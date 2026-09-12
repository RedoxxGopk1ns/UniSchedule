/**
 * Generates supabase/seed.sql from the TypeScript fixture in
 * src/lib/data/seed.ts, so the mock demo and the real database always show the
 * same catalogue.
 *
 * Run with:  npm run seed:sql
 *
 * Relies on Node's built-in TypeScript type stripping (Node 22.6+), which is
 * why the import below carries an explicit .ts extension.
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALL_COURSES,
  CALENDAR,
  DEMO_SCHEDULE,
  SCHEDULE,
  SEMESTER,
  SEMESTERS,
} from '../src/lib/data/seed.ts'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../supabase/seed.sql')

/** Single-quote escaping for SQL string literals. */
const q = (value) =>
  value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`

/** Booleans and integers are literals in SQL, not quoted strings. */
const raw = (value) => (value === null || value === undefined ? 'null' : String(value))

const semesterRows = SEMESTERS.map(
  (s) =>
    `  (${q(s.name)}, ${q(s.start_date)}, ${q(s.end_date)}, 'Europe/Athens', ` +
    `${raw(s.name === SEMESTER.name)})`,
).join(',\n')

const courseRows = ALL_COURSES.map(
  (c) =>
    `  (${q(c.id)}, ${q(c.course_code)}, ${q(c.course_name)}, ${q(c.professor)}, ` +
    `${q(c.department)}, ${q(c.color_tag)}, ${q(c.subject)}, ` +
    `${raw(c.is_mandatory)}, ${raw(c.study_year)}, ${raw(c.semester_number)}, ` +
    `${raw(c.ects)})`,
).join(',\n')

// The stored rows, not the joined CATALOGUE: `lectures` holds only the
// scheduling half since migration 0006.
const lectures = [...SCHEDULE, ...DEMO_SCHEDULE]

const rows = lectures.map(
  (l) =>
    `  (${q(l.id)}, ${q(l.course_id)}, ${q(l.room)}, ${q(l.day_of_week)}, ` +
    `${q(l.start_time)}, ${q(l.end_time)}, ${q(l.semester)})`,
).join(',\n')

const eventRows = CALENDAR.map(
  (e) =>
    `  (${q(e.id)}, ${q(e.semester)}, ${q(e.kind)}, ${q(e.title)}, ` +
    `${q(e.start_date)}, ${q(e.end_date)}, ${raw(e.blocks_teaching)})`,
).join(',\n')

const sql = `-- GENERATED FILE — do not edit by hand.
-- Source: src/lib/data/seed.ts   Regenerate: npm run seed:sql
--
-- The Department of Informatics and Telematics catalogue for spring 2025-2026,
-- parsed from the university's own timetable and academic calendar PDFs. It
-- contains the real Monday 12:00-15:00 clash between Εφαρμογές Τηλεματικής and
-- the Προγραμματισμός Συστημάτων lab, which exercises the §8.4 conflict warning.
--
-- It also carries the fictional 'Demo Term' — DEMO-* codes, 'Demo Lecturer'
-- staff — which exists so the app can be demonstrated during an active term
-- once the real spring one has ended. Drop those rows to remove it.

insert into public.semesters (name, start_date, end_date, time_zone, is_current)
values
${semesterRows}
on conflict (name) do update
  set start_date = excluded.start_date,
      end_date   = excluded.end_date;

-- Courses first: lectures reference them. Ids are stable in the fixture, so id
-- is the conflict target even though course_name carries the unique constraint
-- a timetable import actually matches on.
insert into public.courses
  (id, course_code, course_name, professor, department, color_tag, subject, is_mandatory, study_year, semester_number, ects)
values
${courseRows}
on conflict (id) do update
  set course_code  = excluded.course_code,
      course_name  = excluded.course_name,
      professor    = excluded.professor,
      department   = excluded.department,
      color_tag    = excluded.color_tag,
      subject      = excluded.subject,
      is_mandatory = excluded.is_mandatory,
      study_year   = excluded.study_year,
      semester_number = excluded.semester_number,
      ects         = excluded.ects;

-- When and where each course meets. Everything else about a lecture is read
-- through course_id.
insert into public.lectures
  (id, course_id, room, day_of_week, start_time, end_time, semester)
values
${rows}
on conflict (id) do update
  set course_id   = excluded.course_id,
      room        = excluded.room,
      day_of_week = excluded.day_of_week,
      start_time  = excluded.start_time,
      end_time    = excluded.end_time,
      semester    = excluded.semester;

-- Academic calendar: holidays, breaks and the term's date markers. Rows with
-- blocks_teaching = true become EXDATEs on every recurring Calendar event that
-- crosses them (see supabase/functions/sync-schedule).
insert into public.academic_events
  (id, semester, kind, title, start_date, end_date, blocks_teaching)
values
${eventRows}
on conflict (id) do update
  set semester        = excluded.semester,
      kind            = excluded.kind,
      title           = excluded.title,
      start_date      = excluded.start_date,
      end_date        = excluded.end_date,
      blocks_teaching = excluded.blocks_teaching;
`

writeFileSync(out, sql, 'utf8')
console.log(
  `Wrote ${SEMESTERS.length} semesters, ${ALL_COURSES.length} courses, ` +
    `${lectures.length} lectures and ${CALENDAR.length} academic events ` +
    `to supabase/seed.sql`,
)
