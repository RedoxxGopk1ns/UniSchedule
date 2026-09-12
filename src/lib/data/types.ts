/**
 * Shared domain types. These mirror the Supabase schema in PRD §5 exactly, so
 * the mock provider and the Supabase provider are interchangeable behind
 * `DataProvider` (see provider.ts).
 */

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'

export const DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
]

/**
 * A course — what the department teaches, independent of when.
 *
 * Admin-populated by hand and edited only in the Courses tab. A timetable
 * import never creates one: the PDF says where and when a course meets, it
 * does not decide that the course exists. Students never write to this.
 */
export interface Course {
  id: string
  course_code: string
  /**
   * The course title. This is the identity a timetable import matches on, so
   * it is unique across the table — two courses that genuinely share a title
   * (a lecture and its lab) are distinguished in the title itself, the way the
   * department already writes them: 'Προγραμματισμός ΙΙ — Ομάδα 1'.
   */
  course_name: string
  professor: string
  department: string | null
  /** Optional hex used for the lecture block's left stripe. */
  color_tag: string | null
  /**
   * Topic, deliberately independent of `department` — 'Systems' spans several
   * departments, and one department teaches many subjects.
   */
  subject: string | null
  /** Required for the degree, rather than an elective. */
  is_mandatory: boolean
  /**
   * Year of study this course belongs to (1–4). Not to be confused with a
   * lecture's `semester`, which is a term name.
   */
  study_year: number | null
  /**
   * Which of the eight programme semesters the course is published under.
   *
   * Distinct from `study_year` (= ceil(semester_number / 2), which cannot tell
   * the 5th semester from the 6th) and from `Lecture.semester` (a term name
   * like 'Spring 2026'). Null when unknown.
   */
  semester_number: number | null
  /** Credit weight, 5–8 across this programme. Null when unknown. */
  ects: number | null
}

/**
 * One weekly meeting of a course, in one term.
 *
 * A lecture owns only the scheduling half — where and when. Everything else
 * on this interface is *inherited* from `courses` through `course_id`: the
 * providers join and flatten it on read, so renaming a course or changing its
 * lecturer shows up on every lecture of that course with nothing to migrate.
 * That inheritance is why the flat fields below are readonly — write them
 * through `updateCourse`, never through a lecture.
 *
 * This is the shape the whole UI consumes, unchanged from when `lectures` was
 * a single flat table (migration 0006 split it).
 */
export interface Lecture {
  id: string
  course_id: string
  room: string | null
  day_of_week: DayOfWeek
  /** 'HH:MM' 24-hour, wall-clock local to the university. */
  start_time: string
  end_time: string
  /** The term this lecture runs in, e.g. 'Spring 2026'. */
  semester: string

  // --- Inherited from the course. Read-only; see `Course` above. ---
  readonly course_code: string
  readonly course_name: string
  readonly professor: string
  readonly department: string | null
  readonly color_tag: string | null
  readonly subject: string | null
  readonly is_mandatory: boolean
  readonly study_year: number | null
}

/**
 * A `lectures` row exactly as stored — the scheduling half, before the course
 * join. What the seed fixture and the providers hold internally; the UI only
 * ever sees the joined `Lecture`.
 */
export interface LectureRow extends LectureInput {
  id: string
}

/** The course half of a `Lecture`, as `joinCourse` needs it. */
export type LectureCourseFields = Pick<
  Course,
  | 'course_code'
  | 'course_name'
  | 'professor'
  | 'department'
  | 'color_tag'
  | 'subject'
  | 'is_mandatory'
  | 'study_year'
>

/** Copies a course's inherited half onto a lecture's scheduling half. */
export function joinCourse<T extends { course_id: string }>(
  lecture: T,
  course: LectureCourseFields,
): T & LectureCourseFields {
  return {
    ...lecture,
    course_code: course.course_code,
    course_name: course.course_name,
    professor: course.professor,
    department: course.department,
    color_tag: course.color_tag,
    subject: course.subject,
    is_mandatory: course.is_mandatory,
    study_year: course.study_year,
  }
}

/** A row of user_schedules joined onto its lecture. */
export interface ScheduleEntry {
  id: string
  lecture_id: string
  google_event_id: string | null
  lecture: Lecture
}

/** The only elevated role. Absent/undefined means an ordinary student. */
export type UserRole = 'admin'

