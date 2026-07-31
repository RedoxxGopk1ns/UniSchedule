import { useEffect } from 'react'
import { useScheduleStore } from '../store/scheduleStore'

/** Loads the user's schedule on mount (once) and exposes it. */
export function useSchedule() {
  const entries = useScheduleStore((s) => s.entries)
  const loading = useScheduleStore((s) => s.loading)
  const loaded = useScheduleStore((s) => s.loaded)
  const syncing = useScheduleStore((s) => s.syncing)
  const error = useScheduleStore((s) => s.error)
  const load = useScheduleStore((s) => s.load)
  const sync = useScheduleStore((s) => s.sync)

  useEffect(() => {
    void load()
  }, [load])

  return { entries, loading: loading || !loaded, syncing, error, sync, reload: load }
}
