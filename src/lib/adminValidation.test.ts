import { describe, expect, it } from 'vitest'
import { validateLectureInput, validateSemesterInput } from './adminValidation'
import type { LectureInput, SemesterInput } from './data/types'

const validLecture: LectureInput = {
  course_code: 'CS999',
  course_name: 'Test Course',
  professor: 'Dr. Test',
  room: 'Room 1',
  day_of_week: 'Monday',
  start_time: '09:00',
  end_time: '10:30',
  semester: 'Spring 2026',
  department: 'Computer Science',
  color_tag: '#111111',
  subject: 'Systems',
  is_mandatory: false,
  study_year: 3,
}

describe('validateLectureInput', () => {
  it('accepts a valid lecture', () => {
    expect(validateLectureInput(validLecture)).toBeNull()
  })

  it('rejects a missing required field', () => {
    expect(validateLectureInput({ ...validLecture, course_code: '  ' })).toMatch(/course code/i)
  })

  it('rejects end time not after start time', () => {
    expect(validateLectureInput({ ...validLecture, start_time: '11:00', end_time: '10:00' })).toMatch(
      /after start/i,
    )
    expect(validateLectureInput({ ...validLecture, start_time: '10:00', end_time: '10:00' })).toMatch(
      /after start/i,
    )
  })

  it('rejects a study year outside 1–4', () => {
    expect(validateLectureInput({ ...validLecture, study_year: 5 })).toMatch(/between 1 and 4/i)
    expect(validateLectureInput({ ...validLecture, study_year: 0 })).toMatch(/between 1 and 4/i)
  })

  it('allows a null study year', () => {
    expect(validateLectureInput({ ...validLecture, study_year: null })).toBeNull()
  })

  it('rejects a study year that is not a whole number', () => {
    expect(validateLectureInput({ ...validLecture, study_year: Number.NaN })).toMatch(
      /between 1 and 4/i,
    )
    expect(validateLectureInput({ ...validLecture, study_year: 2.5 })).toMatch(
      /between 1 and 4/i,
    )
  })

  // Regression: toMinutes returns NaN for these and every NaN comparison is
  // false, so an ordering check on its own accepted the lot. On the real
  // backend they reached Postgres and failed the whole batch insert.
  it('rejects times that are not a 24-hour clock reading', () => {
    for (const bad of ['9am', 'abc', '25:00', '12:60', '']) {
      expect(
        validateLectureInput({ ...validLecture, start_time: bad, end_time: '23:00' }),
      ).toBeTruthy()
      expect(
        validateLectureInput({ ...validLecture, start_time: '08:00', end_time: bad }),
      ).toBeTruthy()
    }
  })

  it('rejects a lecture outside the rendered timetable', () => {
    expect(
      validateLectureInput({ ...validLecture, start_time: '23:00', end_time: '23:30' }),
    ).toMatch(/timetable/i)
    expect(
      validateLectureInput({ ...validLecture, start_time: '06:00', end_time: '08:00' }),
    ).toMatch(/timetable/i)
  })

  it('accepts an evening lecture', () => {
    expect(
      validateLectureInput({ ...validLecture, start_time: '20:00', end_time: '22:00' }),
    ).toBeNull()
  })

  it('accepts a lecture on the exact grid boundaries', () => {
    expect(
      validateLectureInput({ ...validLecture, start_time: '07:00', end_time: '23:00' }),
    ).toBeNull()
  })
})

const validSemester: SemesterInput = {
  name: 'Spring 2026',
  // The real spring term opens on a Tuesday, the day after Καθαρά Δευτέρα.
  start_date: '2026-02-24',
  end_date: '2026-06-05',
  time_zone: 'Europe/Athens',
}

describe('validateSemesterInput', () => {
  it('accepts a term that starts on a weekday other than Monday', () => {
    expect(validateSemesterInput(validSemester)).toBeNull()
    expect(validateSemesterInput({ ...validSemester, start_date: '2026-02-23' })).toBeNull()
  })

  it('rejects a start date at the weekend', () => {
    // 2026-02-28 is a Saturday, 2026-03-01 a Sunday. Nothing is taught then, so
    // a term cannot open on one.
    expect(validateSemesterInput({ ...validSemester, start_date: '2026-02-28' })).toMatch(
      /weekday/i,
    )
    expect(validateSemesterInput({ ...validSemester, start_date: '2026-03-01' })).toMatch(
      /weekday/i,
    )
  })

  it('rejects an end date not after the start date', () => {
    expect(validateSemesterInput({ ...validSemester, end_date: '2026-02-24' })).toMatch(
      /after the start/i,
    )
  })

  it('rejects a missing name', () => {
    expect(validateSemesterInput({ ...validSemester, name: '' })).toMatch(/name is required/i)
  })

  // Regression: an unparseable date compares false against everything, so the
  // `end <= start` check waved it through.
  it('rejects an unparseable end date', () => {
    expect(validateSemesterInput({ ...validSemester, end_date: 'not-a-date' })).toMatch(
      /not a valid date/i,
    )
  })
})
