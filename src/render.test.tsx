// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { resetMockCatalogue, resetMockState } from './lib/data/mockProvider'
import { useAuthStore } from './store/authStore'
import { useScheduleStore } from './store/scheduleStore'

/**
 * Smoke tests: do the real screens mount and render their content without
 * throwing? These catch the class of bug that a logic test cannot — a bad hook
 * order, a missing provider, an undefined read during first paint.
 *
 * They run against the mock data provider, which is the default.
 */

// Catalogue rows the assertions below hang off. Both run Monday 12:00–15:00 in
// the department's published timetable, which is the clash these tests use.
const SYSPROG = 'TPT6-PROGRAMMATISMOS-SYSTIMATON'
const SYSPROG_NAME = 'Προγραμματισμός Συστημάτων'
const TELEMATICS = 'TPT6-EFARMOGES-TILEMATIKIS'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  // Without this React does not flush act() updates into the DOM.
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true

  // jsdom implements neither of these, and both are used during first render.
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  )
  window.scrollTo = () => {}

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  // The mock provider's state and the two stores are module singletons, so
  // without this the file's tests only pass in the order they happen to be
  // written — one that syncs a course leaves it enrolled for the next.
  resetMockCatalogue()
  resetMockState()
  useAuthStore.setState({ session: null, loading: true, signingIn: false })
  useScheduleStore.getState().reset()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  vi.unstubAllGlobals()
})

/** Mounts the app at a route. */
async function mountAt(path: string) {
  window.history.pushState({}, '', path)
  await act(async () => {
    root.render(<App />)
  })
  await settle()
}

/** Advances past the mock provider's simulated latency. */
async function settle(ms = 120) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

