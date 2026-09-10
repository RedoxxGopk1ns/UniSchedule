import { mockProvider } from './mockProvider'
import { supabaseProvider } from './supabaseProvider'
import type {
  AcademicEvent,
  AcademicEventInput,
  AdminSemester,
  AdminStats,
  AdminUser,
  AdminUserDetail,
  BulkImportResult,
  LectureFilters,
  Lecture,
  LectureInput,
  LectureOverride,
  OverrideInput,
  OverridePublishResult,
  ScheduleEntry,
  Semester,
  SemesterInput,
  Session,
  SyncDiff,
  SyncResult,
  Upcoming,
  UserRole,
} from './types'

/**
 * Admin-only operations. Every method is authorised server-side by the `admin`
 * Edge Function (which re-checks the caller's admin claim); the UI reaching
 * these is gated by AdminRoute, but that gate is UX, not security.
 */
export interface AdminApi {
  // Catalogue — the full table, unfiltered by student rules.
  listLectures(): Promise<Lecture[]>
  createLecture(input: LectureInput): Promise<Lecture>
  updateLecture(id: string, input: LectureInput): Promise<Lecture>
  deleteLecture(id: string): Promise<void>
  bulkImportLectures(rows: LectureInput[]): Promise<BulkImportResult>

  // Semesters
  listSemesters(): Promise<AdminSemester[]>
  createSemester(input: SemesterInput): Promise<Semester>
  updateSemester(name: string, input: SemesterInput): Promise<Semester>
  setCurrentSemester(name: string): Promise<void>
  deleteSemester(name: string): Promise<void>

  // Academic calendar — holidays, breaks and the term's date markers, which
  // together decide which weeks a recurring lecture is *not* taught.
  listAcademicEvents(semester?: string): Promise<AcademicEvent[]>
  createAcademicEvent(input: AcademicEventInput): Promise<AcademicEvent>
  updateAcademicEvent(id: string, input: AcademicEventInput): Promise<AcademicEvent>
  deleteAcademicEvent(id: string): Promise<void>
  bulkImportAcademicEvents(rows: AcademicEventInput[]): Promise<BulkImportResult>

  // Per-occurrence overrides — one session cancelled, moved, or relocated.
  listOverrides(semester?: string): Promise<LectureOverride[]>
  createOverride(input: OverrideInput): Promise<LectureOverride>
  updateOverride(id: string, input: OverrideInput): Promise<LectureOverride>
  deleteOverride(id: string): Promise<void>
  /**
   * Pushes an override to the Google Calendar of everyone enrolled in the
   * lecture. Separate from create/update on purpose: an admin drafting a change
   * should not touch students' calendars until they say so.
   */
  publishOverride(id: string): Promise<OverridePublishResult>

  // Users
  listUsers(): Promise<AdminUser[]>
  getUser(id: string): Promise<AdminUserDetail>
  setUserRole(id: string, role: UserRole | null): Promise<void>
  deleteUser(id: string): Promise<void>
  revokeUserTokens(id: string): Promise<void>

  // Analytics
  getStats(): Promise<AdminStats>
}

/**
 * The single boundary between the UI and its backend.
 *
 * Two implementations exist — MockProvider (in-memory, zero config) and
 * SupabaseProvider (real auth, Postgres, and Google Calendar via Edge
 * Functions). Nothing above this file knows which one is live; the choice is
 * made once, here, from VITE_DATA_SOURCE.
 */
export interface DataProvider {
  /** Which implementation is running — surfaced in the UI as a demo badge. */
  readonly kind: 'mock' | 'supabase'

  // Auth
  getSession(): Promise<Session | null>
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>
  /**
   * Called once on the OAuth callback. Supabase surfaces Google's provider
   * tokens on the session exactly once, immediately after the redirect — if
   * they are not persisted here they are lost, and Calendar sync fails an hour
   * later when the access token expires.
   */
  captureProviderTokens(): Promise<void>
  /** Fires whenever the session changes. Returns an unsubscribe function. */
  onAuthChange(cb: (session: Session | null) => void): () => void

  // Catalogue
  getSemester(): Promise<Semester>
  /**
   * Every semester's teaching window, readable by any signed-in student.
   *
   * Distinct from `getSemester`, which answers "which term is it now" for the
   * catalogue. This answers "when is this lecture taught", which is a different
   * question once a student's enrolments outlive the term they were made in —
   * see `withinTerm` in src/lib/occurrences.ts. Not the same as
   * `admin.listSemesters`, which returns the editable rows behind the admin
   * gate; this one carries only the dates and needs no role.
   */
  listSemesters(): Promise<Semester[]>
  listLectures(filters?: LectureFilters): Promise<Lecture[]>

  /**
   * The student's year of study (1–4), or null if they have not set one.
   *
   * Read separately rather than folded into `getSession`, which builds its user
   * from auth metadata alone and costs no database round trip today (see
   * supabaseProvider.getSession). Only the course filters need this.
   */
  getStudyYear(): Promise<number | null>
  setStudyYear(year: number | null): Promise<void>

  /**
   * Passed courses — the course codes a student has already completed. Hidden
   * from the selection catalogue so they do not reappear each term, and
   * reviewable through the "Passed courses" toggle. Keyed by course_code, not
   * lecture id: passing a course hides every one of its sections at once.
   *
   * Marking a course passed only writes the passed set here; removing it from
   * the active schedule (and Calendar) is left to the caller via syncSchedule,
   * so the two writes reuse one code path (see SelectCourses).
   */
  getPassedCourseCodes(): Promise<string[]>
  markCoursePassed(courseCode: string): Promise<void>
  unmarkCoursePassed(courseCode: string): Promise<void>

  /**
   * The academic calendar for the current term, readable by every signed-in
   * student. Drives the holiday markings on the timetable — see
   * src/lib/occurrences.ts.
   */
  listAcademicEvents(): Promise<AcademicEvent[]>
  /** Overrides affecting the caller's own enrolments. */
  getMyOverrides(): Promise<LectureOverride[]>

  // Schedule
  getMySchedule(): Promise<ScheduleEntry[]>
  getUpcoming(): Promise<Upcoming>
  syncSchedule(diff: SyncDiff): Promise<SyncResult>

  /** Admin surface — see AdminApi. Present on both providers. */
  admin: AdminApi
}

let cached: DataProvider | null = null

/**
 * Resolved lazily and memoised. `supabase` requires VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY; if either is missing we fall back to mock rather than
 * crashing, because a broken env var should never take down a live demo.
 */
export function getProvider(): DataProvider {
  if (cached) return cached

  const source = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
  const hasCreds =
    Boolean(import.meta.env.VITE_SUPABASE_URL) &&
    Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)

  if (source === 'supabase' && !hasCreds) {
    console.warn(
      '[UniSchedule] VITE_DATA_SOURCE=supabase but Supabase credentials are missing. Falling back to mock data.',
    )
  }

  cached =
    source === 'supabase' && hasCreds ? supabaseProvider : mockProvider

  return cached
}
