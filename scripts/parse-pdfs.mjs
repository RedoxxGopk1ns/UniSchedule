/**
 * Runs the import parsers over the fixtures and prints what they found.
 *
 * This is the offline counterpart to the admin Import screen: same parsers,
 * same output, no browser. It exists for two reasons — checking a parser change
 * against the real documents without clicking through the UI, and generating
 * the catalogue that gets committed into src/lib/data/seed.ts.
 *
 * Run with:
 *   npm run import:parse            # human-readable report
 *   npm run import:parse -- --seed  # a seed.ts fragment on stdout
 *
 * Regenerate the fixtures it reads with `npm run import:fixtures`.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = resolve(here, '../src/lib/import/__fixtures__')
const read = (name) => JSON.parse(readFileSync(resolve(fixtures, name), 'utf8'))

// Loaded through Vite rather than Node's own type stripping so the parsers can
// keep the extensionless imports the rest of src/ uses. Node would need a '.ts'
// on every value import, which would ripple out into src/lib/time.ts and beyond.
const server = await createServer({
  configFile: resolve(here, '../vite.config.ts'),
  server: { middlewareMode: true },
  logLevel: 'warn',
})
const { deriveCourseCodes } = await server.ssrLoadModule('/src/lib/import/courseCode.ts')
const { parseAcademicCalendar } = await server.ssrLoadModule(
  '/src/lib/import/calendarParser.ts',
)
const { parseTimetable } = await server.ssrLoadModule('/src/lib/import/timetableParser.ts')

const SEMESTER_NAME = 'Spring 2026'
const seedMode = process.argv.includes('--seed')

const timetable = parseTimetable(read('timetable.json'), { semester: SEMESTER_NAME })
const codes = deriveCourseCodes(timetable.lectures)
timetable.lectures.forEach((l, i) => {
  l.course_code = codes[i]
})

const calendar = parseAcademicCalendar(read('calendar.json'))

if (seedMode) {
  printSeed()
} else {
  printReport()
}

await server.close()

function printReport() {
  for (const sheet of timetable.sheets) {
    console.log(
      `\n=== page ${sheet.page} · semester ${sheet.semesterNumber} · year ${sheet.studyYear} · ${sheet.lectures.length} lectures`,
    )
    for (const w of sheet.warnings) console.log(`   ! ${w}`)
    for (const l of sheet.lectures) {
      console.log(
        `  ${l.day_of_week.slice(0, 3)} ${l.start_time}-${l.end_time}  ` +
          `${l.course_code.padEnd(24)} ${l.is_mandatory ? 'REQ' : 'ele'}  ` +
          `${l.course_name} | ${l.professor} | ${l.room ?? '—'}`,
      )
      for (const w of l.warnings) console.log(`       ! ${w}`)
    }
  }
  console.log(`\nTotal lectures: ${timetable.lectures.length}`)

  console.log(`\n=== academic calendar · ${calendar.events.length} events`)
  for (const w of calendar.warnings) console.log(`   ! ${w}`)
  for (const e of calendar.events) {
    const range = e.start_date === e.end_date ? e.start_date : `${e.start_date}..${e.end_date}`
    console.log(
      `  ${range.padEnd(24)} ${e.kind.padEnd(15)} ${e.blocks_teaching ? 'blocks' : '      '}  ${e.title}`,
    )
  }
  if (calendar.springSemester) {
    console.log(`\nProposed semester: ${JSON.stringify(calendar.springSemester)}`)
  }
}

/** Emits the LECTURES / ACADEMIC_EVENTS arrays for src/lib/data/seed.ts. */
function printSeed() {
  const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "\\'")}'`)
  const term = calendar.springSemester

  console.log(`export const SEMESTER: Semester = {`)
  console.log(`  name: ${q(term.name)},`)
  console.log(`  start_date: ${q(term.start_date)},`)
  console.log(`  end_date: ${q(term.end_date)},`)
  console.log('}\n')

  console.log('export const LECTURES: Lecture[] = [')
  let year = null
  timetable.lectures.forEach((l, i) => {
    if (l.study_year !== year) {
      year = l.study_year
      console.log(`  // Year ${year} — ${year * 2}ο εξάμηνο`)
    }
    console.log(
      `  { id: ${q(uuidFor(i))}, course_code: ${q(l.course_code)}, course_name: ${q(l.course_name)}, ` +
        `professor: ${q(l.professor)}, room: ${q(l.room)}, day_of_week: ${q(l.day_of_week)}, ` +
        `start_time: ${q(l.start_time)}, end_time: ${q(l.end_time)}, semester: ${q(l.semester)}, ` +
        `department: ${q(l.department)}, color_tag: ${q(l.color_tag)}, subject: ${q(l.subject)}, ` +
        `is_mandatory: ${l.is_mandatory}, study_year: ${l.study_year} },`,
    )
  })
  console.log(']\n')

  console.log('export const ACADEMIC_EVENTS: AcademicEvent[] = [')
  calendar.events.forEach((e, i) => {
    // Rows inside the spring teaching window belong to that term; the winter
    // ones and the exam periods either side stay on the academic year (null).
    const inTerm = e.start_date >= term.start_date && e.end_date <= term.end_date
    console.log(
      `  { id: ${q(uuidFor(1000 + i))}, semester: ${inTerm ? q(term.name) : 'null'}, kind: ${q(e.kind)}, ` +
        `title: ${q(e.title)}, start_date: ${q(e.start_date)}, end_date: ${q(e.end_date)}, ` +
        `blocks_teaching: ${e.blocks_teaching} },`,
    )
  })
  console.log(']')
}

/** Stable fake uuids, so re-running the generator produces no diff. */
function uuidFor(n) {
  const hex = String(n + 1).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}
