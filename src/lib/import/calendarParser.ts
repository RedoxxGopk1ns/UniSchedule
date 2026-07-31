/**
 * Reads the department's academic calendar PDF into AcademicEvent rows.
 *
 * Pure, like timetableParser — it consumes the `PdfPage[]` from pdfText.ts, so
 * the tests run it against the real document's geometry.
 *
 * ## How the document is shaped
 *
 * A two-column table: a Greek label on the left, one or two dates on the right.
 *
 *     Αργία 25ης Μαρτίου                     Τετάρτη 25/03/2026
 *     Διακοπές Πάσχα                         Δευτέρα 06/04/2026 έως Παρασκευή
 *                                            17/04/2026
 *
 * The wrap in the second row is the only real difficulty. It is detected by the
 * dangling connector: a date cell that ends on 'έως' / 'μέχρι και' or on a bare
 * weekday name is still open, so the next line continues it rather than
 * starting a new entry.
 */
import type { AcademicEventInput, AcademicEventKind, SemesterInput } from '../data/types'
import { findDates, foldGreek } from './greek'
import type { PdfItem, PdfPage } from './pdfText'

export interface ParsedAcademicEvent extends AcademicEventInput {
  key: string
  warnings: string[]
}

export interface ParsedCalendar {
  events: ParsedAcademicEvent[]
  /**
   * Start and end of the spring term, taken from its 'Έναρξη μαθημάτων εαρινού'
   * and 'Λήξη Μαθημάτων Εαρινού' rows — what the Import screen offers as the
   * semester to create.
   */
  springSemester: SemesterInput | null
  warnings: string[]
}

/** Keyword to event kind, tried in order — the first match wins. */
const KIND_RULES: [RegExp, AcademicEventKind][] = [
  [/ΑΡΓΙΑ/, 'holiday'],
  [/ΔΙΑΚΟΠΕΣ/, 'break'],
  [/ΕΞΕΤΑΣΤΙΚ/, 'exam_period'],
  [/ΑΝΑΠΛΗΡΩΣ/, 'makeup_week'],
  [/ΠΑΡΟΥΣΙΑΣΕΙΣ|ΠΤΥΧΙΑΚ/, 'presentations'],
  [/ΕΝΑΡΞΗ\s+ΜΑΘΗΜΑΤΩΝ/, 'teaching_start'],
  [/ΛΗΞΗ\s+ΜΑΘΗΜΑΤΩΝ/, 'teaching_end'],
]

/**
 * Which kinds actually cancel lectures.
 *
 * Make-up weeks and thesis presentations add sessions rather than removing
 * them, and the date markers only record a boundary. 'other' stays false on
 * purpose: a row nobody understood must not silently delete a student's
 * classes — the admin can tick it in the review table.
 */
const BLOCKS_TEACHING: Record<AcademicEventKind, boolean> = {
  holiday: true,
  break: true,
  exam_period: true,
  makeup_week: false,
  teaching_start: false,
  teaching_end: false,
  presentations: false,
  other: false,
}

function classify(label: string): AcademicEventKind {
  const folded = foldGreek(label)
  for (const [pattern, kind] of KIND_RULES) {
    if (pattern.test(folded)) return kind
  }
  return 'other'
}

/**
 * True when a date cell has been cut off mid-phrase and the rest of it is on
 * the following line: '… 06/04/2026 έως Παρασκευή' with the second date to come.
 */
function isOpen(dateText: string): boolean {
  const folded = foldGreek(dateText)
  return /(ΕΩΣ|ΜΕΧΡΙ|ΚΑΙ|ΔΕΥΤΕΡΑ|ΤΡΙΤΗ|ΤΕΤΑΡΤΗ|ΠΕΜΠΤΗ|ΠΑΡΑΣΚΕΥΗ|-)\s*$/.test(folded)
}

