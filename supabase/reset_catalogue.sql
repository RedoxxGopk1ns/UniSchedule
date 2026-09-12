-- Clears the catalogue so supabase/seed.sql can load the department's official
-- course list into a database that already held the old one.
--
-- Run this ONLY when you mean to replace the catalogue wholesale, immediately
-- before seed.sql, with the SQL editor or a service-role connection:
--
--   psql "$DATABASE_URL" -f supabase/reset_catalogue.sql
--   psql "$DATABASE_URL" -f supabase/seed.sql
--
-- ## Why it is needed
--
-- Migration 0006 backfills one `courses` row per distinct title found in the
-- `lectures` table it is splitting up. Those rows get generated uuids and the
-- titles the old timetable used. seed.sql then inserts the official 73 courses
-- with fixed ids and `on conflict (id) do update` — which does not fire when
-- the collision is on `course_name` instead, and `courses.course_name` is
-- unique because a timetable import matches on it. The result is a unique
-- violation that aborts the entire seed. Clearing first sidesteps it.
--
-- ## What this destroys
--
-- `lectures.course_id` cascades from `courses`, and `user_schedules.lecture_id`
-- cascades from `lectures`, so **every student's saved schedule goes with it**.
-- Their Google Calendar events are NOT removed — this is plain SQL, it cannot
-- call the Calendar API — so anyone enrolled keeps orphaned events until they
-- re-pick their courses and sync again. On a demo database with one account
-- that is nothing; on a live one, think first.
--
-- `user_passed_courses` is keyed by course_code, not by a foreign key, so
-- passed courses survive. The old codes were minted ones ('TPT6-…') and the new
-- list uses the department's own ('ΥΠ25', 'ΕΠ34'), so any passed marks made
-- before this will no longer match a course. Clear them too if that matters:
--   delete from public.user_passed_courses;

begin;

-- Order matters only for readability; both cascade from courses anyway.
delete from public.lectures;
delete from public.courses;

commit;
