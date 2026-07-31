/**
 * Reads the department's weekly timetable PDF into LectureInput rows.
 *
 * Pure: it takes the `PdfPage[]` that pdfText.ts produces and never touches a
 * PDF library, so the tests run it against the university's real page geometry
 * from src/lib/import/__fixtures__/timetable.json.
 *
 * ## How the document is shaped
 *
 * Each page is one semester's grid: a left-hand ΩΡΕΣ column of hour labels
 * ('09-10' … '18-19'), then five day columns. A lecture occupying several hours
 * is a merged cell whose text sits in its *first* hour row, with a literal '>>'
 * typed into every further row it covers. Those markers are what recovers the
 * end time — nothing else in the document states a lecture's duration.
 *
 * A cell reads:
 *
 *     Μηχανική Μάθηση και Εφαρμογές (Ε)     course name, (Υ)=required (Ε)=elective
 *                  Χ. Δίου                   professor(s)
 *               (Αμφιθέατρο)                 room, parenthesised
 *
 * ## What it cannot do
 *
 * There are no course codes anywhere in the PDF, and cells are free text laid
 * out by hand, so some will come out wrong. Every block therefore carries its
 * own `warnings`, and nothing here throws: the admin review table is what turns
 * a good-enough parse into correct data.
 */
import type { DayOfWeek, LectureInput } from '../data/types'
import { fromMinutes } from '../time'
import { foldGreek, parseSemesterHeading } from './greek'
import type { PdfItem, PdfPage } from './pdfText'

/** A lecture as parsed, with everything the review UI needs to flag it. */
export interface ParsedLecture extends LectureInput {
  /** Stable within one parse — used as a React key before the row has an id. */
  key: string
  warnings: string[]
  /** Which page and cell it came from, so the admin can find it in the PDF. */
  source: { page: number; semesterNumber: number | null }
}

export interface ParsedSheet {
  /** 1-based, matching the PDF's own page numbering. */
  page: number
  /** 2, 4, 6, 8 … from the "ΣΤ' ΕΞΑΜΗΝΟ (6ο)" heading. */
  semesterNumber: number | null
  studyYear: number | null
  lectures: ParsedLecture[]
  warnings: string[]
}

export interface ParsedTimetable {
  sheets: ParsedSheet[]
  lectures: ParsedLecture[]
}

/** The department every row is attributed to. */
export const DEPARTMENT = 'Πληροφορικής και Τηλεματικής'

/**
 * Greyscale by year of study, matching the palette already used by the seed
 * catalogue. §20 rules out blue, purple, gradients and green fills, so the
 * whole scheme is neutral by design.
 */
const COLOR_BY_YEAR: Record<number, string> = {
  1: '#111111',
  2: '#374151',
  3: '#4B5563',
  4: '#6B7280',
}

/**
 * Subject for the catalogue's subject filter.
 *
 * The PDF has no such field — subject is editorial, and the department groups
 * its courses only by semester. These keyword rules are a first guess so the
 * filter is populated after an import rather than empty; the review table is
 * where a wrong one gets corrected. Order matters: the first match wins.
 */
