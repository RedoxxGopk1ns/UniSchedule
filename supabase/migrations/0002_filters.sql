-- Filtering metadata for the course selection screen.
--
-- Run with: supabase db push
-- Then reseed the catalogue with: supabase/seed.sql
--
-- `study_year` is the student's year of study (1-4). It is deliberately NOT
-- called `semester`: lectures.semester already exists and holds a term name
-- ('Spring 2026'), and two columns named "semester" meaning different things
-- would be a lasting trap.

alter table public.lectures
  add column if not exists subject      text,
  add column if not exists is_mandatory boolean not null default false,
  add column if not exists study_year   int check (study_year between 1 and 4);

alter table public.user_profiles
  add column if not exists study_year int check (study_year between 1 and 4);

create index if not exists lectures_subject_idx
  on public.lectures (subject);

-- Partial: the "mandatory for my year" filter only ever reads mandatory rows.
create index if not exists lectures_mandatory_idx
  on public.lectures (study_year, is_mandatory)
  where is_mandatory;
