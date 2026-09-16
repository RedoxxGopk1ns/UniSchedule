import {
  validateAcademicEventInput,
  validateCourseInput,
  validateLectureInput,
  validateOverrideInput,
  validateSemesterInput,
} from '../adminValidation'
import { applyFilters } from '../filters'
import { dayName, minutesOfDay, toMinutes } from '../time'
import {
  ALL_COURSES,
  CALENDAR,
  DEFAULT_ENROLMENT,
  DEMO_SCHEDULE,
  SCHEDULE,
  SEMESTER,
  SEMESTERS,
} from './seed'
import type { DataProvider } from './provider'
import { DAYS, joinCourse } from './types'
import type {
  AcademicEvent,
  AcademicEventInput,
  AdminSemester,
  AdminUser,
  AdminUserDetail,
  BulkImportResult,
  Course,
  CourseInput,
  LectureFilters,
  Lecture,
  LectureInput,
  LectureOverride,
  LectureRow,
  OverrideInput,
  OverridePublishResult,
  ScheduleEntry,
  SemesterInput,
  Session,
  SyncDiff,
  SyncResult,
  UserProfile,
  UserRole,
} from './types'

/**
 * In-memory backend for local development and live demos.
 *
 * It persists to localStorage so a refresh mid-presentation does not reset the
 * schedule, and it simulates latency so the skeleton states (§13) are actually
 * visible rather than flashing past.
 */

const STORAGE_KEY = 'unischedule.mock.v1'

interface MockState {
  signedIn: boolean
  enrolled: string[]
  /** Year of study (1–4), or null until the student picks one. */
  studyYear: number | null
  /** Course codes the student has marked as already passed. */
  passed: string[]
  /** Whether the demo user is an admin — drives the admin UI in mock mode. */
  isAdmin: boolean
}

const DEMO_USER = {
  id: 'demo-user-0000-0000-000000000000',
  full_name: 'Alex Papadopoulos',
  email: 'alex.papadopoulos@university.edu',
  avatar_url: null,
}

/** The demo user, with the role reflecting the current admin flag. */
function currentUser(): UserProfile {
  return { ...DEMO_USER, role: state.isAdmin ? 'admin' : null }
}

// Mutable in-memory catalogue for admin CRUD, seeded from the fixture so admin
// edits are observable within a session without touching the shared constant.
//
// The student-facing reads below go through these same arrays, not through the
// frozen CATALOGUE import. That matters for the demo: importing a timetable and
// then seeing it on the dashboard is the whole point of the Import screen, and
// it has to work with no network.
let adminCourses: Course[] = ALL_COURSES.map((x) => ({ ...x }))
let adminSchedule: LectureRow[] = [...SCHEDULE, ...DEMO_SCHEDULE].map((x) => ({ ...x }))
let adminSemesters: AdminSemester[] = seedSemesters()
let adminEvents: AcademicEvent[] = CALENDAR.map((x) => ({ ...x }))
let adminOverrides: LectureOverride[] = []

/**
 * The stored rows joined to their courses — the mock's stand-in for the
 * PostgREST embed the Supabase provider does.
 *
 * Recomputed on every read rather than cached, which is what makes a course
 * rename show up on its lectures immediately: there is no copy of the course
 * fields anywhere to go stale. A row whose course was deleted is dropped, the
 * same outcome as the `on delete cascade` in migration 0006.
 */
function joinedLectures(): Lecture[] {
  const byId = new Map(adminCourses.map((c) => [c.id, c]))
  return adminSchedule.flatMap((row) => {
    const course = byId.get(row.course_id)
    return course ? [joinCourse(row, course)] : []
  })
}

/** The fixture's terms as admin rows. The real one is the current term. */
function seedSemesters(): AdminSemester[] {
  return SEMESTERS.map((s) => ({
    ...s,
    time_zone: 'Europe/Athens',
    is_current: s.name === SEMESTER.name,
    lecture_count: [...SCHEDULE, ...DEMO_SCHEDULE].filter((l) => l.semester === s.name)
      .length,
  }))
}

