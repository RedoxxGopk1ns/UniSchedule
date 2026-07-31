// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { resetMockCatalogue, setMockAdmin } from './lib/data/mockProvider'
import { useAuthStore } from './store/authStore'
import { useScheduleStore } from './store/scheduleStore'

/**
 * Admin route guard + dashboard, against the mock provider. Mirrors the harness
 * in render.test.tsx. The admin flag on the mock user is toggled with
 * setMockAdmin before mounting.
 */

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }))
  window.scrollTo = () => {}

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  // Clean baseline: signed out, not an admin. Reset the auth store (a shared
  // singleton) to loading:true so a route guard holds its skeleton until the
  // fresh getSession resolves, rather than acting on a prior test's session.
  const { getProvider } = await import('./lib/data/provider')
  await getProvider().signOut()
  // The mock catalogue lives in module-level arrays, so an admin test that
  // creates or deletes rows would otherwise leak into the next one.
  resetMockCatalogue()
  setMockAdmin(false)
  useAuthStore.setState({ session: null, loading: true, signingIn: false })
  useScheduleStore.getState().reset()
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

async function waitFor(predicate: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await settle(50)
  }
  throw new Error(`waitFor timed out. Rendered:\n${container.textContent}`)
}

/** Clicks one of the admin dashboard's tabs and waits for it to render. */
async function openTab(label: string) {
  await waitFor(() => (container.textContent ?? '').includes('Overview'))
  const tab = [...container.querySelectorAll('button')].find(
    (b) => b.getAttribute('role') === 'tab' && b.textContent?.trim() === label,
  )!
  await act(async () => tab.click())
  await settle()
}

async function signIn(admin: boolean) {
  const { getProvider } = await import('./lib/data/provider')
  await getProvider().signInWithGoogle()
  setMockAdmin(admin)
}

describe('admin route guard', () => {
  it('redirects a signed-in non-admin away from /admin', async () => {
    await signIn(false)
    await mountAt('/admin')
    await waitFor(() => window.location.pathname === '/dashboard')
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('redirects an unauthenticated visitor away from /admin', async () => {
    await mountAt('/admin')
    await waitFor(() => window.location.pathname === '/')
    expect(container.textContent).toContain('Your semester, perfectly organised.')
  })
})

describe('admin dashboard', () => {
  it('shows the overview to an admin', async () => {
    await signIn(true)
    await mountAt('/admin')
    await waitFor(() => (container.textContent ?? '').includes('Calendar sync adoption'))

    const text = container.textContent ?? ''
    expect(text).toContain('Overview')
    expect(text).toContain('Lectures')
    expect(text).toContain('Users')
    expect(text).toContain('Enrollments')
  })

  it('lists the catalogue on the Lectures tab', async () => {
    await signIn(true)
    await mountAt('/admin')
    await waitFor(() => (container.textContent ?? '').includes('Overview'))

    const lecturesTab = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('role') === 'tab' && b.textContent?.trim() === 'Lectures',
    )!
    await act(async () => lecturesTab.click())
    await waitFor(() =>
      (container.textContent ?? '').includes('TPT6-PROGRAMMATISMOS-SYSTIMATON'),
    )

    expect(container.textContent).toContain('Add lecture')
    // Opening the form shows the create modal.
    const add = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Add lecture',
    )!
    await act(async () => add.click())
    await waitFor(() => container.querySelector('[role="dialog"]') !== null)
    expect(container.textContent).toContain('New lecture')
  })

  it('manages the academic calendar on the Calendar tab', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Calendar')

    // Seeded straight from the university's academic calendar PDF.
    await waitFor(() => (container.textContent ?? '').includes('Αργία 25ης Μαρτίου'))
    expect(container.textContent).toContain('Διακοπές Πάσχα')
    // Entries that suppress lectures are marked as such.
    expect(container.textContent).toContain('Cancels lectures')

    const add = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Add entry',
    )!
    await act(async () => add.click())
    await waitFor(() => container.querySelector('[role="dialog"]') !== null)
    expect(container.textContent).toContain('New calendar entry')
  })

  it('records a cancellation against a single lecture', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Lectures')
    await waitFor(() =>
      (container.textContent ?? '').includes('TPT6-PROGRAMMATISMOS-SYSTIMATON'),
    )

    const changes = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Changes',
    )!
    await act(async () => changes.click())
    // The modal fetches the lecture's existing changes before it can offer to
    // add one, so wait for the button rather than for the dialog.
    await waitFor(() => (container.textContent ?? '').includes('Add change'))

    const addChange = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Add change',
    )!
    await act(async () => addChange.click())
    await settle()

    // The date list is restricted to sessions this lecture actually has, which
    // is what stops a change being pinned to a day the class does not run.
    const dateSelect = [...container.querySelectorAll('label')]
      .find((l) => l.textContent?.includes('Session date'))
      ?.querySelector('select')
    expect(dateSelect).toBeDefined()
    expect(dateSelect!.options.length).toBeGreaterThan(0)
    for (const option of dateSelect!.options) {
      // Every offered date is a Monday: this lecture runs on Mondays.
      expect(new Date(`${option.value}T00:00:00Z`).getUTCDay()).toBe(1)
    }

    const save = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Save',
    )!
    await act(async () => save.click())
    await waitFor(() => (container.textContent ?? '').includes('Change saved'))

    // It is listed, and pushing it to calendars is a separate, explicit action:
    // saving a change must not silently rewrite students' Google Calendars.
    await waitFor(() => (container.textContent ?? '').includes('Push to calendars'))
    expect(container.textContent).toContain('Cancel this session')
  })
})
