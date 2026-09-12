import { describe, expect, it } from 'vitest'
import { describeConflict, detectConflicts } from './conflicts'
import {
  CATALOGUE,
  SPRING_ENROLMENT,
  DEMO_LECTURES,
  DEMO_SEMESTER,
  LECTURES,
  SEMESTER,
  SEMESTERS,
} from './data/seed'
import { DAYS, type Lecture, type ScheduleEntry } from './data/types'
import { withinTerm } from './occurrences'
import { computeDiff, isEmptyDiff, unsyncedLectureIds, withBackfill } from './diff'
import { activeFilterCount, applyFilters, bandOf } from './filters'
import { layoutDay, layoutWeek } from './layout'
import { pgFilterValue } from './postgrestFilter'
import {
  SLOT_COUNT,
  countdownLabel,
  formatEventRange,
  isValidTime,
  isWithinGrid,
  slotOffset,
  slotSpan,
  toMinutes,
} from './time'

const byId = (id: string): Lecture => LECTURES.find((l) => l.id === id)!

const entry = (lecture: Lecture): ScheduleEntry => ({
  id: lecture.id,
  lecture_id: lecture.id,
  google_event_id: null,
  lecture,
})

// The spring half only: `byId` looks rows up in the real-only LECTURES, and
// these tests are about the real timetable's own clashes.
const mine = SPRING_ENROLMENT.map((id) => entry(byId(id)))

// Third-year rows from the real spring catalogue. The two Monday 12:00-15:00
// entries genuinely clash in the published timetable, which is what the
// conflict tests below exercise.
const SYSPROG_MON_AM = '00000000-0000-4000-8000-000000000020' // Mon 09:00–12:00, enrolled
const TELEMATICS_MON = '00000000-0000-4000-8000-000000000021' // Mon 12:00–15:00, enrolled
const SYSPROG_MON_PM = '00000000-0000-4000-8000-000000000022' // Mon 12:00–15:00, not enrolled
const ALGORITHMS_TUE = '00000000-0000-4000-8000-000000000024' // Tue 09:00–12:00, enrolled

// The two sections of Αρχιτεκτονική Υπολογιστών — one course, two days.
const ARCH_WED = '00000000-0000-4000-8000-000000000007'
const ARCH_FRI = '00000000-0000-4000-8000-000000000009'

/** Course codes with exactly two sections each, for the passed-course rules. */
const SYSPROG = 'ΕΠ02'
const DATABASES = 'ΥΠ16'
const DEPARTMENT = 'Πληροφορικής και Τηλεματικής'

describe('demo term fixture', () => {
  const demo = (code: string) => DEMO_LECTURES.filter((l) => l.course_code === code)

  it('is the term teaching over the summer, when the real one is not', () => {
    // The reason it exists: the real catalogue closed on 05/06/2026, so without
    // this term the app cannot be shown with an active semester after that.
    for (const day of ['2026-06-15', '2026-08-05', '2026-09-30']) {
      expect(withinTerm(SEMESTERS, DEMO_SEMESTER.name, day)).toBe(true)
      expect(withinTerm(SEMESTERS, SEMESTER.name, day)).toBe(false)
    }
  })

  it('leaves the real catalogue and the current term alone', () => {
    expect(LECTURES.some((l) => l.semester === DEMO_SEMESTER.name)).toBe(false)
    expect(CATALOGUE).toHaveLength(LECTURES.length + DEMO_LECTURES.length)
    // The admin Import screen defaults to the current term; moving the flag onto
    // a fictional one would quietly file real imports under it.
    expect(SEMESTERS[0]!.name).toBe(SEMESTER.name)
  })

  it('is named so no row can be mistaken for the department catalogue', () => {
    for (const l of DEMO_LECTURES) {
      expect(l.semester).toBe(DEMO_SEMESTER.name)
      expect(l.course_code).toMatch(/^DEMO-/)
      expect(l.course_name).toMatch(/^Demo /)
      expect(l.professor).toMatch(/^Demo Lecturer /)
      expect(l.department).toBe('Demo Department')
    }
  })

  it('carries the Monday overlap the conflict warning is meant to catch', () => {
    const conflicts = detectConflicts(DEMO_LECTURES)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.day).toBe('Monday')
    expect([conflicts[0]!.a.course_code, conflicts[0]!.b.course_code].sort()).toEqual([
      'DEMO-102',
      'DEMO-103',
    ])
  })

  it('splits one course into two sections, and fits inside the grid', () => {
    expect(demo('DEMO-107')).toHaveLength(2)
    // Including the 19:00–22:00 class, which is what the evening end of the
    // 07:00–23:00 window is for.
    expect(DEMO_LECTURES.every((l) => isWithinGrid(l.start_time, l.end_time))).toBe(true)
  })
})

