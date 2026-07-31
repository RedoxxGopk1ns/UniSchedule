import { describe, expect, it } from 'vitest'
import { validateLectureInput } from '../../lib/adminValidation'
import { parseLectureCsv } from './lectureCsv'

const header =
  'course_code,course_name,professor,day_of_week,start_time,end_time,semester'
const row = 'CS1,Intro,Prof,Monday,09:00,10:00,Spring 2026'

describe('parseLectureCsv', () => {
  it('parses a well-formed row', () => {
    const [parsed] = parseLectureCsv(`${header}\n${row}`)
    expect(parsed).toMatchObject({
      course_code: 'CS1',
      day_of_week: 'Monday',
      start_time: '09:00',
      semester: 'Spring 2026',
    })
  })

  it('keeps a comma inside a quoted field', () => {
    const [parsed] = parseLectureCsv(
      `${header},room\n${row},"Building A, Room 204"`,
    )
    expect(parsed!.room).toBe('Building A, Room 204')
  })

  // Regression: the day was passed through a `DAY_SET.has(day) ? day : day`
  // ternary, so the lookup did nothing and casing was never normalised.
  it('normalises the casing of a weekday', () => {
    const [parsed] = parseLectureCsv(
      `${header}\nCS1,Intro,Prof,monday,09:00,10:00,Spring 2026`,
    )
    expect(parsed!.day_of_week).toBe('Monday')
    expect(validateLectureInput(parsed!)).toBeNull()
  })

  it('leaves a non-weekday alone for validation to reject', () => {
    const [parsed] = parseLectureCsv(
      `${header}\nCS1,Intro,Prof,Saturday,09:00,10:00,Spring 2026`,
    )
    expect(parsed!.day_of_week).toBe('Saturday')
    expect(validateLectureInput(parsed!)).toMatch(/monday to friday/i)
  })

  it('rejects a malformed time rather than importing it', () => {
    const [parsed] = parseLectureCsv(
      `${header}\nCS1,Intro,Prof,Monday,9am,10am,Spring 2026`,
    )
    expect(validateLectureInput(parsed!)).toMatch(/24-hour/i)
  })

  it('throws when a required column is missing', () => {
    expect(() => parseLectureCsv(`course_code,course_name\nCS1,Intro`)).toThrow(
      /missing required column/i,
    )
  })

  it('returns nothing for a header with no data rows', () => {
    expect(parseLectureCsv(header)).toEqual([])
  })
})
