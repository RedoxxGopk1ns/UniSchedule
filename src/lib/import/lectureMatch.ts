import type { DayOfWeek, Lecture } from '../data/types'
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
 */
export function matchLecture(
  parsed: { course_name: string; day_of_week: DayOfWeek; start_time: string },
  catalogue: Lecture[],
): LectureMatch {
  const key = (l: { course_name: string; day_of_week: DayOfWeek; start_time: string }) =>
    `${foldGreek(l.course_name)}|${l.day_of_week}|${l.start_time}`
  const wanted = key(parsed)
  const candidates = catalogue.filter((l) => key(l) === wanted)
  if (candidates.length === 0) return { status: 'unmatched' }
  if (candidates.length > 1) return { status: 'ambiguous', candidates }
  return { status: 'matched', lecture: candidates[0] }
}
