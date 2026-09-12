# UniSchedule

University weekly planner with Google Calendar sync. React + Vite + TypeScript +
Tailwind, backed by Supabase.

Implements the PRD in `prompt.txt`. Section references throughout the code
(`§8.2.1`, `§20`, …) point back to it.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

That is the whole setup. The app ships with `VITE_DATA_SOURCE=mock`, an
in-memory backend seeded with 30 lectures and a demo student, so every screen is
clickable with no credentials, no network, and no Supabase project.

| Script            | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Dev server                                        |
| `npm run build`   | Typecheck + production build                      |
| `npm test`        | Logic test suite (layout, conflicts, diff, time)   |
| `npm run seed:sql`| Regenerate `supabase/seed.sql` from the TS fixture |

## Architecture

Everything hinges on one boundary: **`src/lib/data/provider.ts`**.

```
DataProvider (interface)
├── mockProvider.ts       in-memory, localStorage-backed, simulated latency
└── supabaseProvider.ts   real auth + Postgres + Edge Functions
```

No page, hook, or component knows which implementation is live. Switching
backends is one environment variable — which is also why a demo never depends on
the network being healthy on the day.

```
src/
  lib/
    data/      types · provider (the swap boundary) · mock · supabase · seed
    time.ts    slot maths for the grid, countdown formatting, RRULE weekday codes
    layout.ts  positions lectures in the grid, splits overlapping blocks
    conflicts.ts  pure overlap detection
    diff.ts    minimal add/remove set — unchanged courses cost zero API calls
    copy.ts    every user-facing string (§11)
  components/  layout · schedule · sidebar · courses · ui
  pages/       LandingPage · Dashboard · SelectCourses · AuthCallback
  store/       authStore · scheduleStore (zustand)
  styles/globals.css   all design tokens (§8.1)
```

### Design tokens

Every colour, radius, and shadow in the app resolves through the `@theme` block
in `src/styles/globals.css`. A hex literal in a component file is a bug — it
means a token is missing. The only exceptions are the Google brand mark in
`icons.tsx` and `color_tag` values in the seed data.

This is what enforces §20: there is no blue, purple, gradient, or green fill
anywhere, because none exists to reference.

## Switching to the real backend

Google Calendar is **not** required to get here. The schedule persists to
Postgres on its own; Calendar is a separate switch, documented further down.

### 1. Database

```bash
npx supabase init                      # creates config.toml — nothing else works without it
npx supabase login
npx supabase link --project-ref <your-ref>
npx supabase db push                   # applies everything in supabase/migrations/
```

Then load the catalogue. `seed.sql` writes to `courses`/`lectures`/`semesters`,
which RLS makes read-only to clients, so it needs elevated rights: paste it into
the Supabase SQL Editor, or `psql "$DATABASE_URL" -f supabase/seed.sql`.

`0001_init` creates `semesters`, `lectures`, `user_schedules` and
`user_profiles`, enables RLS on all four, and adds a trigger that creates a
profile row on sign-up. Later migrations add filtering columns, passed courses,
the admin audit log, per-occurrence overrides, the `0006_courses` split of
`lectures` into a `courses` table plus the per-term schedule that references it,
and `0007_course_details` (`semester_number`, `ects`).

#### Updating a database that already holds the old catalogue

`0006` backfills a `courses` row per distinct lecture title it finds, so the
migration itself is safe to apply to a populated database. Re-seeding afterwards
is not: those backfilled rows carry generated ids and the old timetable's
titles, `courses.course_name` is unique, and `seed.sql` upserts on `id` — so a
title present in both aborts the whole seed with a unique violation. Clear the
catalogue first:

```bash
psql "$DATABASE_URL" -f supabase/reset_catalogue.sql   # destroys saved schedules
psql "$DATABASE_URL" -f supabase/seed.sql
```

Read the header of `reset_catalogue.sql` before running it — it cascades through
`lectures` into `user_schedules`, so every student's saved selection goes with
it, and their Google Calendar events are left orphaned because plain SQL cannot
call the Calendar API.

If the app shows **"No courses match your search"** on the selection screen with
`VITE_DATA_SOURCE=supabase`, this is almost always the cause: the migrations are
not applied, the `courses` embed 404s, and the catalogue fetch fails to an empty
list. Check the browser console for `PGRST205`.

### 2. Google sign-in

In Google Cloud Console → Credentials → OAuth client (Web application), add
`https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect
URI. That is Supabase's callback, not the app's — it does not change when the
frontend is deployed somewhere new.

In Supabase → Authentication → Providers → Google: paste the client ID and
secret.

In Supabase → Authentication → **URL Configuration** — the step that is easy to
miss, and fails with a bare `otp_expired`-style redirect when skipped:

- Site URL: `http://localhost:5173`
- Redirect URLs: `http://localhost:5173/auth/callback`, plus the production
  origin once deployed. `signInWithOAuth` derives `redirectTo` from
  `window.location.origin`, so deployment needs no code change.

### 3. Point the app at it

```bash
# .env.local
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_ENABLE_CALENDAR_SYNC=false
```

If the credentials are missing the app logs a warning and falls back to mock
rather than failing to boot. So if a screen still shows demo data, check the
console before checking anything else.

