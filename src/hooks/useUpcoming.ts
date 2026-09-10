import { useCallback, useEffect, useMemo, useState } from 'react'
import { getProvider } from '../lib/data/provider'
import type { ScheduleEntry, Upcoming } from '../lib/data/types'
import type { ResolvedOccurrence } from '../lib/occurrences'
import { useScheduleStore } from '../store/scheduleStore'

/** §18 get-upcoming is polled every five minutes. */
const REFRESH_MS = 5 * 60 * 1000

/**
 * Today's remaining lectures for the sidebar. Refetches on an interval and
 * whenever the schedule itself changes, so a sync is reflected immediately
 * rather than up to five minutes later.
 *
 * `occurrences` is this week resolved against the academic calendar (see
 * useWeek). Sessions that are not happening — a public holiday, a cancellation,
 * a class moved to another day, or a week outside the lecture's own semester —
 * are dropped from the result: telling a student their next lecture is one that
 * was cancelled is worse than telling them nothing.
 *
 * The provider's own `getUpcoming` knows none of this; it reads the weekly
 * pattern straight from the enrolments, which is why the filtering happens here
 * rather than there.
 *
 * Sessions moved *into* this week are not added here. The provider computes
 * `Upcoming` from the weekly pattern and does not know about them; they show up
 * on the grid and in the changes banner instead.
 */
export function useUpcoming(occurrences: ResolvedOccurrence[] = []) {
  const [data, setData] = useState<Upcoming | null>(null)
  const [loading, setLoading] = useState(true)
  const entries = useScheduleStore((s) => s.entries)

  const refresh = useCallback(async () => {
    try {
      setData(await getProvider().getUpcoming())
    } catch {
      setData({ next: null, laterToday: [], nextOtherDay: null })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, entries])

  useEffect(() => {
    const id = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Keyed by lecture and weekday: the same course can run twice a week, and
  // only one of those sessions may be off.
  const suppressed = useMemo(() => {
    const off = new Set<string>()
    for (const o of occurrences) {
      if (
        o.status === 'cancelled' ||
        o.status === 'moved-out' ||
        o.status === 'out-of-term'
      ) {
        off.add(`${o.entry.lecture_id}|${o.day_of_week}`)
      }
    }
    return off
  }, [occurrences])

  const upcoming = useMemo(() => {
    if (!data) return null
    if (suppressed.size === 0) return data
    const running = (e: ScheduleEntry | null): e is ScheduleEntry =>
      e !== null && !suppressed.has(`${e.lecture_id}|${e.lecture.day_of_week}`)

    const laterToday = data.laterToday.filter(running)
    // When the next lecture is off, the one after it becomes the next one —
    // otherwise the sidebar would claim the day is over while a class remains.
    const [promoted, ...rest] = laterToday
    const next = running(data.next) ? data.next : (promoted ?? null)

    return {
      next,
      laterToday: running(data.next) ? laterToday : rest,
      nextOtherDay: running(data.nextOtherDay) ? data.nextOtherDay : null,
    }
  }, [data, suppressed])

  return { upcoming, loading }
}

/**
 * Ticks once a minute so the countdown pill stays truthful without re-rendering
 * the whole sidebar every second.
 */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
