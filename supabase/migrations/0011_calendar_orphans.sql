-- Remembers Calendar events whose enrolment is already gone.
--
-- Run with: supabase db push
--
-- Why
-- ---
-- Unenrolling is deliberately ordered database-first: the browser deletes the
-- `user_schedules` row, then `sync-schedule` deletes the Google Calendar event.
-- That order is what stops a Calendar outage from costing a student their
-- selection (README, "Who writes what"), and it is not up for negotiation.
--
-- Its cost is this: the row holding `google_event_id` is gone by the time the
-- Calendar call runs, so if that call fails the event is left in the student's
-- calendar with nothing anywhere that remembers it exists. `computeDiff` will
-- never mention the lecture again — they are not enrolled — so the ghost
-- lecture repeats weekly, forever, and the only fix is deleting it by hand.
--
-- The mirror case already has a repair. An enrolment with a null
-- `google_event_id` is picked up by `withBackfill` on the next save and the
-- event is created. This table is that idea pointed the other way: the id
-- outlives the row just long enough to be retried.
--
-- Shape
-- -----
-- One row per event that failed to delete. `sync-schedule` sweeps a user's rows
-- at the start of every sync, retries the delete, and drops the row when
-- Calendar confirms it is gone — including 404/410, which mean the student
-- deleted it themselves and the job is done either way.
--
-- `attempts` bounds the retrying. An id that fails for a reason time will not
-- cure (a revoked calendar, a malformed id) would otherwise cost one API call
-- per sync forever; after MAX_ATTEMPTS the sweep leaves it alone. `last_error`
-- is kept so that pile can be read later rather than guessed at.

create table if not exists public.user_calendar_orphans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  google_event_id text not null,
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- The same event failing twice is one piece of work, not two.
  unique (user_id, google_event_id)
);

-- The sweep reads one user's pending rows, cheapest attempts first.
create index if not exists user_calendar_orphans_sweep_idx
  on public.user_calendar_orphans (user_id, attempts);

-- RLS on with no policies, exactly like admin_audit_log (migration 0004):
-- unreadable and unwritable by any client, service role only. Nothing in the
-- browser has any business seeing this — it is bookkeeping between the Edge
-- Function and itself, and the student is told about a failed removal by the
-- toast, not by this table.
alter table public.user_calendar_orphans enable row level security;