const SUBJECT_RULES: [RegExp, string][] = [
  [/ΑΣΦΑΛΕΙΑ|ΚΡΥΠΤΟΓΡΑΦ/, 'Ασφάλεια'],
  [/ΜΗΧΑΝΙΚΗ ΜΑΘΗΣΗ|ΕΙΚΟΝΑΣ|ΦΥΣΙΚΗΣ ΓΛΩΣΣΑΣ|ΝΟΗΜΟΣΥΝΗ/, 'Τεχνητή νοημοσύνη'],
  [/ΒΑΣΕΙΣ ΔΕΔΟΜΕΝΩΝ|ΑΝΑΚΤΗΣΗ ΠΛΗΡΟΦΟΡΙΑΣ|ΟΓΚΟΥ ΔΕΔΟΜΕΝΩΝ/, 'Δεδομένα'],
  [/ΔΙΚΤΥ|ΤΗΛΕΠΙΚΟΙΝΩΝ|ΔΙΑΔΙΚΤΥΟ|ΤΗΛΕΜΑΤΙΚ|ΝΕΦΟΥΣ|ΥΠΗΡΕΣΙΕΣ ΚΑΙ ΣΥΣΤΗΜΑΤΑ/, 'Δίκτυα και τηλεπικοινωνίες'],
  [/ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΣ|ΜΕΤΑΓΛΩΤΤΙΣΤΕΣ|ΑΝΤΙΚΕΙΜΕΝΟΣΤΡΕΦ/, 'Προγραμματισμός'],
  [/ΑΛΓΟΡΙΘΜΟΙ|ΠΟΛΥΠΛΟΚΟΤΗΤΑ|ΜΑΘΗΜΑΤΙΚΑ|ΠΙΘΑΝΟΤΗΤΕΣ|ΣΤΑΤΙΣΤΙΚ/, 'Αλγόριθμοι και μαθηματικά'],
  [/ΠΛΗΡΟΦΟΡΙΑΚΑ ΣΥΣΤΗΜΑΤΑ|ΕΠΙΧΕΙΡΕΙΝ|ΑΠΟΤΙΜΗΣΗ|ΑΠΟΦΑΣΕΩΝ|ΛΟΓΙΣΜΙΚΟΥ|ΙΣΤΟΥ/, 'Πληροφοριακά συστήματα'],
  [/ΑΡΧΙΤΕΚΤΟΝΙΚΗ|ΠΑΡΑΛΛΗΛΕΣ|ΣΗΜΑΤΑ|ΗΛΕΚΤΡΟΝΙΚΗΣ|ΠΡΟΣΟΜΟΙΩΣΗ|ΣΥΣΤΗΜΑΤΩΝ/, 'Συστήματα και υλικό'],
  [/ΔΙΔΑΚΤΙΚΗ|ΠΑΙΔΑΓΩΓΙΚ|ΨΥΧΟΛΟΓΙΑ|ΚΟΙΝΩΝΙΑ|ΜΕΘΟΔΟΛΟΓΙΑ|ΕΡΕΥΝΑΣ/, 'Εκπαίδευση και κοινωνία'],
]

export function guessSubject(courseName: string): string | null {
  const folded = foldGreek(courseName)
  for (const [pattern, subject] of SUBJECT_RULES) {
    if (pattern.test(folded)) return subject
  }
  return null
}

// --- Geometry helpers ------------------------------------------------------

/** Items on one visual line, left to right. */
interface Line {
  y: number
  h: number
  x0: number
  x1: number
  text: string
}

/** A contiguous run of lines forming one table cell. */
interface Block {
  lines: Line[]
  x0: number
  x1: number
  top: number
  bottom: number
}

const HOUR_LABEL = /^(\d{1,2})\s*-\s*(\d{1,2})$/
const CONTINUATION = '>>'

/** Joins runs on the same line, inserting a space only where one is missing. */
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

/**
 * Groups items into lines, then splits each line wherever a horizontal gap is
 * wide enough to be a cell boundary rather than a word space. This is what
 * separates two courses sitting side by side in the same day column.
 */
function toSegments(items: PdfItem[]): Line[] {
  const byY = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: PdfItem[][] = []
  for (const item of byY) {
    const last = rows[rows.length - 1]
    // Same line when the baselines are within a third of a line height — the
    // superscript in '(6ο)' sits a hair above its neighbours.
    if (last && Math.abs(item.y - last[0].y) <= Math.max(3, item.h / 3)) {
      last.push(item)
    } else {
      rows.push([item])
    }
  }

  const lines: Line[] = []
  for (const row of rows) {
    const sorted = row.sort((a, b) => a.x - b.x)
    let group: PdfItem[] = []
    const flush = () => {
      if (group.length === 0) return
      const text = joinItems(group)
      if (text !== '') {
        lines.push({
          y: group[0].y,
          h: Math.max(...group.map((i) => i.h)),
          x0: Math.min(...group.map((i) => i.x)),
          x1: Math.max(...group.map((i) => i.x + i.w)),
          text,
        })
      }
      group = []
    }
    for (const item of sorted) {
      const prev = group[group.length - 1]
      if (prev && item.x - (prev.x + prev.w) > 12) flush()
      group.push(item)
    }
    flush()
  }
  return lines.sort((a, b) => a.y - b.y || a.x0 - b.x0)
}

