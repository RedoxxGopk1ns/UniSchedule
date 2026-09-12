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
 * A parsed timetable row whose title matches the seeded 'Προγραμματισμός
 * Συστημάτων' course, and one whose title matches nothing.
 *
 * The matched row's day, time, room and professor deliberately differ from the
 * seeded lecture's. That is the point: matching is on title alone, so a course
 * whose slot has moved must still resolve — and the new slot is what gets
 * written. A matcher that consulted day or time would fail to find this row.
 */
const { fakeSheets, fakeLectures } = vi.hoisted(() => {
  const matched: ParsedLecture = {
    key: 'k1',
    course_code: '',
    course_name: 'Προγραμματισμός Συστημάτων',
    professor: 'Διαφορετικός Καθηγητής',
    room: 'Διαφορετική Αίθουσα',
    // The seeded lecture is Monday 09:00-12:00; this has moved to Thursday.
    day_of_week: 'Thursday',
    start_time: '16:00',
    end_time: '18:00',
    semester: 'Spring 2026',
    department: 'Πληροφορικής και Τηλεματικής',
    color_tag: null,
    subject: null,
    is_mandatory: false,
    study_year: null,
    semester_number: null,
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
    semester_number: null,
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

/**
 * Types into a controlled React input.
 *
 * React installs its own value setter on the DOM node and remembers the last
 * value it wrote, so a plain `el.value = x` is seen as no change and onChange
 * never fires. Going through the prototype's setter is what makes the event
 * look like a real keystroke.
 */
function setNativeValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  // The descriptor is taken from the element's own prototype rather than the
  // global HTMLInputElement: jsdom's generated setters reject a wrapper from a
  // different realm, and the test globals are not always the document's.
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(el),
    'value',
  )!.set!
  setter.call(el, value)
}

function setInputValue(el: HTMLInputElement, value: string) {
  setNativeValue(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Same, for a <select>. */
function setSelectValue(el: HTMLSelectElement, value: string) {
  setNativeValue(el, value)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Feeds the (stubbed) PDF parser a file, as the FileDrop would. */
async function dropPdf() {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['dummy'], 'timetable.pdf', { type: 'application/pdf' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
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
      (container.textContent ?? '').includes('Προγραμματισμός Συστημάτων'),
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
      (container.textContent ?? '').includes('Προγραμματισμός Συστημάτων'),
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
    // The course is picked, never typed, and the one it already has is
    // selected — the same class of bug as the room, on the field that now
    // carries the lecture's whole identity.
    const courseSelect = field('Course').querySelector('select')!
    expect(courseSelect.value).toBe(target.course_id)
    expect(courseSelect.options.length).toBeGreaterThan(1)

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

  /**
   * A new lecture must be able to name a course, and only an existing one. The
   * course fields themselves are gone from this form entirely — they belong to
   * the course, and are edited in the Courses tab.
   */
  it('offers only existing courses when adding a lecture', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Lectures')
    await waitFor(() =>
      (container.textContent ?? '').includes('Προγραμματισμός Συστημάτων'),
    )

    const add = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Add lecture',
    )!
    await act(async () => add.click())
    await waitFor(() => container.querySelector('[role="dialog"]') !== null)

    const dialog = container.querySelector('[role="dialog"]')!
    const label = (text: string) =>
      [...dialog.querySelectorAll('label')].find((l) => l.textContent?.includes(text))

    const courseSelect = label('Course')!.querySelector('select')!
    const selectable = [...courseSelect.options].filter((o) => o.value !== '')
    expect(selectable.length).toBeGreaterThan(0)

    // Nothing about the course is editable from here — a lecture write that
    // could touch these is exactly what the 0006 split removes.
    expect(label('Professor')).toBeUndefined()
    expect(label('Course code')).toBeUndefined()
    expect(label('Subject')).toBeUndefined()
  })

  /**
   * The inheritance the split exists for, end to end through the UI: rename a
   * course once and every lecture of it reads the new name.
   */
  it('propagates a course rename to the lectures table', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Courses')
    await waitFor(() => (container.textContent ?? '').includes('Προγραμματισμός Συστημάτων'))

    const rows = [...container.querySelectorAll('tr')]
    const row = rows.find((r) => r.textContent?.includes('Προγραμματισμός Συστημάτων'))!
    const edit = [...row.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Edit',
    )!
    await act(async () => edit.click())
    await waitFor(() => container.querySelector('[role="dialog"]') !== null)

    const dialog = container.querySelector('[role="dialog"]')!
    const nameInput = [...dialog.querySelectorAll('label')]
      .find((l) => l.textContent?.includes('Course name'))!
      .querySelector('input')!
    await act(async () => {
      setInputValue(nameInput, 'Μετονομασμένο Μάθημα')
    })

    const save = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Save',
    )!
    await act(async () => save.click())
    await waitFor(() => (container.textContent ?? '').includes('Course saved'))

    await openTab('Lectures')
    await waitFor(() => (container.textContent ?? '').includes('Μετονομασμένο Μάθημα'))
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
      (container.textContent ?? '').includes('Προγραμματισμός Συστημάτων'),
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

  /**
   * The whole timetable flow: parse, match by title, approve, replace.
   *
   * The fixture's matched row has moved to Thursday 16:00 and carries a
   * different room and lecturer from the seeded Monday lecture. That is what
   * makes this worth asserting — the row must still resolve to the same
   * course (title-only matching), the new slot must be written, and the
   * lecturer must *not* be, because it belongs to the course.
   */
  it('matches a timetable import to courses by title and replaces the term', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Import')
    await waitFor(() => (container.textContent ?? '').includes('Import from PDF'))

    const { getProvider } = await import('./lib/data/provider')
    const before = await getProvider().admin.listLectures()
    const courses = await getProvider().admin.listCourses()
    const target = courses.find(
      (c) => c.course_name === 'Προγραμματισμός Συστημάτων',
    )!
    const springBefore = before.filter((l) => l.semester === 'Spring 2026')
    expect(springBefore.length).toBeGreaterThan(1)

    await dropPdf()
    // The courses are fetched after the parse, so the review renders before
    // anything is matched; the count is what says matching has happened.
    await waitFor(() => (container.textContent ?? '').includes('1 of 2 approved'))

    // The matched row resolved to the right course and is approved by default.
    const rowFor = (name: string) =>
      [...container.querySelectorAll('input[type="checkbox"]')].find(
        (c) => c.getAttribute('aria-label') === `Approve ${name}`,
      ) as HTMLInputElement
    const matched = rowFor('Προγραμματισμός Συστημάτων')
    expect(matched.checked).toBe(true)

    const courseSelects = [...container.querySelectorAll('select')].filter((el) =>
      [...el.options].some((o) => o.value === target.id),
    )
    expect(courseSelects[0]!.value).toBe(target.id)

    // The unmatched row is flagged and left out — nothing was invented for it.
    expect(container.textContent).toContain('No course has this name')
    const unmatched = rowFor('Ένα Μάθημα Που Δεν Υπάρχει')
    expect(unmatched.checked).toBe(false)
    expect(unmatched.disabled).toBe(true)
    expect(container.textContent).toContain('1 of 2 approved')

    // Committing replaces the term, behind an explicit confirmation.
    const commit = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Save to catalogue',
    )!
    await act(async () => commit.click())
    await waitFor(() => (container.textContent ?? '').includes('Replace the timetable?'))
    const confirm = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Replace timetable',
    )!
    await act(async () => confirm.click())
    await waitFor(() => (container.textContent ?? '').includes('Replaced'))

    const after = await getProvider().admin.listLectures()
    const spring = after.filter((l) => l.semester === 'Spring 2026')
    // The term is exactly what was approved — the rest of it was replaced.
    expect(spring).toHaveLength(1)

    const written = spring[0]!
    expect(written.course_id).toBe(target.id)
    // The PDF's slot and room won.
    expect(written.day_of_week).toBe('Thursday')
    expect(written.start_time).toBe('16:00')
    expect(written.end_time).toBe('18:00')
    expect(written.room).toBe('Διαφορετική Αίθουσα')
    // The course's own fields did not: they are inherited, and the PDF's
    // 'Διαφορετικός Καθηγητής' never reached the database.
    expect(written.professor).toBe(target.professor)
    expect(written.course_code).toBe(target.course_code)

    // Other terms are untouched.
    expect(after.filter((l) => l.semester !== 'Spring 2026')).toHaveLength(
      before.filter((l) => l.semester !== 'Spring 2026').length,
    )
  })

  /**
   * The admin's override: the matcher proposed nothing for this row, so the
   * only way it can be imported is by choosing a course by hand — and doing so
   * is itself the approval.
   */
  it('lets the admin point an unmatched row at a course by hand', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Import')
    await waitFor(() => (container.textContent ?? '').includes('Import from PDF'))

    const { getProvider } = await import('./lib/data/provider')
    const courses = await getProvider().admin.listCourses()
    const chosen = courses.find((c) => c.course_name === 'Πιθανότητες')!

    await dropPdf()
    await waitFor(() => (container.textContent ?? '').includes('1 of 2 approved'))

    const approveBox = (name: string) =>
      [...container.querySelectorAll('input[type="checkbox"]')].find(
        (c) => c.getAttribute('aria-label') === `Approve ${name}`,
      ) as HTMLInputElement
    expect(approveBox('Ένα Μάθημα Που Δεν Υπάρχει').checked).toBe(false)

    // The unmatched row's dropdown is the one still sitting on its placeholder.
    const selects = [...container.querySelectorAll('select')].filter((el) =>
      [...el.options].some((o) => o.value === chosen.id),
    )
    const empty = selects.find((el) => el.value === '')!
    await act(async () => {
      setSelectValue(empty, chosen.id)
    })

    await waitFor(() => (container.textContent ?? '').includes('2 of 2 approved'))
    expect(approveBox('Ένα Μάθημα Που Δεν Υπάρχει').checked).toBe(true)
    // Labelled as the admin's decision rather than the matcher's.
    expect(container.textContent).toContain('Changed by you')
  })

  /**
   * The guarantee the admin is being asked to trust: whatever the PDF says, an
   * import can only ever file rows against courses that already exist.
   */
  it('never creates a course from the PDF', async () => {
    await signIn(true)
    await mountAt('/admin')
    await openTab('Import')
    await waitFor(() => (container.textContent ?? '').includes('Import from PDF'))

    const { getProvider } = await import('./lib/data/provider')
    const before = await getProvider().admin.listCourses()

    await dropPdf()
    await waitFor(() => (container.textContent ?? '').includes('1 of 2 approved'))

    const commit = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Save to catalogue',
    )!
    await act(async () => commit.click())
    await waitFor(() => (container.textContent ?? '').includes('Replace the timetable?'))
    const confirm = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Replace timetable',
    )!
    await act(async () => confirm.click())
    await waitFor(() => (container.textContent ?? '').includes('Replaced'))

    const after = await getProvider().admin.listCourses()
    expect(after.map((c) => c.id).sort()).toEqual(before.map((c) => c.id).sort())
    // In particular, the row that matched nothing did not become a course.
    expect(after.some((c) => c.course_name === 'Ένα Μάθημα Που Δεν Υπάρχει')).toBe(false)
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
