import { describe, expect, it } from 'vitest'
import { parseAcademicCalendar } from './calendarParser'
import { findDates, parseGreekDate, parseSemesterHeading } from './greek'
import fixture from './__fixtures__/calendar.json'
import type { PdfPage } from './pdfText'

/**
 * Run against the university's real academic calendar PDF — the positioned
 * text of Ακαδημαϊκός Προγραμματισμός ΤΠΤ_ΠΠΣ 2025-2026.pdf, dumped by
 * `npm run import:fixtures`.
 */
const pages = fixture as PdfPage[]
const parsed = parseAcademicCalendar(pages)

const byTitle = (fragment: string) => parsed.events.find((e) => e.title.includes(fragment))

describe('parseAcademicCalendar', () => {
  it('reads every row of the table', () => {
    expect(parsed.events).toHaveLength(24)
  })

  it('reads a single-day entry as a one-day range', () => {
    const holiday = byTitle('25ης Μαρτίου')
    expect(holiday?.kind).toBe('holiday')
    expect(holiday?.start_date).toBe('2026-03-25')
    // Inclusive range: a single day repeats itself, so consumers never have to
    // special-case it.
    expect(holiday?.end_date).toBe('2026-03-25')
    expect(holiday?.blocks_teaching).toBe(true)
  })

  it('follows a date cell that wrapped onto the next line', () => {
    // 'Δευτέρα 06/04/2026 έως Παρασκευή' / '17/04/2026'
    const easter = byTitle('Διακοπές Πάσχα')
    expect(easter?.start_date).toBe('2026-04-06')
    expect(easter?.end_date).toBe('2026-04-17')
  })

  it('follows a wrap where the label continues too', () => {
    // 'Εβδομάδα αναπληρώσεων μαθημάτων,' / 'εργαστηρίων κλπ' with the second
    // date on the continuation line.
    const makeup = parsed.events.find(
      (e) => e.kind === 'makeup_week' && e.start_date === '2026-06-08',
    )
    expect(makeup?.end_date).toBe('2026-06-12')
    expect(makeup?.title).toContain('εργαστηρίων')
  })

  it('handles the μέχρι και connector as well as έως', () => {
    const january = parsed.events.find(
      (e) => e.kind === 'makeup_week' && e.start_date === '2026-01-19',
    )
    expect(january?.end_date).toBe('2026-01-23')
  })

  it('classifies each row from its Greek label', () => {
    expect(byTitle('Αργία Καθαράς Δευτέρας')?.kind).toBe('holiday')
    expect(byTitle('Χριστουγέννων')?.kind).toBe('break')
    expect(byTitle('Έναρξη Εξεταστικής Περιόδου εαρινού')?.kind).toBe('exam_period')
    expect(byTitle('Παρουσιάσεις')?.kind).toBe('presentations')
    expect(byTitle('Έναρξη μαθημάτων εαρινού')?.kind).toBe('teaching_start')
    expect(byTitle('Λήξη Μαθημάτων Εαρινού')?.kind).toBe('teaching_end')
  })

  it('only cancels teaching for the kinds that actually do', () => {
    expect(byTitle('Αργία Πρωτομαγιάς')?.blocks_teaching).toBe(true)
    expect(byTitle('Διακοπές Πάσχα')?.blocks_teaching).toBe(true)
    // A make-up week adds sessions, and the date markers cancel nothing.
    expect(byTitle('αναπληρώσεων')?.blocks_teaching).toBe(false)
    expect(byTitle('Έναρξη μαθημάτων εαρινού')?.blocks_teaching).toBe(false)
    expect(byTitle('Παρουσιάσεις')?.blocks_teaching).toBe(false)
  })

  it('proposes the spring term from its own teaching boundaries', () => {
    expect(parsed.springSemester).toEqual({
      name: 'Spring 2026',
      // A Tuesday — the day after Καθαρά Δευτέρα.
      start_date: '2026-02-24',
      end_date: '2026-06-05',
      time_zone: 'Europe/Athens',
    })
  })

  it('skips the letterhead and the closing note', () => {
    expect(parsed.events.some((e) => e.title.includes('ΧΑΡΟΚΟΠΕΙΟ'))).toBe(false)
    expect(parsed.events.some((e) => e.title.includes('ενημερώνουμε'))).toBe(false)
  })

  it('never emits a backwards range', () => {
    for (const e of parsed.events) {
      expect(e.end_date >= e.start_date).toBe(true)
    }
  })

  it('says so when handed the wrong document', () => {
    const result = parseAcademicCalendar([{ width: 100, height: 100, items: [] }])
    expect(result.events).toEqual([])
    expect(result.warnings[0]).toContain('No dates')
  })
})

describe('greek helpers', () => {
  it('parses a Greek date and rejects an impossible one', () => {
    expect(parseGreekDate('25/03/2026')).toBe('2026-03-25')
    expect(parseGreekDate('6/4/2026')).toBe('2026-04-06')
    // Date would roll 31 February into March; round-tripping catches it.
    expect(parseGreekDate('31/02/2026')).toBeNull()
    expect(parseGreekDate('not a date')).toBeNull()
  })

  it('finds every date in a line, in order', () => {
    expect(findDates('Δευτέρα 06/04/2026 έως Παρασκευή 17/04/2026')).toEqual([
      '2026-04-06',
      '2026-04-17',
    ])
  })

  it('reads the semester number from a sheet heading', () => {
    expect(parseSemesterHeading("ΣΤ' ΕΞΑΜΗΝΟ (6ο)")).toBe(6)
    expect(parseSemesterHeading("Β' ΕΞΑΜΗΝΟ (2ο)")).toBe(2)
    expect(parseSemesterHeading('ΠΡΟΓΡΑΜΜΑ ΜΑΘΗΜΑΤΩΝ')).toBeNull()
  })
})