## Turning on Calendar sync

Deliberately a second step. `calendar.events` is a Google *sensitive* scope: an
unverified app shows a warning interstitial and hard-blocks anyone who is not a
registered test user. Until this is switched on, the app never requests the
scope at all. (Sensitive is not *restricted* — verification needs Google's brand
+ scope review, but **not** a third-party CASA security assessment.)

1. **Google Cloud Console** — enable the **Google Calendar API**. On the OAuth
   consent screen (External) set the app homepage, the privacy-policy URL
   (`<APP_URL>/privacy`, served by `src/pages/Privacy.tsx`), and an authorized
   domain; add the `calendar.events` scope. Create a **Web application** OAuth
   client whose authorized redirect URI is the Supabase callback
   `https://<project-ref>.supabase.co/auth/v1/callback`. Copy the client id/secret.
2. **Supabase dashboard** — Authentication → Providers → Google: enable and paste
   the client id/secret. URL Configuration: set Site URL and add
   `<APP_URL>/auth/callback` (and `http://127.0.0.1:3000/auth/callback` for dev)
   to the redirect allow-list.
3. **Function secrets + deploy** (separate from the dashboard copy above):
   ```bash
   npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
   npx supabase functions deploy sync-schedule
   ```
4. Set `VITE_ENABLE_CALENDAR_SYNC=true` (dev and the production build) and restart.
5. Sign out and sign in again. The refresh token is issued only on the consent
   that first grants the Calendar scope — see below.

For a **public launch**, submit the consent screen for verification (scope
justification, demo video, the privacy + homepage URLs). The app stays usable via
OAuth *test users* the entire time review is pending; publishing to Production
removes the warning for everyone.

`sync-schedule` is the only component that ever holds a Google token. The
browser never reads `google_access_token` — see `supabaseProvider.ts`, which
selects columns explicitly and never includes them.

### Who writes what

Enrolment rows are written by the **browser**, directly, before Google is
involved; the Edge Function only fills in `google_event_id` afterwards. That
split is deliberate: with the function owning both writes, a Calendar outage —
or simply an unconfigured OAuth app — silently discarded the student's whole
selection. A Calendar failure now downgrades the toast and nothing more
(`SyncResult.calendar` in `lib/data/types.ts`).

## Two things worth knowing before debugging sync

**The refresh token is issued once.** `signInWithOAuth` requests
`access_type=offline` with `prompt=consent`. Without both, Google returns an
access token only, and sync breaks silently an hour later when it expires.
`captureProviderTokens()` persists the tokens on the OAuth callback — Supabase
exposes `provider_refresh_token` on the session exactly once, immediately after
the redirect, and never again.

**Recurring events store wall-clock time plus an IANA zone**, not UTC instants.
A 09:00 lecture must stay at 09:00 after the spring DST change; converting to
UTC at creation time would shift the whole series by an hour mid-semester.

## Courses vs. lectures

A **course** is what the department teaches — its code, title, lecturer,
subject, semester and ECTS. It is entered by hand in Admin → Courses and does
not change from one term to the next.

The seeded course list is the department's own, all 73 courses across the eight
semesters, taken from
<https://dit.hua.gr/index.php/el/programmata-spoudon/proptyxiako/mathimata>.
That page publishes no lecturer, so `professor` carries the name from the
timetable PDF where the titles match (32 courses) and `Δεν έχει οριστεί`
otherwise (41) — fill those in from the Courses tab as they are announced.

A **lecture** is one weekly meeting of a course in one term: a day, a time, a
room. It points at its course and inherits everything else from it, so
correcting a lecturer's name once updates every lecture of that course.

Importing the weekly timetable PDF (Admin → Import) therefore never creates a
course. Each row the parser finds is matched to an existing course **by title**,
and the admin approves the match, picks a different course from the dropdown, or
skips the row. A course the PDF mentions but the catalogue lacks has to be added
in the Courses tab first — the import will not invent one.

Saving **replaces** the chosen semester's timetable with the approved rows
rather than merging into it. A lecture holds only where and when, and the PDF is
the authority on both, so re-uploading a corrected timetable mid-term is a
single gesture instead of a diff to review. Because that also rebuilds the
Google Calendar events of everyone enrolled, it asks for confirmation first.

## Deliberate deviations from the PRD

- **`get-upcoming` Edge Function not built.** The sidebar computes today's
  remaining lectures client-side from the already-loaded schedule (a handful of
  rows). A function invocation every five minutes per user would buy nothing.
  The five-minute refresh from §18 is still implemented, in `useUpcoming`.
- **Holiday `EXDATE` handling** (§22) is out of scope for v1. The RRULE
  construction site in `sync-schedule/index.ts` is commented where it would go.
- **Multi-section conflicts warn rather than block** (§22). A student may have a
  genuine reason to double-book; the app should not overrule them.
- **Lecture-edit auto-patch via DB trigger** (§22) is not built — it needs a
  service-role webhook, and admin edits are rare.

## Testing

`npm test` covers the parts where a bug would be silent rather than visible:
grid slot maths, overlap layout and column splitting, conflict detection
(including the boundary case where two lectures merely touch), and the sync diff
— in particular that an unchanged selection produces zero Calendar calls.