/**
 * Restores the catalogue to the seed fixture.
 *
 * The arrays above are module singletons, so without this an admin test that
 * imports or deletes lectures leaks into whatever runs next. Call it from
 * `beforeEach` alongside the store resets.
 */
export function resetMockCatalogue() {
  adminCourses = ALL_COURSES.map((x) => ({ ...x }))
  adminSchedule = [...SCHEDULE, ...DEMO_SCHEDULE].map((x) => ({ ...x }))
  adminSemesters = seedSemesters()
  adminEvents = CALENDAR.map((x) => ({ ...x }))
  adminOverrides = []
  // Users too: granting someone the admin role or revoking their tokens is as
  // much a mutation of the admin surface as editing a lecture, and a role left
  // behind changes what the next test is allowed to do — the last-admin guard
  // in setUserRole counts them.
  mockUsers = seedUsers()
  syncDemoRole()
}

/**
 * Rejects a lecture filed under a term that does not exist.
 *
 * `lectures.semester` is a foreign key, and the Edge Function checks it on
 * every write (`assertSemesterExists`, supabase/functions/admin/index.ts). The
 * mock enforcing it too is what keeps "passes in tests, fails in production"
 * from being a whole class of bug — the message matches the server's wording so
 * assertions written against one hold against the other.
 */
function assertSemesterExists(name: string) {
  if (!adminSemesters.some((s) => s.name === name)) {
    throw new Error(`Unknown semester: ${name}`)
  }
}

/** Rejects a lecture pointing at a course that is not there (the FK). */
function assertCourseExists(id: string) {
  if (!adminCourses.some((c) => c.id === id)) {
    throw new Error(`Unknown course: ${id}`)
  }
}

/**
 * Rejects a duplicate course title.
 *
 * `courses.course_name` is unique in the database because a timetable import
 * matches on it; two courses sharing a title would make every row of that
 * title ambiguous and un-importable.
 */
function assertCourseTitleFree(name: string, exceptId?: string) {
  const taken = adminCourses.some(
    (c) => c.id !== exceptId && c.course_name.trim() === name.trim(),
  )
  if (taken) throw new Error(`A course named ${name.trim()} already exists.`)
}

/** One stored row joined to its course, for the CRUD methods' return value. */
function joinLecture(row: LectureRow): Lecture {
  const course = adminCourses.find((c) => c.id === row.course_id)
  if (!course) throw new Error(`Unknown course: ${row.course_id}`)
  return joinCourse(row, course)
}

/** Validates a batch of lecture inputs into stored rows, collecting errors. */
function buildRows(rows: LectureInput[]) {
  const errors: { row: number; message: string }[] = []
  const created: LectureRow[] = []
  rows.forEach((row, i) => {
    const err = validateLectureInput(row) ?? courseError(row.course_id)
    if (err) {
      errors.push({ row: i + 1, message: err })
      return
    }
    created.push({ id: crypto.randomUUID(), ...row })
  })
  return { created, errors }
}

function courseError(id: string): string | null {
  return adminCourses.some((c) => c.id === id) ? null : `Unknown course: ${id}`
}

/** A small user fixture so the admin Users screen renders in mock mode. */
const USER_FIXTURE: AdminUser[] = [
  {
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    full_name: DEMO_USER.full_name,
    avatar_url: null,
    study_year: 3,
    role: null,
    created_at: '2026-02-01T09:00:00.000Z',
    enrolled_count: DEFAULT_ENROLMENT.length,
    passed_count: 0,
    calendar: {
      connected: true,
      has_refresh_token: true,
      token_expires_at: '2026-06-30T00:00:00.000Z',
      token_valid: true,
    },
  },
  {
    id: 'demo-user-1111-1111-111111111111',
    email: 'maria.ioannou@university.edu',
    full_name: 'Maria Ioannou',
    avatar_url: null,
    study_year: 2,
    role: null,
    created_at: '2026-02-03T14:30:00.000Z',
    enrolled_count: 5,
    passed_count: 3,
    calendar: {
      connected: false,
      has_refresh_token: false,
      token_expires_at: null,
      token_valid: false,
    },
  },
]

