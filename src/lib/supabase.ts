import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Single Supabase client, created lazily so that a mock-mode demo never touches
 * the network (and never fails on missing env vars).
 */
let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
    )
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
  return client
}

/**
 * Whether this deployment talks to Google Calendar at all.
 *
 * Off, the app is still fully functional — enrolments persist to Postgres and
 * every screen works; there is simply no event pushed to Calendar. On, sign-in
 * additionally asks for the Calendar scope and syncSchedule invokes the
 * sync-schedule Edge Function.
 */
export const CALENDAR_SYNC_ENABLED =
  import.meta.env.VITE_ENABLE_CALENDAR_SYNC === 'true'

/**
 * Scopes required by §6. `calendar.events` is the narrowest scope that still
 * permits creating and deleting events on the primary calendar — but it is a
 * *sensitive* scope, so an unverified OAuth app shows a warning interstitial
 * and blocks anyone who is not a registered test user. It is therefore only
 * requested when Calendar sync is actually switched on.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  ...(CALENDAR_SYNC_ENABLED
    ? ['https://www.googleapis.com/auth/calendar.events']
    : []),
].join(' ')
