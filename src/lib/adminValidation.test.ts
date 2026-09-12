import { describe, expect, it } from 'vitest'
import {
  validateAcademicEventInput,
  validateCourseInput,
  validateLectureInput,
  validateOverrideInput,
  validateSemesterInput,
} from './adminValidation'
import type {
  AcademicEventInput,
  CourseInput,
  LectureInput,
  OverrideInput,
  SemesterInput,
} from './data/types'

const validCourse: CourseInput = {
  course_code: 'CS999',
  course_name: 'Test Course',
  professor: 'Dr. Test',
  department: 'Computer Science',
  color_tag: '#111111',
  subject: 'Systems',
  is_mandatory: false,
  study_year: 3,
  semester_number: 6,
  ects: 5,
}

const validLecture: LectureInput = {
  course_id: '00000000-0000-4000-8000-000000000001',
  room: 'Room 1',
  day_of_week: 'Monday',
  start_time: '09:00',
  end_time: '10:30',
  semester: 'Spring 2026',
}

describe('validateCourseInput', () => {
  it('accepts a valid course', () => {
    expect(validateCourseInput(validCourse)).toBeNull()
  })

  it('rejects a missing required field', () => {
    expect(validateCourseInput({ ...validCourse, course_code: '  ' })).toMatch(/course code/i)
    expect(validateCourseInput({ ...validCourse, course_name: '' })).toMatch(/course name/i)
    expect(validateCourseInput({ ...validCourse, professor: '   ' })).toMatch(/professor/i)
  })

  // study_year lives on the course now, so this is where it is checked.
  it('rejects a study year outside 1-4', () => {
    expect(validateCourseInput({ ...validCourse, study_year: 5 })).toMatch(/between 1 and 4/i)
    expect(validateCourseInput({ ...validCourse, study_year: 0 })).toMatch(/between 1 and 4/i)
  })

  it('allows a null study year', () => {
    expect(validateCourseInput({ ...validCourse, study_year: null })).toBeNull()
  })

  it('rejects a study year that is not a whole number', () => {
    expect(validateCourseInput({ ...validCourse, study_year: Number.NaN })).toMatch(
      /between 1 and 4/i,
    )
    expect(validateCourseInput({ ...validCourse, study_year: 2.5 })).toMatch(
      /between 1 and 4/i,
    )
  })
})

