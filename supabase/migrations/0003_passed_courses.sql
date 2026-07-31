-- Passed courses — the courses a student has already completed and does not
-- want to see when building a future schedule.
--
-- Run with: supabase db push
--
-- Keyed by course_code (text), not a lecture id: a student passes a whole
-- course ('CS301'), not a particular Tuesday section, so every section of that
-- code is hidden at once. Modeled on user_schedules (0001_init.sql) otherwise —
-- one row per (user, course), owned exclusively by the student via RLS.

create table if not exists public.user_passed_courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_code text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, course_code)
);

create index if not exists user_passed_courses_user_idx
  on public.user_passed_courses (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — a student sees and edits only their own passed courses.
-- No update policy: a passed course is added or removed, never edited in place.
-- ---------------------------------------------------------------------------
alter table public.user_passed_courses enable row level security;

drop policy if exists "own passed select" on public.user_passed_courses;
create policy "own passed select"
  on public.user_passed_courses for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own passed insert" on public.user_passed_courses;
create policy "own passed insert"
  on public.user_passed_courses for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own passed delete" on public.user_passed_courses;
create policy "own passed delete"
  on public.user_passed_courses for delete
  to authenticated
  using (auth.uid() = user_id);
