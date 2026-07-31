import { describe, expect, it } from 'vitest'
import { deriveCourseCode, deriveCourseCodes } from './courseCode'
import fixture from './__fixtures__/timetable.json'
import type { PdfPage } from './pdfText'
import { guessSubject, parseTimetable } from './timetableParser'

/**
 * Run against the university's real timetable PDF.
 *
 * The fixture is the positioned text of ΠΡΟΓΡΑΜΜΑ ΠΠΣ ΕΑΡΙΝΟ 2025-2026.pdf,
 * dumped by `npm run import:fixtures`. Testing against synthetic geometry would
 * prove nothing: every difficulty in this parser — merged cells, two courses
 * sharing a day column, a professor's surname on the next line — comes from how
 * that document is actually laid out.
 */
const pages = fixture as PdfPage[]
const parsed = parseTimetable(pages, { semester: 'Spring 2026' })

const find = (name: string, day?: string) =>
  parsed.lectures.find(
    (l) => l.course_name.includes(name) && (day === undefined || l.day_of_week === day),
  )

describe('parseTimetable', () => {
  it('reads one sheet per semester and maps it to a year of study', () => {
    expect(parsed.sheets.map((s) => s.semesterNumber)).toEqual([2, 4, 6, 8])
    expect(parsed.sheets.map((s) => s.studyYear)).toEqual([1, 2, 3, 4])
  })

  it('finds every lecture in the document', () => {
    expect(parsed.lectures).toHaveLength(43)
    expect(parsed.sheets.map((s) => s.lectures.length)).toEqual([11, 8, 15, 9])
  })

  it('gives every row a day, a time inside the grid, and a semester', () => {
    for (const l of parsed.lectures) {
      expect(l.semester).toBe('Spring 2026')
      expect(l.start_time < l.end_time).toBe(true)
      expect(l.department).toBe('Πληροφορικής και Τηλεματικής')
    }
  })

  it('recovers a multi-hour block from its >> continuation markers', () => {
    // Nothing in the PDF states a duration; the merged cell is marked by a '>>'
    // typed into each further hour row.
    const ml = find('Μηχανική Μάθηση')
    expect(ml?.day_of_week).toBe('Monday')
    expect(ml?.start_time).toBe('15:00')
    expect(ml?.end_time).toBe('18:00')

    // Six hours on the 4th-semester Thursday — the document really does say so.
    const db = find('Βάσεις Δεδομένων', 'Thursday')
    expect(db?.start_time).toBe('09:00')
    expect(db?.end_time).toBe('15:00')
  })

  it('splits two courses that share one day column', () => {
    // Monday 12:00-15:00 on the 6th-semester sheet carries two cells side by
    // side. They are the deliberate clash the app's conflict warning demos.
    const monday = parsed.lectures.filter(
      (l) => l.day_of_week === 'Monday' && l.start_time === '12:00' && l.study_year === 3,
    )
    expect(monday.map((l) => l.course_name).sort()).toEqual([
      'Εφαρμογές Τηλεματικής στις Μεταφορές και την Υγεία',
      'Προγραμματισμός Συστημάτων',
    ])
  })

  it('keeps consecutive lab groups apart and names them', () => {
    const groups = parsed.lectures.filter((l) => l.course_name.includes('Ομάδα'))
    expect(groups.map((l) => l.course_name)).toEqual([
      'Προγραμματισμός ΙΙ — Ομάδα 1',
      'Προγραμματισμός ΙΙ — Ομάδα 2',
      'Προγραμματισμός ΙΙ — Ομάδα 3',
    ])
    // Three back-to-back one-hour slots, which is what the geometry says.
    expect(groups.map((l) => l.start_time)).toEqual(['09:00', '10:00', '11:00'])
  })

  it('reads the (Υ) / (Ε) legend where the sheet carries one', () => {
    // Αλγόριθμοι runs in both the 4th and the 6th semester, on the same
    // weekday. Only the 6th-semester sheet carries the legend that marks it
    // required, so the year is what tells the two apart.
    const sixth = parsed.lectures.find(
      (l) => l.course_name.startsWith('Αλγόριθμοι') && l.study_year === 3,
    )
    const fourth = parsed.lectures.find(
      (l) => l.course_name.startsWith('Αλγόριθμοι') && l.study_year === 2,
    )
    expect(sixth?.is_mandatory).toBe(true)
    expect(fourth?.is_mandatory).toBe(false)
    expect(find('Μηχανική Μάθηση')?.is_mandatory).toBe(false)
    // The course name keeps neither marker.
    expect(sixth?.course_name).toBe('Αλγόριθμοι και Πολυπλοκότητα')
  })

  it('says so when a sheet marks no required courses at all', () => {
    // Only the 6th-semester sheet has the legend; silently calling a whole year
    // optional would be worse than saying nothing.
    const second = parsed.sheets.find((s) => s.semesterNumber === 2)
    expect(second?.warnings.some((w) => w.includes('(Υ)'))).toBe(true)
  })

  it('rejoins a room that wrapped onto a second line', () => {
    expect(find('Ψηφιακή Επεξεργασία')?.room).toBe('Αίθουσα 2.3 + εργ. 2ου ορόφου')
  })

  it('reads a room written without parentheses', () => {
    // The 4th-semester sheet writes 'Αίθουσα 3.7' bare.
    expect(find('Μεθοδολογία')?.room).toBe('Αίθουσα 3.7')
    expect(find('Μεθοδολογία')?.course_name).toBe('Μεθοδολογία Επιστημονικής Έρευνας')
  })

  it('rejoins a professor list cut after an initial', () => {
    // 'Η. Βαρλάμης, Β.' / 'Ευθυμίου' across two lines.
    expect(find('Βάσεις Δεδομένων', 'Friday')?.professor).toBe('Η. Βαρλάμης, Β. Ευθυμίου')
  })

  it('rejoins Εξωτερικός / Διδάσκων when the layout splits it', () => {
    const lab = parsed.lectures.find(
      (l) =>
        l.course_name === 'Προγραμματισμός Συστημάτων' &&
        l.start_time === '12:00',
    )
    expect(lab?.professor).toBe('Εξωτερικός Διδάσκων')
  })

  it('accepts a Latin initial in a Greek name', () => {
    // The 2nd-semester sheet types the A of 'A. Χαραλαμπίδης' as a Latin A.
    expect(find('Αντικειμενοστρεφής', 'Monday')?.professor).toBe(
      'Κ. Μπαρδάκη, A. Χαραλαμπίδης',
    )
  })

  it('honours an inline start-time note and flags it', () => {
    const oop = find('Αντικειμενοστρεφής', 'Monday')
    expect(oop?.start_time).toBe('09:30')
    expect(oop?.warnings.some((w) => w.includes('09:30'))).toBe(true)
  })

  it('drops the room legend and the footnotes under the table', () => {
    const names = parsed.lectures.map((l) => l.course_name)
    expect(names.some((n) => n.includes('Ελ. Βενιζέλου'))).toBe(false)
    expect(names.some((n) => n.includes('Γραμματεία'))).toBe(false)
    expect(names.some((n) => n.startsWith('Υ='))).toBe(false)
  })

  it('assigns a subject to every row', () => {
    expect(parsed.lectures.every((l) => l.subject !== null)).toBe(true)
  })
})

