-- Academic calendar and per-occurrence lecture overrides.
--
-- Until now a lecture was a pure weekly pattern (day_of_week + start_time) with
-- no dates attached, so the system had no way to say "there is no class that
-- Wednesday, it is 25η Μαρτίου" or "this Thursday's lab moved to room 2.3".
-- These two tables add the date layer:
--
--   academic_events   — term-wide dates from the university's academic calendar
--                       PDF. Rows with blocks_teaching = true suppress every
--                       lecture occurrence falling inside their range.
--   lecture_overrides — one-off exceptions to a single lecture's weekly pattern.
--
-- Both feed the same place in the end: the EXDATE list on the recurring Google
-- Calendar event built in supabase/functions/sync-schedule (PRD §22, previously
-- a deliberate v1 omission).

-- ---------------------------------------------------------------------------
-- Academic calendar
-- ---------------------------------------------------------------------------

create table if not exists public.academic_events (
  id              uuid primary key default gen_random_uuid(),
  -- null means the row applies to the whole academic year rather than one term.
  semester        text references public.semesters(name) on delete cascade,
  kind            text not null check (kind in (
                    'holiday', 'break', 'exam_period', 'makeup_week',
                    'teaching_start', 'teaching_end', 'presentations', 'other'
                  )),
  title           text not null,
  start_date      date not null,
  -- Inclusive. A single-day holiday stores the same date in both columns, so
  -- every consumer can treat the row as a range without special-casing.
  end_date        date not null,
  -- False for the boundary markers (teaching_start/teaching_end), which record
  -- a date without cancelling anything.
  blocks_teaching boolean not null default true,
  created_at      timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists academic_events_range_idx
  on public.academic_events (start_date, end_date);

-- ---------------------------------------------------------------------------
-- Per-occurrence overrides
-- ---------------------------------------------------------------------------

create table if not exists public.lecture_overrides (
  id              uuid primary key default gen_random_uuid(),
  lecture_id      uuid not null references public.lectures(id) on delete cascade,
  kind            text not null check (kind in
                    ('cancelled', 'moved', 'room_change', 'extra')),
  -- The normally-scheduled date being changed. For 'extra' — a session that has
  -- no counterpart in the weekly pattern — it is the date of the added class.
  occurrence_date date not null,
  new_date        date,
  new_start_time  time,
  new_end_time    time,
  new_room        text,
  note            text,
  created_at      timestamptz not null default now(),
  -- One override of a given kind per lecture per date. Kind is part of the key
  -- so an 'extra' session can share a date with a 'cancelled' regular one.
  unique (lecture_id, occurrence_date, kind),
  check (kind <> 'moved' or (
    new_date is not null and new_start_time is not null and new_end_time is not null
  )),
  check (kind <> 'extra' or (
    new_start_time is not null and new_end_time is not null
  )),
  check (new_start_time is null or new_end_time is null or new_end_time > new_start_time)
);

create index if not exists lecture_overrides_lecture_idx
  on public.lecture_overrides (lecture_id, occurrence_date);

-- ---------------------------------------------------------------------------
-- Google event ids for the one-off events an override produces
-- ---------------------------------------------------------------------------

-- A 'moved' or 'extra' override is published to Calendar as a *separate* single
-- event rather than by patching a recurring instance. Remembering its id per
-- user is what makes publishing idempotent (patch instead of duplicate) and
-- what lets a deleted override clean up after itself.
create table if not exists public.user_override_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  override_id     uuid not null references public.lecture_overrides(id) on delete cascade,
  google_event_id text,
  created_at      timestamptz not null default now(),
  unique (user_id, override_id)
);

create index if not exists user_override_events_user_idx
  on public.user_override_events (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Same posture as lectures/semesters in 0001_init: every authenticated user may
-- read the calendar, nobody may write it from the client. Writes go through the
-- `admin` Edge Function, which runs with the service role.
alter table public.academic_events enable row level security;
alter table public.lecture_overrides enable row level security;

create policy "academic events readable by authenticated"
  on public.academic_events for select to authenticated using (true);

create policy "lecture overrides readable by authenticated"
  on public.lecture_overrides for select to authenticated using (true);

-- Event ids are per-user and are written by the service role only.
alter table public.user_override_events enable row level security;

create policy "own override events select"
  on public.user_override_events for select to authenticated
  using (auth.uid() = user_id);
