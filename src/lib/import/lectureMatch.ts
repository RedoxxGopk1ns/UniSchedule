import type { Course } from '../data/types'
import { foldGreek } from './greek'

export type CourseMatch =
  | { status: 'matched'; course: Course }
  | { status: 'unmatched' }
  | { status: 'ambiguous'; candidates: Course[] }

/**
 * Identifies which course a parsed PDF cell is a meeting of.
 *
 * The key is the title alone. A course *is* its title as far as the timetable
 * is concerned: the PDF carries no course codes, and day/time are precisely
 * what the import is there to change, so matching on them would mean a course
 * stopped being recognised the moment its slot moved — the one case the whole
 * feature exists for.
 *
 * `foldGreek` absorbs the differences that are not differences: accents, case,
 * and the Latin/Greek homoglyphs ('A' vs 'Α') that the department's own
 * documents mix freely.
 *
 * Titles are unique in `courses`, so 'ambiguous' should not arise in practice.
 * It is still reported rather than silently resolved: the admin picks from the
 * dropdown, which is the same gesture every other uncertain row needs.
 */
export function matchCourse(
  parsed: { course_name: string },
  courses: Course[],
): CourseMatch {
  const wanted = foldGreek(parsed.course_name)
  if (wanted === '') return { status: 'unmatched' }
  const candidates = courses.filter((c) => foldGreek(c.course_name) === wanted)
  if (candidates.length === 0) return { status: 'unmatched' }
  if (candidates.length > 1) return { status: 'ambiguous', candidates }
  return { status: 'matched', course: candidates[0] }
}
