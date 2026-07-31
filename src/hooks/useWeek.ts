import { useEffect, useMemo, useState } from 'react'
import { getProvider } from '../lib/data/provider'
import type { AcademicEvent, LectureOverride } from '../lib/data/types'
import { resolveWeek, weekChanges, type ResolvedOccurrence } from '../lib/occurrences'
import { useScheduleStore } from '../store/scheduleStore'

/**
 * This week's schedule, with the academic calendar and any per-occurrence
 * changes applied (§22).
 *
 * The calendar and the override list are small, rarely change, and are needed
 * by both the grid and the sidebar, so they are fetched once here rather than
 * per component. Resolution itself is pure — see src/lib/occurrences.ts.
 *
 * Only the current week is resolved. Week navigation is a separate feature;
 * what the dashboard needs is to stop telling a student they have a lecture on
 * a public holiday.
 */
export function useWeek(reference: Date = new Date()) {
  const entries = useScheduleStore((s) => s.entries)
  const [events, setEvents] = useState<AcademicEvent[]>([])
  const [overrides, setOverrides] = useState<LectureOverride[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      const provider = getProvider()
      try {
        const [e, o] = await Promise.all([
          provider.listAcademicEvents(),
          provider.getMyOverrides(),
        ])
        if (!alive) return
        setEvents(e)
        setOverrides(o)
      } catch {
        // A calendar that will not load must not blank the timetable: fall
        // back to the plain weekly pattern, which is what the app showed
        // before any of this existed.
        if (alive) {
          setEvents([])
          setOverrides([])
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
    () => resolveWeek(entries, overrides, events, new Date(day)),
    [entries, overrides, events, day],
  )

  return {
    occurrences,
    changes: useMemo(() => weekChanges(occurrences), [occurrences]),
    events,
    overrides,
    loading,
  }
}

export type { ResolvedOccurrence }
