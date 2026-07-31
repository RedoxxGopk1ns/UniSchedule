# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

UniSchedule — university weekly planner with Google Calendar sync. React 19 + Vite + TypeScript + Tailwind v4, backed by Supabase (Postgres + Deno Edge Functions).

`prompt.txt` is the PRD this implements. Code comments cite it by section (`§8.2.1`, `§20`, …); when changing behaviour that carries such a reference, read that section first. `README.md` covers backend/OAuth setup end to end — don't duplicate it here, follow it.

## Commands

```bash
npm run dev            # dev server, http://localhost:5173
npm run build          # tsc -b && vite build  (typecheck is part of the build)
npm test               # vitest run
npm run lint           # oxlint
npm run seed:sql       # regenerate supabase/seed.sql from src/lib/data/seed.ts
```

Single test file / single test:

```bash
npx vitest run src/lib/logic.test.ts
npx vitest run -t 'maps the top of the grid to slot 0'
npx vitest            # watch mode
```

`vite.config.ts` pins `VITE_DATA_SOURCE=mock` (and blanks the Supabase vars) for the test env on purpose — the suite must not pick up whatever `.env.local` is on disk. Don't remove that block.

### Test layout

`src/lib/logic.test.ts` and `adminValidation.test.ts` are pure-function tests. `render.test.tsx`, `features.test.tsx`, and `admin.test.tsx` mount the real `App` against the mock provider under jsdom, and every one of them needs the same harness — copy it when adding another:

- `// @vitest-environment jsdom` as the first line;
- `IS_REACT_ACT_ENVIRONMENT = true`, or `act()` updates never flush to the DOM;
- stubs for `matchMedia` (`matches: false` = desktop layout, full grid) and `window.scrollTo`, neither of which jsdom implements and both of which run during first paint;
- `useScheduleStore.getState().reset()` / `useAuthStore` reset in `beforeEach` — the stores are module singletons, so a memoised `loaded` flag otherwise leaks entries into the next test and blocks a fresh load.

Admin screens are reached in mock mode via `setMockAdmin()` from `mockProvider.ts`.

Edge functions are deployed separately and are not built or typechecked by `npm run build` (`tsconfig.app.json` includes only `src`):

```bash
npx supabase functions deploy sync-schedule
npx supabase functions deploy admin
```

## Architecture

### The provider boundary

Everything hinges on `src/lib/data/provider.ts`. It defines `DataProvider` (auth, catalogue, schedule, plus an `admin: AdminApi` surface) and picks an implementation once from `VITE_DATA_SOURCE`:

- `mockProvider.ts` — in-memory, localStorage-persisted, simulated latency, seeded from `seed.ts`. The default; needs no credentials or network.
- `supabaseProvider.ts` — real auth + Postgres + Edge Functions.

No page, hook, component, or store imports either implementation directly; they call `getProvider()`. **Any change to `DataProvider`/`AdminApi` must land in both implementations** — the mock is what keeps the app demoable and what the render/feature tests run against. If credentials are missing while `VITE_DATA_SOURCE=supabase`, the provider logs a warning and silently falls back to mock; a screen showing demo data is usually this, so check the console first.

State above the provider lives in two zustand stores (`src/store/`): `authStore` (session, initialised once in `App.tsx`) and `scheduleStore` (enrolments, shared by dashboard/sidebar/selection so one sync updates all three). `scheduleStore.sync` re-reads from the provider after a sync rather than patching locally — the server owns `google_event_id`.

### Who writes what during sync

Enrolment rows are written by the **browser** directly; the `sync-schedule` Edge Function only fills in `google_event_id` afterwards. A Calendar failure therefore downgrades the toast (`SyncResult.calendar` in `types.ts`) and never discards the student's selection. Keep that split.

`src/lib/diff.ts` produces the minimal add/remove set, so an unchanged selection costs zero Calendar calls — there is a test asserting exactly this.

