/**
 * admin — the authoritative boundary for every admin operation (catalogue,
 * semesters, users, analytics). The `/admin` UI and the AdminRoute guard are
 * UX only; this function is the security boundary.
 *
 * Contract:  POST { action: string, payload: object }
 *   200 { data }        on success
 *   400 { error }       validation / bad request
 *   401 { error }       missing/!valid token
 *   403 { error }       authenticated but not an admin
 *
 * An admin is a user whose JWT app_metadata.role === 'admin' (see
 * supabase/admin/README.md). This is re-checked here on every call — never
 * trust the client.
 *
 * Deploy with:  supabase functions deploy admin
 * Reuses the same secrets as sync-schedule (SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  buildRecurrence,
  overrideSession,
  type AcademicEventRow,
  type OverrideRow,
} from '../_shared/recurrence.ts'
import { pgFilterValue } from '../_shared/postgrest.ts'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

const COURSE_COLUMNS =
  'id, course_code, course_name, professor, department, color_tag, subject, is_mandatory, study_year, semester_number, ects'

// A lecture with its course folded in, so admin reads return the same flat
// shape the frontend's `Lecture` type has always had. `!inner` because
// course_id is NOT NULL — there is no such thing as a lecture without a course.
const LECTURE_COLUMNS =
  'id, course_id, room, day_of_week, start_time, end_time, semester, courses!inner(course_code, course_name, professor, department, color_tag, subject, is_mandatory, study_year, semester_number, ects)'

const OVERRIDE_COLUMNS =
  'id, lecture_id, kind, occurrence_date, new_date, new_start_time, new_end_time, new_room, note'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

interface CourseInput {
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
 * A lecture is scheduling only since migration 0006 — the course fields are
 * reached through `course_id`. Accepting them here would let a lecture write
 * drift from its course, which is the bug that migration removes.
 */
interface LectureInput {
  course_id: string
  room: string | null
  day_of_week: string
  start_time: string
  end_time: string
  semester: string
}

interface SemesterInput {
  name: string
  start_date: string
  end_date: string
  time_zone: string
}

interface AcademicEventInput {
  semester: string | null
  kind: string
  title: string
  start_date: string
  end_date: string
  blocks_teaching: boolean
}

interface OverrideInput {
  lecture_id: string
  kind: string
  occurrence_date: string
  new_date: string | null
  new_start_time: string | null
  new_end_time: string | null
  new_room: string | null
  note: string | null
}

/**
 * The service-role client.
 *
 * Rows are deliberately `any`. Without generated database types, supabase-js
 * infers every PostgREST result as `never`, which made `deno check` emit ~57
 * errors of pure noise across this file and hid any real one. Generating types
 * would be better still, but it needs a live database connection at build time;
 * this at least makes the function typecheckable.
 */
// deno-lint-ignore no-explicit-any
type Supabase = SupabaseClient<any, any, any>

// --- Validation ------------------------------------------------------------

// Mirrors src/lib/time.ts. Optional seconds so Postgres `time` values pass too.
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

function isValidTime(time: string): boolean {
  return TIME_PATTERN.test(time)
}

