import type { DayOfWeek, Lecture } from '../data/types'
import { hhmm } from '../time'
import { foldGreek } from './greek'

export type LectureMatch =
  | { status: 'matched'; lecture: Lecture }
  | { status: 'unmatched' }
  | { status: 'ambiguous'; candidates: Lecture[] }

/**
 * Identifies which existing catalogue lecture a parsed PDF row refers to.
 *
 * The key is name + day + start time — the same tuple that already tells two
 * sessions of one course (a lecture and its lab) apart in the catalogue.
 * Name alone or name+day alone both collide on real data: a course's lecture
 * and lab share a name, and some courses meet on the same day twice.
 *
 * Times go through `hhmm` because the two sides arrive in different shapes: the
 * parser emits 'HH:MM' (fromMinutes) while Postgres serialises its `time`
 * columns as 'HH:MM:SS'. Comparing raw strings matches nothing in production
 * and everything against the seed-backed mock, so the normalisation is load
 * bearing rather than cosmetic.
 */
export function matchLecture(
  parsed: { course_name: string; day_of_week: DayOfWeek; start_time: string },
  catalogue: Lecture[],
): LectureMatch {
  const key = (l: { course_name: string; day_of_week: DayOfWeek; start_time: string }) =>
    `${foldGreek(l.course_name)}|${l.day_of_week}|${hhmm(l.start_time)}`
  const wanted = key(parsed)
  const candidates = catalogue.filter((l) => key(l) === wanted)
  if (candidates.length === 0) return { status: 'unmatched' }
  if (candidates.length > 1) return { status: 'ambiguous', candidates }
  return { status: 'matched', lecture: candidates[0] }
}
