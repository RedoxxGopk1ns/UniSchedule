/**
 * sync-schedule — the only place in the system that touches Google Calendar
 * or handles OAuth tokens (PRD §17, §18).
 *
 * Input:  { to_add: string[], to_remove: { lecture_id, google_event_id }[] }
 * Output: { success: boolean, errors: { lecture_id, message }[] }
 *
 * Partial failure is tolerated and reported honestly: if three of four events
 * are created, the three are persisted and the fourth is returned as an error,
 * rather than rolling everything back.
 *
 * Deploy with:  supabase functions deploy sync-schedule
 * Required secrets:
 *   supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  buildRecurrence,
  firstOccurrence,
  overrideSession,
  type AcademicEventRow,
  type OverrideRow,
} from '../_shared/recurrence.ts'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * The service-role client.
 *
 * Rows are deliberately `any`. Without generated database types supabase-js
 * infers every PostgREST result as `never`, which buried this file in type
 * errors that had nothing to do with the code. Kept identical to the
 * declaration in supabase/functions/admin/index.ts.
 */
// deno-lint-ignore no-explicit-any
type Supabase = SupabaseClient<any, any, any>

interface SyncDiff {
  to_add: string[]
  to_remove: { lecture_id: string; google_event_id: string | null }[]
}

interface SyncError {
  lecture_id: string
  message: string
}

/** Naive in-memory rate limit (§17). Per-instance, which is enough here. */
const lastCall = new Map<string, number>()
const RATE_LIMIT_MS = 3000

