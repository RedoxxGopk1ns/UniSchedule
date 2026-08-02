// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { resetMockCatalogue, setMockAdmin } from './lib/data/mockProvider'
import { useAuthStore } from './store/authStore'
import { useScheduleStore } from './store/scheduleStore'
import type { ParsedLecture, ParsedSheet } from './lib/import/timetableParser'

/**
 * A parsed timetable row matching the seeded 'TPT6-PROGRAMMATISMOS-SYSTIMATON'
 * lecture (name + day + start time), and one that matches nothing. room/
 * professor/end_time deliberately differ from the real seeded values, so the
 * "does not overwrite the schedule" assertion below actually exercises
 * something — if the import ever started writing those fields back, this
 * would catch it.
 */
const { fakeSheets, fakeLectures } = vi.hoisted(() => {
  const matched: ParsedLecture = {
    key: 'k1',
    course_code: '',
    course_name: 'Προγραμματισμός Συστημάτων',
    professor: 'Διαφορετικός Καθηγητής',
    room: 'Διαφορετική Αίθουσα',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '11:00',
    semester: 'Spring 2026',
    department: 'Πληροφορικής και Τηλεματικής',
    color_tag: null,
    subject: null,
    is_mandatory: false,
    study_year: null,
    warnings: [],
    source: { page: 1, semesterNumber: 6 },
  }
  const unmatched: ParsedLecture = {
    key: 'k2',
    course_code: '',
    course_name: 'Ένα Μάθημα Που Δεν Υπάρχει',
    professor: 'Άγνωστος',
    room: null,
    day_of_week: 'Friday',
    start_time: '18:00',
    end_time: '19:00',
    semester: 'Spring 2026',
    department: 'Πληροφορικής και Τηλεματικής',
    color_tag: null,
    subject: null,
    is_mandatory: false,
    study_year: null,
    warnings: [],
    source: { page: 1, semesterNumber: null },
  }
  const fakeLectures: ParsedLecture[] = [matched, unmatched]
  const fakeSheets: ParsedSheet[] = [
    { page: 1, semesterNumber: 6, studyYear: 3, lectures: fakeLectures, warnings: [] },
  ]
  return { fakeSheets, fakeLectures }
})

