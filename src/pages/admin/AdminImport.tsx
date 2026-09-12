import { useEffect, useMemo, useState } from 'react'
import { WeeklyGrid } from '../../components/schedule/WeeklyGrid'
import { Button } from '../../components/ui/Button'
import { FileDrop } from '../../components/ui/FileDrop'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { validateAcademicEventInput } from '../../lib/adminValidation'
import { copy } from '../../lib/copy'
import { getProvider } from '../../lib/data/provider'
import {
  ACADEMIC_EVENT_KINDS,
  joinCourse,
  type AcademicEventInput,
  type AcademicEventKind,
  type AdminSemester,
  type Course,
  type DayOfWeek,
  type LectureInput,
  type ScheduleEntry,
  type SemesterInput,
} from '../../lib/data/types'
import { matchCourse, type CourseMatch } from '../../lib/import/lectureMatch'
import { parseAcademicCalendar } from '../../lib/import/calendarParser'
import { extractPages, pageText, type PdfPage } from '../../lib/import/pdfText'
import { parseTimetable, type ParsedSheet } from '../../lib/import/timetableParser'
import { foldGreek } from '../../lib/import/greek'

type Kind = 'timetable' | 'calendar'

/** Whether the admin has signed off on a row, and how it got its course. */
type RowState = 'approved' | 'skipped'

/**
 * One timetable cell as parsed. Read-only — it is what the PDF says, and
 * editing it would only hide a bad parse rather than fix it.
 */
interface ParsedRow {
  key: string
  course_name: string
  professor: string
  room: string | null
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  warnings: string[]
  page: number
}

/** What the admin changed about a row, if anything. */
interface Decision {
  course_id: string
  state: RowState
}

/** A parsed row resolved against the catalogue — what the review renders. */
interface LectureRow extends ParsedRow {
  /** The course the matcher proposed, or null when it found none. */
  matched: Course | null
  match: CourseMatch
  /** What the row will be filed under: the admin's choice, else the match. */
  course_id: string
  state: RowState
  /** True when `course_id` is the matcher's own answer, not the admin's. */
  autoMatched: boolean
}

interface EventRow extends AcademicEventInput {
  key: string
  include: boolean
  warnings: string[]
}

/**
 * Import the department's timetable and academic calendar from the PDFs the
 * university publishes.
 *
 * The PDF is parsed **in the browser** (src/lib/import), reduced to plain rows,
 * reviewed here, and only then sent through the ordinary admin actions. No
 * binary crosses the wire, there is no storage bucket, and the whole flow works
 * against the mock provider with no network at all.
 *
 * ## What a timetable import does
 *
 * It re-times courses that already exist. It never creates one — a course is
 * the stable half of the catalogue (name, code, lecturer) and is added by hand
 * in the Courses tab. So each parsed cell is matched to a course **by title
 * alone** (src/lib/import/lectureMatch.ts), and the admin either approves that
 * match or picks the right course from a dropdown of what already exists. A row
 * whose course is genuinely missing is skipped, and the fix is to add the
 * course and import again.
 *
 * Committing **replaces** the chosen semester's timetable rather than merging
 * into it: a lecture holds only where and when, both of which this PDF is the
 * authority on, so there is nothing in the old rows worth reconciling. That
 * also makes a re-import after a mid-term change a one-gesture operation
 * instead of a diff the admin has to read.
 */
