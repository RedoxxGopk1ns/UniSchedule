// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { resetMockCatalogue } from './lib/data/mockProvider'
import { useScheduleStore } from './store/scheduleStore'

/**
 * Integration tests for the features added this session — quick-delete from the
 * dashboard popover, and mark-as-passed / restore on the selection screen. They
 * drive the real app against the mock provider, the same way render.test.tsx
 * does, so they exercise the actual wiring (store sync, filters, copy).
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false, // desktop layout — full weekly grid, all toggle pills visible
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }))
  window.scrollTo = () => {}
  // The schedule store is a module singleton; without this its memoised `loaded`
  // flag carries entries between tests and blocks a fresh load on the next mount.
  useScheduleStore.getState().reset()
  // Same for the mock catalogue and its overrides, which live in module-level
  // arrays rather than in localStorage.
  resetMockCatalogue()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  vi.unstubAllGlobals()
})

async function mountAt(path: string) {
  window.history.pushState({}, '', path)
  await act(async () => {
    root.render(<App />)
  })
  await settle()
}

async function settle(ms = 120) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

async function waitFor(predicate: () => boolean, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await settle(50)
  }
  throw new Error(
    `waitFor timed out after ${timeoutMs}ms. Rendered text:\n${container.textContent}`,
  )
}

async function signIn() {
  const { getProvider } = await import('./lib/data/provider')
  await getProvider().signInWithGoogle()
}

const buttonByText = (text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)

describe('privacy policy page', () => {
  it('is reachable without signing in and carries the Google disclosures', async () => {
    // No signIn() — the route must be public for Google verification.
    await mountAt('/privacy')
    const text = container.textContent ?? ''
    expect(text).toContain('Privacy policy')
    expect(text).toContain('calendar.events')
    // The verbatim Limited Use statement Google verification requires.
    expect(text).toContain('Google API Services User Data Policy')
    expect(text).toContain('Limited Use')
    // Stayed on the page rather than redirecting to sign-in.
    expect(window.location.pathname).toBe('/privacy')
  })
})

describe('quick-delete from the dashboard popover', () => {
  const gridBlocks = () =>
    [...container.querySelectorAll<HTMLButtonElement>('[role="grid"] button')].filter((b) =>
      /\d\d:\d\d/.test(b.getAttribute('aria-label') ?? ''),
    )
  const blocksForCode = (code: string) =>
    gridBlocks().filter((b) => (b.getAttribute('aria-label') ?? '').startsWith(`${code} `))

  const removeViaPopover = async (block: HTMLButtonElement) => {
    await act(async () => block.click())
    await waitFor(() => container.querySelector('[role="dialog"]') !== null)
    const remove = buttonByText('Remove from schedule')
    expect(remove).toBeTruthy()
    await act(async () => remove!.click())
    await waitFor(() => (container.textContent ?? '').includes('removed from your schedule'))
  }

  it('removes the whole course (all its sections) and confirms with a toast', async () => {
    await signIn()
    await mountAt('/dashboard')
    await waitFor(() => gridBlocks().length > 0)

    const before = gridBlocks().length
    const code = (gridBlocks()[0]!.getAttribute('aria-label') ?? '').split(' ')[0]!
    const sections = blocksForCode(code).length

    await removeViaPopover(gridBlocks()[0]!)

    // Every section of that code leaves the grid, not just the clicked block.
    await waitFor(() => gridBlocks().length === before - sections)
    expect(blocksForCode(code).length).toBe(0)
  })

  it('drops both sections of a two-section course from one block', { timeout: 20000 }, async () => {
    await signIn()
    // Enrol both Προγραμματισμός Συστημάτων sections (the lecture and its lab)
    // up front. They share a course code and both fall on Monday.
    const { getProvider } = await import('./lib/data/provider')
    const SYSPROG = 'TPT6-PROGRAMMATISMOS-SYSTIMATON'
    const SYSPROG_AM = '00000000-0000-4000-8000-000000000020'
    const SYSPROG_PM = '00000000-0000-4000-8000-000000000022'
    await getProvider().syncSchedule({ to_add: [SYSPROG_AM, SYSPROG_PM], to_remove: [] })

    await mountAt('/dashboard')
    await waitFor(() => gridBlocks().length > 0)
    await waitFor(() => blocksForCode(SYSPROG).length === 2)

    const before = gridBlocks().length
    await removeViaPopover(blocksForCode(SYSPROG)[0]!)

    await waitFor(() => blocksForCode(SYSPROG).length === 0)
    expect(gridBlocks().length).toBe(before - 2)
  })
})

describe('mark as passed and restore', () => {
  /** The trailing "Mark as passed" button that sits beside a catalogue row. */
  const markButtonFor = (code: string) => {
    const row = [...container.querySelectorAll('[role="checkbox"]')].find((r) =>
      (r.getAttribute('aria-label') ?? '').includes(code),
    )
    if (!row) return undefined
    const wrapper = row.parentElement!
    return [...wrapper.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Mark as passed',
    )
  }

  const rowExists = (code: string) =>
    [...container.querySelectorAll('[role="checkbox"]')].some((r) =>
      (r.getAttribute('aria-label') ?? '').includes(code),
    )

  it('hides a course after passing it, then brings it back on restore', { timeout: 20000 }, async () => {
    await signIn()
    await mountAt('/select-courses')
    await waitFor(() => container.querySelectorAll('[role="checkbox"]').length > 0)

    // Μηχανική Μάθηση is a single-section elective — crisp to assert on.
    const code = 'TPT6-MICHANIKI-MATHISI'
    expect(rowExists(code)).toBe(true)

    // Open the confirm dialog from the row action, then confirm inside it.
    await act(async () => markButtonFor(code)!.click())
    await waitFor(() => container.querySelector('[role="dialog"]') !== null)
    const dialog = container.querySelector('[role="dialog"]')!
    const confirm = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Mark as passed',
    )!
    await act(async () => confirm.click())

    // It leaves the catalogue (its selectable checkbox row is gone) and a toast fires.
    await waitFor(() => (container.textContent ?? '').includes('marked as passed'))
    await waitFor(() => !rowExists(code))

    // Flip the "Passed courses" toggle: the review view lists CS420 with Restore.
    // Passed rows are static review rows (no checkbox), so assert via the panel.
    await act(async () => buttonByText('Passed courses')!.click())
    await waitFor(() => buttonByText('Restore') !== undefined)
    const listPanel = container.querySelector('.rounded-panel')!
    expect(listPanel.textContent).toContain(code)

    // Restore empties the passed-only view (the empty-state copy appears, and it
    // is distinct from any toast text so it is a safe signal).
    await act(async () => buttonByText('Restore')!.click())
    await waitFor(() =>
      (container.querySelector('.rounded-panel')?.textContent ?? '').includes(
        'not marked any courses as passed',
      ),
    )
  })
})