/**
 * Column boundaries between the six header labels.
 *
 * Header text is centred over its column but cells are not, so the midpoint
 * between two headers is not the divider — on the 6th-semester sheet a Monday
 * cell reaches 80 points left of the ΔΕΥΤΕΡΑ centre. Instead the widest strip
 * of blank page between two headers is taken as the divider, falling back to
 * the midpoint only where a column is empty and there is nothing to separate.
 */
function columnBoundaries(centres: number[], body: PdfItem[]): number[] {
  const bounds: number[] = []
  for (let k = 0; k < centres.length - 1; k++) {
    const lo = centres[k]
    const hi = centres[k + 1]
    const spans = body
      .map((i): [number, number] => [i.x, i.x + i.w])
      .filter(([a, b]) => b > lo && a < hi)
      .sort((a, b) => a[0] - b[0])

    const merged: [number, number][] = []
    for (const [a, b] of spans) {
      const last = merged[merged.length - 1]
      if (last && a <= last[1] + 0.5) last[1] = Math.max(last[1], b)
      else merged.push([a, b])
    }

    let best: number | null = null
    let widest = -1
    for (let j = 1; j < merged.length; j++) {
      const gap = merged[j][0] - merged[j - 1][1]
      const mid = (merged[j][0] + merged[j - 1][1]) / 2
      if (mid > lo && mid < hi && gap > widest) {
        widest = gap
        best = mid
      }
    }
    bounds.push(best ?? (lo + hi) / 2)
  }
  return bounds
}

// --- Cell content ----------------------------------------------------------

// 'Δ. Μιχαήλ', 'Θ.Καμαλάκης', 'Τ. Σταμάτη/Γ. Δέδε', 'Χ. Σοφιανοπούλου,'.
// Latin capitals are allowed because the source document mixes them in: the
// 'A' of 'A. Χαραλαμπίδης' on the 2nd-semester sheet is a Latin A.
const PROFESSOR_INITIAL = /^[Α-ΩΆΈΉΊΌΎΏA-Z]\s*\.\s*\S/
const EXTERNAL = /ΕΞΩΤ|ΔΙΔΑΣΚ(ΩΝ|ΟΥΣΑ)/
/** A line that is only an initial or a trailing comma — its surname wrapped. */
const DANGLING_NAME = /(^|[\s,/])[Α-ΩΆΈΉΊΌΎΏA-Z]\s*\.\s*$|,\s*$/
const ROOM_WORDS = /ΑΙΘΟΥΣΑ|ΑΜΦΙΘΕΑΤΡΟ|ΕΡΓΑΣΤΗΡΙ|ΕΡΓ\.|ΟΡΟΦΟΥ/

function looksLikeProfessor(line: string): boolean {
  const folded = foldGreek(line)
  if (EXTERNAL.test(folded)) return true
  return PROFESSOR_INITIAL.test(line.trim())
}

function looksLikeRoom(line: string): boolean {
  const folded = foldGreek(line)
  if (!ROOM_WORDS.test(folded)) return false
  // Usually parenthesised, but the 4th-semester sheet writes a bare
  // 'Αίθουσα 3.7', so a line that *starts* with a room word counts too.
  return line.trimStart().startsWith('(') || /^(ΑΙΘΟΥΣΑ|ΑΜΦΙΘΕΑΤΡΟ|ΕΡΓ)/.test(folded)
}

/**
 * Rejoins lines the layout broke apart, before anything is classified.
 *
 * Three cases occur in the real documents: a room whose parenthesis is still
 * open ('(Αίθουσα 2.3 + εργ. 2ου' / 'ορόφου)'), a professor list cut after an
 * initial ('Η. Βαρλάμης, Β.' / 'Ευθυμίου'), and 'Εξωτερικός' / 'Διδάσκων' split
 * over two lines.
 */