/** Refreshes the access token if it is expired or about to be. */
async function ensureAccessToken(
  supabase: Supabase,
  userId: string,
): Promise<string> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('google_access_token, google_refresh_token, token_expires_at')
    .eq('id', userId)
    .single()

  if (error || !profile) throw new Error('Profile not found')

  const expiresAt = profile.token_expires_at
    ? new Date(profile.token_expires_at).getTime()
    : 0
  // 60s of slack, so a token does not expire mid-batch.
  if (profile.google_access_token && expiresAt > Date.now() + 60_000) {
    return profile.google_access_token as string
  }

  if (!profile.google_refresh_token) {
    throw new Error(
      'No refresh token stored. Sign out and sign in again to reauthorise Google Calendar.',
    )
  }

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

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ success: false, errors: [{ lecture_id: '', message: 'Unauthorised' }] }, 401)

    // Service-role client: RLS is bypassed here, so every query below filters
    // by the authenticated user id explicitly.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return json({ success: false, errors: [{ lecture_id: '', message: 'Unauthorised' }] }, 401)

    const previous = lastCall.get(user.id) ?? 0
    if (Date.now() - previous < RATE_LIMIT_MS) {
      return json(
        { success: false, errors: [{ lecture_id: '', message: 'Too many requests. Please wait a moment.' }] },
        429,
      )
    }
    lastCall.set(user.id, Date.now())

    const diff = (await req.json()) as SyncDiff
    const errors: SyncError[] = []

    const accessToken = await ensureAccessToken(supabase, user.id)
    const auth = { Authorization: `Bearer ${accessToken}` }

    // ---- Removals -------------------------------------------------------
    for (const item of diff.to_remove ?? []) {
      if (item.google_event_id) {
        const res = await fetch(`${CALENDAR_API}/${item.google_event_id}`, {
          method: 'DELETE',
          headers: auth,
        })
        // 404/410 mean the user already deleted it in Calendar — not an error.
        if (!res.ok && res.status !== 404 && res.status !== 410) {
          errors.push({ lecture_id: item.lecture_id, message: `Calendar delete failed (${res.status})` })
        }
      }
      // The user_schedules row is already gone: the client deletes it before
      // invoking this function, so that a Calendar outage cannot strand a
      // student's enrolment. See supabaseProvider.syncSchedule.
    }

    // ---- Additions ------------------------------------------------------
    if (diff.to_add?.length) {
      const { data: lectures } = await supabase
        .from('lectures')
        .select('*, semesters!inner(start_date, end_date, time_zone)')
        .in('id', diff.to_add)

      // The academic calendar and any per-occurrence changes, fetched once for
      // the whole batch rather than per lecture. Both feed the EXDATE list, so
      // a series created here already skips the holidays and the cancellations
      // that were known at the time (§22).
      const semesterNames = [...new Set((lectures ?? []).map((l) => l.semester as string))]
      const [{ data: academicEvents }, { data: overrides }] = await Promise.all([
        semesterNames.length
          ? supabase
              .from('academic_events')
              .select('semester, start_date, end_date, blocks_teaching')
              .or(
                `semester.in.(${semesterNames.map((n) => `"${n}"`).join(',')}),semester.is.null`,
              )
          : Promise.resolve({ data: [] }),
        supabase
          .from('lecture_overrides')
          .select(
            'id, lecture_id, kind, occurrence_date, new_date, new_start_time, new_end_time, new_room, note',
          )
          .in('lecture_id', diff.to_add),
      ])

      for (const lecture of lectures ?? []) {
        try {
          const sem = lecture.semesters
          const date = firstOccurrence(sem.start_date, lecture.day_of_week)
          const timeZone = sem.time_zone ?? 'Europe/Athens'

          const events = (academicEvents ?? []).filter(
            (e) => e.semester === null || e.semester === lecture.semester,
          ) as AcademicEventRow[]
          const mine = (overrides ?? []).filter(
            (o) => o.lecture_id === lecture.id,
          ) as (OverrideRow & { id: string; lecture_id: string; note: string | null })[]

          const body = {
            summary: `${lecture.course_code} — ${lecture.course_name}`,
            description: `Professor: ${lecture.professor}`,
            location: lecture.room ?? undefined,
            // Wall-clock time plus an IANA zone, so the series stays correct
            // across the DST change mid-semester.
            start: { dateTime: `${date}T${lecture.start_time}`, timeZone },
            end: { dateTime: `${date}T${lecture.end_time}`, timeZone },
            recurrence: buildRecurrence(lecture, sem, events, mine),
            reminders: {
              useDefault: false,
              overrides: [{ method: 'popup', minutes: 15 }],
            },
          }

          const res = await fetch(CALENDAR_API, {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

          if (!res.ok) {
            errors.push({ lecture_id: lecture.id, message: `Calendar create failed (${res.status})` })
            continue
          }

          // The row already exists (the client inserted it); this function only
          // ever fills in the Calendar event id.
          const event = await res.json()
          const { error: updateError } = await supabase
            .from('user_schedules')
            .update({ google_event_id: event.id })
            .eq('user_id', user.id)
            .eq('lecture_id', lecture.id)
          if (updateError) {
            errors.push({ lecture_id: lecture.id, message: updateError.message })
          }

          // A moved, relocated or extra session is its own single event: the
          // recurring series has that date excluded above. Enrolling late must
          // still produce them, so they are created here as well as by
          // admin's override.publish.
          for (const override of mine) {
            const session = overrideSession(lecture, override)
            if (!session) continue
            const single = await fetch(CALENDAR_API, {
              method: 'POST',
              headers: { ...auth, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                summary: `${lecture.course_code} — ${lecture.course_name}`,
                description: override.note
                  ? `${override.note}\n\nProfessor: ${lecture.professor}`
                  : `Professor: ${lecture.professor}`,
                location: session.room ?? undefined,
                start: { dateTime: `${session.date}T${session.start_time}`, timeZone },
                end: { dateTime: `${session.date}T${session.end_time}`, timeZone },
                reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
              }),
            })
            if (!single.ok) {
              errors.push({
                lecture_id: lecture.id,
                message: `Calendar session failed (${single.status})`,
              })
              continue
            }
            const created = await single.json()
            await supabase.from('user_override_events').upsert(
              {
                user_id: user.id,
                override_id: override.id,
                google_event_id: created.id,
              },
              { onConflict: 'user_id,override_id' },
            )
          }
        } catch (e) {
          errors.push({
            lecture_id: lecture.id,
            message: e instanceof Error ? e.message : 'Unknown error',
          })
        }
      }
    }

    return json({ success: errors.length === 0, errors })
  } catch (e) {
    return json(
      {
        success: false,
        errors: [{ lecture_id: '', message: e instanceof Error ? e.message : 'Sync failed' }],
      },
      500,
    )
  }
})
