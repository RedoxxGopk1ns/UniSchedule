import { useEffect, useMemo, useState } from 'react'
import { WeeklyGrid } from '../../components/schedule/WeeklyGrid'
import { Button } from '../../components/ui/Button'
import { FileDrop } from '../../components/ui/FileDrop'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { validateAcademicEventInput } from '../../lib/adminValidation'
import { copy } from '../../lib/copy'
import { getProvider } from '../../lib/data/provider'
import {
  ACADEMIC_EVENT_KINDS,
  DAYS,
  type AcademicEventInput,
  type AcademicEventKind,
  type DayOfWeek,
  type Lecture,
  type ScheduleEntry,
  type SemesterInput,
} from '../../lib/data/types'
import { matchLecture, type LectureMatch } from '../../lib/import/lectureMatch'
import { parseAcademicCalendar } from '../../lib/import/calendarParser'
import { extractPages, pageText, type PdfPage } from '../../lib/import/pdfText'
import { parseTimetable, type ParsedSheet } from '../../lib/import/timetableParser'
import { foldGreek } from '../../lib/import/greek'

type Kind = 'timetable' | 'calendar'

/**
 * A parsed timetable row, reduced to what matching and review need.
 *
 * There is deliberately no course_code / subject / department / study_year
 * here: a timetable import never creates or edits a catalogue entry, so
 * fields the commit never writes have no business being editable.
 */
interface LectureRow {
  key: string
  course_name: string
  professor: string
  room: string | null
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  include: boolean
  warnings: string[]
  page: number
}

interface ReviewRow extends LectureRow {
  match: LectureMatch
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
 * The PDF is parsed **in the browser** (src/lib/import), reduced to plain
 * rows, reviewed here, and only then sent through the ordinary admin
 * actions. No binary crosses the wire, there is no storage bucket, and the
 * whole flow works against the mock provider with no network at all.
 *
 * The timetable PDF never creates a lecture — lectures are added by hand in
 * the Lectures tab. Each row here is matched by name, day and time against
 * the existing catalogue (src/lib/import/lectureMatch.ts); a match gets its
 * `semester` field set to the term being imported, and nothing else about it
 * changes. A row with no match (or more than one) is flagged so the admin
 * notices — the fix lives in the Lectures tab, not on this screen.
 */
export function AdminImport() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [kind, setKind] = useState<Kind | null>(null)
  const [pages, setPages] = useState<PdfPage[] | null>(null)
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [lectures, setLectures] = useState<LectureRow[]>([])
  const [existingLectures, setExistingLectures] = useState<Lecture[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [proposed, setProposed] = useState<SemesterInput | null>(null)
  const [semester, setSemester] = useState('')

  // Every lecture needs a semester, and the timetable PDF never names one. Seed
  // the field from the current term so a plain timetable import is valid on
  // arrival instead of showing 43 identical "Semester is required" errors.
  useEffect(() => {
    let alive = true
    void getProvider()
      .admin.listSemesters()
      .then((terms) => {
        if (!alive) return
        const current = terms.find((t) => t.is_current) ?? terms[0]
        if (current) setSemester((s) => s || current.name)
      })
      .catch(() => {
        // Leave the field empty; the admin can type the name.
      })
    return () => {
      alive = false
    }
  }, [])

  // The catalogue to match parsed rows against — fetched whenever a timetable
  // is being reviewed, so a re-import after editing the catalogue sees it.
  useEffect(() => {
    if (kind !== 'timetable') return
    let alive = true
    void getProvider()
      .admin.listLectures()
      .then((ls) => {
        if (alive) setExistingLectures(ls)
      })
    return () => {
      alive = false
    }
  }, [kind])

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
    setLectures([])
    setEvents([])
    setProposed(null)
  }