describe('time', () => {
  it('maps the top of the grid to slot 0', () => {
    expect(slotOffset('07:00')).toBe(0)
    expect(slotOffset('09:00')).toBe(4)
  })

  it('measures a 90-minute lecture as three slots', () => {
    expect(slotSpan('09:00', '10:30')).toBe(3)
  })

  it('covers 07:00–23:00 in 30-minute slots', () => {
    expect(SLOT_COUNT).toBe(32)
  })

  it('formats the countdown pill', () => {
    expect(countdownLabel(45)).toBe('In 45 min')
    expect(countdownLabel(120)).toBe('In 2 h')
    expect(countdownLabel(130)).toBe('In 2 h 10 min')
    expect(countdownLabel(0)).toBe('Starting now')
  })

  it('formats a term entry as a day, a span, or a span across months', () => {
    expect(formatEventRange('2027-01-06', '2027-01-06')).toBe('6 Jan')
    expect(formatEventRange('2026-10-19', '2026-10-23')).toBe('19–23 Oct')
    expect(formatEventRange('2026-06-30', '2026-07-10')).toBe('30 Jun – 10 Jul')
  })

  it('reads a term entry as a calendar day, whatever the runner timezone', () => {
    // '2026-10-19' is a date, not an instant. Formatted in local time west of
    // Greenwich it would print the 18th.
    expect(formatEventRange('2026-10-19', '2026-10-19')).toBe('19 Oct')
  })
})

describe('seed data', () => {
  it('keeps every lecture inside the rendered window', () => {
    const outside = LECTURES.filter(
      (l) => slotOffset(l.start_time) < 0 || slotOffset(l.end_time) > SLOT_COUNT,
    )
    expect(outside).toEqual([])
  })

  it('ends every lecture after it starts', () => {
    for (const l of LECTURES) {
      expect(slotSpan(l.start_time, l.end_time)).toBeGreaterThan(0)
    }
  })
})

describe('layoutDay', () => {
  it('places every lecture in the week', () => {
    const week = layoutWeek(mine, DAYS)
    expect(Object.values(week).flat()).toHaveLength(mine.length)
  })

  it('splits overlapping lectures into side-by-side columns', () => {
    const placed = layoutDay([entry(byId(TELEMATICS_MON)), entry(byId(SYSPROG_MON_PM))])
    expect(placed.map((p) => p.columns)).toEqual([2, 2])
    expect(new Set(placed.map((p) => p.column)).size).toBe(2)
  })

  it('leaves back-to-back lectures at full width', () => {
    // 09:00–12:00 followed by 12:00–15:00: they touch but do not overlap.
    const placed = layoutDay([entry(byId(SYSPROG_MON_AM)), entry(byId(TELEMATICS_MON))])
    expect(placed.map((p) => p.columns)).toEqual([1, 1])
  })
})

