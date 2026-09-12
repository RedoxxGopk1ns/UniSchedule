import type {
  AcademicEventInput,
  CourseInput,
  LectureInput,
  OverrideInput,
  SemesterInput,
} from './data/types'
import { ACADEMIC_EVENT_KINDS, DAYS, OVERRIDE_KINDS } from './data/types'
import { GRID_END_TIME, GRID_START_TIME, isValidTime, isWithinGrid, toMinutes } from './time'

/**
 * Pure validation for admin inputs, mirroring the DB constraints and the checks
 * in supabase/functions/admin. Kept free of React so the forms, the mock
 * provider, and the unit tests all share one source of truth. Each function
 * returns a human-readable error, or null when the input is valid.
 *
 * The Edge Function re-validates server-side regardless — this is for fast
 * feedback, not security.
 */

export function validateCourseInput(input: Partial<CourseInput>): string | null {
  const required: [keyof CourseInput, string][] = [
    ['course_code', 'Course code'],
    ['course_name', 'Course name'],
    ['professor', 'Professor'],
  ]
  for (const [key, label] of required) {
    const v = input[key]
    if (v === undefined || v === null || String(v).trim() === '') {
      return `${label} is required.`
    }
  }
  const year = input.study_year
  if (
    year !== null &&
    year !== undefined &&
    (!Number.isInteger(year) || year < 1 || year > 4)
  ) {
    return 'Year of study must be between 1 and 4.'
  }
  const sem = input.semester_number
  if (
    sem !== null &&
    sem !== undefined &&
    (!Number.isInteger(sem) || sem < 1 || sem > 8)
  ) {
    return 'Semester must be between 1 and 8.'
  }
  const ects = input.ects
  if (
    ects !== null &&
    ects !== undefined &&
    (!Number.isFinite(ects) || ects < 0 || ects > 30)
  ) {
    return 'ECTS must be between 0 and 30.'
  }
  return null
}

/**
 * A lecture's own fields only — the scheduling half.
 *
 * Course code, name, professor and year of study are not checked here because
 * a lecture no longer carries them; they are validated once, on the course
 * (see validateCourseInput), and inherited. `course_id` is checked for
 * presence only: whether it names a real course is a question about the
 * database, which the Edge Function answers with a foreign key.
 */
export function validateLectureInput(input: Partial<LectureInput>): string | null {
  const required: [keyof LectureInput, string][] = [
    ['course_id', 'Course'],
    ['day_of_week', 'Day'],
    ['start_time', 'Start time'],
    ['end_time', 'End time'],
    ['semester', 'Semester'],
  ]
  for (const [key, label] of required) {
    const v = input[key]
    if (v === undefined || v === null || String(v).trim() === '') {
      return `${label} is required.`
    }
  }
  if (!DAYS.includes(input.day_of_week as (typeof DAYS)[number])) {
    return 'Day must be Monday to Friday.'
  }
  // Check the shape before comparing. toMinutes returns NaN for a malformed
  // time and every comparison against NaN is false, so an ordering check alone
  // would wave '9am' or '25:00' straight through to the database.
  const start = input.start_time as string
  const end = input.end_time as string
  if (!isValidTime(start)) return 'Start time must be a 24-hour time, e.g. 09:00.'
  if (!isValidTime(end)) return 'End time must be a 24-hour time, e.g. 10:30.'
  if (toMinutes(end) <= toMinutes(start)) {
    return 'End time must be after start time.'
  }
  if (!isWithinGrid(start, end)) {
    return `Lectures must fall within the ${GRID_START_TIME}–${GRID_END_TIME} timetable.`
  }
  return null
}