The one deliberate exception is the Calendar backfill. An enrolment can exist with a null `google_event_id` (created while sync was off, or a Calendar call that failed), and `computeDiff` would never mention it again because the student did not change it. `supabaseProvider.syncSchedule` therefore re-reads event-less rows and folds them into the payload via `withBackfill`. This lives in the provider, **not** in `computeDiff`, so the "1 added" counts shown to the student stay honest — don't move it.

Recurring events are created as wall-clock time + IANA zone, never UTC instants, so a 09:00 lecture stays at 09:00 across the DST change.

### Admin

`AdminRoute` and the admin nav link are UX only. The security boundary is the `admin` Edge Function, which re-checks `app_metadata.role === 'admin'` from the JWT on every call. All admin calls go through one `adminInvoke(action, payload)` RPC-style dispatcher in `supabaseProvider.ts` against `POST { action, payload }`; adding an admin operation means touching `AdminApi`, both providers, and the action switch in `supabase/functions/admin/index.ts`. Role granting is documented in `supabase/admin/README.md`.

Validation exists twice by design: `src/lib/adminValidation.ts` (pure, shared by forms + mock provider + tests, for fast feedback) and inside the Edge Function (authoritative). Change one, change the other. This includes the time-format pattern and the grid bounds — the Edge Function runs on Deno and cannot import `src/lib/time.ts`, so `GRID_START_MIN`/`GRID_END_MIN` there are hand-copied from `GRID_START_HOUR`/`GRID_END_HOUR` and must be moved together.

The timetable window is `GRID_START_HOUR`/`GRID_END_HOUR` in `src/lib/time.ts` (currently 07:00–23:00, wide enough for the university's evening lectures). Everything on screen and in print derives from that pair — moving the window is those two numbers plus the Edge Function copy above.

Every mutating admin action is written to `admin_audit_log` (migration `0004`) by the Edge Function, which runs with the service role. That table has RLS on and *no* policies — deliberately unreadable by any client, service role only. New mutating actions should log there too.

Both functions are declared `verify_jwt = true` in `supabase/config.toml`, so unauthenticated requests never reach Deno; the in-function claim check is the second layer, not the only one.

### Database

Migrations are sequential in `supabase/migrations/` (`0001_init` schema + RLS + the sign-up profile trigger, `0002_filters`, `0003_passed_courses`, `0004_admin`). Add a new numbered file rather than editing an applied one. `lectures`/`semesters` are read-only to clients under RLS, which is why `seed.sql` needs the SQL editor or a service-role connection.

### Pure logic in `src/lib/`

`time.ts` (slot maths, countdown, RRULE weekday codes), `layout.ts` (grid positioning, splitting overlapping blocks into columns), `conflicts.ts`, `diff.ts`, `filters.ts`. These are the parts where a bug is silent rather than visible, and they are what `logic.test.ts` covers — put new schedule logic here rather than in components.

## Conventions

- **No hex literals in component files.** Every colour, radius, shadow, and the grid's slot geometry resolve through the `@theme` block in `src/styles/globals.css`. A hex in a component means a token is missing. Exceptions: the Google brand mark in `ui/icons.tsx` and `color_tag` values in seed data. §20 forbids blue/purple/gradients/green fills — they're absent from the tokens so there is nothing to reference.
- **No inline user-facing strings.** They all live in `src/lib/copy.ts` (§11: sentence case, no exclamation marks, no emoji).
- **`seed.ts` is the source of truth for the catalogue**; `supabase/seed.sql` is generated. After editing the fixture run `npm run seed:sql` (needs Node 22.6+ for `.ts` type stripping) rather than hand-editing the SQL.
- PDF export uses the browser's own print pipeline (`src/lib/print.ts` + `PrintableSchedule.tsx`), not a client-side PDF library.

## Deliberate omissions

Documented in README under "Deliberate deviations from the PRD" — no `get-upcoming` function (computed client-side in `useUpcoming`), no holiday `EXDATE` handling, conflicts warn rather than block, no lecture-edit auto-patch trigger. Don't "fix" these without asking.