function rejoinWrappedLines(lines: string[]): string[] {
  const out: string[] = []
  for (const raw of lines) {
    const prev = out[out.length - 1]
    const merge = () => {
      out[out.length - 1] = `${prev} ${raw}`.replace(/\s+/g, ' ').trim()
    }
    if (prev !== undefined) {
      if (parenDepth(prev) > 0) {
        merge()
        continue
      }
      if (looksLikeProfessor(prev) && DANGLING_NAME.test(prev) && !looksLikeRoom(raw)) {
        merge()
        continue
      }
      if (/^ΕΞΩΤ\.?(ΕΡΙΚΟΣ|ΕΡΙΚΗ)?$/.test(foldGreek(prev)) && /ΔΙΔΑΣΚ/.test(foldGreek(raw))) {
        merge()
        continue
      }
    }
    out.push(raw)
  }
  return out
}

/** Counts unbalanced '(' so a room split across two lines can be rejoined. */
function parenDepth(line: string): number {
  let depth = 0
  for (const ch of line) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
  }
  return depth
}

interface CellContent {
  course_name: string
  professor: string
  room: string | null
  is_mandatory: boolean
  /** Set when the cell carries an inline '(έναρξη 9.30)' note. */
  startOverride: string | null
  warnings: string[]
}

function readCell(lines: string[]): CellContent {
  const warnings: string[] = []
  let is_mandatory = false
  let startOverride: string | null = null

  const joined = rejoinWrappedLines(lines)

  const nameParts: string[] = []
  const professors: string[] = []
  const rooms: string[] = []
  let group: string | null = null

  for (let line of joined) {
    // '(έναρξη 9.30)' — a one-off start time written into the cell.
    const startNote = line.match(/έναρξη\s*(\d{1,2})[.:](\d{2})/i)
    if (startNote) {
      const h = Number(startNote[1])
      const m = Number(startNote[2])
      startOverride = fromMinutes(h * 60 + m)
      warnings.push(`The cell says it starts at ${startOverride} — check the time.`)
      line = line.replace(/\(?\s*έναρξη[^)]*\)?/i, '').trim()
      if (line === '') continue
    }

    // Lab group: 'Ομάδα 1'. Kept in the course name so that a student who picks
    // group 2 gets a distinct row, without needing a schema column for it.
    const groupNote = line.match(/Ομάδα\s*(\d+)/i)
    if (groupNote) {
      group = groupNote[1]
      line = line.replace(/Ομάδα\s*\d+/i, '').trim()
      if (line === '') continue
    }

    if (looksLikeRoom(line)) {
      rooms.push(line.replace(/^\(|\)$/g, '').trim())
      continue
    }
    if (looksLikeProfessor(line)) {
      professors.push(line.replace(/,\s*$/, '').trim())
      continue
    }
    nameParts.push(line)
  }

  let course_name = nameParts.join(' ').replace(/\s+/g, ' ').trim()

  // '(Υ)' required / '(Ε)' elective, per the legend on the 6th and 8th sheets.
  if (/\(\s*Υ\s*\)/.test(course_name)) is_mandatory = true
  course_name = course_name.replace(/\(\s*[ΥΕ]\s*\)/g, ' ')

  // Footnote markers refer to notes under the table, not to the course.
  course_name = course_name.replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim()
  course_name = course_name.replace(/^[-–—,\s]+|[-–—,\s]+$/g, '')

  if (group) course_name = `${course_name} — Ομάδα ${group}`

  const professor = professors.join(', ').replace(/\s+/g, ' ').trim()
  if (course_name === '') warnings.push('No course name could be read from this cell.')
  if (professor === '') warnings.push('No professor could be read from this cell.')

  return {
    course_name,
    professor,
    room: rooms.length ? rooms.join(' / ') : null,
    is_mandatory,
    startOverride,
    warnings,
  }
}

// --- The parse -------------------------------------------------------------

export interface TimetableOptions {
  /** The semester name every row is filed under, e.g. 'Spring 2026'. */
  semester: string
}