describe('this week’s changes on the dashboard', () => {
  const gridBlocks = () =>
    [...container.querySelectorAll<HTMLButtonElement>('[role="grid"] button')].filter((b) =>
      /\d\d:\d\d/.test(b.getAttribute('aria-label') ?? ''),
    )

  it('strikes through a lecture the university has cancelled and lists it', { timeout: 20000 }, async () => {
    await signIn()

    const { getProvider } = await import('./lib/data/provider')
    const { startOfWeek } = await import('./lib/occurrences')
    const SYSPROG_AM = '00000000-0000-4000-8000-000000000020'

    // Enrol explicitly rather than relying on the seeded default: an earlier
    // test in this file may have unenrolled it, and getMyOverrides only reports
    // changes to lectures the student actually takes.
    await getProvider().syncSchedule({ to_add: [SYSPROG_AM], to_remove: [] })

    // The Monday of the week the test is running in — the dashboard resolves
    // the current week, so the change has to land inside it.
    const monday = startOfWeek(new Date()).toISOString().slice(0, 10)

    // Created through the admin surface, so the whole path is real: provider,
    // resolution in src/lib/occurrences, and the render.
    const admin = getProvider().admin
    await admin.createOverride({
      lecture_id: SYSPROG_AM,
      kind: 'cancelled',
      occurrence_date: monday,
      new_date: null,
      new_start_time: null,
      new_end_time: null,
      new_room: null,
      note: 'Ο διδάσκων απουσιάζει',
    })

    await mountAt('/dashboard')
    await waitFor(() => gridBlocks().length > 0)

    // The banner names the change…
    await waitFor(() =>
      (container.textContent ?? '').includes('One change to your schedule this week'),
    )
    expect(container.textContent).toContain('Ο διδάσκων απουσιάζει')
    expect(container.querySelector('[aria-label="Changes this week"]')).not.toBeNull()

    // …and the block itself is marked rather than removed, so a student
    // scanning Monday sees why the slot is empty.
    const block = gridBlocks().find((b) =>
      b.getAttribute('aria-label')?.includes('TPT6-PROGRAMMATISMOS-SYSTIMATON'),
    )
    expect(block?.getAttribute('aria-label')).toContain('Cancelled')
  })
})
