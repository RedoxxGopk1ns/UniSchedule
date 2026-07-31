import type { Lecture } from './data/types'
import { fromMinutes, overlaps, timeRange, toMinutes } from './time'

export interface Conflict {
  a: Lecture
  b: Lecture
  day: string
  /** Overlapping window, e.g. '10:00–11:00'. */
  window: string
}

/**
 * Finds every pair of selected lectures that share a day and overlap in time
 * (§8.4). Conflicts are a warning, never a block — a student may knowingly
 * double-book and resolve it themselves.
 *
 * O(n²) over the selection, which is at most a few dozen rows.
 */
export function detectConflicts(lectures: Lecture[]): Conflict[] {
  const out: Conflict[] = []

  for (let i = 0; i < lectures.length; i++) {
    for (let j = i + 1; j < lectures.length; j++) {
      const a = lectures[i]!
      const b = lectures[j]!
      if (a.day_of_week !== b.day_of_week) continue
      if (!overlaps(a.start_time, a.end_time, b.start_time, b.end_time)) continue

      const from = Math.max(toMinutes(a.start_time), toMinutes(b.start_time))
      const to = Math.min(toMinutes(a.end_time), toMinutes(b.end_time))
      out.push({
        a,
        b,
        day: a.day_of_week,
        window: timeRange(fromMinutes(from), fromMinutes(to)),
      })
    }
  }

  return out
}

/** 'CS301 overlaps with MATH205 on Tuesday 10:00–11:00' */
export function describeConflict(c: Conflict): string {
  return `${c.a.course_code} overlaps with ${c.b.course_code} on ${c.day} ${c.window}`
}