export function parseTimetable(
  pages: PdfPage[],
  options: TimetableOptions,
): ParsedTimetable {
  const sheets = pages.map((page, index) => parseSheet(page, index + 1, options))
  return { sheets, lectures: sheets.flatMap((s) => s.lectures) }
}

function parseSheet(
  page: PdfPage,
  pageNumber: number,
  options: TimetableOptions,
): ParsedSheet {
  const warnings: string[] = []
  const empty: ParsedSheet = {
    page: pageNumber,
    semesterNumber: null,
    studyYear: null,
    lectures: [],
    warnings,
  }

  // --- Frame: the header row and the hour labels ---------------------------
  const headerItems = ['ΩΡΕΣ', 'ΔΕΥΤΕΡΑ', 'ΤΡΙΤΗ', 'ΤΕΤΑΡΤΗ', 'ΠΕΜΠΤΗ', 'ΠΑΡΑΣΚΕΥΗ'].map(
    (name) => page.items.find((i) => foldGreek(i.text) === name) ?? null,
  )
  if (headerItems.some((h) => h === null)) {
    warnings.push('This page has no timetable header row, so it was skipped.')
    return empty
  }
  const headers = headerItems as PdfItem[]
  const headerY = Math.max(...headers.map((h) => h.y + h.h))

  const hourLabels = page.items
    .filter((i) => HOUR_LABEL.test(i.text) && i.y > headerY)
    .sort((a, b) => a.y - b.y)
  if (hourLabels.length < 2) {
    warnings.push('No hour labels were found on this page, so it was skipped.')
    return empty
  }

  const rows = hourLabels.map((item) => {
    const m = item.text.match(HOUR_LABEL) as RegExpMatchArray
    return { y: item.y + item.h / 2, startHour: Number(m[1]), endHour: Number(m[2]) }
  })
  const firstRowY = rows[0].y
  const lastRowY = rows[rows.length - 1].y

  // Semester heading, e.g. "ΣΤ' ΕΞΑΜΗΝΟ (6ο)" — sits above the header row and
  // is split into several runs by the superscript, so read it as a whole line.
  let semesterNumber: number | null = null
  for (const line of toSegments(page.items.filter((i) => i.y < headerY))) {
    const found = parseSemesterHeading(line.text)
    if (found !== null) {
      semesterNumber = found
      break
    }
  }
  if (semesterNumber === null) {
    warnings.push('The semester heading could not be read; set the year by hand.')
  }
  const studyYear = semesterNumber === null ? null : Math.ceil(semesterNumber / 2)

  // --- Columns -------------------------------------------------------------
  // Only ink level with the hour labels counts towards the dividers: the room
  // legend and the footnotes below the table run right across it.
  const frameItems = page.items.filter((i) => i.y >= firstRowY - 8 && i.y <= lastRowY + 8)
  const bounds = columnBoundaries(
    headers.map((h) => h.x + h.w / 2),
    frameItems,
  )
  // Everything below the last hour row belongs to the legend, not the grid.
  const rowPitch = (lastRowY - firstRowY) / (rows.length - 1)
  const bodyBottom = lastRowY + rowPitch

  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const lectures: ParsedLecture[] = []

  for (let d = 0; d < days.length; d++) {
    // bounds[0] divides the hours column from Monday, so day d sits between
    // bounds[d] and bounds[d + 1] (or the page edge for Friday).
    const left = bounds[d]
    const right = d + 1 < bounds.length ? bounds[d + 1] : page.width
    const items = page.items.filter((i) => {
      const centre = i.x + i.w / 2
      return centre >= left && centre < right && i.y > headerY && i.y <= bodyBottom
    })
    if (items.length === 0) continue

    lectures.push(
      ...parseDay(toSegments(items), {
        day: days[d],
        rows,
        pageNumber,
        semesterNumber,
        studyYear,
        semester: options.semester,
      }),
    )
  }

  if (lectures.length === 0) {
    warnings.push('No lectures were found on this page.')
  } else if (!lectures.some((l) => l.is_mandatory)) {
    // Only the 6th- and 8th-semester sheets carry the (Υ)/(Ε) legend. On the
    // others the document simply does not say, and every row lands on the
    // is_mandatory default — worth saying out loud rather than implying that
    // an entire year of study is optional.
    warnings.push(
      'This page does not mark required courses with (Υ), so every row is set to elective.',
    )
  }
  return { page: pageNumber, semesterNumber, studyYear, lectures, warnings }
}