describe('guessSubject', () => {
  it('picks the more specific rule when several could match', () => {
    // 'Ασφάλεια στον Παγκόσμιο Ιστό' contains 'Ιστού'-adjacent wording, but
    // security wins because its rule comes first.
    expect(guessSubject('Ασφάλεια στον Παγκόσμιο Ιστό')).toBe('Ασφάλεια')
    expect(guessSubject('Μηχανική Μάθηση και Εφαρμογές')).toBe('Τεχνητή νοημοσύνη')
  })

  it('returns null for something it does not recognise', () => {
    expect(guessSubject('Χορός και Κίνηση')).toBeNull()
  })
})

describe('deriveCourseCode', () => {
  it('transliterates the name and prefixes the semester', () => {
    expect(deriveCourseCode(6, 'Μηχανική Μάθηση και Εφαρμογές')).toBe(
      'TPT6-MICHANIKI-MATHISI',
    )
    // ΝΤ stays as NT: mapping it to D turned this into 'ADIKEIMENOSTREFIS'.
    expect(deriveCourseCode(2, 'Αντικειμενοστρεφής Προγραμματισμός Ι')).toBe(
      'TPT2-ANTIKEIMENOSTREFIS-PROGRAMMATISMOS',
    )
  })

  it('is deterministic, so re-importing updates rather than duplicates', () => {
    expect(deriveCourseCode(4, 'Βάσεις Δεδομένων')).toBe(
      deriveCourseCode(4, 'Βάσεις Δεδομένων'),
    )
  })
})

describe('deriveCourseCodes', () => {
  const codes = deriveCourseCodes(parsed.lectures)

  it('gives every lecture a code', () => {
    expect(codes).toHaveLength(parsed.lectures.length)
    expect(codes.every((c) => c.trim() !== '')).toBe(true)
  })

  it('keeps the sections of one course on the same code', () => {
    // Passing a course must hide all of its sections, so lab groups and the
    // lecture that owns them share a code.
    const groups = parsed.lectures
      .map((l, i) => ({ name: l.course_name, code: codes[i]! }))
      .filter((x) => x.name.startsWith('Προγραμματισμός ΙΙ'))
    expect(new Set(groups.map((g) => g.code)).size).toBe(1)
  })

  it('separates two different courses that shorten alike', () => {
    // Πληροφοριακά Συστήματα exists in both the 6th and the 8th semester.
    const both = parsed.lectures
      .map((l, i) => ({ l, code: codes[i]! }))
      .filter((x) => x.l.course_name.startsWith('Πληροφοριακά Συστήματα'))
    expect(both.length).toBeGreaterThan(1)
    expect(new Set(both.map((b) => b.code)).size).toBe(both.length)
  })
})
