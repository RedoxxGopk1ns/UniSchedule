import { describe, expect, it } from 'vitest'
import { validateLectureInput } from '../../lib/adminValidation'
import type { Course } from '../../lib/data/types'
import { parseLectureCsv } from './lectureCsv'

const header = 'course_name,day_of_week,start_time,end_time,semester'
const row = 'Intro,Monday,09:00,10:00,Spring 2026'

const course: Course = {
  id: 'course-1',
  course_code: 'CS1',
  course_name: 'Intro',
  professor: 'Prof',
  department: null,
  color_tag: null,
  subject: null,
  is_mandatory: false,
  study_year: null,
  semester_number: null,
  ects: null,
}
const courses = [course]

describe('parseLectureCsv', () => {
  it('parses a well-formed row onto its course', () => {
    const { rows } = parseLectureCsv(`${header}\n${row}`, courses)
    expect(rows[0]).toMatchObject({
      course_id: 'course-1',
      day_of_week: 'Monday',
      start_time: '09:00',
      semester: 'Spring 2026',
    })
  })

  it('keeps a comma inside a quoted field', () => {
    const { rows } = parseLectureCsv(
      `${header},room\n${row},"Building A, Room 204"`,
      courses,
    )
    expect(rows[0]!.room).toBe('Building A, Room 204')
  })

  // Regression: the day was passed through a `DAY_SET.has(day) ? day : day`
  // ternary, so the lookup did nothing and casing was never normalised.
  it('normalises the casing of a weekday', () => {
    const { rows } = parseLectureCsv(
      `${header}\nIntro,monday,09:00,10:00,Spring 2026`,
      courses,
    )
    expect(rows[0]!.day_of_week).toBe('Monday')
    expect(validateLectureInput(rows[0]!)).toBeNull()
  })

  it('leaves a non-weekday alone for validation to reject', () => {
    const { rows } = parseLectureCsv(
      `${header}\nIntro,Saturday,09:00,10:00,Spring 2026`,
      courses,
    )
    expect(rows[0]!.day_of_week).toBe('Saturday')
    expect(validateLectureInput(rows[0]!)).toMatch(/monday to friday/i)
  })

  it('rejects a malformed time rather than importing it', () => {
    const { rows } = parseLectureCsv(
      `${header}\nIntro,Monday,9am,10am,Spring 2026`,
      courses,
    )
    expect(validateLectureInput(rows[0]!)).toMatch(/24-hour/i)
  })

  /**
   * A CSV can no more invent a course than a PDF can. The row is reported
   * rather than dropped, so the admin learns which course to add.
   */
  it('reports a row naming a course that does not exist', () => {
    const { rows, unmatched } = parseLectureCsv(
      `${header}\nNo Such Course,Monday,09:00,10:00,Spring 2026`,
      courses,
    )
    expect(rows).toEqual([])
    expect(unmatched).toEqual([{ row: 1, course_name: 'No Such Course' }])
  })

  it('matches a course name regardless of accents or case', () => {
    const greek: Course = {
      ...course,
      id: 'course-2',
      course_name: 'Αλγόριθμοι και Πολυπλοκότητα',
    }
    const { rows } = parseLectureCsv(
      `${header}\nΑΛΓΟΡΙΘΜΟΙ ΚΑΙ ΠΟΛΥΠΛΟΚΟΤΗΤΑ,Monday,09:00,10:00,Spring 2026`,
      [greek],
    )
    expect(rows[0]!.course_id).toBe('course-2')
  })

  it('throws when a required column is missing', () => {
    expect(() => parseLectureCsv(`course_code,professor\nCS1,Prof`, courses)).toThrow(
      /missing required column/i,
    )
  })

  it('returns nothing for a header with no data rows', () => {
    expect(parseLectureCsv(header, courses)).toEqual({ rows: [], unmatched: [] })
  })
})