interface DayContext {
  day: DayOfWeek
  rows: { y: number; startHour: number; endHour: number }[]
  pageNumber: number
  semesterNumber: number | null
  studyYear: number | null
  semester: string
}

function parseDay(segments: Line[], ctx: DayContext): ParsedLecture[] {
  const markers = segments.filter((s) => s.text === CONTINUATION)
  const text = segments.filter((s) => s.text !== CONTINUATION)

  // Lines inside a cell are set solid — about 1.5pt of leading on a 10pt line —
  // while two stacked cells are separated by 13pt or more. Anything up to most
  // of a line height therefore still belongs to the cell above; more than that
  // starts a new one. This is what keeps 'Ομάδα 2' and 'Ομάδα 3' apart.
  const blocks: Block[] = []
  for (const line of text) {
    const fit = blocks.find(
      (b) =>
        line.y - b.bottom <= Math.max(line.h, b.lines[0].h) * 0.9 &&
        // Side-by-side cells never overlap horizontally.
        line.x0 < b.x1 + 6 &&
        line.x1 > b.x0 - 6,
    )
    if (fit) {
      fit.lines.push(line)
      fit.x0 = Math.min(fit.x0, line.x0)
      fit.x1 = Math.max(fit.x1, line.x1)
      fit.bottom = Math.max(fit.bottom, line.y + line.h)
    } else {
      blocks.push({
        lines: [line],
        x0: line.x0,
        x1: line.x1,
        top: line.y,
        bottom: line.y + line.h,
      })
    }
  }

  const out: ParsedLecture[] = []
  for (const block of blocks) {
    // '>>' extends the block downwards: attach every marker below it that lines
    // up horizontally and has no other block in between.
    let extent = block.bottom
    for (const marker of markers) {
      if (marker.y < block.bottom) continue
      const centre = (marker.x0 + marker.x1) / 2
      if (centre < block.x0 - 6 || centre > block.x1 + 6) continue
      const blocked = blocks.some(
        (other) => other !== block && other.top > block.bottom && other.top < marker.y,
      )
      if (blocked) continue
      extent = Math.max(extent, marker.y + marker.h)
    }

    const spanned = ctx.rows.filter((r) => r.y >= block.top - 2 && r.y <= extent + 2)
    if (spanned.length === 0) {
      // Legend and footnote text sits outside every hour row. Dropping it is
      // correct: a real cell always contains its own centred hour label.
      continue
    }

    const cell = readCell(block.lines.map((l) => l.text))
    if (cell.course_name === '' && cell.professor === '') continue

    const startHour = spanned[0].startHour
    const endHour = spanned[spanned.length - 1].endHour
    const warnings = [...cell.warnings]
    if (ctx.studyYear === null) {
      warnings.push('Year of study is unknown because the semester heading was unreadable.')
    }

    out.push({
      key: `p${ctx.pageNumber}-${ctx.day}-${startHour}-${Math.round(block.x0)}`,
      // Filled in by deriveCourseCodes once the whole document is parsed.
      course_code: '',
      course_name: cell.course_name,
      professor: cell.professor,
      room: cell.room,
      day_of_week: ctx.day,
      start_time: cell.startOverride ?? fromMinutes(startHour * 60),
      end_time: fromMinutes(endHour * 60),
      semester: ctx.semester,
      department: DEPARTMENT,
      color_tag: ctx.studyYear === null ? null : (COLOR_BY_YEAR[ctx.studyYear] ?? null),
      subject: guessSubject(cell.course_name),
      is_mandatory: cell.is_mandatory,
      study_year: ctx.studyYear,
      warnings,
      source: { page: ctx.pageNumber, semesterNumber: ctx.semesterNumber },
    })
  }

  return out.sort((a, b) => a.start_time.localeCompare(b.start_time))
}
