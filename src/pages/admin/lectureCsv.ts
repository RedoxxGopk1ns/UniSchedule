import { foldGreek } from '../../lib/import/greek'
import type { Course, DayOfWeek, LectureInput } from '../../lib/data/types'

/**
 * Minimal CSV parser for the bulk lecture importer. Supports double-quoted
 * fields (rooms like "Building A, Room 204" contain commas) and escaped quotes
 * (""). Not a general CSV library — just enough for pasted catalogue data.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  out.push(field)
  return out.map((f) => f.trim())
}

// course_name rather than course_code: a code covers a lecture and its lab
// groups alike, so it cannot say which course a row means. The name can — it is
// the same key the PDF import matches on.
const REQUIRED = ['course_name', 'day_of_week', 'start_time', 'end_time', 'semester']

const DAY_SET = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

/**
 * Title-cases a pasted day so 'monday' and 'MONDAY' import as 'Monday'.
 * Anything that is not a weekday is passed through untouched, to be rejected
 * by validation with the admin's original spelling in the error message.
 */
function normaliseDay(day: string): string {
  const match = DAY_SET.find((d) => d.toLowerCase() === day.trim().toLowerCase())
  return match ?? day
}

/** A parsed row that named a course the catalogue does not have. */
export interface CsvRowError {
  row: number
  course_name: string
}

export interface CsvParseResult {
  rows: LectureInput[]
  /** Rows dropped because their course_name matched no course. */
  unmatched: CsvRowError[]
}

/**
 * Parses pasted CSV into LectureInput rows, resolving each row's `course_name`
 * against the existing catalogue. Throws on a malformed header; per-row
 * validation is left to the importer/Edge Function so that a few bad rows are
 * reported rather than aborting the whole paste.
 *
 * A CSV cannot create a course, for the same reason the PDF import cannot: a
 * course is the stable half of the catalogue and is added by hand. A row naming
 * an unknown course is returned in `unmatched` rather than silently dropped.
 */
export function parseLectureCsv(text: string, courses: Course[]): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length < 2) return { rows: [], unmatched: [] }

  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase())
  for (const key of REQUIRED) {
    if (!header.includes(key)) throw new Error(`CSV is missing required column: ${key}`)
  }

  const col = (row: string[], name: string): string => {
    const idx = header.indexOf(name)
    return idx >= 0 ? (row[idx] ?? '') : ''
  }

  // Folded once rather than per row: the same accent/case/homoglyph handling
  // the PDF matcher uses, so the two agree on what counts as the same title.
  const byTitle = new Map(courses.map((c) => [foldGreek(c.course_name), c]))

  const rows: LectureInput[] = []
  const unmatched: CsvRowError[] = []
  lines.slice(1).forEach((line, i) => {
    const row = parseCsvLine(line)
    const name = col(row, 'course_name')
    const course = byTitle.get(foldGreek(name))
    if (!course) {
      unmatched.push({ row: i + 1, course_name: name })
      return
    }
    rows.push({
      course_id: course.id,
      room: col(row, 'room') || null,
      day_of_week: normaliseDay(col(row, 'day_of_week')) as DayOfWeek,
      start_time: col(row, 'start_time'),
      end_time: col(row, 'end_time'),
      semester: col(row, 'semester'),
    })
  })
  return { rows, unmatched }
}