  /** Runs a parser over already-extracted pages. */
  function run(which: Kind, source: PdfPage[]) {
    setKind(which)
    if (which === 'timetable') {
      // The semester name comes from the calendar PDF when that was imported
      // first; otherwise the admin types it before saving.
      const name = proposed?.name ?? semester
      const result = parseTimetable(source, { semester: name })
      setSheets(result.sheets)
      setLectures(
        result.lectures.map((l) => ({
          key: l.key,
          course_name: l.course_name,
          professor: l.professor,
          room: l.room,
          day_of_week: l.day_of_week,
          start_time: l.start_time,
          end_time: l.end_time,
          include: true,
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

  const setLecture = (key: string, patch: Partial<LectureRow>) =>
    setLectures((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const setEvent = (key: string, patch: Partial<EventRow>) =>
    setEvents((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  // Recomputed on every keystroke: editing a row's name/day/time is how the
  // admin steers a garbled parse onto the right catalogue lecture. None of
  // these edits are ever written back — they only change what gets matched.
  const lectureRows: ReviewRow[] = useMemo(
    () =>
      lectures.map((l) => ({
        ...l,
        match: matchLecture(
          { course_name: l.course_name, day_of_week: l.day_of_week, start_time: l.start_time },
          existingLectures,
        ),
      })),
    [lectures, existingLectures],
  )

  const chosenLectures = lectureRows.filter(
    (r): r is ReviewRow & { match: Extract<LectureMatch, { status: 'matched' }> } =>
      r.include && r.match.status === 'matched',
  )
  const chosenEvents = events.filter((e) => e.include)

  /** Preview entries for the read-only grid beside the table. */
  const previewEntries: ScheduleEntry[] = chosenLectures.map((r, i) => ({
    id: `preview-${i}`,
    lecture_id: `preview-${i}`,
    google_event_id: null,
    lecture: { ...r.match.lecture, semester: semester || r.match.lecture.semester, id: `preview-${i}` },
  }))

  async function commit() {
    const admin = getProvider().admin
    setSaving(true)
    try {
      if (kind === 'calendar') {
        if (chosenEvents.length === 0) {
          toast(copy.adminImportNothing, 'warning')
          return
        }
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
      } else {
        if (chosenLectures.length === 0) {
          toast(copy.adminImportNothing, 'warning')
          return
        }
        let updated = 0
        let failed = 0
        for (const row of chosenLectures) {
          try {
            const { id: _id, ...input } = row.match.lecture
            await admin.updateLecture(row.match.lecture.id, { ...input, semester })
            updated++
          } catch {
            failed++
          }
        }
        toast(copy.adminImportSyncDone(updated, failed), failed ? 'warning' : 'success')
      }
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

      {kind === 'timetable' && lectureRows.length > 0 && (
        <TimetableReview
          rows={lectureRows}
          sheets={sheets}
          semester={semester}
          onSemester={setSemester}
          onChange={setLecture}
          preview={previewEntries}
          saving={saving}
          onCommit={commit}
        />
      )}

      {kind === 'calendar' && events.length > 0 && (
        <CalendarReview
          rows={events}
          proposed={proposed}
          onChange={setEvent}
          saving={saving}
          onCommit={commit}
        />
      )}
    </section>
  )
}

// --- Timetable review ------------------------------------------------------

interface TimetableReviewProps {
  rows: ReviewRow[]
  sheets: ParsedSheet[]
  semester: string
  onSemester: (value: string) => void
  onChange: (key: string, patch: Partial<LectureRow>) => void
  preview: ScheduleEntry[]
  saving: boolean
  onCommit: () => void
}

function TimetableReview({
  rows,
  sheets,
  semester,
  onSemester,
  onChange,
  preview,
  saving,
  onCommit,
}: TimetableReviewProps) {
  const flagged = rows.filter((r) => r.warnings.length > 0 || r.match.status !== 'matched')
  const included = rows.filter((r) => r.include && r.match.status === 'matched').length

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">
            {copy.adminImportReviewLectures}
          </h3>
          <p className="mt-1 max-w-[70ch] text-sm text-muted">{copy.adminImportReviewHint}</p>
        </div>
        <Button loading={saving} onClick={onCommit} disabled={included === 0}>
          {copy.adminImportApplySemester}
        </Button>
      </div>

      <div className="mt-4 max-w-[320px]">
        <Input
          label={copy.adminTabSemesters}
          value={semester}
          onChange={(e) => onSemester(e.target.value)}
          placeholder="Spring 2026"
        />
      </div>

      {flagged.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          {copy.adminImportWarnings}: {flagged.length}
        </p>
      )}

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 overflow-x-auto">
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
                    <LectureRowEditor key={row.key} row={row} onChange={onChange} />
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

function LectureRowEditor({
  row,
  onChange,
}: {
  row: ReviewRow
  onChange: (key: string, patch: Partial<LectureRow>) => void
}) {
  const matched = row.match.status === 'matched'

  return (
    <div className="rounded-card border border-line p-3">
      <div className="flex items-start gap-3">
        <label className="mt-1 flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={row.include && matched}
            disabled={!matched}
            onChange={(e) => onChange(row.key, { include: e.target.checked })}
            aria-label={`${copy.adminImportInclude} ${row.course_name}`}
          />
        </label>

        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Course name"
            value={row.course_name}
            onChange={(e) => onChange(row.key, { course_name: e.target.value })}
          />
          <Input
            label="Professor"
            value={row.professor}
            onChange={(e) => onChange(row.key, { professor: e.target.value })}
          />
          <Select
            label="Day"
            value={row.day_of_week}
            options={DAYS.map((d) => ({ value: d, label: d }))}
            onChange={(e) =>
              onChange(row.key, { day_of_week: e.target.value as DayOfWeek })
            }
          />
          <Input
            label="Start"
            type="time"
            value={row.start_time}
            onChange={(e) => onChange(row.key, { start_time: e.target.value })}
          />
          <Input
            label="End"
            type="time"
            value={row.end_time}
            onChange={(e) => onChange(row.key, { end_time: e.target.value })}
          />
          <Input
            label="Room"
            value={row.room ?? ''}
            onChange={(e) => onChange(row.key, { room: e.target.value || null })}
          />
        </div>
      </div>

      {row.warnings.map((w) => (
        <p key={w} className="mt-2 text-sm text-muted">
          {w}
        </p>
      ))}
      {row.match.status === 'matched' && (
        <p className="mt-2 text-sm text-muted">
          Matches {row.match.lecture.course_code} · {row.match.lecture.professor}
        </p>
      )}
      {row.match.status === 'unmatched' && (
        <p className="mt-2 text-sm text-danger">{copy.adminImportNoMatch}</p>
      )}
      {row.match.status === 'ambiguous' && (
        <p className="mt-2 text-sm text-danger">
          {copy.adminImportAmbiguousMatch(row.match.candidates.length)}
        </p>
      )}
    </div>
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