/**
 * Fresh copies of the fixture. `calendar` is nested and revokeUserTokens
 * rewrites it, so a shallow copy would let one test blank another’s tokens.
 */
function seedUsers(): AdminUser[] {
  return USER_FIXTURE.map((u) => ({ ...u, calendar: { ...u.calendar } }))
}

let mockUsers: AdminUser[] = seedUsers()

/**
 * The demo user appears twice: as the signed-in session (`state.isAdmin`) and
 * as a row in the admin Users table. The fixture row is written with no role,
 * so without this the overview read "Admins 0" while the same user was browsing
 * the admin screens. `state.isAdmin` is the authority; the row follows it.
 */
function syncDemoRole() {
  mockUsers = mockUsers.map((u) =>
    u.id === DEMO_USER.id ? { ...u, role: state.isAdmin ? 'admin' : null } : u,
  )
}

/**
 * Test/demo hook: flip the demo user's admin flag. Called by tests before
 * mounting, and honoured from VITE_MOCK_ADMIN so the admin UI can be explored
 * in a local mock deployment.
 */
export function setMockAdmin(value: boolean) {
  state = { ...state, isAdmin: value }
  syncDemoRole()
  persist()
}

function load(): MockState {
  const fallback: MockState = {
    signedIn: false,
    enrolled: [...DEFAULT_ENROLMENT],
    studyYear: null,
    passed: [],
    isAdmin: import.meta.env.VITE_MOCK_ADMIN === 'true',
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // Spread over the fallback so state saved before a field existed still
    // loads, rather than leaving that field undefined.
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<MockState>) }
  } catch {
    // Corrupt or unavailable storage falls through to defaults.
  }
  return fallback
}

let state: MockState = load()
syncDemoRole()

/**
 * Restores the demo user's session state — enrolment, passed courses, study
 * year, sign-in, admin flag.
 *
 * `state` is read from localStorage once when this module is first imported, so
 * a test calling `localStorage.clear()` does **not** get a clean slate: the
 * in-memory object survives and leaks into whatever runs next. Resetting it
 * explicitly is what makes the jsdom suites independent of execution order.
 */
export function resetMockState() {
  localStorage.removeItem(STORAGE_KEY)
  state = {
    signedIn: false,
    enrolled: [...DEFAULT_ENROLMENT],
    studyYear: null,
    passed: [],
    isAdmin: false,
  }
}
const listeners = new Set<(s: Session | null) => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private browsing — state simply stays in memory for the session.
  }
  const session = state.signedIn ? { user: currentUser() } : null
  listeners.forEach((cb) => cb(session))
}

/** Simulated network latency, so loading states are observable. */
const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms))

function entriesFor(ids: string[]): ScheduleEntry[] {
  return ids
    .map((id) => joinedLectures().find((x) => x.id === id))
    .filter((x): x is Lecture => Boolean(x))
    .map((lecture) => ({
      id: `mock-${lecture.id}`,
      lecture_id: lecture.id,
      // Mock events get a plausible-looking id so the popover's Calendar link
      // renders; it deliberately does not resolve to a real event.
      google_event_id: `mockevent${lecture.id.slice(0, 8)}`,
      lecture,
    }))
}

function sortEntries(a: ScheduleEntry, b: ScheduleEntry): number {
  const d = DAYS.indexOf(a.lecture.day_of_week) - DAYS.indexOf(b.lecture.day_of_week)
  return d !== 0 ? d : toMinutes(a.lecture.start_time) - toMinutes(b.lecture.start_time)
}