/** Minutes since midnight, or NaN when the input is not a real clock time. */
function toMinutes(hhmm: string): number {
  if (!isValidTime(hhmm)) return Number.NaN
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

// The weekly grid the app can actually render. Must match GRID_START_HOUR /
// GRID_END_HOUR in src/lib/time.ts — this file cannot import from the frontend.
const GRID_START_MIN = 7 * 60
const GRID_END_MIN = 23 * 60

/** Returns an error message, or null when the input is valid. */
function validateCourse(input: Partial<CourseInput>): string | null {
  const required: (keyof CourseInput)[] = ['course_code', 'course_name', 'professor']
  for (const key of required) {
    const v = input[key]
    if (v === undefined || v === null || String(v).trim() === '') {
      return `Missing required field: ${key}`
    }
  }
  if (
    input.study_year !== null &&
    input.study_year !== undefined &&
    (!Number.isInteger(input.study_year) ||
      input.study_year < 1 ||
      input.study_year > 4)
  ) {
    return 'study_year must be between 1 and 4'
  }
  if (
    input.semester_number !== null &&
    input.semester_number !== undefined &&
    (!Number.isInteger(input.semester_number) ||
      input.semester_number < 1 ||
      input.semester_number > 8)
  ) {
    return 'semester_number must be between 1 and 8'
  }
  if (
    input.ects !== null &&
    input.ects !== undefined &&
    (!Number.isFinite(input.ects) || input.ects < 0 || input.ects > 30)
  ) {
    return 'ects must be between 0 and 30'
  }
  return null
}

/**
 * A lecture's own fields. Course code, name, professor and year of study are
 * validated on the course instead (validateCourse) and inherited from it;
 * whether `course_id` names a real course is answered by the foreign key.
 *
 * Mirrors validateLectureInput in src/lib/adminValidation.ts — change one,
 * change the other.
 */
function validateLecture(input: Partial<LectureInput>): string | null {
  const required: (keyof LectureInput)[] = [
    'course_id',
    'day_of_week',
    'start_time',
    'end_time',
    'semester',
  ]
  for (const key of required) {
    const v = input[key]
    if (v === undefined || v === null || String(v).trim() === '') {
      return `Missing required field: ${key}`
    }
  }
  if (!DAYS.includes(input.day_of_week as string)) {
    return `day_of_week must be one of ${DAYS.join(', ')}`
  }
  // Shape first: toMinutes is NaN for malformed input and NaN fails every
  // comparison, so an ordering check alone accepts '9am' and '25:00'. Those
  // then blow up the batch insert below as a raw Postgres type error.
  const start = input.start_time as string
  const end = input.end_time as string
  if (!isValidTime(start)) return 'start_time must be a 24-hour time, e.g. 09:00'
  if (!isValidTime(end)) return 'end_time must be a 24-hour time, e.g. 10:30'
  if (toMinutes(end) <= toMinutes(start)) {
    return 'end_time must be after start_time'
  }
  if (toMinutes(start) < GRID_START_MIN || toMinutes(end) > GRID_END_MIN) {
    return 'lecture must fall within the 07:00-23:00 timetable'
  }
  return null
}

function validateSemester(input: Partial<SemesterInput>): string | null {
  if (!input.name || String(input.name).trim() === '') return 'Missing required field: name'
  if (!input.start_date) return 'Missing required field: start_date'
  if (!input.end_date) return 'Missing required field: end_date'
  // Teaching is Monday to Friday, so the term cannot open at the weekend. It
  // used to have to be a Monday because sync-schedule's firstOccurrence added a
  // fixed weekday offset; that now walks forward to the lecture's own weekday,
  // and the real spring term starts on Tuesday 24/02/2026.
  // Both dates go through isValidDate rather than a bare Date parse. The end
  // date in particular used to be compared without being checked, and an
  // unparseable one is `Invalid Date`, which compares false against
  // everything — so `end <= start` was false and the row went through. The
  // client twin rejected it, which meant the authoritative validator was the
  // weaker of the two. It also catches '2026-02-31', which Date rolls into
  // March instead of refusing.
  if (!isValidDate(input.start_date)) return 'start_date must be a date, e.g. 2026-02-24'
  if (!isValidDate(input.end_date)) return 'end_date must be a date, e.g. 2026-06-05'

  const start = new Date(`${input.start_date}T00:00:00Z`)
  if (start.getUTCDay() === 0 || start.getUTCDay() === 6) {
    return 'start_date must be a weekday'
  }
  if (new Date(`${input.end_date}T00:00:00Z`) <= start) {
    return 'end_date must be after start_date'
  }
  return null
}

const ACADEMIC_EVENT_KINDS = [
  'holiday',
  'break',
  'exam_period',
  'makeup_week',
  'teaching_start',
  'teaching_end',
  'presentations',
  'other',
]

const OVERRIDE_KINDS = ['cancelled', 'moved', 'room_change', 'extra']

/** Well-formed ISO 'YYYY-MM-DD' that is also a real calendar date. */
function isValidDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  // Round-tripping catches '2026-02-31', which Date rolls forward into March.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function validateAcademicEvent(input: Partial<AcademicEventInput>): string | null {
  if (!input.title || String(input.title).trim() === '') {
    return 'Missing required field: title'
  }
  if (!input.kind) return 'Missing required field: kind'
  if (!ACADEMIC_EVENT_KINDS.includes(input.kind as string)) {
    return `kind must be one of ${ACADEMIC_EVENT_KINDS.join(', ')}`
  }
  if (!isValidDate(input.start_date)) return 'start_date must be a date, e.g. 2026-03-25'
  if (!isValidDate(input.end_date)) return 'end_date must be a date, e.g. 2026-04-17'
  // Inclusive range — a single-day holiday repeats the same date, so equal is
  // valid here, unlike a semester where end must be strictly after start.
  if ((input.end_date as string) < (input.start_date as string)) {
    return 'end_date must be on or after start_date'
  }
  return null
}

function validateOverride(input: Partial<OverrideInput>): string | null {
  if (!input.lecture_id || String(input.lecture_id).trim() === '') {
    return 'Missing required field: lecture_id'
  }
  if (!input.kind) return 'Missing required field: kind'
  if (!OVERRIDE_KINDS.includes(input.kind as string)) {
    return `kind must be one of ${OVERRIDE_KINDS.join(', ')}`
  }
  if (!isValidDate(input.occurrence_date)) {
    return 'occurrence_date must be a date, e.g. 2026-03-25'
  }
  // 'cancelled' needs nothing else; the rest each require their own fields.
  // Migration 0005 carries the same checks as table constraints.
  if (input.kind === 'moved' && !isValidDate(input.new_date)) {
    return 'a moved session needs new_date'
  }
  if (input.kind === 'moved' || input.kind === 'extra') {
    const start = input.new_start_time as string
    const end = input.new_end_time as string
    if (!start || !end) return 'new_start_time and new_end_time are required'
    if (!isValidTime(start)) return 'new_start_time must be a 24-hour time, e.g. 09:00'
    if (!isValidTime(end)) return 'new_end_time must be a 24-hour time, e.g. 10:30'
    if (toMinutes(end) <= toMinutes(start)) {
      return 'new_end_time must be after new_start_time'
    }
    if (toMinutes(start) < GRID_START_MIN || toMinutes(end) > GRID_END_MIN) {
      return 'session must fall within the 07:00-23:00 timetable'
    }
  }
  if (input.kind === 'room_change') {
    if (!input.new_room || String(input.new_room).trim() === '') {
      return 'a room change needs new_room'
    }
  }
  return null
}

/** Only the known columns — never trust extra keys from the client. */
function cleanCourse(input: CourseInput): CourseInput {
  return {
    course_code: input.course_code.trim(),
    course_name: input.course_name.trim(),
    professor: input.professor.trim(),
    department: input.department?.trim() || null,
    color_tag: input.color_tag?.trim() || null,
    subject: input.subject?.trim() || null,
    is_mandatory: Boolean(input.is_mandatory),
    study_year: input.study_year ?? null,
    semester_number: input.semester_number ?? null,
    ects: input.ects ?? null,
  }
}

function cleanLecture(input: LectureInput): LectureInput {
  return {
    course_id: input.course_id,
    room: input.room?.trim() || null,
    day_of_week: input.day_of_week,
    start_time: input.start_time,
    end_time: input.end_time,
    semester: input.semester,
  }
}

