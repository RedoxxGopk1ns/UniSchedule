import { withBackfill } from '../diff'
import { pgFilterValue } from '../postgrestFilter'
import { CALENDAR_SYNC_ENABLED, GOOGLE_SCOPES, supabase } from '../supabase'
import { dayName, minutesOfDay, toMinutes } from '../time'
import { SEMESTER } from './seed'
import type { DataProvider } from './provider'
import { DAYS, joinCourse } from './types'
import type {
  AcademicEvent,
  AcademicEventInput,
  AdminSemester,
  AdminStats,
  AdminUser,
  AdminUserDetail,
  BulkImportResult,
  Course,
  CourseInput,
  LectureCourseFields,
  LectureFilters,
  Lecture,
  LectureInput,
  LectureOverride,
  LectureRow,
  OverrideInput,
  OverridePublishResult,
  ReplaceScheduleResult,
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
 * Invoke the admin Edge Function. It returns { data } on success and a non-2xx
 * { error } otherwise; supabase-js surfaces the latter as `error` with the body
 * on `error.context`, which we unwrap so the UI shows the real message.
 */
async function adminInvoke<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase().functions.invoke('admin', {
    body: { action, payload },
  })
  if (error) {
    let message = error.message
    try {
      const body = await (error as { context?: Response }).context?.json?.()
      if (body?.error) message = body.error as string
    } catch {
      // Fall back to the generic message.
    }
    throw new Error(message)
  }
  return (data as { data: T }).data
}

/**
 * Real backend: Supabase Postgres for the catalogue and enrolments, Supabase
 * Edge Functions for anything that touches Google Calendar.
 *
 * Note what is absent: this file never reads google_access_token. Tokens live
 * behind RLS and are only ever handled inside the sync-schedule function
 * (§17) — the browser cannot see them.
 */

/**
 * A lecture and the course it teaches, as one PostgREST embed.
 *
 * Migration 0006 moved the course fields out of `lectures`, so they arrive
 * nested under `course` and are flattened by `flattenLecture` into the shape
 * the rest of the app reads. The embed is a plain foreign-key join on
 * `lectures.course_id`; doing it on every read is what makes a renamed course
 * appear on its lectures with nothing to backfill.
 */
const LECTURE_COLUMNS =
  'id, course_id, room, day_of_week, start_time, end_time, semester, course:courses!inner(course_code, course_name, professor, department, color_tag, subject, is_mandatory, study_year, semester_number, ects)'

/** A `lectures` row with its embedded course, before flattening. */
type EmbeddedLecture = LectureRow & { course: LectureCourseFields | null }

/**
 * Folds the embedded course up onto the lecture.
 *
 * A null `course` cannot happen — `course_id` is NOT NULL with a foreign key —
 * but PostgREST types the embed as nullable, and a row that somehow lost its
 * course is dropped rather than rendered with blank fields.
 */
function flattenLectures(rows: EmbeddedLecture[] | null): Lecture[] {
  return (rows ?? []).flatMap(({ course, ...row }) =>
    course ? [joinCourse(row, course)] : [],
  )
}

const ACADEMIC_EVENT_COLUMNS =
  'id, semester, kind, title, start_date, end_date, blocks_teaching'

const OVERRIDE_COLUMNS =
  'id, lecture_id, kind, occurrence_date, new_date, new_start_time, new_end_time, new_room, note'

function sortEntries(a: ScheduleEntry, b: ScheduleEntry): number {
  const d = DAYS.indexOf(a.lecture.day_of_week) - DAYS.indexOf(b.lecture.day_of_week)
  return d !== 0 ? d : toMinutes(a.lecture.start_time) - toMinutes(b.lecture.start_time)
}

