-- Two facts the department publishes about every course that had nowhere to go.
--
-- Run with: supabase db push
--
-- `semester_number` is which of the eight programme semesters a course belongs
-- to (1-8). It is NOT the same as `study_year`, which is ceil(semester/2) and
-- cannot tell the 5th semester from the 6th, and NOT the same as
-- `lectures.semester`, which is a term *name* like 'Spring 2026'. Three things
-- called some variant of "semester" is a trap, so the column is spelled out.
--
-- `ects` is the credit weight, 5-8 across the programme.
--
-- Both are nullable: a course added by hand before its details are known is
-- still a valid course, and the demo term has neither.

alter table public.courses
  add column if not exists semester_number int
    check (semester_number between 1 and 8),
  add column if not exists ects numeric(3, 1)
    check (ects >= 0 and ects <= 30);

-- The course list is browsed a semester at a time, which is how the programme
-- is published and how a student picks.
create index if not exists courses_semester_number_idx
  on public.courses (semester_number);