/**
 * Folds the embedded course up onto the lecture, so every admin read returns
 * the flat shape the frontend expects.
 */
// deno-lint-ignore no-explicit-any
function flattenLecture(row: any) {
  const { courses, ...lecture } = row
  return { ...lecture, ...courses }
}

/**
 * Validates and inserts a batch of lectures, collecting per-row failures.
 *
 * Shared by lecture.bulkImport and lecture.replaceSemester so the two cannot
 * drift. Row numbers are carried alongside the payload, so a failure is
 * reported against the line the admin actually saw.
 */
async function insertLectures(supabase: Supabase, rows: LectureInput[]) {
  const errors: { row: number; message: string }[] = []
  const valid: { row: number; input: LectureInput }[] = []
  const semesters = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const err = validateLecture(rows[i])
    if (err) {
      errors.push({ row: i + 1, message: err })
      continue
    }
    valid.push({ row: i + 1, input: cleanLecture(rows[i]) })
    semesters.add(rows[i].semester)
  }
  // Reject the whole import if it references an unknown semester.
  for (const name of semesters) {
    const exists = await semesterExists(supabase, name)
    if (!exists) throw new BadRequest(`Unknown semester: ${name}`)
  }

  let created = 0
  if (valid.length) {
    // One statement for the common case. Postgres rejects the whole batch if
    // any single row violates a constraint, so on failure fall back to per-row
    // inserts: a bad row must cost only itself, not the other 199.
    const { data, error } = await supabase
      .from('lectures')
      .insert(valid.map((v) => v.input))
      .select('id')
    if (!error) {
      created = data?.length ?? 0
    } else {
      for (const { row, input } of valid) {
        const { error: rowError } = await supabase.from('lectures').insert(input)
        if (rowError) errors.push({ row, message: rowError.message })
        else created++
      }
    }
  }
  errors.sort((a, b) => a.row - b.row)
  return { created, errors }
}

/** Rejects a lecture pointing at a course that does not exist. */
async function assertCourseExists(supabase: Supabase, id: string) {
  const { data } = await supabase.from('courses').select('id').eq('id', id).maybeSingle()
  if (!data) throw new BadRequest(`Unknown course: ${id}`)
}

function cleanAcademicEvent(input: AcademicEventInput): AcademicEventInput {
  return {
    semester: input.semester?.trim() || null,
    kind: input.kind,
    title: input.title.trim(),
    start_date: input.start_date,
    end_date: input.end_date,
    blocks_teaching: Boolean(input.blocks_teaching),
  }
}

function cleanOverride(input: OverrideInput): OverrideInput {
  return {
    lecture_id: input.lecture_id,
    kind: input.kind,
    occurrence_date: input.occurrence_date,
    new_date: input.new_date || null,
    new_start_time: input.new_start_time || null,
    new_end_time: input.new_end_time || null,
    new_room: input.new_room?.trim() || null,
    note: input.note?.trim() || null,
  }
}

// --- Google Calendar cleanup ----------------------------------------------

