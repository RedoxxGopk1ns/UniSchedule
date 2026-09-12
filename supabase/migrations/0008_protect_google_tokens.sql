-- Makes the Google tokens write-only from the browser.
--
-- Run with: supabase db push
--
-- Why
-- ---
-- `sync-schedule` is meant to be the only component that ever holds a Google
-- token, and README says as much: "The browser never reads google_access_token
-- — see supabaseProvider.ts, which selects columns explicitly." That was true
-- of our own code and enforced by nothing. `authenticated` held table-level
-- SELECT on user_profiles and the "own profile select" policy allows a user to
-- read their own row, so any script on the page could ask for
--
--   GET /rest/v1/user_profiles?select=google_refresh_token
--
-- and be handed a long-lived offline credential for the user's calendar. The
-- token is the user's own, so this is not cross-account exposure — it is the
-- blast radius of an XSS or a hostile browser extension, which is exactly what
-- keeping the token server-side was supposed to contain.
--
-- The asymmetry that makes this work: the browser must still *write* the
-- tokens. Supabase exposes provider_refresh_token on the session exactly once,
-- client-side, immediately after the OAuth redirect (captureProviderTokens), so
-- the token cannot avoid passing through the page on its way in. It can avoid
-- ever being readable again. INSERT and UPDATE therefore stay; only SELECT
-- goes.
--
-- Postgres cannot revoke a column subset from a table-level grant — a
-- column-level REVOKE against a table-level privilege does nothing. So the
-- table-level SELECT is dropped and the non-secret columns are granted back by
-- name. Adding a column to this table means adding it here too, or it will be
-- unreadable; that is the intended failure direction.
--
-- The service role is untouched and bypasses this entirely, which is how both
-- Edge Functions keep reading the tokens they need.

revoke select on public.user_profiles from anon, authenticated;

-- anon is granted nothing back: there is no RLS policy for anon on this table,
-- so it could never read a row anyway, and the grant only ever served to make
-- the table discoverable.
grant select (id, full_name, avatar_url, study_year, updated_at)
  on public.user_profiles
  to authenticated;

-- Writes are unchanged and deliberately still cover the token columns.
grant insert, update on public.user_profiles to authenticated;
