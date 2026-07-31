-- UniSchedule schema (PRD §5) with Row Level Security (§17).
--
-- Run with: supabase db push
-- Then seed the catalogue with: supabase/seed.sql

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- semesters
-- Answers the §22 open question: the recurrence rule needs a real UNTIL date,
-- so the range lives in a table rather than being hardcoded per deployment.
-- ---------------------------------------------------------------------------
create table if not exists public.semesters (
  name        text primary key,
  start_date  date not null,        -- must be a Monday
  end_date    date not null,
  time_zone   text not null default 'Europe/Athens',
  is_current  boolean not null default false
);

-- Only one semester may be current at a time.
create unique index if not exists semesters_one_current
  on public.semesters (is_current)
  where is_current;

-- ---------------------------------------------------------------------------
-- lectures — master catalogue, admin-populated, read-only to students
-- ---------------------------------------------------------------------------
create table if not exists public.lectures (
  id           uuid primary key default gen_random_uuid(),
  course_code  text not null,
  course_name  text not null,
  professor    text not null,
  room         text,
  day_of_week  text not null check (
                 day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday')
               ),
  start_time   time not null,
  end_time     time not null,
  semester     text not null references public.semesters(name),
  department   text,
  color_tag    text,
  check (end_time > start_time)
);

create index if not exists lectures_semester_day_idx
  on public.lectures (semester, day_of_week, start_time);
create index if not exists lectures_department_idx
  on public.lectures (department);

-- ---------------------------------------------------------------------------
-- user_schedules — which lectures a student is enrolled in
-- ---------------------------------------------------------------------------
create table if not exists public.user_schedules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  lecture_id      uuid not null references public.lectures(id) on delete cascade,
  google_event_id text,
  created_at      timestamptz not null default now(),
  unique (user_id, lecture_id)
);

create index if not exists user_schedules_user_idx
  on public.user_schedules (user_id);

-- ---------------------------------------------------------------------------
-- user_profiles — Google OAuth tokens for Calendar API calls
--
-- These columns are the most sensitive data in the system. They are readable
-- only by the owning user via RLS, and in practice only ever read by the
-- sync-schedule Edge Function using the service role key. The browser never
-- selects them (see src/lib/data/supabaseProvider.ts).
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text,
  avatar_url           text,
  google_access_token  text,
  google_refresh_token text,
  token_expires_at     timestamptz,
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.lectures       enable row level security;
alter table public.semesters      enable row level security;
alter table public.user_schedules enable row level security;
alter table public.user_profiles  enable row level security;

-- Catalogue is readable by any signed-in student, writable by no one.
-- (Admins load it via the service role, which bypasses RLS.)
drop policy if exists "lectures readable by authenticated" on public.lectures;
create policy "lectures readable by authenticated"
  on public.lectures for select
  to authenticated
  using (true);

drop policy if exists "semesters readable by authenticated" on public.semesters;
create policy "semesters readable by authenticated"
  on public.semesters for select
  to authenticated
  using (true);

-- A student sees and edits only their own enrolments.
drop policy if exists "own schedule select" on public.user_schedules;
create policy "own schedule select"
  on public.user_schedules for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own schedule insert" on public.user_schedules;
create policy "own schedule insert"
  on public.user_schedules for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own schedule update" on public.user_schedules;
create policy "own schedule update"
  on public.user_schedules for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own schedule delete" on public.user_schedules;
create policy "own schedule delete"
  on public.user_schedules for delete
  to authenticated
  using (auth.uid() = user_id);

-- Profiles: strictly own-row only.
drop policy if exists "own profile select" on public.user_profiles;
create policy "own profile select"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "own profile upsert" on public.user_profiles;
create policy "own profile upsert"
  on public.user_profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "own profile update" on public.user_profiles;
create policy "own profile update"
  on public.user_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Create a profile row automatically on sign-up, so the sync function always
-- has somewhere to store tokens.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
