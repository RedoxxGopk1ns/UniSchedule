import { describe, expect, it } from 'vitest'
import {
  CATALOGUE,
  CALENDAR,
  DEFAULT_ENROLMENT,
  DEMO_ENROLMENT,
  DEMO_SEMESTER,
  LECTURES,
  SEMESTERS,
  SPRING_ENROLMENT,
} from './data/seed'
import type { ScheduleEntry } from './data/types'
import { isOutOfTerm, resolveWeek } from './occurrences'

/**
 * Guards the demo fixture — the thing that makes the app showable at all.
 *
 * `DEMO_SEMESTER` exists so the dashboard is never empty outside the real
 * spring term. That guarantee is quietly time-dependent, and it has already
 * broken twice: once when the demo term's `end_date` passed, and once when a
 * `blocks_teaching` break was left sitting on the week being demonstrated. Both
 * render as "no lectures this week", which looks like a broken app rather than
 * a stale fixture.
 */

const entryFor = (id: string): ScheduleEntry => {
  const lecture = CATALOGUE.find((l) => l.id === id)!
  return { id, lecture_id: id, google_event_id: null, lecture }
}

/** What the grid would draw for `entries` on the week containing `date`. */
function weekOf(date: string, ids: string[]) {
  const entries = ids.map(entryFor)
  const resolved = resolveWeek(entries, [], CALENDAR, new Date(`${date}T10:00:00Z`), SEMESTERS)
  return {
    outOfTerm: isOutOfTerm(resolved),
    drawn: resolved.filter((o) => o.status !== 'out-of-term' && o.status !== 'cancelled'),
  }
}

describe('demo fixture', () => {
  it('resolves every pre-enrolled id against the catalogue', () => {
    // A `!` assertion on this lookup is what crashed the landing page when the
    // demo ids were added to an enrolment resolved against LECTURES.
    for (const id of DEFAULT_ENROLMENT) {
      expect(CATALOGUE.find((l) => l.id === id), `no lecture ${id}`).toBeDefined()
    }
  })

  it('keeps the spring half resolvable against the real-only catalogue', () => {
    // LandingPage's hero grid and logic.test.ts both look these up in LECTURES.
    for (const id of SPRING_ENROLMENT) {
      expect(LECTURES.find((l) => l.id === id), `no spring lecture ${id}`).toBeDefined()
    }
  })

  it('draws a full week inside the demo term', () => {
    const { outOfTerm, drawn } = weekOf('2026-09-11', DEMO_ENROLMENT)
    expect(outOfTerm).toBe(false)
    expect(drawn.length).toBeGreaterThan(0)

    // Every weekday carries something, so the dashboard has content whichever
    // day the app is opened on.
    const days = new Set(drawn.map((o) => o.entry.lecture.day_of_week))
    expect([...days].sort()).toEqual([
      'Friday',
      'Monday',
      'Thursday',
      'Tuesday',
      'Wednesday',
    ])
  })

  /**
   * The failure that prompted this file: a five-day break was left sitting on
   * 7-11 September, so the app opened on that week showed "no lectures this
   * week" and looked broken.
   *
   * Single blocked *days* are fine and wanted — the real calendar's exam
   * markers and holidays are what §22's strike-through demonstrates. A blocked
   * *week* is the problem, because it empties the grid entirely.
   */
  it('almost never blanks a whole week of the demo term', () => {
    const start = new Date(`${DEMO_SEMESTER.start_date}T00:00:00Z`)
    const end = new Date(`${DEMO_SEMESTER.end_date}T00:00:00Z`)

    const blank: string[] = []
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 7 * 86_400_000)) {
      const iso = d.toISOString().slice(0, 10)
      if (weekOf(iso, DEMO_ENROLMENT).drawn.length === 0) blank.push(iso)
    }

    // At most the one deliberate break, so there is something to show for §22.
    expect(blank.length, `blank weeks: ${blank.join(', ')}`).toBeLessThanOrEqual(1)

    // And not in the term's opening months, where whoever is presenting would
    // land on it without having gone looking.
    for (const iso of blank) {
      const weeksIn =
        (new Date(`${iso}T00:00:00Z`).getTime() - start.getTime()) / (7 * 86_400_000)
      expect(weeksIn, `week of ${iso} is blank`).toBeGreaterThan(8)
    }
  })

  it('runs long enough to outlive a term of demonstrating', () => {
    // Not asserted against the real clock — that would fail spontaneously one
    // day with no code change. Asserted against its own start instead: a demo
    // term shorter than a year is one that expires while still being used.
    const days =
      (new Date(`${DEMO_SEMESTER.end_date}T00:00:00Z`).getTime() -
        new Date(`${DEMO_SEMESTER.start_date}T00:00:00Z`).getTime()) /
      86_400_000
    expect(days).toBeGreaterThan(365)
  })

  it('is obviously fake, so it cannot be mistaken for the real timetable', () => {
    for (const id of DEMO_ENROLMENT) {
      const lecture = entryFor(id).lecture
      expect(lecture.course_code).toMatch(/^DEMO-/)
      expect(lecture.course_name).toMatch(/^Demo /)
      expect(lecture.professor).toMatch(/^Demo Lecturer/)
    }
  })
})