export interface UserProfile {
  id: string
  full_name: string
  avatar_url: string | null
  email: string
  /**
   * Read from the JWT's app_metadata (auth.users.raw_app_meta_data). The user
   * cannot set this; it gates the admin UI and is re-checked server-side by the
   * admin Edge Function. Undefined for ordinary students.
   */
  role?: UserRole | null
}

/** Which part of the day a lecture starts in (§8.3 filters). */
export type TimeBand = 'Morning' | 'Afternoon' | 'Evening'

export const TIME_BANDS: TimeBand[] = ['Morning', 'Afternoon', 'Evening']

export interface Session {
  user: UserProfile
}

export interface Semester {
  name: string
  /** ISO date, e.g. '2026-02-02' — must be a Monday. */
  start_date: string
  /** ISO date, e.g. '2026-06-30'. */
  end_date: string
}

/**
 * The payload handed to sync-schedule (§18). Only genuine changes travel here —
 * unchanged enrolments never produce a Calendar API call (§10).
 */
export interface SyncDiff {
  to_add: string[]
  to_remove: { lecture_id: string; google_event_id: string | null }[]
}

export interface SyncResult {
  /** Did the enrolment itself persist? This is the only fatal dimension. */
  success: boolean
  errors: { lecture_id: string; message: string }[]
  /**
   * Calendar is advisory: the schedule is saved to the database first, and a
   * Calendar failure downgrades the toast rather than losing the selection.
   * 'skipped' means sync is switched off (VITE_ENABLE_CALENDAR_SYNC).
   */
  calendar?: 'ok' | 'skipped' | 'failed'
}

/** Shape backing the Upcoming sidebar (§8.2.2). */
export interface Upcoming {
  /** The next lecture starting today, if any. */
  next: ScheduleEntry | null
  /** Today's remaining lectures after `next`. */
  laterToday: ScheduleEntry[]
  /** Shown only when today has nothing left: the next class on a future day. */
  nextOtherDay: ScheduleEntry | null
}

/**
 * Catalogue filter state (§8.3). Every dimension is AND-ed together; the values
 * within one dimension are OR-ed, so `days: ['Tuesday', 'Thursday']` means
 * either day. An empty array means "no constraint", never "match nothing".
 */
export interface LectureFilters {
  search?: string
  departments?: string[]
  days?: DayOfWeek[]
  subjects?: string[]
  professors?: string[]
  bands?: TimeBand[]
  /** Restrict to required courses (see `applyFilters` for the year rule). */
  mandatoryOnly?: boolean
  /** Restrict to lectures the student has already ticked. */
  selectedOnly?: boolean
  /**
   * Review mode for passed courses. Off (default) hides passed courses from the
   * catalogue; on flips the list to show *only* passed courses, so the student
   * can look them over and restore any marked by mistake.
   */
  passedOnly?: boolean
  semester?: string | null
}

// ---------------------------------------------------------------------------
// Admin (§ admin dashboard). Everything below is used only behind AdminRoute
// and is authorised server-side by the `admin` Edge Function — see
// src/lib/data/provider.ts (AdminApi) and supabase/functions/admin.
// ---------------------------------------------------------------------------

/** Create/update payload for a course — every inherited field, no id. */
export interface CourseInput {
  course_code: string
  course_name: string
  professor: string
  department: string | null
  color_tag: string | null
  subject: string | null
  is_mandatory: boolean
  study_year: number | null
  semester_number: number | null
  ects: number | null
}

/**
 * Create/update payload for a lecture — the scheduling half plus which course
 * it teaches.
 *
 * There is deliberately no course_name/professor/subject here. Those live on
 * `courses` and are inherited (see `Lecture`); accepting them would let a
 * lecture write drift away from its course, which is the exact bug the 0006
 * split removes. A timetable import supplies `course_id` by matching the PDF's
 * title against the course table, never by inventing a course.
 */
export interface LectureInput {
  course_id: string
  room: string | null
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  semester: string
}

/** Create/update payload for a semester. */
export interface SemesterInput {
  name: string
  /**
   * ISO date of the first teaching day — a weekday, not necessarily a Monday.
   * The real spring term opens on Tuesday 24/02/2026, the day after Καθαρά
   * Δευτέρα, so anything stricter would be a lie about the calendar.
   */
  start_date: string
  end_date: string
  time_zone: string
}

/** A semester as the admin sees it — the full row plus how many lectures use it. */
export interface AdminSemester extends Semester {
  time_zone: string
  is_current: boolean
  lecture_count: number
}

