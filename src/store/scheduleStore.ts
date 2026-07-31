import { create } from 'zustand'
import { getProvider } from '../lib/data/provider'
import type { ScheduleEntry, SyncDiff, SyncResult } from '../lib/data/types'

interface ScheduleState {
  entries: ScheduleEntry[]
  loading: boolean
  loaded: boolean
  syncing: boolean
  error: string | null
  load: (force?: boolean) => Promise<void>
  sync: (diff: SyncDiff) => Promise<SyncResult>
  reset: () => void
}

/**
 * Owns the user's enrolled lectures. Shared by the dashboard, the sidebar, and
 * the course selection screen so that a sync updates all three at once without
 * a refetch storm.
 */
export const useScheduleStore = create<ScheduleState>((set, get) => ({
  entries: [],
  loading: false,
  loaded: false,
  syncing: false,
  error: null,

  load: async (force = false) => {
    if (get().loading) return
    if (get().loaded && !force) return

    set({ loading: true, error: null })
    try {
      const entries = await getProvider().getMySchedule()
      set({ entries, loading: false, loaded: true })
    } catch (e) {
      set({
        loading: false,
        loaded: true,
        error: e instanceof Error ? e.message : 'Failed to load schedule',
      })
    }
  },

  sync: async (diff) => {
    set({ syncing: true, error: null })
    try {
      const result = await getProvider().syncSchedule(diff)
      // Re-read rather than patching locally: the server is the source of truth
      // for google_event_id, and a partial failure must be reflected honestly.
      const entries = await getProvider().getMySchedule()
      set({ entries, syncing: false, loaded: true })
      return result
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sync failed'
      set({ syncing: false, error: message })
      return { success: false, errors: [{ lecture_id: '', message }] }
    }
  },

  reset: () => set({ entries: [], loading: false, loaded: false, error: null }),
}))
