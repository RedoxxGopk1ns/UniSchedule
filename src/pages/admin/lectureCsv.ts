import type { DayOfWeek, LectureInput } from '../../lib/data/types'

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

const REQUIRED = [
  'course_code',
  'course_name',
  'professor',
  'day_of_week',
  'start_time',
  'end_time',
  'semester',
]

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

/**
 * Parses pasted CSV into LectureInput rows. Throws on a malformed header;
 * per-row validation is left to the importer/Edge Function so that a few bad
 * rows are reported rather than aborting the whole paste.
 */
export function parseLectureCsv(text: string): LectureInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase())
  for (const key of REQUIRED) {
    if (!header.includes(key)) throw new Error(`CSV is missing required column: ${key}`)
  }

  const col = (row: string[], name: string): string => {
    const idx = header.indexOf(name)
    return idx >= 0 ? (row[idx] ?? '') : ''
  }

  return lines.slice(1).map((line) => {
    const row = parseCsvLine(line)
    const day = col(row, 'day_of_week')
    const yearRaw = col(row, 'study_year')
    const year = yearRaw ? Number(yearRaw) : null
    return {
      course_code: col(row, 'course_code'),
      course_name: col(row, 'course_name'),
      professor: col(row, 'professor'),
      room: col(row, 'room') || null,
      day_of_week: normaliseDay(day) as DayOfWeek,
      start_time: col(row, 'start_time'),
      end_time: col(row, 'end_time'),
      semester: col(row, 'semester'),
      department: col(row, 'department') || null,
      color_tag: col(row, 'color_tag') || null,
      subject: col(row, 'subject') || null,
      is_mandatory: /^(true|yes|1)$/i.test(col(row, 'is_mandatory')),
      study_year: year !== null && Number.isFinite(year) ? year : null,
    }
  })
}
