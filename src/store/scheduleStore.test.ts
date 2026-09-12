// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProvider } from '../lib/data/provider'
import { resetMockState } from '../lib/data/mockProvider'
import { useAuthStore } from './authStore'
import { useScheduleStore } from './scheduleStore'

/**
 * The stores are module singletons shared by every screen, which is what makes
 * their lifecycle worth testing on its own: a value left behind here is a value
 * the next page renders. jsdom because the mock provider persists to
 * localStorage.
 */

beforeEach(() => {
  resetMockState()
  useScheduleStore.getState().reset()
  useAuthStore.setState({ session: null, loading: true, signingIn: false })
})

describe('scheduleStore.reset', () => {
  it('clears syncing as well as the entries', () => {
    useScheduleStore.setState({
      entries: [{ id: 'x' }] as never,
      loaded: true,
      syncing: true,
      error: 'boom',
    })

    useScheduleStore.getState().reset()

    const s = useScheduleStore.getState()
    expect(s.entries).toEqual([])
    expect(s.loaded).toBe(false)
    // A reset mid-sync used to leave this true, and nothing ever set it back —
    // the Edit schedule button spins for the life of the page.
    expect(s.syncing).toBe(false)
    expect(s.error).toBeNull()
  })
})

describe('scheduleStore.load', () => {
  it('does not refetch once loaded', async () => {
    const spy = vi.spyOn(getProvider(), 'getMySchedule')
    await useScheduleStore.getState().load()
    await useScheduleStore.getState().load()
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('retries after a failed load instead of settling on the error', async () => {
    const spy = vi
      .spyOn(getProvider(), 'getMySchedule')
      .mockRejectedValueOnce(new Error('network down'))

    await useScheduleStore.getState().load()
    expect(useScheduleStore.getState().error).toBe('network down')
    // Settled, so the UI stops spinning and can show the error...
    expect(useScheduleStore.getState().loaded).toBe(true)

    // ...but not done: the next mount tries again rather than leaving the page
    // permanently empty until a refresh.
    await useScheduleStore.getState().load()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(useScheduleStore.getState().error).toBeNull()
    expect(useScheduleStore.getState().entries.length).toBeGreaterThan(0)
    spy.mockRestore()
  })
})

describe('signing out', () => {
  it('drops the schedule rather than leaving it for the next account', async () => {
    await getProvider().signInWithGoogle()
    await useScheduleStore.getState().load()
    expect(useScheduleStore.getState().entries.length).toBeGreaterThan(0)

    await useAuthStore.getState().signOut()

    // The Google redirect is a full page load, which hid this — but the store
    // outliving its owner is a property of the code, not of the OAuth flow.
    expect(useScheduleStore.getState().entries).toEqual([])
    expect(useScheduleStore.getState().loaded).toBe(false)
  })
})