describe('validateLectureInput', () => {
  it('accepts a valid lecture', () => {
    expect(validateLectureInput(validLecture)).toBeNull()
  })

  // The whole point of the 0006 split: a lecture must name a course rather
  // than carrying its own copy of the course's fields.
  it('requires a course', () => {
    expect(validateLectureInput({ ...validLecture, course_id: '' })).toMatch(/course/i)
  })

  it('rejects end time not after start time', () => {
    expect(validateLectureInput({ ...validLecture, start_time: '11:00', end_time: '10:00' })).toMatch(
      /after start/i,
    )
    expect(validateLectureInput({ ...validLecture, start_time: '10:00', end_time: '10:00' })).toMatch(
      /after start/i,
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

/**
 * These two validators had no unit tests at all, despite being the most
 * branch-heavy in the file — validateOverrideInput alone has a different
 * required-field set per override kind, and the Edge Function keeps a
 * hand-copied duplicate of both that must agree with them.
 */
const validEvent: AcademicEventInput = {
  semester: 'Spring 2026',
  kind: 'holiday',
  title: 'Αργία 25ης Μαρτίου',
  start_date: '2026-03-25',
  end_date: '2026-03-25',
  blocks_teaching: true,
}

describe('validateAcademicEventInput', () => {
  it('accepts a valid entry', () => {
    expect(validateAcademicEventInput(validEvent)).toBeNull()
  })

  it('accepts a single-day entry where end equals start', () => {
    // Unlike a semester, the range is inclusive — a one-day holiday repeats the
    // same date on both sides.
    expect(validateAcademicEventInput({ ...validEvent, end_date: validEvent.start_date })).toBeNull()
  })

  it('rejects a blank title', () => {
    expect(validateAcademicEventInput({ ...validEvent, title: '   ' })).toMatch(/title/i)
  })

  it('rejects an unknown kind', () => {
    expect(
      validateAcademicEventInput({
        ...validEvent,
        kind: 'party' as AcademicEventInput['kind'],
      }),
    ).toMatch(/kind/i)
  })

  it('rejects an end date before the start date', () => {
    expect(validateAcademicEventInput({ ...validEvent, end_date: '2026-03-24' })).toMatch(
      /on or after/i,
    )
  })

  it('rejects a date that looks right but is not real', () => {
    expect(validateAcademicEventInput({ ...validEvent, start_date: '2026-02-31' })).toMatch(
      /start date must be a date/i,
    )
  })
})

const baseOverride: OverrideInput = {
  lecture_id: 'lec-1',
  kind: 'cancelled',
  occurrence_date: '2026-03-02',
  new_date: null,
  new_start_time: null,
  new_end_time: null,
  new_room: null,
  note: null,
}

describe('validateOverrideInput', () => {
  it('accepts a cancellation, which needs nothing else', () => {
    expect(validateOverrideInput(baseOverride)).toBeNull()
  })

  it('requires a lecture and a valid date', () => {
    expect(validateOverrideInput({ ...baseOverride, lecture_id: ' ' })).toMatch(/lecture/i)
    expect(validateOverrideInput({ ...baseOverride, occurrence_date: '' })).toMatch(/date/i)
    expect(validateOverrideInput({ ...baseOverride, occurrence_date: '2026-13-01' })).toMatch(
      /date must be a date/i,
    )
  })

  it('requires a new date and times for a moved session', () => {
    const moved: OverrideInput = { ...baseOverride, kind: 'moved' }
    expect(validateOverrideInput(moved)).toMatch(/new date/i)
    expect(validateOverrideInput({ ...moved, new_date: '2026-03-09' })).toMatch(
      /start and end time/i,
    )
    expect(
      validateOverrideInput({
        ...moved,
        new_date: '2026-03-09',
        new_start_time: '09:00',
        new_end_time: '12:00',
      }),
    ).toBeNull()
  })

  it('requires times for an extra session but not a new date', () => {
    const extra: OverrideInput = { ...baseOverride, kind: 'extra' }
    expect(validateOverrideInput(extra)).toMatch(/start and end time/i)
    expect(
      validateOverrideInput({ ...extra, new_start_time: '09:00', new_end_time: '12:00' }),
    ).toBeNull()
  })

  it('rejects a moved session that ends before it starts', () => {
    expect(
      validateOverrideInput({
        ...baseOverride,
        kind: 'moved',
        new_date: '2026-03-09',
        new_start_time: '12:00',
        new_end_time: '09:00',
      }),
    ).toMatch(/after start/i)
  })

  it('rejects a session outside the timetable window', () => {
    expect(
      validateOverrideInput({
        ...baseOverride,
        kind: 'extra',
        new_start_time: '05:00',
        new_end_time: '06:00',
      }),
    ).toMatch(/timetable/i)
  })

  it('accepts a Postgres time with seconds', () => {
    // Existing overrides come back from the database as 'HH:MM:SS'; re-saving
    // one must not be rejected for a shape the database itself produced.
    expect(
      validateOverrideInput({
        ...baseOverride,
        kind: 'extra',
        new_start_time: '09:00:00',
        new_end_time: '12:00:00',
      }),
    ).toBeNull()
  })

  it('requires a room for a room change', () => {
    const roomChange: OverrideInput = { ...baseOverride, kind: 'room_change' }
    expect(validateOverrideInput(roomChange)).toMatch(/room/i)
    expect(validateOverrideInput({ ...roomChange, new_room: 'Αίθουσα 2.3' })).toBeNull()
  })

  it('rejects an unknown kind', () => {
    expect(
      validateOverrideInput({ ...baseOverride, kind: 'exploded' as OverrideInput['kind'] }),
    ).toMatch(/change type/i)
  })
})
