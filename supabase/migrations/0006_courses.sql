-- Splits `lectures` into the course (what is taught) and the lecture (when and
-- where it meets).
--
-- Run with: supabase db push
--
-- Why
-- ---
-- `lectures` carried both halves on one row, so the course's name, lecturer and
-- subject were copied onto every session of it — three times for a course that
-- meets three times a week, and again for every new term. Correcting a
-- lecturer's name meant finding every copy, and the timetable import had no way
-- to say "this is the same course, at a new time" without either duplicating
-- the course or rewriting its identity from a hand-laid-out PDF cell.
--
-- After this migration a lecture owns only `course_id`, `room`, `day_of_week`,
-- `start_time`, `end_time` and `semester`. Everything else is read through the
-- foreign key, so a course edited once is corrected everywhere at no cost.
--
-- `courses.course_name` is unique because it is the key a timetable import
-- matches on (src/lib/import/lectureMatch.ts): two courses sharing a title
-- would make every row of that title ambiguous. The department already
-- distinguishes its lab groups in the title itself ('… — Ομάδα 1'), so this
-- costs nothing it was not already doing.

-- ---------------------------------------------------------------------------
-- 1. The courses table
-- ---------------------------------------------------------------------------

create table if not exists public.courses (
  id           uuid primary key default gen_random_uuid(),
  course_code  text not null,
  course_name  text not null unique,
  professor    text not null,
  department   text,
  color_tag    text,
  subject      text,
  is_mandatory boolean not null default false,
  study_year   int check (study_year between 1 and 4)
);

-- course_code is deliberately NOT unique: the department gives a lecture and
-- its lab groups one code, and `user_passed_courses` keys off that code so
-- passing a course hides all of its sections at once (migration 0003).
create index if not exists courses_course_code_idx on public.courses (course_code);
create index if not exists courses_subject_idx     on public.courses (subject);
create index if not exists courses_mandatory_idx
  on public.courses (study_year, is_mandatory)
  where is_mandatory;

-- ---------------------------------------------------------------------------
-- 2. Backfill one course per distinct title
-- ---------------------------------------------------------------------------
--
-- distinct on (course_name) picks one row per title. The order by decides
-- which: rows are ranked by how many lectures share their exact field values,
-- so a value that appears on two of a course's three sessions beats the odd one
-- out. That is not pedantry — the real catalogue had a course whose professor
-- was spelled with a Latin 'A' on one row and a Greek 'Α' on the other two.

insert into public.courses
  (course_code, course_name, professor, department, color_tag, subject, is_mandatory, study_year)
select distinct on (course_name)
  course_code, course_name, professor, department, color_tag, subject, is_mandatory, study_year
from (
  select
    l.*,
    count(*) over (
      partition by course_name, course_code, professor, department,
                   color_tag, subject, is_mandatory, study_year
    ) as agreement
  from public.lectures l
) ranked
order by course_name, agreement desc, course_code
on conflict (course_name) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Point lectures at their course, then drop the copied columns
-- ---------------------------------------------------------------------------

alter table public.lectures
  add column if not exists course_id uuid references public.courses (id) on delete cascade;

update public.lectures l
   set course_id = c.id
  from public.courses c
 where c.course_name = l.course_name
   and l.course_id is null;

-- Fails loudly rather than silently dropping rows if anything above missed one.
do $$
declare orphans int;
begin
  select count(*) into orphans from public.lectures where course_id is null;
  if orphans > 0 then
    raise exception 'Migration 0006: % lectures could not be matched to a course', orphans;
  end if;
end $$;

alter table public.lectures alter column course_id set not null;

alter table public.lectures
  drop column if exists course_code,
  drop column if exists course_name,
  drop column if exists professor,
  drop column if exists department,
  drop column if exists color_tag,
  drop column if exists subject,
  drop column if exists is_mandatory,
  drop column if exists study_year;

-- These indexed the columns that just moved to `courses`; their replacements
-- are created in section 1.
drop index if exists public.lectures_subject_idx;
drop index if exists public.lectures_mandatory_idx;

create index if not exists lectures_course_id_idx on public.lectures (course_id);
create index if not exists lectures_semester_idx  on public.lectures (semester);

-- ---------------------------------------------------------------------------
-- 4. RLS — courses read exactly like lectures did
-- ---------------------------------------------------------------------------
--
-- Readable by any signed-in user, written only by the service role (which
-- bypasses RLS), so the admin Edge Function stays the sole write path. There is
-- deliberately no insert/update/delete policy: a client with an anon key cannot
-- create a course even with a forged admin claim in its own JWT payload.

alter table public.courses enable row level security;

drop policy if exists "courses are readable by authenticated users" on public.courses;
create policy "courses are readable by authenticated users"
  on public.courses for select
  to authenticated
  using (true);