/**
 * Polls until `predicate` holds, flushing React work between attempts. More
 * reliable than a fixed sleep: the app chains several delayed provider calls
 * (session, then schedule, then upcoming) and their total varies.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await settle(50)
  }
  throw new Error(
    `waitFor timed out after ${timeoutMs}ms. Rendered text:\n${container.textContent}`,
  )
}

describe('landing page', () => {
  it('renders the hero and the sign-in call to action', async () => {
    await mountAt('/')
    const text = container.textContent ?? ''
    expect(text).toContain('Your semester, perfectly organised.')
    expect(text).toContain('Sign in with Google')
    expect(text).toContain('No account needed')
  })

  it('renders the live schedule preview rather than a screenshot', async () => {
    await mountAt('/')
    // The preview is a real WeeklyGrid, so it carries the grid role.
    await waitFor(() => container.querySelector('[role="grid"]') !== null)
    expect(container.textContent).toContain(SYSPROG)
  })
})

describe('protected routes', () => {
  it('redirects an unauthenticated visitor away from the dashboard', async () => {
    await mountAt('/dashboard')
    expect(container.textContent).toContain('Your semester, perfectly organised.')
    expect(window.location.pathname).toBe('/')
  })
})

describe('authenticated app', () => {
  /** Signs in through the mock provider before mounting. */
  async function signIn() {
    const { getProvider } = await import('./lib/data/provider')
    await getProvider().signInWithGoogle()
  }

  it('renders the dashboard with the weekly grid and the sidebar', async () => {
    await signIn()
    await mountAt('/dashboard')
    await waitFor(() => container.querySelector('[role="grid"]') !== null)

    const text = container.textContent ?? ''
    expect(text).toContain('My Schedule')
    expect(text).toContain('Edit Schedule')
    expect(text).toContain('Today')
    // A seeded lecture made it into the grid.
    expect(text).toContain(SYSPROG_NAME)
  })

  it('renders a printable schedule alongside the screen shell', async () => {
    await signIn()
    await mountAt('/dashboard')
    // Wait for the enrolment to land, not merely for the print root to exist:
    // the tree renders empty first, so the weaker condition passed only while
    // an earlier test's entries were still in the shared store.
    await waitFor(() =>
      (container.querySelector('[data-print-root]')?.textContent ?? '').includes(SYSPROG_NAME),
    )

    const printRoot = container.querySelector('[data-print-root]')!
    const shell = container.querySelector('[data-screen-shell]')!

    // The printable tree must be a sibling of the shell, not a child — the
    // print stylesheet hides the shell wholesale, which would take a nested
    // print root down with it.
    expect(shell.contains(printRoot)).toBe(false)

    const text = printRoot.textContent ?? ''
    expect(text).toContain('My Schedule')
    expect(text).toContain('UniSchedule')
    expect(text).toContain('Course details')
    // Every weekday column is present on paper, regardless of viewport.
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      expect(text).toContain(day)
    }
    // A seeded lecture reached both the grid and the detail table.
    expect(text).toContain(SYSPROG)
    expect(text).toContain(SYSPROG_NAME)
  })

  it('exports the schedule through the browser print pipeline', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    await signIn()
    await mountAt('/dashboard')
    // Export is disabled while loading and while the schedule is empty, so wait
    // for the button to actually become usable rather than merely present.
    const exportButton = () =>
      [...container.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Export PDF'),
      )
    await waitFor(() => exportButton()?.hasAttribute('disabled') === false)

    const button = exportButton()!
    expect(button.hasAttribute('disabled')).toBe(false)

    await act(async () => button.click())
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('renders the course selection list with the sticky action bar', async () => {
    await signIn()
    await mountAt('/select-courses')
    await waitFor(() => container.querySelectorAll('[role="checkbox"]').length > 0)

    const text = container.textContent ?? ''
    expect(text).toContain('Select your courses')
    expect(text).toContain('Review & Confirm')
    expect(text).toMatch(/\d+ courses selected/)
    // Catalogue rows are checkboxes.
    expect(container.querySelectorAll('[role="checkbox"]').length).toBeGreaterThan(10)
  })

  /** Opens a filter pill by its trigger label and clicks one of its options. */
  async function pickFilter(pill: string, option: string) {
    const trigger = [...container.querySelectorAll('button')].find((b) =>
      b.getAttribute('aria-label')?.startsWith(pill),
    )
    if (!trigger) throw new Error(`no filter pill "${pill}"`)
    if (trigger.getAttribute('aria-expanded') !== 'true') {
      await act(async () => trigger.click())
    }
    const choice = [...container.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent?.trim() === option,
    )
    if (!choice) throw new Error(`no option "${option}" in ${pill}`)
    await act(async () => (choice as HTMLElement).click())
    return trigger
  }

  const rowCount = () => container.querySelectorAll('[role="checkbox"]').length

  it('narrows the catalogue by day and ORs a second day in', async () => {
    await signIn()
    await mountAt('/select-courses')
    await waitFor(() => rowCount() > 0)

    const total = rowCount()

    const trigger = await pickFilter('Day', 'Tuesday')
    await settle()
    const tuesdayOnly = rowCount()
    expect(tuesdayOnly).toBeLessThan(total)

    // The menu stays open for multi-select, so a second day is one more click.
    await pickFilter('Day', 'Thursday')
    await settle()
    expect(rowCount()).toBeGreaterThan(tuesdayOnly)
    expect(trigger.textContent).toContain('2 days')

    // The count reflects the filtered view against the full catalogue.
    expect(container.textContent).toContain(`of ${total} lectures`)

    const clear = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Clear all',
    )!
    await act(async () => clear.click())
    await settle()
    expect(rowCount()).toBe(total)
  })

  it('filters down to the current selection', async () => {
    await signIn()
    await mountAt('/select-courses')
    await waitFor(() => rowCount() > 0)

    const total = rowCount()
    const ticked = [...container.querySelectorAll('[role="checkbox"]')].filter(
      (el) => el.getAttribute('aria-checked') === 'true',
    ).length
    expect(ticked).toBeGreaterThan(0)

    const toggle = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.includes('Selected only'),
    )!
    await act(async () => toggle.click())
    await settle()

    expect(rowCount()).toBe(ticked)
    expect(rowCount()).toBeLessThan(total)
  })

  it('keeps warning about a clash even when one lecture is filtered out of view', async () => {
    await signIn()
    await mountAt('/select-courses')
    await waitFor(() => rowCount() > 0)

    const rowFor = (code: string, slot: string) => {
      const row = [...container.querySelectorAll('[role="checkbox"]')].find(
        (el) =>
          el.getAttribute('aria-label')?.includes(code) &&
          el.getAttribute('aria-label')?.includes(slot),
      )
      if (!row) throw new Error(`no row for ${code} ${slot}`)
      return row as HTMLElement
    }

    // Build the clash: the enrolment already holds Εφαρμογές Τηλεματικής on
    // Monday 12:00, so ticking the Προγραμματισμός Συστημάτων lab in the same
    // slot is enough. Both really do clash in the published timetable.
    await act(async () => rowFor(SYSPROG, 'Monday, 12:00–15:00').click())
    await settle()

    // Which code is named first follows selection order, so match either way.
    const clash = new RegExp(
      `(${SYSPROG} overlaps with ${TELEMATICS}|${TELEMATICS} overlaps with ${SYSPROG}) on Monday 12:00–15:00`,
    )
    expect(container.textContent).toMatch(clash)

    // Now hide the lab entirely by filtering to the other course's subject.
    await pickFilter('Subject', 'Δίκτυα και τηλεπικοινωνίες')
    await settle()
    expect(container.textContent).not.toContain(SYSPROG_NAME)

    // The warning is about the selection, not the visible rows — it must stay.
    expect(container.textContent).toMatch(clash)
  })

  it('warns about a clash as soon as both courses are ticked, before confirming', async () => {
    await signIn()
    await mountAt('/select-courses')
    await waitFor(() => container.querySelectorAll('[role="checkbox"]').length > 0)

    /** Finds a catalogue row by its accessible label. */
    const rowFor = (code: string, slot: string) => {
      const row = [...container.querySelectorAll('[role="checkbox"]')].find(
        (el) =>
          el.getAttribute('aria-label')?.includes(code) &&
          el.getAttribute('aria-label')?.includes(slot),
      )
      if (!row) throw new Error(`no row for ${code} ${slot}`)
      return row as HTMLElement
    }

    // Προγραμματισμός Συστημάτων runs two Monday sections; only the afternoon
    // one clashes with Εφαρμογές Τηλεματικής.
    const sysprogPm = rowFor(SYSPROG, 'Monday, 12:00–15:00')
    const telematics = rowFor(TELEMATICS, 'Monday, 12:00–15:00')

    // Start from a clean slate for both rows, so each tick below is an
    // unambiguous add, then tick both halves of the clash.
    for (const row of [sysprogPm, telematics]) {
      if (row.getAttribute('aria-checked') === 'true') {
        await act(async () => row.click())
      }
    }
    for (const row of [sysprogPm, telematics]) {
      await act(async () => row.click())
    }
    await settle()

    // The warning is on the page itself — no modal required.
    expect(container.textContent).toContain(
      `${SYSPROG} overlaps with ${TELEMATICS} on Monday 12:00–15:00`,
    )
    // Both offending rows are flagged.
    expect(sysprogPm.getAttribute('aria-label')).toContain('conflicts with')
    expect(telematics.getAttribute('aria-label')).toContain('conflicts with')
  })

  it('marks a course code that has more than one section', async () => {
    await signIn()
    await mountAt('/select-courses')
    await waitFor(() => container.querySelectorAll('[role="checkbox"]').length > 0)

    const labelled = (slot: string) =>
      [...container.querySelectorAll('[role="checkbox"]')].find((el) =>
        el.getAttribute('aria-label')?.includes(`${SYSPROG} — ${SYSPROG_NAME}, ${slot}`),
      )

    // Two sections, so each row carries its slot next to the pill.
    expect(labelled('Monday, 09:00–12:00')?.textContent).toContain('Mon 09:00')
    expect(labelled('Monday, 12:00–15:00')?.textContent).toContain('Mon 12:00')
  })

  it('syncs an added course end to end and lands back on the dashboard', async () => {
    await signIn()
    await mountAt('/select-courses')
    await waitFor(() => container.querySelectorAll('[role="checkbox"]').length > 0)

    const rows = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"]'))
    const before = rows().filter((r) => r.getAttribute('aria-checked') === 'true').length

    // Tick the first unchecked course.
    const target = rows().find((r) => r.getAttribute('aria-checked') === 'false')!
    await act(async () => target.click())
    expect(container.textContent).toContain(`${before + 1} courses selected`)

    // Open the review modal.
    const review = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Review & Confirm'),
    )!
    await act(async () => review.click())
    await waitFor(() => container.querySelector('[role="dialog"]') !== null)
    expect(container.textContent).toContain('Review your schedule')

    // Confirm and sync.
    const confirm = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirm & Sync to Google Calendar'),
    )!
    await act(async () => confirm.click())

    await waitFor(() => container.textContent!.includes('Schedule synced'))
    await waitFor(() => container.textContent!.includes('My Schedule'))
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('pre-checks the current enrolment in edit mode', async () => {
    await signIn()

    // Read the expected count from the provider rather than hardcoding it: an
    // earlier test in this file may legitimately have changed the enrolment.
    const { getProvider } = await import('./lib/data/provider')
    const enrolled = (await getProvider().getMySchedule()).length
    expect(enrolled).toBeGreaterThan(0)

    await mountAt('/edit-schedule')
    await waitFor(
      () =>
        container.querySelectorAll('[role="checkbox"][aria-checked="true"]').length > 0,
    )

    const checked = container.querySelectorAll('[role="checkbox"][aria-checked="true"]')
    expect(checked.length).toBe(enrolled)
    expect(container.textContent).toContain(`${enrolled} courses selected`)
  })
})