async function ensureAccessToken(supabase: Supabase, userId: string): Promise<string> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('google_access_token, google_refresh_token, token_expires_at')
    .eq('id', userId)
    .single()
  if (error || !profile) throw new Error('Profile not found')

  const expiresAt = profile.token_expires_at
    ? new Date(profile.token_expires_at as string).getTime()
    : 0
  if (profile.google_access_token && expiresAt > Date.now() + 60_000) {
    return profile.google_access_token as string
  }
  if (!profile.google_refresh_token) throw new Error('No refresh token')

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: profile.google_refresh_token as string,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  const token = await res.json()
  await supabase
    .from('user_profiles')
    .update({
      google_access_token: token.access_token,
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  return token.access_token as string
}

/**
 * Best-effort deletion of the given users' Calendar events. A user whose token
 * is gone is skipped rather than failing the whole operation — the DB rows are
 * removed regardless, matching sync-schedule's "schedule first" philosophy.
 */
async function deleteCalendarEvents(
  supabase: Supabase,
  rows: { user_id: string; google_event_id: string | null }[],
): Promise<void> {
  const byUser = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.google_event_id) continue
    const list = byUser.get(r.user_id) ?? []
    list.push(r.google_event_id)
    byUser.set(r.user_id, list)
  }
  for (const [userId, eventIds] of byUser) {
    try {
      const token = await ensureAccessToken(supabase, userId)
      for (const eid of eventIds) {
        const res = await fetch(`${CALENDAR_API}/${eid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        // 404/410 mean the user already removed it — not an error.
        if (!res.ok && res.status !== 404 && res.status !== 410) {
          console.error(`[admin] calendar delete ${eid} -> ${res.status}`)
        }
      }
    } catch (e) {
      console.error(`[admin] skipping calendar cleanup for ${userId}:`, e)
    }
  }
}

// --- Audit -----------------------------------------------------------------

async function audit(
  supabase: Supabase,
  actor: { id: string; email?: string | null },
  action: string,
  target: string | null,
  summary: unknown,
): Promise<void> {
  try {
    await supabase.from('admin_audit_log').insert({
      actor_id: actor.id,
      actor_email: actor.email ?? null,
      action,
      target,
      summary,
    })
  } catch (e) {
    console.error('[admin] audit write failed', e)
  }
}

// --- Action handlers -------------------------------------------------------

async function handle(
  supabase: Supabase,
  actor: { id: string; email?: string | null },
  action: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  switch (action) {
    // ---- Courses ---------------------------------------------------------
    //
    // What the department teaches, independent of any term. Hand-maintained:
    // a timetable import reads this table to resolve a parsed title, and never
    // writes to it.
    case 'course.list': {
      const { data, error } = await supabase
        .from('courses')
        .select(COURSE_COLUMNS)
        .order('course_name')
      if (error) throw new Error(error.message)
      return data
    }
    case 'course.create': {
      const input = payload.input as CourseInput
      const err = validateCourse(input)
      if (err) throw new BadRequest(err)
      const { data, error } = await supabase
        .from('courses')
        .insert(cleanCourse(input))
        .select(COURSE_COLUMNS)
        .single()
      // course_name is unique — it is what a timetable import matches on.
      if (error) {
        if (error.code === '23505') {
          throw new BadRequest(`A course named ${input.course_name.trim()} already exists.`)
        }
        throw new Error(error.message)
      }
      await audit(supabase, actor, action, data.id as string, {
        course_code: input.course_code,
      })
      return data
    }
    case 'course.update': {
      const id = payload.id as string
      const input = payload.input as CourseInput
      const err = validateCourse(input)
      if (err) throw new BadRequest(err)
      const { data, error } = await supabase
        .from('courses')
        .update(cleanCourse(input))
        .eq('id', id)
        .select(COURSE_COLUMNS)
        .single()
      if (error) {
        if (error.code === '23505') {
          throw new BadRequest(`A course named ${input.course_name.trim()} already exists.`)
        }
        throw new Error(error.message)
      }
      // Nothing to propagate: every lecture of this course reads its name and
      // lecturer through the foreign key, so they are already up to date.
      await audit(supabase, actor, action, id, { course_code: input.course_code })
      return data
    }
    case 'course.delete': {
      const id = payload.id as string
      // `lectures.course_id` cascades, and `user_schedules.lecture_id` cascades
      // from there, so Calendar events have to be cleaned up first — by the
      // time the delete returns, the rows holding the event ids are gone.
      const { data: affected } = await supabase
        .from('user_schedules')
        .select('user_id, google_event_id, lectures!inner(course_id)')
        .eq('lectures.course_id', id)
      await deleteCalendarEvents(
        supabase,
        (affected ?? []) as { user_id: string; google_event_id: string | null }[],
      )
      const { error } = await supabase.from('courses').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, id, { enrolled: affected?.length ?? 0 })
      return { ok: true }
    }

    // ---- Lectures --------------------------------------------------------
    case 'lecture.list': {
      const { data, error } = await supabase
        .from('lectures')
        .select(LECTURE_COLUMNS)
        .order('day_of_week')
        .order('start_time')
      if (error) throw new Error(error.message)
      // deno-lint-ignore no-explicit-any
      return (data as any[]).map(flattenLecture)
    }
    case 'lecture.create': {
      const input = payload.input as LectureInput
      const err = validateLecture(input)
      if (err) throw new BadRequest(err)
      await assertSemesterExists(supabase, input.semester)
      await assertCourseExists(supabase, input.course_id)
      const { data, error } = await supabase
        .from('lectures')
        .insert(cleanLecture(input))
        .select(LECTURE_COLUMNS)
        .single()
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, data.id as string, {
        course_id: input.course_id,
      })
      return flattenLecture(data)
    }
    case 'lecture.update': {
      const id = payload.id as string
      const input = payload.input as LectureInput
      const err = validateLecture(input)
      if (err) throw new BadRequest(err)
      await assertSemesterExists(supabase, input.semester)
      await assertCourseExists(supabase, input.course_id)
      const { data, error } = await supabase
        .from('lectures')
        .update(cleanLecture(input))
        .eq('id', id)
        .select(LECTURE_COLUMNS)
        .single()
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, id, { course_id: input.course_id })
      return flattenLecture(data)
    }
    case 'lecture.delete': {
      const id = payload.id as string
      // Clean up Calendar events for everyone enrolled BEFORE the cascade
      // removes the user_schedules rows that hold the event ids.
      const { data: affected } = await supabase
        .from('user_schedules')
        .select('user_id, google_event_id')
        .eq('lecture_id', id)
      await deleteCalendarEvents(
        supabase,
        (affected ?? []) as { user_id: string; google_event_id: string | null }[],
      )
      const { error } = await supabase.from('lectures').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, id, { enrolled: affected?.length ?? 0 })
      return { ok: true }
    }
    case 'lecture.bulkImport': {
      const rows = (payload.rows as LectureInput[]) ?? []
      const { created, errors } = await insertLectures(supabase, rows)
      await audit(supabase, actor, action, null, { created, failed: errors.length })
      return { created, errors }
    }
    case 'lecture.replaceSemester': {
      // The timetable import's commit: one term's schedule is rebuilt from the
      // PDF rather than diffed against what is there. A lecture holds only
      // where and when, both of which the PDF is the authority on, so nothing
      // is lost by replacing — and the admin's job stays "approve these rows".
      const semester = payload.semester as string
      const rows = (payload.rows as LectureInput[]) ?? []
      await assertSemesterExists(supabase, semester)
      // Every row must belong to the term being replaced. Without this a
      // mislabelled row would survive the delete below while its term's real
      // lectures were removed and not put back.
      for (const row of rows) {
        if (row.semester !== semester) {
          throw new BadRequest(`Row is filed under ${row.semester}, not ${semester}.`)
        }
      }

      // Calendar first, for the same reason as lecture.delete: the cascade
      // takes the user_schedules rows that hold the event ids with it.
      const { data: affected } = await supabase
        .from('user_schedules')
        .select('user_id, google_event_id, lectures!inner(semester)')
        .eq('lectures.semester', semester)
      await deleteCalendarEvents(
        supabase,
        (affected ?? []) as { user_id: string; google_event_id: string | null }[],
      )

      const { data: doomed, error: deleteError } = await supabase
        .from('lectures')
        .delete()
        .eq('semester', semester)
        .select('id')
      if (deleteError) throw new Error(deleteError.message)

      const { created, errors } = await insertLectures(supabase, rows)
      const deleted = doomed?.length ?? 0
      await audit(supabase, actor, action, null, {
        semester,
        deleted,
        created,
        failed: errors.length,
        enrolled: affected?.length ?? 0,
      })
      return { deleted, created, errors }
    }

    // ---- Academic calendar -----------------------------------------------
    case 'academicEvent.list': {
      let query = supabase
        .from('academic_events')
        .select('id, semester, kind, title, start_date, end_date, blocks_teaching')
        .order('start_date')
      const semester = payload.semester as string | undefined
      // A null semester means the row spans the whole academic year, so it is
      // always in scope.
      if (semester) {
        query = query.or(`semester.eq.${pgFilterValue(semester)},semester.is.null`)
      }
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return data
    }
    case 'academicEvent.create': {
      const input = payload.input as AcademicEventInput
      const err = validateAcademicEvent(input)
      if (err) throw new BadRequest(err)
      if (input.semester) await assertSemesterExists(supabase, input.semester)
      const { data, error } = await supabase
        .from('academic_events')
        .insert(cleanAcademicEvent(input))
        .select('id, semester, kind, title, start_date, end_date, blocks_teaching')
        .single()
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, data.id as string, { title: input.title })
      return data
    }
    case 'academicEvent.update': {
      const id = payload.id as string
      const input = payload.input as AcademicEventInput
      const err = validateAcademicEvent(input)
      if (err) throw new BadRequest(err)
      if (input.semester) await assertSemesterExists(supabase, input.semester)
      const { data, error } = await supabase
        .from('academic_events')
        .update(cleanAcademicEvent(input))
        .eq('id', id)
        .select('id, semester, kind, title, start_date, end_date, blocks_teaching')
        .single()
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, id, { title: input.title })
      return data
    }
    case 'academicEvent.delete': {
      const id = payload.id as string
      const { error } = await supabase.from('academic_events').delete().eq('id', id)
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, id, null)
      return { ok: true }
    }
    case 'academicEvent.bulkImport': {
      // Same shape as lecture.bulkImport, including the per-row fallback: one
      // malformed row must not cost the other twenty-three.
      const rows = (payload.rows as AcademicEventInput[]) ?? []
      const errors: { row: number; message: string }[] = []
      const valid: { row: number; input: AcademicEventInput }[] = []
      const semesters = new Set<string>()
      for (let i = 0; i < rows.length; i++) {
        const err = validateAcademicEvent(rows[i])
        if (err) {
          errors.push({ row: i + 1, message: err })
          continue
        }
        valid.push({ row: i + 1, input: cleanAcademicEvent(rows[i]) })
        if (rows[i].semester) semesters.add(rows[i].semester as string)
      }
      for (const name of semesters) {
        const exists = await semesterExists(supabase, name)
        if (!exists) throw new BadRequest(`Unknown semester: ${name}`)
      }
      let created = 0
      if (valid.length) {
        const { data, error } = await supabase
          .from('academic_events')
          .insert(valid.map((v) => v.input))
          .select('id')
        if (!error) {
          created = data?.length ?? 0
        } else {
          for (const { row, input } of valid) {
            const { error: rowError } = await supabase.from('academic_events').insert(input)
            if (rowError) errors.push({ row, message: rowError.message })
            else created++
          }
        }
      }
      errors.sort((a, b) => a.row - b.row)
      await audit(supabase, actor, action, null, { created, failed: errors.length })
      return { created, errors }
    }

    // ---- Per-occurrence overrides ----------------------------------------
    case 'override.list': {
      const semester = payload.semester as string | undefined
      let lectureIds: string[] | null = null
      if (semester) {
        const { data: lectures } = await supabase
          .from('lectures')
          .select('id')
          .eq('semester', semester)
        lectureIds = (lectures ?? []).map((l) => l.id as string)
        if (lectureIds.length === 0) return []
      }
      let query = supabase
        .from('lecture_overrides')
        .select(OVERRIDE_COLUMNS)
        .order('occurrence_date')
      if (lectureIds) query = query.in('lecture_id', lectureIds)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return data
    }
    case 'override.create': {
      const input = payload.input as OverrideInput
      const err = validateOverride(input)
      if (err) throw new BadRequest(err)
      await assertLectureExists(supabase, input.lecture_id)
      const { data, error } = await supabase
        .from('lecture_overrides')
        .insert(cleanOverride(input))
        .select(OVERRIDE_COLUMNS)
        .single()
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, data.id as string, {
        lecture_id: input.lecture_id,
        kind: input.kind,
        date: input.occurrence_date,
      })
      return data
    }
    case 'override.update': {
      const id = payload.id as string
      const input = payload.input as OverrideInput
      const err = validateOverride(input)
      if (err) throw new BadRequest(err)
      await assertLectureExists(supabase, input.lecture_id)
      const { data, error } = await supabase
        .from('lecture_overrides')
        .update(cleanOverride(input))
        .eq('id', id)
        .select(OVERRIDE_COLUMNS)
        .single()
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, id, { kind: input.kind })
      return data
    }
    case 'override.delete': {
      const id = payload.id as string
      // Remove the one-off events this override put on students' calendars
      // before the row (and its cascade) disappears.
      const { data: published } = await supabase
        .from('user_override_events')
        .select('user_id, google_event_id')
        .eq('override_id', id)
      await deleteCalendarEvents(
        supabase,
        (published ?? []) as { user_id: string; google_event_id: string | null }[],
      )
      const { error } = await supabase.from('lecture_overrides').delete().eq('id', id)
      if (error) throw new Error(error.message)
      // The series still has this date excluded until it is republished, so
      // say so in the audit trail rather than pretending the change is undone.
      await audit(supabase, actor, action, id, { unpublished: published?.length ?? 0 })
      return { ok: true }
    }
    case 'override.publish': {
      return await publishOverride(supabase, actor, payload.id as string)
    }

    // ---- Semesters -------------------------------------------------------
    case 'semester.list': {
      const { data: sems, error } = await supabase
        .from('semesters')
        .select('name, start_date, end_date, time_zone, is_current')
        .order('start_date', { ascending: false })
      if (error) throw new Error(error.message)
      const { data: lectures } = await supabase.from('lectures').select('semester')
      const counts = new Map<string, number>()
      for (const l of lectures ?? []) {
        counts.set(l.semester as string, (counts.get(l.semester as string) ?? 0) + 1)
      }
      return (sems ?? []).map((s) => ({ ...s, lecture_count: counts.get(s.name as string) ?? 0 }))
    }
    case 'semester.create': {
      const input = payload.input as SemesterInput
      const err = validateSemester(input)
      if (err) throw new BadRequest(err)
      const { data, error } = await supabase
        .from('semesters')
        .insert({
          name: input.name.trim(),
          start_date: input.start_date,
          end_date: input.end_date,
          time_zone: input.time_zone || 'Europe/Athens',
        })
        .select('name, start_date, end_date')
        .single()
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, input.name, null)
      return data
    }
    case 'semester.update': {
      const name = payload.name as string
      const input = payload.input as SemesterInput
      const err = validateSemester(input)
      if (err) throw new BadRequest(err)
      const { data, error } = await supabase
        .from('semesters')
        .update({
          start_date: input.start_date,
          end_date: input.end_date,
          time_zone: input.time_zone || 'Europe/Athens',
        })
        .eq('name', name)
        .select('name, start_date, end_date')
        .single()
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, name, null)
      return data
    }
    case 'semester.setCurrent': {
      const name = payload.name as string
      // The partial unique index allows only one current row, so clear first.
      await supabase.from('semesters').update({ is_current: false }).eq('is_current', true)
      const { error } = await supabase
        .from('semesters')
        .update({ is_current: true })
        .eq('name', name)
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, name, null)
      return { ok: true }
    }
    case 'semester.delete': {
      const name = payload.name as string
      const { count } = await supabase
        .from('lectures')
        .select('id', { count: 'exact', head: true })
        .eq('semester', name)
      if ((count ?? 0) > 0) {
        throw new BadRequest(`Cannot delete: ${count} lecture(s) still use this semester`)
      }
      const { error } = await supabase.from('semesters').delete().eq('name', name)
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, name, null)
      return { ok: true }
    }

    // ---- Users -----------------------------------------------------------
    case 'user.list': {
      return await listUsers(supabase)
    }
    case 'user.get': {
      const id = payload.id as string
      const users = await listUsers(supabase)
      const base = users.find((u) => u.id === id)
      if (!base) throw new BadRequest('User not found')
      const { data: schedule } = await supabase
        .from('user_schedules')
        .select(`id, lecture_id, google_event_id, lecture:lectures(${LECTURE_COLUMNS})`)
        .eq('user_id', id)
      const { data: passed } = await supabase
        .from('user_passed_courses')
        .select('course_code')
        .eq('user_id', id)
      return {
        ...base,
        schedule: (schedule ?? [])
          .filter((e) => e.lecture)
          .map((e) => ({ ...e, lecture: flattenLecture(e.lecture) })),
        passed_course_codes: (passed ?? []).map((p) => p.course_code),
      }
    }
    case 'user.setRole': {
      const id = payload.id as string
      if (!id || String(id).trim() === '') {
        throw new BadRequest('Missing required field: id')
      }

      // Two roles exist and nothing checks for a third. An unrecognised value
      // written into app_metadata reads as "not an admin" everywhere in the
      // app while looking deliberate in the users table, so a typo would take
      // someone's access away silently. The UI only ever sends 'admin' or
      // null; this is for anything that talks to the function directly.
      const raw = payload.role ?? null
      if (raw !== null && raw !== 'admin') {
        throw new BadRequest("role must be 'admin' or null")
      }
      const role = raw as 'admin' | null

      // Removing the last admin is unrecoverable from inside the app: this
      // function checks the admin claim on every call, so with no admin left
      // there is no way to grant one back. Recovery would mean the Supabase
      // dashboard or a service-role SQL session. Demoting yourself while
      // another admin exists is allowed — that is reversible.
      if (role === null) {
        const admins = (await listUsers(supabase)).filter((u) => u.role === 'admin')
        if (admins.length <= 1 && admins.some((u) => u.id === id)) {
          throw new BadRequest('Cannot remove the last admin')
        }
      }

      const { error } = await supabase.auth.admin.updateUserById(id, {
        app_metadata: { role },
      })
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, id, { role })
      return { ok: true }
    }
    case 'user.revokeTokens': {
      const id = payload.id as string
      const { error } = await supabase
        .from('user_profiles')
        .update({
          google_access_token: null,
          google_refresh_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, id, null)
      return { ok: true }
    }
    case 'user.delete': {
      const id = payload.id as string
      // Remove their Calendar events first, then delete the auth user (which
      // cascades profile/schedules/passed rows).
      const { data: rows } = await supabase
        .from('user_schedules')
        .select('user_id, google_event_id')
        .eq('user_id', id)
      await deleteCalendarEvents(
        supabase,
        (rows ?? []) as { user_id: string; google_event_id: string | null }[],
      )
      const { error } = await supabase.auth.admin.deleteUser(id)
      if (error) throw new Error(error.message)
      await audit(supabase, actor, action, id, null)
      return { ok: true }
    }

    // ---- Analytics -------------------------------------------------------
    case 'stats.overview': {
      return await stats(supabase)
    }

    default:
      throw new BadRequest(`Unknown action: ${action}`)
  }
}

// --- Helpers used by handlers ---------------------------------------------

class BadRequest extends Error {}

async function semesterExists(supabase: Supabase, name: string): Promise<boolean> {
  const { count } = await supabase
    .from('semesters')
    .select('name', { count: 'exact', head: true })
    .eq('name', name)
  return (count ?? 0) > 0
}

async function assertSemesterExists(supabase: Supabase, name: string): Promise<void> {
  if (!(await semesterExists(supabase, name))) throw new BadRequest(`Unknown semester: ${name}`)
}

async function assertLectureExists(supabase: Supabase, id: string): Promise<void> {
  const { count } = await supabase
    .from('lectures')
    .select('id', { count: 'exact', head: true })
    .eq('id', id)
  if ((count ?? 0) === 0) throw new BadRequest('Unknown lecture')
}

/**
 * Pushes one override to the Google Calendar of everyone enrolled in its
 * lecture.
 *
 * Two things happen per user, in this order:
 *
 *  1. the recurring series is PATCHed with a freshly rebuilt RRULE + EXDATE, so
 *     the affected instance stops appearing; and
 *  2. for a move, a room change, or an extra session, a single event is created
 *     (or updated, if this override was published before) covering the new slot.
 *
 * Recurring *instances* are never patched. Going through EXDATE plus a separate
 * event means this reuses the same create/delete paths as ordinary sync, and
 * republishing is idempotent because the exclusion list is rebuilt from the
 * database rather than appended to.
 *
 * Failure is per-user and reported, not thrown: one student with a revoked
 * Google token must not stop the other thirty from being updated.
 */
async function publishOverride(
  supabase: Supabase,
  actor: { id: string; email?: string | null },
  overrideId: string,
): Promise<{ users_updated: number; errors: { user_id: string; message: string }[] }> {
  const { data: override, error: overrideError } = await supabase
    .from('lecture_overrides')
    .select(OVERRIDE_COLUMNS)
    .eq('id', overrideId)
    .maybeSingle()
  if (overrideError) throw new Error(overrideError.message)
  if (!override) throw new BadRequest('Change not found')

  const { data: lecture, error: lectureError } = await supabase
    .from('lectures')
    .select(
      `${LECTURE_COLUMNS}, semesters!inner(start_date, end_date, time_zone)`,
    )
    .eq('id', override.lecture_id)
    .single()
  if (lectureError || !lecture) throw new BadRequest('Unknown lecture')
  // Both embeds are to-one and arrive as objects, but naming the columns lets
  // supabase-js infer them as arrays without generated database types — hence
  // the trip through `unknown`. See the Supabase client note at the top.
  const semester = lecture.semesters as unknown as {
    start_date: string
    end_date: string
    time_zone: string | null
  }
  // Course fields arrive nested under the embed; the summary below reads them
  // flat, the same way the frontend's Lecture does.
  const course = flattenLecture(lecture) as {
    course_code: string
    course_name: string
    professor: string
  }

  // Every exclusion for this lecture, not just this override's — the series is
  // rewritten wholesale, so a previously published change must survive.
  const [{ data: events }, { data: overrides }] = await Promise.all([
    supabase
      .from('academic_events')
      .select('start_date, end_date, blocks_teaching')
      .or(`semester.eq.${pgFilterValue(lecture.semester)},semester.is.null`),
    supabase
      .from('lecture_overrides')
      .select('kind, occurrence_date, new_date, new_start_time, new_end_time, new_room')
      .eq('lecture_id', override.lecture_id),
  ])

  const recurrence = buildRecurrence(
    lecture as { day_of_week: string; start_time: string },
    semester,
    (events ?? []) as AcademicEventRow[],
    (overrides ?? []) as OverrideRow[],
  )
  const session = overrideSession(
    lecture as { start_time: string; end_time: string; room: string | null },
    override as OverrideRow,
  )
  const timeZone = semester.time_zone ?? 'Europe/Athens'

  const { data: enrolled } = await supabase
    .from('user_schedules')
    .select('user_id, google_event_id')
    .eq('lecture_id', override.lecture_id)
    .not('google_event_id', 'is', null)

  const { data: alreadyPublished } = await supabase
    .from('user_override_events')
    .select('user_id, google_event_id')
    .eq('override_id', overrideId)
  const publishedFor = new Map(
    (alreadyPublished ?? []).map((r) => [r.user_id as string, r.google_event_id as string | null]),
  )

  const errors: { user_id: string; message: string }[] = []
  let updated = 0

  for (const row of (enrolled ?? []) as { user_id: string; google_event_id: string }[]) {
    try {
      const token = await ensureAccessToken(supabase, row.user_id)
      const auth = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }

      const patch = await fetch(`${CALENDAR_API}/${row.google_event_id}`, {
        method: 'PATCH',
        headers: auth,
        body: JSON.stringify({ recurrence }),
      })
      // A series the student deleted themselves is not an error worth failing
      // the publish over; there is simply nothing left to exclude.
      if (!patch.ok && patch.status !== 404 && patch.status !== 410) {
        throw new Error(`Calendar update failed (${patch.status})`)
      }

      if (session) {
        const body = {
          summary: `${course.course_code} — ${course.course_name}`,
          description: override.note
            ? `${override.note}\n\nProfessor: ${course.professor}`
            : `Professor: ${course.professor}`,
          location: session.room ?? undefined,
          start: { dateTime: `${session.date}T${session.start_time}`, timeZone },
          end: { dateTime: `${session.date}T${session.end_time}`, timeZone },
          reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
        }
        const existing = publishedFor.get(row.user_id)
        const res = existing
          ? await fetch(`${CALENDAR_API}/${existing}`, {
              method: 'PATCH',
              headers: auth,
              body: JSON.stringify(body),
            })
          : await fetch(CALENDAR_API, {
              method: 'POST',
              headers: auth,
              body: JSON.stringify(body),
            })
        if (!res.ok) throw new Error(`Calendar session failed (${res.status})`)
        const event = await res.json()
        await supabase
          .from('user_override_events')
          .upsert(
            { user_id: row.user_id, override_id: overrideId, google_event_id: event.id },
            { onConflict: 'user_id,override_id' },
          )
      }

      updated++
    } catch (e) {
      errors.push({
        user_id: row.user_id,
        message: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  await audit(supabase, actor, 'override.publish', overrideId, {
    users_updated: updated,
    failed: errors.length,
  })
  return { users_updated: updated, errors }
}

interface AuthUser {
  id: string
  email?: string
  created_at: string
  app_metadata?: { role?: string | null }
}

async function listUsers(supabase: Supabase) {
  const { data: authList, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const authUsers = (authList?.users ?? []) as unknown as AuthUser[]

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select(
      'id, full_name, avatar_url, study_year, google_access_token, google_refresh_token, token_expires_at',
    )
  const { data: schedules } = await supabase.from('user_schedules').select('user_id')
  const { data: passed } = await supabase.from('user_passed_courses').select('user_id')

  const profileById = new Map<string, Record<string, unknown>>()
  for (const p of profiles ?? []) profileById.set(p.id as string, p)
  const enrolledCount = new Map<string, number>()
  for (const s of schedules ?? []) {
    enrolledCount.set(s.user_id as string, (enrolledCount.get(s.user_id as string) ?? 0) + 1)
  }
  const passedCount = new Map<string, number>()
  for (const p of passed ?? []) {
    passedCount.set(p.user_id as string, (passedCount.get(p.user_id as string) ?? 0) + 1)
  }

  return authUsers.map((u) => {
    const p = profileById.get(u.id) ?? {}
    const expiresAt = p.token_expires_at ? new Date(p.token_expires_at as string).getTime() : 0
    return {
      id: u.id,
      email: u.email ?? null,
      full_name: (p.full_name as string) ?? null,
      avatar_url: (p.avatar_url as string) ?? null,
      study_year: (p.study_year as number) ?? null,
      role: u.app_metadata?.role === 'admin' ? 'admin' : null,
      created_at: u.created_at,
      enrolled_count: enrolledCount.get(u.id) ?? 0,
      passed_count: passedCount.get(u.id) ?? 0,
      calendar: {
        connected: Boolean(p.google_access_token),
        has_refresh_token: Boolean(p.google_refresh_token),
        token_expires_at: (p.token_expires_at as string) ?? null,
        token_valid: expiresAt > Date.now(),
      },
    }
  })
}

async function stats(supabase: Supabase) {
  const users = await listUsers(supabase)

  const { count: lectureCount } = await supabase
    .from('lectures')
    .select('id', { count: 'exact', head: true })
  const { count: courseCount } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
  const { count: semesterCount } = await supabase
    .from('semesters')
    .select('name', { count: 'exact', head: true })
  const { data: schedules } = await supabase.from('user_schedules').select('lecture_id')

  // Top courses by enrolment.
  const perLecture = new Map<string, number>()
  for (const s of schedules ?? []) {
    perLecture.set(s.lecture_id as string, (perLecture.get(s.lecture_id as string) ?? 0) + 1)
  }
  const topIds = [...perLecture.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  let topCourses: { lecture_id: string; course_code: string; course_name: string; count: number }[] =
    []
  if (topIds.length) {
    // course_code and course_name live on `courses` since migration 0006, so
    // they are reached through the embed rather than selected off the lecture.
    const { data: lectures } = await supabase
      .from('lectures')
      .select('id, courses!inner(course_code, course_name)')
      .in(
        'id',
        topIds.map(([id]) => id),
      )
    const byId = new Map(
      // deno-lint-ignore no-explicit-any
      (lectures ?? []).map((l: any) => [l.id as string, flattenLecture(l)]),
    )
    topCourses = topIds.map(([id, count]) => ({
      lecture_id: id,
      course_code: (byId.get(id)?.course_code as string) ?? '—',
      course_name: (byId.get(id)?.course_name as string) ?? '',
      count,
    }))
  }

  const connected = users.filter((u) => u.calendar.connected).length
  const withRefresh = users.filter((u) => u.calendar.has_refresh_token).length

  return {
    totals: {
      users: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      lectures: lectureCount ?? 0,
      courses: courseCount ?? 0,
      enrollments: (schedules ?? []).length,
      semesters: semesterCount ?? 0,
    },
    calendar: {
      connected_users: connected,
      users_with_refresh_token: withRefresh,
      adoption_rate: users.length ? connected / users.length : 0,
    },
    top_courses: topCourses,
  }
}

// --- Entry -----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorised' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return json({ error: 'Unauthorised' }, 401)

    // The one check that matters: is the caller actually an admin?
    if (user.app_metadata?.role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const body = (await req.json()) as { action?: string; payload?: Record<string, unknown> }
    if (!body.action) return json({ error: 'Missing action' }, 400)

    const data = await handle(
      supabase,
      { id: user.id, email: user.email },
      body.action,
      body.payload ?? {},
    )
    return json({ data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Admin action failed'
    const status = e instanceof BadRequest ? 400 : 500
    return json({ error: message }, status)
  }
})
