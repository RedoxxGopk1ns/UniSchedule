import type { Lecture, LectureFilters, TimeBand } from './data/types'
import { toMinutes } from './time'

/**
 * Catalogue filtering (§8.3). Kept pure and free of React so it can be tested
 * directly, the same way conflicts.ts and diff.ts are.
 *
 * Two rules hold across every dimension:
 *   - dimensions AND together — a day filter and a subject filter both apply;
 *   - values within a dimension OR together — Tuesday *or* Thursday.
 * An empty (or absent) dimension is no constraint at all, never a constraint
 * that matches nothing. That distinction is what makes "Clear all" trivial.
 */

export const emptyFilters: LectureFilters = {}

/** Band boundaries, in minutes since midnight. */
const NOON = 12 * 60
const EVENING = 17 * 60

/** Which part of the day a lecture starts in. */
export function bandOf(lecture: Lecture): TimeBand {
  const start = toMinutes(lecture.start_time)
  if (start < NOON) return 'Morning'
  if (start < EVENING) return 'Afternoon'
  return 'Evening'
}

/** Human label for the time-of-day pill options. */
export const BAND_LABELS: Record<TimeBand, string> = {
  Morning: 'Morning (before 12:00)',
  Afternoon: 'Afternoon (12:00–17:00)',
  Evening: 'Evening (from 17:00)',
}

/** Free-text match over the fields a student would actually search by. */
export function matchesSearch(lecture: Lecture, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return `${lecture.course_code} ${lecture.course_name} ${lecture.professor} ${lecture.room ?? ''}`
    .toLowerCase()
    .includes(q)
}

/** True when the dimension is unconstrained or the value is one of its options. */
function allows<T>(chosen: T[] | undefined, value: T | null): boolean {
  if (!chosen || chosen.length === 0) return true
  return value !== null && chosen.includes(value)
}

export interface FilterContext {
  /** Lecture ids currently ticked — backs `selectedOnly`. */
  selectedIds?: string[]
  /** The student's year of study, when they have set one. */
  studyYear?: number | null
  /** Course codes the student has passed — backs `passedOnly` and the default hide. */
  passedCourseCodes?: string[]
}

export function applyFilters(
  lectures: Lecture[],
  filters: LectureFilters,
  context: FilterContext = {},
): Lecture[] {
  const selected = new Set(context.selectedIds ?? [])
  const year = context.studyYear ?? null
  const passed = new Set(context.passedCourseCodes ?? [])

  return lectures.filter((lecture) => {
    // Passed courses are a mode switch, applied before the other dimensions:
    // off (default) hides them from the catalogue, on shows only them.
    const isPassed = passed.has(lecture.course_code)
    if (filters.passedOnly ? !isPassed : isPassed) return false

    if (!matchesSearch(lecture, filters.search ?? '')) return false
    if (!allows(filters.departments, lecture.department)) return false
    if (!allows(filters.days, lecture.day_of_week)) return false
    if (!allows(filters.subjects, lecture.subject)) return false
    if (!allows(filters.professors, lecture.professor)) return false
    if (!allows(filters.bands, bandOf(lecture))) return false
    if (filters.semester && lecture.semester !== filters.semester) return false
    if (filters.selectedOnly && !selected.has(lecture.id)) return false

    if (filters.mandatoryOnly) {
      if (!lecture.is_mandatory) return false
      // Narrow to the student's own year only once they have told us what it
      // is. Before that, "mandatory" on its own is still a useful cut, and
      // silently returning nothing would look like a bug.
      if (year !== null && lecture.study_year !== year) return false
    }

    return true
  })
}

/**
 * How many dimensions are currently constraining the list. Drives whether the
 * "Clear all" control appears — not a count of individual values, because a
 * student thinks of "Day" as one filter regardless of how many days are ticked.
 */
export function activeFilterCount(filters: LectureFilters): number {
  let n = 0
  if (filters.search?.trim()) n++
  if (filters.departments?.length) n++
  if (filters.days?.length) n++
  if (filters.subjects?.length) n++
  if (filters.professors?.length) n++
  if (filters.bands?.length) n++
  if (filters.mandatoryOnly) n++
  if (filters.selectedOnly) n++
  if (filters.passedOnly) n++
  return n
}