/** Per-user Google Calendar connection state, derived from user_profiles. */
export interface CalendarStatus {
  /** An access token is stored. */
  connected: boolean
  /** A refresh token is stored — without it sync silently dies after an hour. */
  has_refresh_token: boolean
  token_expires_at: string | null
  /** The stored access token has not yet expired. */
  token_valid: boolean
}

/** A user row in the admin user list. */
export interface AdminUser {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  study_year: number | null
  role: UserRole | null
  created_at: string
  enrolled_count: number
  passed_count: number
  calendar: CalendarStatus
}

/** A single user drilled into: their schedule and passed courses. */
export interface AdminUserDetail extends AdminUser {
  schedule: ScheduleEntry[]
  passed_course_codes: string[]
}

/** Aggregate figures for the analytics overview. */
export interface AdminStats {
  totals: {
    users: number
    admins: number
    /** Distinct courses taught, across all terms. */
    courses: number
    /** Scheduled meetings — several per course for one that meets twice. */
    lectures: number
    enrollments: number
    semesters: number
  }
  calendar: {
    connected_users: number
    users_with_refresh_token: number
    /** connected_users / users, 0..1. */
    adoption_rate: number
  }
  /** Most-enrolled lectures, highest first. */
  top_courses: { lecture_id: string; course_code: string; course_name: string; count: number }[]
}

/** Outcome of a bulk lecture import. */
export interface BulkImportResult {
  created: number
  errors: { row: number; message: string }[]
}

/**
 * Outcome of replacing one term's timetable wholesale.
 *
 * A timetable re-import deletes every lecture in the term and rebuilds it from
 * the PDF rather than diffing. Nothing is lost by doing so — a lecture holds
 * only where and when, and the PDF is the authority on both — and it keeps the
 * admin's job to "approve these rows" instead of "reconcile these rows against
 * what is already there". `deleted` is reported so the toast can say what the
 * re-import actually replaced.
 */
export interface ReplaceScheduleResult {
  deleted: number
  created: number
  errors: { row: number; message: string }[]
}

// ---------------------------------------------------------------------------
// Academic calendar and per-occurrence overrides (§22).
//
// A Lecture is a weekly *pattern* with no dates on it. These two shapes are the
// date layer laid over that pattern: academic events say which weeks do not
// happen at all, overrides say what changed about one specific session.
// ---------------------------------------------------------------------------

export type AcademicEventKind =
  | 'holiday'
  | 'break'
  | 'exam_period'
  | 'makeup_week'
  | 'teaching_start'
  | 'teaching_end'
  | 'presentations'
  | 'other'

export const ACADEMIC_EVENT_KINDS: AcademicEventKind[] = [
  'holiday',
  'break',
  'exam_period',
  'makeup_week',
  'teaching_start',
  'teaching_end',
  'presentations',
  'other',
]

/** A dated entry from the university's academic calendar. */
export interface AcademicEvent {
  id: string
  /** null when the entry spans the whole academic year rather than one term. */
  semester: string | null
  kind: AcademicEventKind
  title: string
  /** ISO date. */
  start_date: string
  /** ISO date, inclusive — equal to start_date for a single day. */
  end_date: string
  /** Whether lectures inside this range are cancelled. False for date markers. */
  blocks_teaching: boolean
}

export type AcademicEventInput = Omit<AcademicEvent, 'id'>

export type OverrideKind = 'cancelled' | 'moved' | 'room_change' | 'extra'

export const OVERRIDE_KINDS: OverrideKind[] = [
  'cancelled',
  'moved',
  'room_change',
  'extra',
]

/** A one-off exception to a single lecture's weekly pattern. */
export interface LectureOverride {
  id: string
  lecture_id: string
  kind: OverrideKind
  /**
   * The normally-scheduled date being changed. For 'extra' — a session with no
   * counterpart in the weekly pattern — the date of the added class.
   */
  occurrence_date: string
  new_date: string | null
  new_start_time: string | null
  new_end_time: string | null
  new_room: string | null
  note: string | null
}

export type OverrideInput = Omit<LectureOverride, 'id'>

/**
 * Outcome of pushing an override to the Google Calendars of everyone enrolled.
 * Partial failure is reported rather than rolled back, as everywhere else that
 * talks to Calendar.
 */
export interface OverridePublishResult {
  users_updated: number
  errors: { user_id: string; message: string }[]
}