export const mockProvider: DataProvider = {
  kind: 'mock',

  async getSession() {
    await delay(80)
    return state.signedIn ? { user: currentUser() } : null
  },

  async signInWithGoogle() {
    await delay(500) // stands in for the OAuth round trip
    state = { ...state, signedIn: true }
    persist()
  },

  async signOut() {
    state = { ...state, signedIn: false }
    persist()
  },

  async captureProviderTokens() {
    // No OAuth in mock mode — there is nothing to persist.
  },

  onAuthChange(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },

  async getSemester() {
    return SEMESTER
  },

  async listSemesters() {
    // Read off the admin rows rather than the seed constant, so editing a
    // semester's dates in the admin screens moves the dashboard's teaching
    // window with it.
    return adminSemesters.map(({ name, start_date, end_date }) => ({
      name,
      start_date,
      end_date,
    }))
  },

  async listLectures(filters: LectureFilters = {}) {
    await delay()
    return applyFilters(joinedLectures(), filters, { studyYear: state.studyYear }).sort(
      (a, b) =>
        DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) ||
        toMinutes(a.start_time) - toMinutes(b.start_time),
    )
  },

  async listAcademicEvents() {
    await delay(120)
    return adminEvents
      .filter((e) => e.semester === null || e.semester === SEMESTER.name)
      .map((e) => ({ ...e }))
  },

  async getMyOverrides() {
    await delay(120)
    const enrolled = new Set(state.enrolled)
    return adminOverrides.filter((o) => enrolled.has(o.lecture_id)).map((o) => ({ ...o }))
  },

  async getStudyYear() {
    return state.studyYear
  },

  async setStudyYear(year: number | null) {
    state = { ...state, studyYear: year }
    persist()
  },

  async getPassedCourseCodes() {
    return [...state.passed]
  },

  async markCoursePassed(courseCode: string) {
    if (!state.passed.includes(courseCode)) {
      state = { ...state, passed: [...state.passed, courseCode] }
      persist()
    }
  },

  async unmarkCoursePassed(courseCode: string) {
    state = { ...state, passed: state.passed.filter((c) => c !== courseCode) }
    persist()
  },

  async getMySchedule() {
    await delay()
    return entriesFor(state.enrolled).sort(sortEntries)
  },

  async getUpcoming() {
    await delay(150)
    const now = new Date()
    const today = dayName(now)
    const nowMin = minutesOfDay(now)
    const mine = entriesFor(state.enrolled).sort(sortEntries)

    const remaining = today
      ? mine
          .filter((e) => e.lecture.day_of_week === today)
          .filter((e) => toMinutes(e.lecture.end_time) > nowMin)
      : []

    if (remaining.length > 0) {
      const [next, ...laterToday] = remaining
      return { next: next!, laterToday, nextOtherDay: null }
    }

    // Nothing left today — find the next class in the weekly cycle, wrapping
    // past the weekend if necessary.
    const todayIdx = today ? DAYS.indexOf(today) : -1
    let nextOtherDay: ScheduleEntry | null = null
    for (let step = 1; step <= DAYS.length && !nextOtherDay; step++) {
      const day = DAYS[(todayIdx + step + DAYS.length) % DAYS.length]!
      nextOtherDay = mine.find((e) => e.lecture.day_of_week === day) ?? null
    }

    return { next: null, laterToday: [], nextOtherDay }
  },

  async syncSchedule(diff: SyncDiff): Promise<SyncResult> {
    // Latency scaled by workload — one "Calendar call" per changed lecture.
    await delay(400 + (diff.to_add.length + diff.to_remove.length) * 120)

    const removed = new Set(diff.to_remove.map((x) => x.lecture_id))
    const next = state.enrolled.filter((id) => !removed.has(id))
    for (const id of diff.to_add) if (!next.includes(id)) next.push(id)

    state = { ...state, enrolled: next }
    persist()
    // The demo pretends Calendar succeeded, so the toast copy matches what a
    // fully configured deployment shows.
    return { success: true, errors: [], calendar: 'ok' }
  },

  // In-memory admin surface. Operates on the mutable copies above so create /
  // edit / delete are observable within a session; there is no real backend.
  admin: {
    async listCourses() {
      await delay(120)
      return adminCourses
        .map((x) => ({ ...x }))
        .sort((a, b) => a.course_name.localeCompare(b.course_name))
    },

    async createCourse(input: CourseInput) {
      const err = validateCourseInput(input)
      if (err) throw new Error(err)
      assertCourseTitleFree(input.course_name)
      await delay(120)
      const course: Course = { id: crypto.randomUUID(), ...input }
      adminCourses = [...adminCourses, course]
      return { ...course }
    },

    async updateCourse(id: string, input: CourseInput) {
      const err = validateCourseInput(input)
      if (err) throw new Error(err)
      assertCourseTitleFree(input.course_name, id)
      await delay(120)
      if (!adminCourses.some((c) => c.id === id)) throw new Error('Course not found')
      const updated: Course = { id, ...input }
      adminCourses = adminCourses.map((c) => (c.id === id ? updated : c))
      // Nothing else to write: every lecture of this course reads its name and
      // lecturer through joinedLectures(), so they inherit the edit as-is.
      return { ...updated }
    },

    async deleteCourse(id: string) {
      await delay(120)
      adminCourses = adminCourses.filter((c) => c.id !== id)
      // Mirrors `on delete cascade` in migration 0006 — a course's lectures
      // have no meaning without it.
      adminSchedule = adminSchedule.filter((l) => l.course_id !== id)
    },

    async listLectures() {
      await delay(120)
      return joinedLectures().sort(
        (a, b) =>
          a.course_code.localeCompare(b.course_code) ||
          DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) ||
          toMinutes(a.start_time) - toMinutes(b.start_time),
      )
    },

    async createLecture(input: LectureInput) {
      const err = validateLectureInput(input)
      if (err) throw new Error(err)
      assertSemesterExists(input.semester)
      assertCourseExists(input.course_id)
      await delay(120)
      const row: LectureRow = { id: crypto.randomUUID(), ...input }
      adminSchedule = [...adminSchedule, row]
      return joinLecture(row)
    },

    async updateLecture(id: string, input: LectureInput) {
      const err = validateLectureInput(input)
      if (err) throw new Error(err)
      assertSemesterExists(input.semester)
      assertCourseExists(input.course_id)
      await delay(120)
      if (!adminSchedule.some((l) => l.id === id)) throw new Error('Lecture not found')
      const row: LectureRow = { id, ...input }
      adminSchedule = adminSchedule.map((l) => (l.id === id ? row : l))
      return joinLecture(row)
    },

    async deleteLecture(id: string) {
      await delay(120)
      adminSchedule = adminSchedule.filter((l) => l.id !== id)
    },

    async bulkImportLectures(rows: LectureInput[]) {
      await delay(200)
      // The Edge Function rejects the whole batch when any row names a term
      // that does not exist, rather than importing the rest. Mirrored here so a
      // bad semester surfaces in tests instead of only in production.
      for (const name of new Set(rows.map((r) => r.semester))) {
        assertSemesterExists(name)
      }
      const { created, errors } = buildRows(rows)
      adminSchedule = [...adminSchedule, ...created]
      return { created: created.length, errors }
    },

    async replaceSemesterSchedule(semester: string, rows: LectureInput[]) {
      assertSemesterExists(semester)
      // Every row must belong to the term being replaced, or the delete below
      // would drop lectures the caller never offered to put back.
      for (const row of rows) {
        if (row.semester !== semester) {
          throw new Error(`Row is filed under ${row.semester}, not ${semester}.`)
        }
      }
      await delay(200)
      const { created, errors } = buildRows(rows)
      const doomed = adminSchedule.filter((l) => l.semester === semester)
      adminSchedule = [
        ...adminSchedule.filter((l) => l.semester !== semester),
        ...created,
      ]
      return { deleted: doomed.length, created: created.length, errors }
    },

    async listAcademicEvents(semester?: string) {
      await delay(120)
      return adminEvents
        .filter((e) => !semester || e.semester === semester || e.semester === null)
        .map((e) => ({ ...e }))
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
    },

    async createAcademicEvent(input: AcademicEventInput) {
      const err = validateAcademicEventInput(input)
      if (err) throw new Error(err)
      await delay(120)
      const event: AcademicEvent = { id: crypto.randomUUID(), ...input }
      adminEvents = [...adminEvents, event]
      return { ...event }
    },

    async updateAcademicEvent(id: string, input: AcademicEventInput) {
      const err = validateAcademicEventInput(input)
      if (err) throw new Error(err)
      await delay(120)
      if (!adminEvents.some((e) => e.id === id)) throw new Error('Academic event not found')
      const updated: AcademicEvent = { id, ...input }
      adminEvents = adminEvents.map((e) => (e.id === id ? updated : e))
      return { ...updated }
    },

    async deleteAcademicEvent(id: string) {
      await delay(120)
      adminEvents = adminEvents.filter((e) => e.id !== id)
    },

    async bulkImportAcademicEvents(rows: AcademicEventInput[]) {
      await delay(200)
      const errors: BulkImportResult['errors'] = []
      const created: AcademicEvent[] = []
      rows.forEach((row, i) => {
        const err = validateAcademicEventInput(row)
        if (err) {
          errors.push({ row: i + 1, message: err })
          return
        }
        created.push({ id: crypto.randomUUID(), ...row })
      })
      adminEvents = [...adminEvents, ...created]
      return { created: created.length, errors }
    },

    async listOverrides(semester?: string) {
      await delay(120)
      const inSemester = new Set(
        adminSchedule.filter((l) => !semester || l.semester === semester).map((l) => l.id),
      )
      return adminOverrides
        .filter((o) => inSemester.has(o.lecture_id))
        .map((o) => ({ ...o }))
        .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))
    },

    async createOverride(input: OverrideInput) {
      const err = validateOverrideInput(input)
      if (err) throw new Error(err)
      await delay(120)
      // Mirrors the unique (lecture_id, occurrence_date, kind) constraint in
      // migration 0005, so the mock rejects what the database would reject.
      const clash = adminOverrides.some(
        (o) =>
          o.lecture_id === input.lecture_id &&
          o.occurrence_date === input.occurrence_date &&
          o.kind === input.kind,
      )
      if (clash) throw new Error('That change already exists for this date.')
      const override: LectureOverride = { id: crypto.randomUUID(), ...input }
      adminOverrides = [...adminOverrides, override]
      return { ...override }
    },

    async updateOverride(id: string, input: OverrideInput) {
      const err = validateOverrideInput(input)
      if (err) throw new Error(err)
      await delay(120)
      if (!adminOverrides.some((o) => o.id === id)) throw new Error('Change not found')
      const updated: LectureOverride = { id, ...input }
      adminOverrides = adminOverrides.map((o) => (o.id === id ? updated : o))
      return { ...updated }
    },

    async deleteOverride(id: string) {
      await delay(120)
      adminOverrides = adminOverrides.filter((o) => o.id !== id)
    },

    async publishOverride(id: string): Promise<OverridePublishResult> {
      await delay(200)
      const override = adminOverrides.find((o) => o.id === id)
      if (!override) throw new Error('Change not found')
      // There is no Calendar in mock mode. Report the number of students who
      // *would* be updated, so the toast reads the same as it does for real.
      const enrolled = state.enrolled.includes(override.lecture_id) ? 1 : 0
      return { users_updated: enrolled, errors: [] }
    },

    async listSemesters() {
      await delay(120)
      return adminSemesters.map((s) => ({
        ...s,
        lecture_count: adminSchedule.filter((l) => l.semester === s.name).length,
      }))
    },

    async createSemester(input: SemesterInput) {
      const err = validateSemesterInput(input)
      if (err) throw new Error(err)
      await delay(120)
      if (adminSemesters.some((s) => s.name === input.name)) {
        throw new Error('A semester with that name already exists.')
      }
      adminSemesters = [
        ...adminSemesters,
        { ...input, is_current: false, lecture_count: 0 },
      ]
      return { name: input.name, start_date: input.start_date, end_date: input.end_date }
    },

    async updateSemester(name: string, input: SemesterInput) {
      const err = validateSemesterInput(input)
      if (err) throw new Error(err)
      await delay(120)
      adminSemesters = adminSemesters.map((s) =>
        s.name === name
          ? { ...s, start_date: input.start_date, end_date: input.end_date, time_zone: input.time_zone }
          : s,
      )
      return { name, start_date: input.start_date, end_date: input.end_date }
    },

    async setCurrentSemester(name: string) {
      await delay(120)
      adminSemesters = adminSemesters.map((s) => ({ ...s, is_current: s.name === name }))
    },

    async deleteSemester(name: string) {
      await delay(120)
      if (adminSchedule.some((l) => l.semester === name)) {
        throw new Error('Cannot delete a semester that still has lectures.')
      }
      adminSemesters = adminSemesters.filter((s) => s.name !== name)
    },

    async listUsers() {
      await delay(150)
      return mockUsers.map((u) => ({ ...u }))
    },

    async getUser(id: string): Promise<AdminUserDetail> {
      await delay(150)
      const base = mockUsers.find((u) => u.id === id)
      if (!base) throw new Error('User not found')
      const schedule =
        id === DEMO_USER.id ? entriesFor(state.enrolled).sort(sortEntries) : []
      return { ...base, schedule, passed_course_codes: [] }
    },

    async setUserRole(id: string, role: UserRole | null) {
      await delay(120)
      // Mirrors the guards in supabase/functions/admin/index.ts — the mock is
      // what the admin tests run against, so a rule only the Edge Function
      // knows is a rule nothing here can prove.
      if (role !== null && role !== 'admin') {
        throw new Error("role must be 'admin' or null")
      }
      if (role === null) {
        const admins = mockUsers.filter((u) => u.role === 'admin')
        if (admins.length <= 1 && admins.some((u) => u.id === id)) {
          throw new Error('Cannot remove the last admin')
        }
      }
      const i = mockUsers.findIndex((u) => u.id === id)
      if (i >= 0) mockUsers[i] = { ...mockUsers[i]!, role }
      // Changing the demo user's own role changes the session's too, as it
      // would for a real user whose next token carries the new claim.
      if (id === DEMO_USER.id) {
        state = { ...state, isAdmin: role === 'admin' }
        persist()
      }
    },

    async deleteUser(id: string) {
      await delay(120)
      const i = mockUsers.findIndex((u) => u.id === id)
      if (i >= 0) mockUsers.splice(i, 1)
    },

    async revokeUserTokens(id: string) {
      await delay(120)
      const i = mockUsers.findIndex((u) => u.id === id)
      if (i >= 0) {
        mockUsers[i] = {
          ...mockUsers[i]!,
          calendar: {
            connected: false,
            has_refresh_token: false,
            token_expires_at: null,
            token_valid: false,
          },
        }
      }
    },

    async getStats() {
      await delay(150)
      const connected = mockUsers.filter((u) => u.calendar.connected).length
      const withRefresh = mockUsers.filter((u) => u.calendar.has_refresh_token).length
      const enrollments = mockUsers.reduce((n, u) => n + u.enrolled_count, 0)
      return {
        totals: {
          users: mockUsers.length,
          admins: mockUsers.filter((u) => u.role === 'admin').length,
          courses: adminCourses.length,
          lectures: adminSchedule.length,
          enrollments,
          semesters: adminSemesters.length,
        },
        calendar: {
          connected_users: connected,
          users_with_refresh_token: withRefresh,
          adoption_rate: mockUsers.length ? connected / mockUsers.length : 0,
        },
        top_courses: joinedLectures()
          .slice(0, 5)
          .map((l, i) => ({
            lecture_id: l.id,
            course_code: l.course_code,
            course_name: l.course_name,
            count: 12 - i * 2,
          })),
      }
    },
  },
}
