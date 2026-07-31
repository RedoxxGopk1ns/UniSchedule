/**
 * Course codes for imported lectures.
 *
 * The timetable PDF carries no codes at all — courses are identified only by
 * their Greek name — but `lectures.course_code` is not null and is what passed
 * courses, search and the year heuristic all key on. So the importer mints one
 * per course and the admin review table lets it be overwritten before anything
 * is saved.
 *
 * The generated form is deterministic: the same course name in the same
 * semester always yields the same code, so re-importing an amended PDF updates
 * rows rather than duplicating them.
 */
import { latinise } from './greek'

/** Words that carry no meaning in a code. */
const STOP_WORDS = new Set([
  'KAI',
  'STIS',
  'TIS',
  'TIN',
  'TON',
  'TOU',
  'TO',
  'I',
  'O',
  'THS',
  'STO',
  'STON',
])

/**
 * 'Μηχανική Μάθηση και Εφαρμογές' in semester 6 -> 'TPT6-MICHANIKI-MATHISI'.
 *
 * Two significant words is enough to stay readable and unique in practice;
 * `deriveCourseCodes` resolves the rare collision.
 */
export function deriveCourseCode(
  semesterNumber: number | null,
  courseName: string,
): string {
  const words = latinise(courseName)
    .split(/[^A-Z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 2)

  const prefix = semesterNumber === null ? 'TPT' : `TPT${semesterNumber}`
  if (words.length === 0) return prefix
  return `${prefix}-${words.join('-')}`
}

/**
 * Assigns a code to every row, keeping rows that share a course name (lab
 * groups, a lecture split across two days) on the *same* code — that is what
 * makes "passed this course" work — while separating genuinely different
 * courses that happen to shorten to the same string.
 */
export function deriveCourseCodes<
  T extends { course_name: string; source?: { semesterNumber: number | null } },
>(rows: T[], semesterOf?: (row: T) => number | null): string[] {
  const byCourse = new Map<string, string>()
  const used = new Set<string>()

  return rows.map((row) => {
    const semester = semesterOf ? semesterOf(row) : (row.source?.semesterNumber ?? null)
    // Lab groups of one course share a code: 'Προγραμματισμός ΙΙ — Ομάδα 1' and
    // '… — Ομάδα 2' are the same course as far as the curriculum is concerned.
    const base = row.course_name.split('—')[0].trim()
    const identity = `${semester ?? ''}:${base}`

    const seen = byCourse.get(identity)
    if (seen) return seen

    const wanted = deriveCourseCode(semester, base)
    let code = wanted
    let n = 2
    while (used.has(code)) code = `${wanted}-${n++}`

    used.add(code)
    byCourse.set(identity, code)
    return code
  })
}
