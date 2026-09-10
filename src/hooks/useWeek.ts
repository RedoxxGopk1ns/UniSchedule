import { useEffect, useMemo, useState } from 'react'
import { getProvider } from '../lib/data/provider'
import type { AcademicEvent, LectureOverride, Semester } from '../lib/data/types'
import {
  isOutOfTerm,
  resolveWeek,
  weekChanges,
  type ResolvedOccurrence,
} from '../lib/occurrences'
import { useScheduleStore } from '../store/scheduleStore'

/**
 * This week's schedule, with the academic calendar and any per-occurrence
 * changes applied (§22).
 *
 * The calendar, the override list and the semester windows are small, rarely
 * change, and are needed by both the grid and the sidebar, so they are fetched
 * once here rather than per component. Resolution itself is pure — see
 * src/lib/occurrences.ts.
 *
 * Only the current week is resolved. Week navigation is a separate feature;
 * what the dashboard needs is to stop telling a student they have a lecture on
 * a public holiday.
 */
export function useWeek(reference: Date = new Date()) {
  const entries = useScheduleStore((s) => s.entries)
  const [events, setEvents] = useState<AcademicEvent[]>([])
  const [overrides, setOverrides] = useState<LectureOverride[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      const provider = getProvider()
      try {
        const [e, o, s] = await Promise.all([
          provider.listAcademicEvents(),
          provider.getMyOverrides(),
          provider.listSemesters(),
        ])
        if (!alive) return
        setEvents(e)
        setOverrides(o)
        setSemesters(s)
      } catch {
        // A calendar that will not load must not blank the timetable: fall
        // back to the plain weekly pattern, which is what the app showed
        // before any of this existed. An empty semester list is the fail-open
        // case for the teaching window too — see withinTerm.
        if (alive) {
          setEvents([])
          setOverrides([])
          setSemesters([])
        }
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
    // Re-read after a sync: enrolling in a course can bring its changes along.
  }, [entries])

  // A Date is a new object on every render, so memoise on its day rather than
  // on the instance or this recomputes forever.
  const day = reference.toDateString()
  const occurrences = useMemo(
    () => resolveWeek(entries, overrides, events, new Date(day), semesters),
    [entries, overrides, events, day, semesters],
  )

  return {
    occurrences,
    changes: useMemo(() => weekChanges(occurrences), [occurrences]),
    /** The student has courses, but none of them are taught this week. */
    outOfTerm: useMemo(() => isOutOfTerm(occurrences), [occurrences]),
    events,
    overrides,
    semesters,
    loading,
  }
}

export type { ResolvedOccurrence }