// The real PDF pipeline (pdfjs, worker) has no place in jsdom; the timetable
// review only needs a parsed result, so both are stubbed. sniff() only reads
// pageText's output, so its content just needs to say "this is a timetable".
vi.mock('./lib/import/pdfText', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/import/pdfText')>()),
  extractPages: vi.fn(async () => [{ width: 1, height: 1, items: [] }]),
  pageText: vi.fn(() => 'ΠΡΟΓΡΑΜΜΑ ΜΑΘΗΜΑΤΩΝ'),
}))
// Spread the real module rather than replacing it: a bare object would be an
// unguarded whitelist, so the day anything in App's import graph reaches for
// another export (DEPARTMENT, guessSubject) every test in this file would fail
// at import time with an unrelated-looking error.
vi.mock('./lib/import/timetableParser', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/import/timetableParser')>()),
  parseTimetable: vi.fn(() => ({ sheets: fakeSheets, lectures: fakeLectures })),
}))

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

  /**
   * The edit form round-trip. This is the shape of test that was missing when
   * Room became a dropdown whose options matched none of the catalogue's real
   * values: React silently selects the first option when `value` matches none,
   * emitting no warning, so the form showed '—' for 40 of 42 lectures while the
   * table behind it showed the true room. Asserting on rendered <select> values
   * — not just that the modal opened — is what catches that class of bug.
   */
  it('shows a lecture’s real values when editing, and saving untouched changes nothing', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Lectures')
    await waitFor(() =>
      (container.textContent ?? '').includes('TPT6-PROGRAMMATISMOS-SYSTIMATON'),
    )

    const { getProvider } = await import('./lib/data/provider')
    const before = await getProvider().admin.listLectures()
    // A lecture with a room that is *not* one of the canonical names — the
    // exact case the dropdown used to misrepresent.
    const target = before.find((l) => l.room === 'Αίθουσα 2.3')!
    expect(target).toBeDefined()

    const rows = [...container.querySelectorAll('tr')]
    const row = rows.find((r) => r.textContent?.includes(target.course_code))!
    const edit = [...row.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Edit',
    )!
    await act(async () => edit.click())
    await waitFor(() => container.querySelector('[role="dialog"]') !== null)

    const dialog = container.querySelector('[role="dialog"]')!
    const field = (label: string) =>
      [...dialog.querySelectorAll('label')].find((l) => l.textContent?.includes(label))!

    // The room the lecture actually has is the one selected, not a blank.
    const roomSelect = field('Room').querySelector('select')!
    expect(roomSelect.value).toBe(target.room)
    // Department must be selectable too, not a dead single-option control.
    const deptSelect = field('Department').querySelector('select')!
    expect(deptSelect.value).toBe(target.department)
    expect(deptSelect.options.length).toBeGreaterThan(1)

    const save = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Save',
    )!
    await act(async () => save.click())
    await waitFor(() => (container.textContent ?? '').includes('Lecture saved'))

    const after = await getProvider().admin.listLectures()
    // Saving without touching anything must be a no-op on every field.
    expect(after.find((l) => l.id === target.id)).toEqual(target)
    expect(after).toHaveLength(before.length)
  })

  it('lets a new lecture be given a department', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Lectures')
    await waitFor(() =>
      (container.textContent ?? '').includes('TPT6-PROGRAMMATISMOS-SYSTIMATON'),
    )

    const add = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Add lecture',
    )!
    await act(async () => add.click())
    await waitFor(() => container.querySelector('[role="dialog"]') !== null)

    const dialog = container.querySelector('[role="dialog"]')!
    const deptSelect = [...dialog.querySelectorAll('label')]
      .find((l) => l.textContent?.includes('Department'))!
      .querySelector('select')!
    // Previously this collapsed to a lone blank option, so a department could
    // never be set on a new lecture — and a null one vanishes from the filter.
    const selectable = [...deptSelect.options].filter((o) => o.value !== '')
    expect(selectable.length).toBeGreaterThan(0)
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

  it('matches a timetable import against the catalogue instead of creating rows', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Import')
    await waitFor(() => (container.textContent ?? '').includes('Import from PDF'))

    const before = await (await import('./lib/data/provider')).getProvider().admin.listLectures()
    const original = before.find((l) => l.course_code === 'TPT6-PROGRAMMATISMOS-SYSTIMATON')!

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['dummy'], 'timetable.pdf', { type: 'application/pdf' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await waitFor(() => (container.textContent ?? '').includes('Review lectures'))

    // The matched row shows what it resolved to and is included by default.
    await waitFor(() =>
      (container.textContent ?? '').includes('Matches TPT6-PROGRAMMATISMOS-SYSTIMATON'),
    )
    const matchedCheckbox = container.querySelector(
      'input[type="checkbox"][aria-label="Include Προγραμματισμός Συστημάτων"]',
    ) as HTMLInputElement
    expect(matchedCheckbox.checked).toBe(true)
    expect(matchedCheckbox.disabled).toBe(false)

    // The unmatched row is flagged, unchecked and cannot be included.
    expect(container.textContent).toContain(
      'No existing lecture matches this name, day and time',
    )
    const unmatchedCheckbox = container.querySelector(
      'input[type="checkbox"][aria-label="Include Ένα Μάθημα Που Δεν Υπάρχει"]',
    ) as HTMLInputElement
    expect(unmatchedCheckbox.checked).toBe(false)
    expect(unmatchedCheckbox.disabled).toBe(true)

    const commit = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Add to semester',
    )!
    await act(async () => commit.click())
    await waitFor(() => (container.textContent ?? '').includes('Added to semester: 1'))

    const after = await (await import('./lib/data/provider')).getProvider().admin.listLectures()
    // No new lecture was created, matched or not.
    expect(after.length).toBe(before.length)
    const updated = after.find((l) => l.course_code === 'TPT6-PROGRAMMATISMOS-SYSTIMATON')!
    expect(updated.semester).toBe('Spring 2026')
    // The import never overwrites day/time/room/professor — only `semester`.
    expect(updated.room).toBe(original.room)
    expect(updated.professor).toBe(original.professor)
    expect(updated.end_time).toBe(original.end_time)
  })

  /**
   * `lectures.semester` is a foreign key, so a typed term that does not exist
   * fails every row at commit time — and because each row fails identically,
   * the admin would see only "0 updated, N failed". Offering a picker over the
   * terms that exist makes the bad state unrepresentable rather than merely
   * reported.
   */
  it('offers only existing semesters to import into', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Import')
    await waitFor(() => (container.textContent ?? '').includes('Import from PDF'))

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['dummy'], 'timetable.pdf', { type: 'application/pdf' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await waitFor(() => (container.textContent ?? '').includes('Review lectures'))

    const semesterField = [...container.querySelectorAll('label')].find((l) =>
      l.textContent?.includes('Semesters'),
    )!
    // A <select>, not a free-text input: a typo must not be expressible.
    const select = semesterField.querySelector('select')
    expect(select).not.toBeNull()
    expect(semesterField.querySelector('input[type="text"]')).toBeNull()

    const { getProvider } = await import('./lib/data/provider')
    const terms = await getProvider().admin.listSemesters()
    const offered = [...select!.options].map((o) => o.value).filter((v) => v !== '')
    expect(offered).toEqual(terms.map((t) => t.name))
    expect(select!.value).toBe('Spring 2026')
  })
})
