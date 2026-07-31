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
import { ACADEMIC_EVENTS, LECTURES, SEMESTER } from '../src/lib/data/seed.ts'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../supabase/seed.sql')

/** Single-quote escaping for SQL string literals. */
const q = (value) =>
  value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`

/** Booleans and integers are literals in SQL, not quoted strings. */
const raw = (value) => (value === null || value === undefined ? 'null' : String(value))

const rows = LECTURES.map(
  (l) =>
    `  (${q(l.id)}, ${q(l.course_code)}, ${q(l.course_name)}, ${q(l.professor)}, ` +
    `${q(l.room)}, ${q(l.day_of_week)}, ${q(l.start_time)}, ${q(l.end_time)}, ` +
    `${q(l.semester)}, ${q(l.department)}, ${q(l.color_tag)}, ` +
    `${q(l.subject)}, ${raw(l.is_mandatory)}, ${raw(l.study_year)})`,
).join(',\n')

const eventRows = ACADEMIC_EVENTS.map(
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

insert into public.semesters (name, start_date, end_date, time_zone, is_current)
values (${q(SEMESTER.name)}, ${q(SEMESTER.start_date)}, ${q(SEMESTER.end_date)}, 'Europe/Athens', true)
on conflict (name) do update
  set start_date = excluded.start_date,
      end_date   = excluded.end_date;

insert into public.lectures
  (id, course_code, course_name, professor, room, day_of_week, start_time, end_time, semester, department, color_tag, subject, is_mandatory, study_year)
values
${rows}
on conflict (id) do update
  set course_code  = excluded.course_code,
      course_name  = excluded.course_name,
      professor    = excluded.professor,
      room         = excluded.room,
      day_of_week  = excluded.day_of_week,
      start_time   = excluded.start_time,
      end_time     = excluded.end_time,
      semester     = excluded.semester,
      department   = excluded.department,
      color_tag    = excluded.color_tag,
      subject      = excluded.subject,
      is_mandatory = excluded.is_mandatory,
      study_year   = excluded.study_year;

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
  `Wrote ${LECTURES.length} lectures and ${ACADEMIC_EVENTS.length} academic events to supabase/seed.sql`,
)