/** Joins runs on one line, adding a space only where the PDF left one. */
function joinItems(items: PdfItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  let text = ''
  let prevEnd: number | null = null
  for (const item of sorted) {
    if (prevEnd !== null && item.x - prevEnd > 1.2) text += ' '
    text += item.text
    prevEnd = item.x + item.w
  }
  return text.replace(/\s+/g, ' ').trim()
}

export function parseAcademicCalendar(pages: PdfPage[]): ParsedCalendar {
  const warnings: string[] = []
  const items = pages.flatMap((p) => p.items)

  // The date column starts at the leftmost date on the page; everything to the
  // left of it is label. Deriving it from the content rather than hard-coding a
  // fraction of the page width keeps this working if the table is re-laid out.
  const dateItems = items.filter((i) => findDates(i.text).length > 0)
  if (dateItems.length === 0) {
    return {
      events: [],
      springSemester: null,
      warnings: ['No dates were found in this PDF — is it the academic calendar?'],
    }
  }
  const split = Math.min(...dateItems.map((i) => i.x)) - 6

  // Lines, tolerating the superscripts in '28ης' and '202ης' which sit a point
  // or two above their neighbours.
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: PdfItem[][] = []
  for (const item of sorted) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(item.y - last[0].y) <= 4) last.push(item)
    else rows.push([item])
  }

  const events: ParsedAcademicEvent[] = []
  let open: { event: ParsedAcademicEvent; dateText: string } | null = null

  for (const row of rows) {
    const label = joinItems(row.filter((i) => i.x < split))
    const dateText = joinItems(row.filter((i) => i.x >= split))
    const dates = findDates(dateText)

    if (open) {
      // Continuation of the previous row: both halves may carry a tail.
      if (label !== '') open.event.title = `${open.event.title} ${label}`.trim()
      open.dateText = `${open.dateText} ${dateText}`.trim()
      const all = findDates(open.dateText)
      applyDates(open.event, all)
      if (!isOpen(open.dateText) || all.length >= 2) open = null
      continue
    }

    // A row with no dates before any entry has started is the letterhead, and
    // one after the table has ended is the closing note. Neither is an event.
    if (dates.length === 0) continue
    if (label === '') {
      warnings.push(`A date with no label was skipped: ${dateText}`)
      continue
    }

    const kind = classify(label)
    const event: ParsedAcademicEvent = {
      key: `cal-${events.length}`,
      semester: null,
      kind,
      title: label.replace(/\s+/g, ' ').trim(),
      start_date: dates[0],
      end_date: dates[dates.length - 1],
      blocks_teaching: BLOCKS_TEACHING[kind],
      warnings: kind === 'other' ? ['This row was not recognised — check its type.'] : [],
    }
    applyDates(event, dates)
    events.push(event)

    if (dates.length < 2 && isOpen(dateText)) open = { event, dateText }
  }

  return { events, springSemester: springSemester(events), warnings }
}

function applyDates(event: ParsedAcademicEvent, dates: string[]): void {
  if (dates.length === 0) return
  event.start_date = dates[0]
  event.end_date = dates[dates.length - 1]
  if (event.end_date < event.start_date) {
    // Out of order in the source; swap rather than reject, and say so.
    const swap = event.start_date
    event.start_date = event.end_date
    event.end_date = swap
    event.warnings.push('The dates were the wrong way round and have been swapped.')
  }
}

/** Pulls the spring term's teaching window out of the parsed rows. */
function springSemester(events: ParsedAcademicEvent[]): SemesterInput | null {
  const spring = (e: ParsedAcademicEvent) => /ΕΑΡΙΝ/.test(foldGreek(e.title))
  const start = events.find((e) => e.kind === 'teaching_start' && spring(e))
  const end = events.find((e) => e.kind === 'teaching_end' && spring(e))
  if (!start || !end) return null
  return {
    // Named for the calendar year the term is taught in, matching the existing
    // 'Spring 2026' convention in the seed catalogue.
    name: `Spring ${start.start_date.slice(0, 4)}`,
    start_date: start.start_date,
    end_date: end.end_date,
    time_zone: 'Europe/Athens',
  }
}