export function AdminImport() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [kind, setKind] = useState<Kind | null>(null)
  const [pages, setPages] = useState<PdfPage[] | null>(null)
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  // Keyed by row key, and deliberately sparse: a row the admin has not touched
  // has no entry, so it always reflects the current matcher result.
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [courses, setCourses] = useState<Course[]>([])
  const [existingCount, setExistingCount] = useState(0)
  const [events, setEvents] = useState<EventRow[]>([])
  const [proposed, setProposed] = useState<SemesterInput | null>(null)
  const [semester, setSemester] = useState('')
  const [semesters, setSemesters] = useState<AdminSemester[]>([])
  const [confirming, setConfirming] = useState(false)

  // Every lecture needs a semester, and the timetable PDF never names one. The
  // field is a picker over the terms that exist rather than free text:
  // `lectures.semester` is a foreign key the Edge Function checks on every
  // write, so a typed name that does not exist fails every row at commit time.
  // Defaulting to the current term keeps a plain timetable import valid on
  // arrival instead of showing 43 identical "Semester is required" errors.
  useEffect(() => {
    let alive = true
    void getProvider()
      .admin.listSemesters()
      .then((terms) => {
        if (!alive) return
        setSemesters(terms)
        const current = terms.find((t) => t.is_current) ?? terms[0]
        if (current) setSemester((s) => s || current.name)
      })
      .catch(() => {
        // Leave the picker empty; the commit button stays disabled.
      })
    return () => {
      alive = false
    }
  }, [])

  // The courses to match parsed rows against — fetched whenever a timetable is
  // being reviewed, so adding a missing course and re-importing picks it up.
  useEffect(() => {
    if (kind !== 'timetable') return
    let alive = true
    void getProvider()
      .admin.listCourses()
      .then((cs) => {
        if (alive) setCourses(cs)
      })
    return () => {
      alive = false
    }
  }, [kind])

  // How many lectures the chosen term already has, so the confirmation can say
  // what the replace is about to remove.
  useEffect(() => {
    if (kind !== 'timetable' || !semester) return
    let alive = true
    void getProvider()
      .admin.listLectures()
      .then((ls) => {
        if (alive) setExistingCount(ls.filter((l) => l.semester === semester).length)
      })
    return () => {
      alive = false
    }
  }, [kind, semester, saving])

  /**
   * Which document this is, from its own wording.
   *
   * Both sides go through foldGreek: the haystack has its accents stripped, so
   * a needle written with them — 'ΑΚΑΔΗΜΑΪΚΟΣ' — would never match.
   */
  function sniff(text: string): Kind | null {
    const folded = foldGreek(text)
    const has = (needle: string) => folded.includes(foldGreek(needle))
    if (has('ΠΡΟΓΡΑΜΜΑ ΜΑΘΗΜΑΤΩΝ')) return 'timetable'
    if (has('ΑΚΑΔΗΜΑΪΚΟΣ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΣ')) return 'calendar'
    if (has('ΕΞΑΜΗΝΟ') && has('ΩΡΕΣ')) return 'timetable'
    return null
  }

  async function onFile(file: File) {
    setBusy(true)
    reset()
    try {
      const parsed = await extractPages(file)
      setPages(parsed)
      const guess = sniff(pageText(parsed))
      if (guess) run(guess, parsed)
      else setKind(null)
    } catch {
      toast(copy.adminImportFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setKind(null)
    setSheets([])
    setParsed([])
    setDecisions({})
    setEvents([])
    setProposed(null)
  }

  /** Runs a parser over already-extracted pages. */
  function run(which: Kind, source: PdfPage[]) {
    setKind(which)
    if (which === 'timetable') {
      // The semester name comes from the calendar PDF when that was imported
      // first; otherwise the admin picks it before saving.
      const name = proposed?.name ?? semester
      const result = parseTimetable(source, { semester: name })
      setSheets(result.sheets)
      setDecisions({})
      setParsed(
        result.lectures.map((l) => ({
          key: l.key,
          course_name: l.course_name,
          professor: l.professor,
          room: l.room,
          day_of_week: l.day_of_week,
          start_time: l.start_time,
          end_time: l.end_time,
          warnings: l.warnings,
          page: l.source.page,
        })),
      )
    } else {
      const result = parseAcademicCalendar(source)
      setEvents(
        result.events.map((e) => ({
          semester: e.semester,
          kind: e.kind,
          title: e.title,
          start_date: e.start_date,
          end_date: e.end_date,
          blocks_teaching: e.blocks_teaching,
          key: e.key,
          include: true,
          warnings: e.warnings,
        })),
      )
      if (result.springSemester) {
        setProposed(result.springSemester)
        setSemester(result.springSemester.name)
      }
    }
  }

  /**
   * The parsed rows resolved against the catalogue.
   *
   * Derived rather than held in state, because the two inputs arrive at
   * different times: the parse is synchronous, the courses are a fetch. Writing
   * the match back into state meant re-running whenever `courses` changed
   * identity — which happened to work, but would have silently discarded the
   * admin's decisions on any refetch.
   *
   * A confident match is approved by default, so the common case — a PDF whose
   * courses all exist — is one button press. Anything the matcher could not
   * resolve starts skipped: an unreviewed row must never save itself.
   */
  const lectures: LectureRow[] = useMemo(
    () =>
      parsed.map((row) => {
        const match = matchCourse(row, courses)
        const matched = match.status === 'matched' ? match.course : null
        const decision = decisions[row.key]
        const course_id = decision?.course_id ?? matched?.id ?? ''
        return {
          ...row,
          match,
          matched,
          course_id,
          state: decision?.state ?? (matched ? 'approved' : 'skipped'),
          // Only when the course showing is the matcher's own answer. Anything
          // else is the admin's choice — including a row the matcher could not
          // resolve at all, which is the most important case to label as such.
          autoMatched: matched !== null && course_id === matched.id,
        }
      }),
    [parsed, courses, decisions],
  )

  const setLecture = (key: string, patch: Decision) =>
    setDecisions((d) => ({ ...d, [key]: patch }))

  const setEvent = (key: string, patch: Partial<EventRow>) =>
    setEvents((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const setAll = (state: RowState) =>
    setDecisions(() =>
      Object.fromEntries(
        lectures
          // "Approve all" can only approve rows that have a course; the rest
          // still need a decision, and approving them would file them nowhere.
          .filter((r) => r.course_id !== '' || state === 'skipped')
          .map((r) => [r.key, { course_id: r.course_id, state }]),
      ),
    )

  const approved = lectures.filter((r) => r.state === 'approved' && r.course_id !== '')
  const chosenEvents = events.filter((e) => e.include)

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  /** Preview entries for the read-only grid beside the table. */
  const previewEntries: ScheduleEntry[] = approved.flatMap((r, i) => {
    const course = courseById.get(r.course_id)
    if (!course) return []
    const lecture = joinCourse(
      {
        id: `preview-${i}`,
        course_id: course.id,
        room: r.room,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        semester,
      },
      course,
    )
    return [
      {
        id: `preview-${i}`,
        lecture_id: `preview-${i}`,
        google_event_id: null,
        lecture,
      },
    ]
  })

  async function commitTimetable() {
    const admin = getProvider().admin
    setSaving(true)
    try {
      const rows: LectureInput[] = approved.map((r) => ({
        course_id: r.course_id,
        room: r.room,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        semester,
      }))
      const result = await admin.replaceSemesterSchedule(semester, rows)
      toast(
        copy.adminImportReplaceDone(result.deleted, result.created, result.errors.length),
        result.errors.length ? 'warning' : 'success',
      )
      setConfirming(false)
      reset()
      setPages(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function commitCalendar() {
    const admin = getProvider().admin
    if (chosenEvents.length === 0) {
      toast(copy.adminImportNothing, 'warning')
      return
    }
    setSaving(true)
    try {
      // The term the calendar describes has to exist before its entries can
      // reference it.
      if (proposed) await ensureSemester(proposed)
      const result = await admin.bulkImportAcademicEvents(
        chosenEvents.map(({ key: _key, include: _include, warnings: _warnings, ...row }) => row),
      )
      toast(
        copy.adminImportDone(result.created, result.errors.length),
        result.errors.length ? 'warning' : 'success',
      )
      reset()
      setPages(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setSaving(false)
    }
  }

  /** Creates the term if it is not already there; an existing one is fine. */
  async function ensureSemester(input: SemesterInput) {
    const admin = getProvider().admin
    const existing = await admin.listSemesters()
    if (existing.some((s) => s.name === input.name)) return
    await admin.createSemester(input)
  }

  return (
    <section>
      <h2 className="text-[17px] font-semibold text-ink">{copy.adminImportTitle}</h2>
      <p className="mt-1 max-w-[70ch] text-sm text-muted">{copy.adminImportIntro}</p>

      <div className="mt-5">
        <FileDrop
          accept="application/pdf,.pdf"
          label={busy ? copy.adminImportReading : copy.adminImportDrop}
          buttonLabel={copy.adminImportChoose}
          disabled={busy || saving}
          onFile={onFile}
        />
      </div>

      {pages && kind === null && !busy && (
        <div className="mt-4 rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-ink">{copy.adminImportUnknown}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => run('timetable', pages)}>
              {copy.adminImportKindTimetable}
            </Button>
            <Button variant="outline" onClick={() => run('calendar', pages)}>
              {copy.adminImportKindCalendar}
            </Button>
          </div>
        </div>
      )}

      {kind === 'timetable' && lectures.length > 0 && (
        <TimetableReview
          rows={lectures}
          courses={courses}
          sheets={sheets}
          semester={semester}
          semesters={semesters}
          approvedCount={approved.length}
          onSemester={setSemester}
          onChange={setLecture}
          onAll={setAll}
          preview={previewEntries}
          saving={saving}
          onCommit={() => setConfirming(true)}
        />
      )}

      {confirming && (
        <ReplaceConfirmModal
          semester={semester}
          existing={existingCount}
          incoming={approved.length}
          saving={saving}
          onCancel={() => setConfirming(false)}
          onConfirm={commitTimetable}
        />
      )}

      {kind === 'calendar' && events.length > 0 && (
        <CalendarReview
          rows={events}
          proposed={proposed}
          onChange={setEvent}
          saving={saving}
          onCommit={commitCalendar}
        />
      )}
    </section>
  )
}

// --- Timetable review ------------------------------------------------------

interface TimetableReviewProps {
  rows: LectureRow[]
  courses: Course[]
  sheets: ParsedSheet[]
  semester: string
  semesters: AdminSemester[]
  approvedCount: number
  onSemester: (value: string) => void
  onChange: (key: string, decision: Decision) => void
  onAll: (state: RowState) => void
  preview: ScheduleEntry[]
  saving: boolean
  onCommit: () => void
}

function TimetableReview({
  rows,
  courses,
  sheets,
  semester,
  semesters,
  approvedCount,
  onSemester,
  onChange,
  onAll,
  preview,
  saving,
  onCommit,
}: TimetableReviewProps) {
  const needsAttention = rows.filter((r) => r.course_id === '').length

  // One option list for every row's dropdown, built once. The code is shown
  // beside the name because a lecture and its lab groups read almost alike.
  const options = useMemo(
    () =>
      courses.map((c) => ({
        value: c.id,
        label: `${c.course_name} · ${c.course_code}`,
      })),
    [courses],
  )

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">
            {copy.adminImportReviewLectures}
          </h3>
          <p className="mt-1 max-w-[70ch] text-sm text-muted">
            {copy.adminImportTimetableIntro}
          </p>
          <p className="mt-1 max-w-[70ch] text-sm text-muted">
            {copy.adminImportReviewHint}
          </p>
        </div>
        <Button
          loading={saving}
          onClick={onCommit}
          disabled={approvedCount === 0 || semester === ''}
        >
          {copy.adminImportCommit}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="max-w-[320px] flex-1">
          <Select
            label={copy.adminTabSemesters}
            value={semester}
            onChange={(e) => onSemester(e.target.value)}
            placeholder={copy.adminImportPickSemester}
            options={semesters.map((s) => ({ value: s.name, label: s.name }))}
          />
        </div>
        <Button variant="outline" onClick={() => onAll('approved')}>
          {copy.adminImportApproveAll}
        </Button>
        <Button variant="outline" onClick={() => onAll('skipped')}>
          {copy.adminImportSkipAll}
        </Button>
      </div>

      <p className="mt-3 text-sm text-muted">
        {copy.adminImportCounts(approvedCount, rows.length)}
        {needsAttention > 0 && ` · ${copy.adminImportWarnings}: ${needsAttention}`}
      </p>

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          {sheets.map((sheet) => {
            const sheetRows = rows.filter((r) => r.page === sheet.page)
            if (sheetRows.length === 0) return null
            return (
              <div key={sheet.page} className="mb-6">
                <h4 className="text-[13px] font-semibold text-ink">
                  {copy.adminImportSheet(sheet.page, sheet.semesterNumber, sheet.studyYear)}
                </h4>
                {sheet.warnings.map((w) => (
                  <p key={w} className="mt-1 text-sm text-muted">
                    {w}
                  </p>
                ))}
                <div className="mt-2 flex flex-col gap-2">
                  {sheetRows.map((row) => (
                    <LectureRowEditor
                      key={row.key}
                      row={row}
                      options={options}
                      onChange={onChange}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold text-ink">{copy.adminImportPreview}</h4>
          <div className="mt-2">
            {/* The real grid, so the parse can be read against the PDF. */}
            <WeeklyGrid entries={preview} preview />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * One parsed cell awaiting a decision.
 *
 * The left half is what the PDF says, shown as plain text — it is evidence, not
 * a form. The right half is the only thing the admin controls: which existing
 * course this is, and whether it goes in.
 */
function LectureRowEditor({
  row,
  options,
  onChange,
}: {
  row: LectureRow
  options: { value: string; label: string }[]
  onChange: (key: string, decision: Decision) => void
}) {
  const approved = row.state === 'approved' && row.course_id !== ''

  return (
    <div className="rounded-card border border-line p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {copy.adminImportFromPdf}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-ink">{row.course_name}</p>
          <p className="mt-0.5 text-sm text-muted">
            {row.day_of_week} {row.start_time}–{row.end_time}
            {row.room ? ` · ${row.room}` : ''}
          </p>
          {row.professor && <p className="text-sm text-muted">{row.professor}</p>}
        </div>

        <div className="min-w-0">
          <Select
            label={copy.adminImportCourse}
            value={row.course_id}
            placeholder={copy.adminImportPickCourse}
            options={options}
            onChange={(e) =>
              onChange(row.key, {
                course_id: e.target.value,
                // Choosing a course is itself the approval — an admin who just
                // fixed a bad match should not have to tick a box as well.
                state: e.target.value ? 'approved' : 'skipped',
              })
            }
          />
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-body">
              <input
                type="checkbox"
                checked={approved}
                disabled={row.course_id === ''}
                onChange={(e) =>
                  onChange(row.key, {
                    course_id: row.course_id,
                    state: e.target.checked ? 'approved' : 'skipped',
                  })
                }
                aria-label={`${copy.adminImportApprove} ${row.course_name}`}
              />
              {approved ? copy.adminImportApproved : copy.adminImportSkipped}
            </label>
            {row.course_id !== '' && (
              <span className="text-[11px] uppercase tracking-wide text-muted">
                {row.autoMatched ? copy.adminImportAutoMatched : copy.adminImportChanged}
              </span>
            )}
          </div>
        </div>
      </div>

      {row.warnings.map((w) => (
        <p key={w} className="mt-2 text-sm text-muted">
          {w}
        </p>
      ))}
      {row.match.status === 'unmatched' && row.course_id === '' && (
        <p className="mt-2 text-sm text-danger">{copy.adminImportNoMatch}</p>
      )}
      {row.match.status === 'ambiguous' && row.course_id === '' && (
        <p className="mt-2 text-sm text-danger">
          {copy.adminImportAmbiguousMatch(row.match.candidates.length)}
        </p>
      )}
    </div>
  )
}

// --- Replace confirmation --------------------------------------------------

/**
 * Committing a timetable deletes the term's existing lectures, and with them
 * the Google Calendar events of everyone enrolled. That is the intended
 * behaviour, and it is also irreversible, so it is confirmed rather than
 * assumed.
 */
function ReplaceConfirmModal({
  semester,
  existing,
  incoming,
  saving,
  onCancel,
  onConfirm,
}: {
  semester: string
  existing: number
  incoming: number
  saving: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open onClose={onCancel} labelledBy="replace-title" className="max-w-[460px]">
      <div className="px-5 py-4">
        <h2 id="replace-title" className="text-[17px] font-semibold text-ink">
          {copy.adminImportReplaceTitle}
        </h2>
        <p className="mt-2 text-sm text-body">
          {copy.adminImportReplaceBody(semester, existing, incoming)}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {copy.adminCancel}
          </Button>
          <Button loading={saving} onClick={onConfirm}>
            {copy.adminImportReplaceConfirm}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// --- Calendar review -------------------------------------------------------

interface CalendarReviewProps {
  rows: EventRow[]
  proposed: SemesterInput | null
  onChange: (key: string, patch: Partial<EventRow>) => void
  saving: boolean
  onCommit: () => void
}

function CalendarReview({ rows, proposed, onChange, saving, onCommit }: CalendarReviewProps) {
  const included = rows.filter((r) => r.include).length

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{copy.adminImportReviewEvents}</h3>
        <Button loading={saving} onClick={onCommit} disabled={included === 0}>
          {copy.adminImportCommit}
        </Button>
      </div>

      {proposed && (
        <p className="mt-2 text-sm text-muted">
          {copy.adminImportSemesterProposal(
            proposed.name,
            proposed.start_date,
            proposed.end_date,
          )}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {rows.map((row) => {
          const error = validateAcademicEventInput(row)
          return (
            <div key={row.key} className="rounded-card border border-line p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-3"
                  checked={row.include}
                  onChange={(e) => onChange(row.key, { include: e.target.checked })}
                  aria-label={`${copy.adminImportInclude} ${row.title}`}
                />
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    label={copy.adminEventTitle}
                    value={row.title}
                    onChange={(e) => onChange(row.key, { title: e.target.value })}
                  />
                  <Select
                    label={copy.adminEventKind}
                    value={row.kind}
                    options={ACADEMIC_EVENT_KINDS.map((k) => ({ value: k, label: k }))}
                    onChange={(e) =>
                      onChange(row.key, { kind: e.target.value as AcademicEventKind })
                    }
                  />
                  <Input
                    label={copy.adminEventStart}
                    type="date"
                    value={row.start_date}
                    onChange={(e) => onChange(row.key, { start_date: e.target.value })}
                  />
                  <Input
                    label={copy.adminEventEnd}
                    type="date"
                    value={row.end_date}
                    onChange={(e) => onChange(row.key, { end_date: e.target.value })}
                  />
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={row.blocks_teaching}
                      onChange={(e) =>
                        onChange(row.key, { blocks_teaching: e.target.checked })
                      }
                    />
                    {copy.adminBlocksTeaching}
                  </label>
                </div>
              </div>
              {row.warnings.map((w) => (
                <p key={w} className="mt-2 text-sm text-muted">
                  {w}
                </p>
              ))}
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