describe('detectConflicts', () => {
  it('reports the default enrolment as clash-free', () => {
    // The demo schedule is deliberately clean, so the dashboard and the landing
    // preview do not open on a warning.
    expect(detectConflicts(mine.map((e) => e.lecture))).toEqual([])
  })

  it('finds the Monday 12:00 clash once the second course is added', () => {
    const conflicts = detectConflicts([
      ...mine.map((e) => e.lecture),
      byId(SYSPROG_MON_PM),
    ])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.day).toBe('Monday')
    expect(describeConflict(conflicts[0]!)).toBe(
      `ΕΠ32 overlaps with ${SYSPROG} on Monday 12:00–15:00`,
    )
  })

  it('does not flag lectures that merely touch at the boundary', () => {
    // 09:00–12:00 then 12:00–15:00 on the same Monday.
    expect(detectConflicts([byId(SYSPROG_MON_AM), byId(TELEMATICS_MON)])).toEqual([])
  })

  it('does not flag the same time on different days', () => {
    // Both run 09:00–12:00, one on Monday and one on Tuesday.
    expect(detectConflicts([byId(SYSPROG_MON_AM), byId(ALGORITHMS_TUE)])).toEqual([])
  })
})

describe('applyFilters', () => {
  const all = LECTURES

  it('scopes to one term, but never hides a course already selected', () => {
    // CATALOGUE spans the real spring term and the demo one; LECTURES is the
    // spring half. The picker scopes to the term being taught so a student
    // cannot enrol in one that has finished — but an enrolment they already
    // hold in another term has to stay visible, or the counter claims more
    // courses than the list can show.
    const spring = applyFilters(CATALOGUE, { semester: SEMESTER.name })
    expect(spring).toHaveLength(LECTURES.length)
    expect(spring.every((l) => l.semester === SEMESTER.name)).toBe(true)

    const demo = CATALOGUE.find((l) => l.semester !== SEMESTER.name)!
    const withPick = applyFilters(
      CATALOGUE,
      { semester: SEMESTER.name },
      { selectedIds: [demo.id] },
    )
    expect(withPick).toHaveLength(LECTURES.length + 1)
    expect(withPick.some((l) => l.id === demo.id)).toBe(true)
  })

  it('returns everything when nothing is constrained', () => {
    expect(applyFilters(all, {})).toHaveLength(all.length)
    // An empty array is "no constraint", not "match nothing" — this is what
    // makes Clear all a single setFilters({}).
    expect(applyFilters(all, { days: [], departments: [] })).toHaveLength(all.length)
  })

  it('ORs values within a dimension', () => {
    const tue = applyFilters(all, { days: ['Tuesday'] })
    const both = applyFilters(all, { days: ['Tuesday', 'Thursday'] })
    expect(both.length).toBeGreaterThan(tue.length)
    expect(both.every((l) => ['Tuesday', 'Thursday'].includes(l.day_of_week))).toBe(true)
  })

  it('ANDs across dimensions', () => {
    const result = applyFilters(all, {
      days: ['Tuesday'],
      departments: [DEPARTMENT],
    })
    expect(result.length).toBeGreaterThan(0)
    expect(
      result.every((l) => l.day_of_week === 'Tuesday' && l.department === DEPARTMENT),
    ).toBe(true)
  })

  it('groups a subject across its sections', () => {
    const result = applyFilters(all, { subjects: ['Προγραμματισμός'] })
    expect(result.every((l) => l.subject === 'Προγραμματισμός')).toBe(true)
    // Both sections of Προγραμματισμός Συστημάτων share the subject.
    expect(result.map((l) => l.id)).toContain(SYSPROG_MON_AM)
    expect(result.map((l) => l.id)).toContain(SYSPROG_MON_PM)
  })

  it('bands lectures by start time, inclusive at the lower bound', () => {
    expect(bandOf(byId(SYSPROG_MON_AM))).toBe('Morning') // 09:00
    expect(bandOf(byId(TELEMATICS_MON))).toBe('Afternoon') // 12:00 exactly
    // The department schedules nothing after 15:00, so the Evening edge is
    // checked against a literal rather than a catalogue row.
    expect(bandOf({ ...byId(SYSPROG_MON_AM), start_time: '17:00' })).toBe('Evening')
  })

  it('filters by time band', () => {
    const morning = applyFilters(all, { bands: ['Morning'] })
    expect(morning.length).toBeGreaterThan(0)
    expect(morning.every((l) => toMinutes(l.start_time) < 12 * 60)).toBe(true)
  })

  it('restricts to the current selection', () => {
    const ids = [SYSPROG_MON_AM, ALGORITHMS_TUE]
    const result = applyFilters(all, { selectedOnly: true }, { selectedIds: ids })
    expect(result.map((l) => l.id).sort()).toEqual([...ids].sort())
  })

  it('hides passed courses from the catalogue by default', () => {
    const result = applyFilters(all, {}, { passedCourseCodes: [SYSPROG] })
    // Both sections drop out; nothing else does.
    expect(result.some((l) => l.course_code === SYSPROG)).toBe(false)
    expect(result).toHaveLength(all.length - 2)
  })

  it('shows only passed courses in the passed-only review', () => {
    const result = applyFilters(all, { passedOnly: true }, { passedCourseCodes: [SYSPROG] })
    expect(result.every((l) => l.course_code === SYSPROG)).toBe(true)
    expect(result.map((l) => l.id).sort()).toEqual(
      [SYSPROG_MON_AM, SYSPROG_MON_PM].sort(),
    )
  })

  it('treats an empty passed set as no constraint', () => {
    expect(applyFilters(all, {}, { passedCourseCodes: [] })).toHaveLength(all.length)
  })

  it('hides multiple passed codes at once', () => {
    const result = applyFilters(all, {}, { passedCourseCodes: [SYSPROG, DATABASES] })
    expect(result.some((l) => [SYSPROG, DATABASES].includes(l.course_code))).toBe(false)
    // Two sections each — four rows removed.
    expect(result).toHaveLength(all.length - 4)
  })

  it('still applies other dimensions inside the passed-only view', () => {
    // Search narrows within the passed set, it does not escape it.
    const result = applyFilters(
      all,
      { passedOnly: true, search: 'Βάσεις' },
      { passedCourseCodes: [SYSPROG, DATABASES] },
    )
    expect(result.every((l) => l.course_code === DATABASES)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('never shows a passed course in the normal view even when it matches a filter', () => {
    // A department filter that would include it, but it is passed → still hidden.
    const result = applyFilters(
      all,
      { departments: [DEPARTMENT] },
      { passedCourseCodes: [SYSPROG] },
    )
    expect(result.some((l) => l.course_code === SYSPROG)).toBe(false)
    expect(result.every((l) => l.department === DEPARTMENT)).toBe(true)
  })

  it('passedOnly with an empty passed set shows nothing', () => {
    expect(applyFilters(all, { passedOnly: true }, { passedCourseCodes: [] })).toEqual([])
  })

  it('falls back to plain mandatory when no year is set', () => {
    const result = applyFilters(all, { mandatoryOnly: true }, { studyYear: null })
    expect(result.length).toBeGreaterThan(0)
    // No year narrowing: every required lecture in the catalogue comes back,
    // whichever year it belongs to.
    expect(result).toEqual(all.filter((l) => l.is_mandatory))
  })

  it('narrows to the student’s own year once it is known', () => {
    const result = applyFilters(all, { mandatoryOnly: true }, { studyYear: 3 })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((l) => l.is_mandatory && l.study_year === 3)).toBe(true)
  })

  it('searches code, name, professor and room', () => {
    expect(applyFilters(all, { search: SYSPROG.toLowerCase() })).toHaveLength(2)
    expect(applyFilters(all, { search: 'Α. Δημόπουλος' })).toHaveLength(2)
    expect(applyFilters(all, { search: 'Καραμπατζός' }).length).toBeGreaterThan(0)
  })

  it('counts constrained dimensions, not chosen values', () => {
    expect(activeFilterCount({})).toBe(0)
    expect(activeFilterCount({ days: [] })).toBe(0)
    // Two days is still one active filter.
    expect(activeFilterCount({ days: ['Monday', 'Tuesday'] })).toBe(1)
    expect(activeFilterCount({ days: ['Monday'], mandatoryOnly: true })).toBe(2)
    expect(activeFilterCount({ passedOnly: true })).toBe(1)
    expect(activeFilterCount({ search: '   ' })).toBe(0)
  })
})

describe('seed metadata', () => {
  it('takes the year of study from the semester the course sits in', () => {
    // The catalogue is one page per semester: Β' (2nd) is year 1, ΣΤ' (6th)
    // is year 3. See src/lib/import/timetableParser.ts.
    expect(byId(SYSPROG_MON_AM).study_year).toBe(3)
    expect(byId(ARCH_WED).study_year).toBe(1)
  })

  it('gives every lecture a subject', () => {
    expect(LECTURES.every((l) => Boolean(l.subject))).toBe(true)
  })

  it('gives every lecture a course code and a professor', () => {
    // Neither appears reliably in the source PDF: codes are minted on import
    // and missing professors are filled in during review. Nothing should reach
    // the catalogue without them.
    expect(LECTURES.every((l) => l.course_code.trim() !== '')).toBe(true)
    expect(LECTURES.every((l) => l.professor.trim() !== '')).toBe(true)
  })

  it('keeps both sections of a course on the same subject and year', () => {
    const a = byId(ARCH_WED)
    const b = byId(ARCH_FRI)
    expect(a.course_code).toBe(b.course_code)
    expect(a.subject).toBe(b.subject)
    expect(a.study_year).toBe(b.study_year)
  })
})

describe('computeDiff', () => {
  it('produces nothing when the selection is unchanged', () => {
    const diff = computeDiff(mine, mine.map((e) => e.lecture_id))
    expect(isEmptyDiff(diff)).toBe(true)
  })

  it('reports a pure addition', () => {
    const diff = computeDiff(mine, [...mine.map((e) => e.lecture_id), LECTURES[9]!.id])
    expect(diff.to_add).toEqual([LECTURES[9]!.id])
    expect(diff.to_remove).toEqual([])
  })

  it('reports a pure removal', () => {
    const diff = computeDiff(mine, mine.slice(1).map((e) => e.lecture_id))
    expect(diff.to_add).toEqual([])
    expect(diff.to_remove).toHaveLength(1)
    expect(diff.to_remove[0]!.lecture_id).toBe(mine[0]!.lecture_id)
  })

  it('ignores untouched courses when swapping one for another', () => {
    const diff = computeDiff(mine, [
      ...mine.slice(1).map((e) => e.lecture_id),
      LECTURES[9]!.id,
    ])
    expect(diff.to_add).toHaveLength(1)
    expect(diff.to_remove).toHaveLength(1)
  })

  it('carries the google_event_id needed to delete the Calendar event', () => {
    const withEvent: ScheduleEntry[] = [
      { ...mine[0]!, google_event_id: 'evt_abc123' },
    ]
    const diff = computeDiff(withEvent, [])
    expect(diff.to_remove[0]!.google_event_id).toBe('evt_abc123')
  })

  it('deduplicates a repeated selection into a single add', () => {
    // A duplicate would otherwise enrol twice and create two Calendar events.
    const diff = computeDiff([], [LECTURES[0]!.id, LECTURES[0]!.id])
    expect(diff.to_add).toEqual([LECTURES[0]!.id])
  })
})

describe('Calendar backfill', () => {
  const synced = (l: Lecture): ScheduleEntry => ({
    id: l.id,
    lecture_id: l.id,
    google_event_id: `evt_${l.id.slice(0, 6)}`,
    lecture: l,
  })
  const unsynced = (l: Lecture): ScheduleEntry => ({ ...synced(l), google_event_id: null })

  const [a, b, c] = [LECTURES[0]!, LECTURES[1]!, LECTURES[2]!]

  it('finds only the enrolments with no Calendar event', () => {
    expect(unsyncedLectureIds([synced(a), unsynced(b), synced(c)])).toEqual([b.id])
  })

  it('reports nothing when every enrolment is already synced', () => {
    expect(unsyncedLectureIds([synced(a), synced(b)])).toEqual([])
  })

  it('adds unsynced lectures to the payload without touching the counts shown', () => {
    // computeDiff stays the student's view: one genuine addition.
    const diff = computeDiff([unsynced(a)], [a.id, b.id])
    expect(diff.to_add).toEqual([b.id])

    const payload = withBackfill(diff, unsyncedLectureIds([unsynced(a)]))
    expect(new Set(payload.to_add)).toEqual(new Set([a.id, b.id]))
  })

  it('never re-creates an event for a lecture being removed in the same save', () => {
    const diff = computeDiff([unsynced(a), synced(b)], [b.id])
    expect(diff.to_remove.map((x) => x.lecture_id)).toEqual([a.id])

    const payload = withBackfill(diff, [a.id])
    expect(payload.to_add).toEqual([])
  })

  it('does not duplicate a lecture already being added', () => {
    const diff = computeDiff([], [a.id])
    const payload = withBackfill(diff, [a.id])
    expect(payload.to_add).toEqual([a.id])
  })

  it('leaves a fully synced schedule as a no-op', () => {
    const entries = [synced(a), synced(b)]
    const diff = computeDiff(entries, [a.id, b.id])
    const payload = withBackfill(diff, unsyncedLectureIds(entries))
    expect(isEmptyDiff(payload)).toBe(true)
  })

  it('carries the removals through untouched', () => {
    const diff = computeDiff([synced(a)], [])
    const payload = withBackfill(diff, [])
    expect(payload.to_remove).toEqual(diff.to_remove)
  })
})

describe('time parsing', () => {
  it('accepts HH:MM and the Postgres HH:MM:SS form', () => {
    expect(isValidTime('09:30')).toBe(true)
    expect(isValidTime('09:30:00')).toBe(true)
    expect(toMinutes('09:30:00')).toBe(570)
  })

  it('rejects times that are not a real clock reading', () => {
    for (const bad of ['', ':', 'abc', '9am', '25:00', '12:60', '9:30']) {
      expect(isValidTime(bad)).toBe(false)
      expect(Number.isNaN(toMinutes(bad))).toBe(true)
    }
  })

  it('does not read an empty time as midnight', () => {
    // The old parser returned 0 here, so a blank field rendered at 00:00.
    expect(Number.isNaN(toMinutes(''))).toBe(true)
  })

  it('knows which lectures the grid can actually draw', () => {
    expect(isWithinGrid('07:00', '23:00')).toBe(true)
    // Evening lectures are taught, so they have to fit (see GRID_END_HOUR).
    expect(isWithinGrid('20:00', '22:00')).toBe(true)
    expect(isWithinGrid('06:30', '08:00')).toBe(false)
    expect(isWithinGrid('22:00', '23:30')).toBe(false)
    expect(isWithinGrid('abc', '10:00')).toBe(false)
  })

  it('places every seeded lecture inside the grid', () => {
    for (const lecture of LECTURES) {
      expect(isWithinGrid(lecture.start_time, lecture.end_time)).toBe(true)
    }
  })
})

describe('pgFilterValue', () => {
  it('quotes the value so punctuation cannot end the disjunct', () => {
    // Unquoted, this term name closed the disjunct at the comma and PostgREST
    // answered PGRST100 — which the academic-calendar readers swallow, so the
    // grid quietly stopped hiding holidays.
    expect(pgFilterValue('Spring 2026, Part B')).toBe('"Spring 2026, Part B"')
    expect(pgFilterValue('Spring 2026')).toBe('"Spring 2026"')
    expect(pgFilterValue('a)b(c')).toBe('"a)b(c"')
  })

  it('escapes backslashes before quotes, not after', () => {
    // Built from char codes rather than escape sequences: the point of this
    // test is exactly the characters that are hard to write literally.
    const bs = String.fromCharCode(92)
    const dq = String.fromCharCode(34)

    // One quote in, one escaped quote out.
    expect(pgFilterValue(dq)).toBe(dq + bs + dq + dq)
    // One backslash in, one escaped backslash out.
    expect(pgFilterValue(bs)).toBe(dq + bs + bs + dq)
    // Backslash then quote: both escape, and the backslash must be doubled
    // first, or it would escape the escape and end the value early.
    expect(pgFilterValue(bs + dq)).toBe(dq + bs + bs + bs + dq + dq)
  })
  it('leaves ilike wildcards alone', () => {
    expect(pgFilterValue('%Demo%')).toBe('"%Demo%"')
  })
})