export const supabaseProvider: DataProvider = {
  kind: 'supabase',

  async getSession(): Promise<Session | null> {
    const { data } = await supabase().auth.getSession()
    const user = data.session?.user
    if (!user) return null
    return {
      user: {
        id: user.id,
        full_name:
          (user.user_metadata?.full_name as string) ??
          (user.user_metadata?.name as string) ??
          user.email ??
          'Student',
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
        email: user.email ?? '',
        // app_metadata is set only via the service role and rides in the JWT,
        // so it is safe to trust here for gating the admin UI.
        role: (user.app_metadata?.role as UserRole) ?? null,
      },
    }
  },

  async signInWithGoogle() {
    const { error } = await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: GOOGLE_SCOPES,
        // Both are required to receive a refresh token. Without them Google
        // returns an access token only, and sync breaks silently an hour later
        // when it expires (§9 "Token Refresh"). With Calendar off there is no
        // offline access worth having, and prompt=consent would re-ask on
        // every single sign-in for nothing.
        queryParams: CALENDAR_SYNC_ENABLED
          ? { access_type: 'offline', prompt: 'consent' }
          : undefined,
      },
    })
    if (error) throw error
  },

  async signOut() {
    await supabase().auth.signOut()
  },

  async captureProviderTokens() {
    const { data } = await supabase().auth.getSession()
    const session = data.session
    if (!session?.user) return

    // provider_token / provider_refresh_token are present only on the session
    // returned right after the OAuth redirect. The refresh token in particular
    // is issued once, and only because signInWithOAuth requested
    // access_type=offline with prompt=consent.
    const accessToken = session.provider_token
    const refreshToken = session.provider_refresh_token
    if (!accessToken && !refreshToken) return

    const payload: Record<string, unknown> = {
      id: session.user.id,
      full_name:
        (session.user.user_metadata?.full_name as string) ??
        (session.user.user_metadata?.name as string) ??
        null,
      avatar_url: (session.user.user_metadata?.avatar_url as string) ?? null,
      updated_at: new Date().toISOString(),
    }

    if (accessToken) {
      payload.google_access_token = accessToken
      // Google access tokens last an hour; the function refreshes from 60s out.
      payload.token_expires_at = new Date(Date.now() + 3600_000).toISOString()
    }
    // Never overwrite a stored refresh token with null: Google only reissues it
    // on the first consent, so a later sign-in would wipe offline access.
    if (refreshToken) payload.google_refresh_token = refreshToken

    const { error } = await supabase()
      .from('user_profiles')
      .upsert(payload, { onConflict: 'id' })

    if (error) console.error('[UniSchedule] Failed to store Google tokens', error)
  },

  onAuthChange(cb: (session: Session | null) => void) {
    const { data } = supabase().auth.onAuthStateChange(() => {
      void supabaseProvider.getSession().then(cb)
    })
    return () => data.subscription.unsubscribe()
  },

  async getSemester(): Promise<Semester> {
    const { data, error } = await supabase()
      .from('semesters')
      .select('name, start_date, end_date')
      .eq('is_current', true)
      .maybeSingle()

    if (error || !data) return SEMESTER // fall back to the bundled constant
    return data as Semester
  },

  async listSemesters(): Promise<Semester[]> {
    const { data, error } = await supabase()
      .from('semesters')
      .select('name, start_date, end_date')
      .order('start_date')

    // Empty on failure, not the bundled constant: an unknown window makes
    // `withinTerm` fail open and the grid behaves as it did before this
    // existed. Guessing a window here would hide real lectures instead.
    if (error || !data) return []
    return data as Semester[]
  },

  async listLectures(filters: LectureFilters = {}): Promise<Lecture[]> {
    let query = supabase()
      .from('lectures')
      .select(LECTURE_COLUMNS)
      .order('day_of_week')
      .order('start_time')

    // Only the cheap, index-backed dimensions are pushed down to Postgres. The
    // selection screen fetches the catalogue once and filters in memory (see
    // SelectCourses), so the rest of LectureFilters is applied client-side by
    // applyFilters rather than duplicated as PostgREST predicates here.
    // `department` and `subject` live on `courses` now, so these push down
    // through the embed rather than as plain column predicates. `!inner` makes
    // the join filtering rather than merely decorative — without it PostgREST
    // returns every lecture and simply nulls the embed that fails the filter.
    if (filters.departments?.length) {
      query = query.in('courses.department', filters.departments)
    }
    if (filters.days?.length) query = query.in('day_of_week', filters.days)
    if (filters.subjects?.length) query = query.in('courses.subject', filters.subjects)
    if (filters.semester) query = query.eq('semester', filters.semester)
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`
      // All three searchable columns moved to `courses`, so the disjunction has
      // to be evaluated against the embedded table. Paired with the `!inner`
      // join above, a row whose course matches nothing drops out entirely.
      // Quoted: the search box is free text and a comma in it would end the
      // disjunct rather than the word. See pgFilterValue.
      const like = pgFilterValue(q)
      query = query.or(
        `course_code.ilike.${like},course_name.ilike.${like},professor.ilike.${like}`,
        { referencedTable: 'courses' },
      )
    }

    const { data, error } = await query
    if (error) throw error

    // day_of_week orders alphabetically in Postgres, so re-sort by weekday.
    return flattenLectures(data as unknown as EmbeddedLecture[]).sort(
      (a, b) =>
        DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) ||
        toMinutes(a.start_time) - toMinutes(b.start_time),
    )
  },

  async listAcademicEvents(): Promise<AcademicEvent[]> {
    const semester = await supabaseProvider.getSemester()
    // Rows with a null semester apply to the whole academic year, so they are
    // fetched alongside the current term's own.
    const { data, error } = await supabase()
      .from('academic_events')
      .select(ACADEMIC_EVENT_COLUMNS)
      .or(`semester.eq.${pgFilterValue(semester.name)},semester.is.null`)
      .order('start_date')

    if (error) throw error
    return data as unknown as AcademicEvent[]
  },

  async getMyOverrides(): Promise<LectureOverride[]> {
    const { data: auth } = await supabase().auth.getUser()
    if (!auth.user) return []

    // Only the lectures this student is actually enrolled in — the overrides
    // table is world-readable, but there is no reason to ship the whole term.
    const { data: rows, error: rowsError } = await supabase()
      .from('user_schedules')
      .select('lecture_id')
      .eq('user_id', auth.user.id)
    if (rowsError) throw rowsError

    const ids = (rows ?? []).map((r) => r.lecture_id as string)
    if (ids.length === 0) return []

    const { data, error } = await supabase()
      .from('lecture_overrides')
      .select(OVERRIDE_COLUMNS)
      .in('lecture_id', ids)
      .order('occurrence_date')

    if (error) throw error
    return data as unknown as LectureOverride[]
  },

  async getStudyYear(): Promise<number | null> {
    const { data: auth } = await supabase().auth.getUser()
    if (!auth.user) return null

    const { data, error } = await supabase()
      .from('user_profiles')
      .select('study_year')
      .eq('id', auth.user.id)
      .maybeSingle()

    if (error) return null
    return (data?.study_year as number | null) ?? null
  },

  async setStudyYear(year: number | null): Promise<void> {
    const { data: auth } = await supabase().auth.getUser()
    if (!auth.user) return

    // The profile row is created by the on_auth_user_created trigger, but
    // upsert keeps this correct for accounts that predate it.
    const { error } = await supabase()
      .from('user_profiles')
      .upsert({ id: auth.user.id, study_year: year }, { onConflict: 'id' })

    if (error) throw error
  },

  async getPassedCourseCodes(): Promise<string[]> {
    const { data: auth } = await supabase().auth.getUser()
    if (!auth.user) return []

    const { data, error } = await supabase()
      .from('user_passed_courses')
      .select('course_code')

    // RLS already scopes the rows to the caller, so no user_id filter is needed.
    if (error) return []
    return (data ?? []).map((row) => (row as { course_code: string }).course_code)
  },

  async markCoursePassed(courseCode: string): Promise<void> {
    const { data: auth } = await supabase().auth.getUser()
    if (!auth.user) return

    const { error } = await supabase()
      .from('user_passed_courses')
      .upsert(
        { user_id: auth.user.id, course_code: courseCode },
        { onConflict: 'user_id,course_code' },
      )

    if (error) throw error
  },

  async unmarkCoursePassed(courseCode: string): Promise<void> {
    const { data: auth } = await supabase().auth.getUser()
    if (!auth.user) return

    // Scoped explicitly as well as by RLS. The policy is what enforces this —
    // but a delete whose only user filter lives in a policy is one migration
    // away from being a delete of everyone's rows, and the id is right here.
    const { error } = await supabase()
      .from('user_passed_courses')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('course_code', courseCode)

    if (error) throw error
  },

  async getMySchedule(): Promise<ScheduleEntry[]> {
    // getSession rather than getUser: this is the dashboard's first request and
    // getUser costs a round trip to the auth server to revalidate the token.
    // The filter is defence in depth — RLS is what actually scopes the read, so
    // a stale session here returns nothing rather than someone else's rows.
    const { data: session } = await supabase().auth.getSession()
    const userId = session.session?.user.id
    if (!userId) return []

    const { data, error } = await supabase()
      .from('user_schedules')
      .select(`id, lecture_id, google_event_id, lecture:lectures(${LECTURE_COLUMNS})`)
      .eq('user_id', userId)

    if (error) throw error

    // Same flattening as listLectures, one level deeper: the embed nests the
    // course under each entry's lecture.
    return (data as unknown as { id: string; lecture_id: string; google_event_id: string | null; lecture: EmbeddedLecture | null }[])
      .flatMap(({ lecture, ...entry }) => {
        const [flat] = flattenLectures(lecture ? [lecture] : [])
        return flat ? [{ ...entry, lecture: flat }] : []
      })
      .sort(sortEntries)
  },

  async getUpcoming(): Promise<Upcoming> {
    // Computed client-side from the already-cached schedule: it is a handful of
    // rows, and this avoids a function invocation every five minutes.
    const mine = await supabaseProvider.getMySchedule()
    const now = new Date()
    const today = dayName(now)
    const nowMin = minutesOfDay(now)

    const remaining = today
      ? mine
          .filter((e) => e.lecture.day_of_week === today)
          .filter((e) => toMinutes(e.lecture.end_time) > nowMin)
      : []

    if (remaining.length > 0) {
      const [next, ...laterToday] = remaining
      return { next: next!, laterToday, nextOtherDay: null }
    }

    const todayIdx = today ? DAYS.indexOf(today) : -1
    let nextOtherDay: ScheduleEntry | null = null
    for (let step = 1; step <= DAYS.length && !nextOtherDay; step++) {
      const day = DAYS[(todayIdx + step + DAYS.length) % DAYS.length]!
      nextOtherDay = mine.find((e) => e.lecture.day_of_week === day) ?? null
    }

    return { next: null, laterToday: [], nextOtherDay }
  },

  /**
   * Enrolment is written to Postgres here, directly, before Google is involved
   * at all. Calendar is then best-effort.
   *
   * The ordering matters: if the Edge Function owned both writes, a Google
   * outage — or simply an unverified OAuth app — would mean the student's
   * selection is silently discarded. RLS scopes both statements to the caller,
   * so no explicit user_id filter is needed on the delete.
   */
  async syncSchedule(diff: SyncDiff): Promise<SyncResult> {
    const {
      data: { user },
    } = await supabase().auth.getUser()

    if (!user) {
      return {
        success: false,
        errors: [{ lecture_id: '', message: 'Not signed in.' }],
      }
    }

    if (diff.to_remove.length > 0) {
      const { error } = await supabase()
        .from('user_schedules')
        .delete()
        .eq('user_id', user.id)
        .in(
          'lecture_id',
          diff.to_remove.map((x) => x.lecture_id),
        )

      if (error) {
        return { success: false, errors: [{ lecture_id: '', message: error.message }] }
      }
    }

    if (diff.to_add.length > 0) {
      const { error } = await supabase()
        .from('user_schedules')
        .upsert(
          diff.to_add.map((lecture_id) => ({ user_id: user.id, lecture_id })),
          { onConflict: 'user_id,lecture_id' },
        )

      if (error) {
        return { success: false, errors: [{ lecture_id: '', message: error.message }] }
      }
    }

    // The schedule is safe from this point on. Everything below can fail
    // without costing the student their selection.
    if (!CALENDAR_SYNC_ENABLED) {
      return { success: true, errors: [], calendar: 'skipped' }
    }

    // Repair pass. An enrolment can sit in the table with no Calendar event —
    // it was created while sync was switched off, or the Calendar call failed
    // while the enrolment itself succeeded. `computeDiff` reports only what the
    // student just changed, so nothing would ever mention those rows again and
    // they would stay missing from Calendar permanently. Reading them back here
    // (rather than trusting the client's copy) also picks up rows written by an
    // earlier session or another device. RLS scopes the select to the caller.
    //
    // The rows just upserted above are themselves event-less, so they come back
    // in this query too; withBackfill deduplicates against to_add.
    let payload = diff
    const { data: unsynced, error: scanError } = await supabase()
      .from('user_schedules')
      .select('lecture_id')
      .eq('user_id', user.id)
      .is('google_event_id', null)

    if (scanError) {
      // A failed scan must not cost the student their actual change: fall
      // through with the plain diff and repair on some later save.
      console.warn('[UniSchedule] Calendar backfill scan failed', scanError)
    } else if (unsynced?.length) {
      payload = withBackfill(
        diff,
        unsynced.map((row) => row.lecture_id as string),
      )
    }

    const { data, error } = await supabase().functions.invoke('sync-schedule', {
      body: payload,
    })

    if (error) {
      return {
        success: true,
        errors: [{ lecture_id: '', message: error.message }],
        calendar: 'failed',
      }
    }

    const result = data as SyncResult
    return {
      success: true,
      errors: result.errors ?? [],
      calendar: result.success ? 'ok' : 'failed',
    }
  },

  // Every admin call routes through the admin Edge Function, which re-checks the
  // caller's admin claim and does all writes with the service role.
  admin: {
    listCourses: () => adminInvoke<Course[]>('course.list'),
    createCourse: (input: CourseInput) => adminInvoke<Course>('course.create', { input }),
    updateCourse: (id: string, input: CourseInput) =>
      adminInvoke<Course>('course.update', { id, input }),
    deleteCourse: async (id: string) => {
      await adminInvoke('course.delete', { id })
    },

    listLectures: () => adminInvoke<Lecture[]>('lecture.list'),
    createLecture: (input: LectureInput) => adminInvoke<Lecture>('lecture.create', { input }),
    updateLecture: (id: string, input: LectureInput) =>
      adminInvoke<Lecture>('lecture.update', { id, input }),
    deleteLecture: async (id: string) => {
      await adminInvoke('lecture.delete', { id })
    },
    bulkImportLectures: (rows: LectureInput[]) =>
      adminInvoke<BulkImportResult>('lecture.bulkImport', { rows }),
    replaceSemesterSchedule: (semester: string, rows: LectureInput[]) =>
      adminInvoke<ReplaceScheduleResult>('lecture.replaceSemester', { semester, rows }),

    listSemesters: () => adminInvoke<AdminSemester[]>('semester.list'),
    createSemester: (input: SemesterInput) => adminInvoke<Semester>('semester.create', { input }),
    updateSemester: (name: string, input: SemesterInput) =>
      adminInvoke<Semester>('semester.update', { name, input }),
    setCurrentSemester: async (name: string) => {
      await adminInvoke('semester.setCurrent', { name })
    },
    deleteSemester: async (name: string) => {
      await adminInvoke('semester.delete', { name })
    },

    listAcademicEvents: (semester?: string) =>
      adminInvoke<AcademicEvent[]>('academicEvent.list', { semester }),
    createAcademicEvent: (input: AcademicEventInput) =>
      adminInvoke<AcademicEvent>('academicEvent.create', { input }),
    updateAcademicEvent: (id: string, input: AcademicEventInput) =>
      adminInvoke<AcademicEvent>('academicEvent.update', { id, input }),
    deleteAcademicEvent: async (id: string) => {
      await adminInvoke('academicEvent.delete', { id })
    },
    bulkImportAcademicEvents: (rows: AcademicEventInput[]) =>
      adminInvoke<BulkImportResult>('academicEvent.bulkImport', { rows }),

    listOverrides: (semester?: string) =>
      adminInvoke<LectureOverride[]>('override.list', { semester }),
    createOverride: (input: OverrideInput) =>
      adminInvoke<LectureOverride>('override.create', { input }),
    updateOverride: (id: string, input: OverrideInput) =>
      adminInvoke<LectureOverride>('override.update', { id, input }),
    deleteOverride: async (id: string) => {
      await adminInvoke('override.delete', { id })
    },
    publishOverride: (id: string) =>
      adminInvoke<OverridePublishResult>('override.publish', { id }),

    listUsers: () => adminInvoke<AdminUser[]>('user.list'),
    getUser: (id: string) => adminInvoke<AdminUserDetail>('user.get', { id }),
    setUserRole: async (id: string, role: UserRole | null) => {
      await adminInvoke('user.setRole', { id, role })
    },
    deleteUser: async (id: string) => {
      await adminInvoke('user.delete', { id })
    },
    revokeUserTokens: async (id: string) => {
      await adminInvoke('user.revokeTokens', { id })
    },

    getStats: () => adminInvoke<AdminStats>('stats.overview'),
  },
}