export function validateSemesterInput(input: Partial<SemesterInput>): string | null {
  if (!input.name || input.name.trim() === '') return 'Name is required.'
  if (!input.start_date) return 'Start date is required.'
  if (!input.end_date) return 'End date is required.'
  // isValidDate, not a bare Date parse: `new Date('2026-02-31')` is not NaN,
  // it is the 3rd of March. A term silently starting a week from where the
  // admin typed it is worse than a rejected form.
  if (!isValidDate(input.start_date)) return 'Start date must be a date, e.g. 2026-02-24.'
  const start = new Date(`${input.start_date}T00:00:00Z`)
  // Teaching runs Monday to Friday, so the term cannot open at the weekend.
  // It used to have to be a Monday; the real spring term begins on Tuesday
  // 24/02/2026 (the day after Καθαρά Δευτέρα), and sync-schedule's
  // firstOccurrence now walks forward to each lecture's weekday rather than
  // assuming a Monday offset, so the stricter rule bought nothing but a lie.
  // getUTCDay: 0 = Sunday, 6 = Saturday.
  if (start.getUTCDay() === 0 || start.getUTCDay() === 6) {
    return 'Start date must be a weekday.'
  }
  // Same trap as the times above: an unparseable end date compares false
  // against everything, so it has to be rejected on its own terms first.
  if (!isValidDate(input.end_date)) return 'End date must be a date, e.g. 2026-06-05.'
  const end = new Date(`${input.end_date}T00:00:00Z`)
  if (end <= start) {
    return 'End date must be after the start date.'
  }
  return null
}

/** True for a well-formed ISO 'YYYY-MM-DD' that is also a real calendar date. */
function isValidDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  // Round-tripping catches '2026-02-31', which Date happily rolls into March.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function validateAcademicEventInput(
  input: Partial<AcademicEventInput>,
): string | null {
  if (!input.title || input.title.trim() === '') return 'Title is required.'
  if (!input.kind) return 'Kind is required.'
  if (!ACADEMIC_EVENT_KINDS.includes(input.kind)) {
    return 'Kind is not one of the known academic event types.'
  }
  if (!input.start_date) return 'Start date is required.'
  if (!isValidDate(input.start_date)) return 'Start date must be a date, e.g. 2026-03-25.'
  if (!input.end_date) return 'End date is required.'
  if (!isValidDate(input.end_date)) return 'End date must be a date, e.g. 2026-04-17.'
  // Inclusive range: a single-day holiday repeats the same date, so equal is
  // valid here — unlike a semester, where end must be strictly after start.
  if (input.end_date < input.start_date) {
    return 'End date must be on or after the start date.'
  }
  return null
}

export function validateOverrideInput(input: Partial<OverrideInput>): string | null {
  if (!input.lecture_id || input.lecture_id.trim() === '') {
    return 'Lecture is required.'
  }
  if (!input.kind) return 'Change type is required.'
  if (!OVERRIDE_KINDS.includes(input.kind)) {
    return 'Change type is not one of the known kinds.'
  }
  if (!input.occurrence_date) return 'Date is required.'
  if (!isValidDate(input.occurrence_date)) {
    return 'Date must be a date, e.g. 2026-03-25.'
  }

  // 'cancelled' needs nothing else. The rest each require their own fields, and
  // the DB carries the same checks — see migration 0005.
  if (input.kind === 'moved') {
    if (!isValidDate(input.new_date)) {
      return 'A moved session needs a new date.'
    }
  }
  if (input.kind === 'moved' || input.kind === 'extra') {
    const start = input.new_start_time
    const end = input.new_end_time
    if (!start || !end) return 'A new start and end time are required.'
    if (!isValidTime(start)) return 'Start time must be a 24-hour time, e.g. 09:00.'
    if (!isValidTime(end)) return 'End time must be a 24-hour time, e.g. 10:30.'
    if (toMinutes(end) <= toMinutes(start)) {
      return 'End time must be after start time.'
    }
    if (!isWithinGrid(start, end)) {
      return `Lectures must fall within the ${GRID_START_TIME}–${GRID_END_TIME} timetable.`
    }
  }
  if (input.kind === 'room_change') {
    if (!input.new_room || input.new_room.trim() === '') {
      return 'A room change needs a new room.'
    }
  }
  return null
}
