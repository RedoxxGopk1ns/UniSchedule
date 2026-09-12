import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmModal } from '../components/courses/ConfirmModal'
import { ConflictWarning } from '../components/courses/ConflictWarning'
import { CourseListItem } from '../components/courses/CourseListItem'
import { FilterPill } from '../components/courses/FilterPill'
import { SearchBar } from '../components/courses/SearchBar'
import { TogglePill } from '../components/courses/TogglePill'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import { useSchedule } from '../hooks/useSchedule'
import { detectConflicts } from '../lib/conflicts'
import { copy } from '../lib/copy'
import { getProvider } from '../lib/data/provider'
import {
  DAYS,
  TIME_BANDS,
  type DayOfWeek,
  type Lecture,
  type LectureFilters,
  type Semester,
  type TimeBand,
} from '../lib/data/types'
import { computeDiff, isEmptyDiff, unsyncedLectureIds } from '../lib/diff'
import { BAND_LABELS, activeFilterCount, applyFilters } from '../lib/filters'
import { activeSemester } from '../lib/occurrences'
import { CALENDAR_SYNC_ENABLED } from '../lib/supabase'

/**
 * Course selection (§8.3) and the edit flow (§10) — one component, two entry
 * points. In edit mode the current enrolment arrives pre-checked, and the diff
 * on confirm is what drives the Calendar calls.
 */
export function SelectCourses({ mode = 'select' }: { mode?: 'select' | 'edit' }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { entries, loading: scheduleLoading, syncing, sync } = useSchedule()

  const [lectures, setLectures] = useState<Lecture[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LectureFilters>({})
  const [studyYear, setStudyYear] = useState<number | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [seeded, setSeeded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [passedCodes, setPassedCodes] = useState<string[]>([])
  // The course code awaiting mark-as-passed confirmation, or null.
  const [passingCode, setPassingCode] = useState<string | null>(null)

  /** Patches one dimension, leaving the rest of the filter state alone. */
  const setFilter = <K extends keyof LectureFilters>(
    key: K,
    value: LectureFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }))

  // Catalogue is fetched once; filtering happens client-side so typing is
  // instant and does not spend a round trip per keystroke.
  useEffect(() => {
    let cancelled = false
    void Promise.all([getProvider().listLectures(), getProvider().listSemesters()])
      .then(([data, terms]) => {
        if (cancelled) return
        setLectures(data)
        setSemesters(terms)
        // Scope the list to the term being taught right now. The catalogue
        // holds every term the department has ever published, and two of them
        // side by side with nothing on the row to tell them apart is how a
        // student ends up enrolled in a term that finished in June. The pill
        // below can widen it back to all terms; an unknown window (no term is
        // teaching today) leaves it unscoped rather than hiding everything.
        setFilters((current) => ({
          ...current,
          semester: activeSemester(terms, new Date())?.name ?? null,
        }))
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        toast(copy.syncError, 'error')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  // Pre-check current enrolment once the schedule resolves.
  useEffect(() => {
    if (scheduleLoading || seeded) return
    setSelected(entries.map((e) => e.lecture_id))
    setSeeded(true)
  }, [entries, scheduleLoading, seeded])

  // The student's own year, which the mandatory filter matches against.
  useEffect(() => {
    let cancelled = false
    void getProvider()
      .getStudyYear()
      .then((year) => !cancelled && setStudyYear(year))
      .catch(() => {
        // Not worth a toast — the year filter simply stays unset.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Courses already passed, hidden from the catalogue by default.
  useEffect(() => {
    let cancelled = false
    void getProvider()
      .getPassedCourseCodes()
      .then((codes) => !cancelled && setPassedCodes(codes))
      .catch(() => {
        // Non-fatal — nothing gets hidden, which fails safe.
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Option lists, derived from whatever the catalogue actually contains. */
  const distinct = useMemo(
    () => ({
      departments: [
        ...new Set(lectures.map((l) => l.department).filter(Boolean)),
      ].sort() as string[],
      subjects: [...new Set(lectures.map((l) => l.subject).filter(Boolean))].sort() as string[],
      professors: [...new Set(lectures.map((l) => l.professor))].sort(),
      years: [
        ...new Set(lectures.map((l) => l.study_year).filter((y): y is number => y !== null)),
      ].sort((a, b) => a - b),
    }),
    [lectures],
  )

  // One representative lecture per passed course code, so the passed-only view
  // shows each course once rather than one row per section.
  const passedLectures = useMemo(() => {
    const seen = new Set<string>()
    const out: Lecture[] = []
    for (const code of passedCodes) {
      if (seen.has(code)) continue
      const lecture = lectures.find((l) => l.course_code === code)
      if (lecture) {
        seen.add(code)
        out.push(lecture)
      }
    }
    return out
  }, [passedCodes, lectures])

  const filtered = useMemo(() => {
    // In the passed-only review the source is the deduped passed list; the
    // normal catalogue simply hides passed courses.
    const source = filters.passedOnly ? passedLectures : lectures
    return applyFilters(source, filters, {
      selectedIds: selected,
      studyYear,
      passedCourseCodes: passedCodes,
    })
  }, [lectures, passedLectures, filters, selected, studyYear, passedCodes])

  /**
   * The catalogue the count is measured against.
   *
   * The term is a scope rather than a filter — it decides which catalogue the
   * student is looking at, so 'showing 16 of 41' has to mean 41 lectures in
   * this term, not 41 of the 54 rows the fetch happened to return across every
   * term the department has ever published.
   */
  const inScope = useMemo(
    () =>
      filters.semester
        ? lectures.filter(
            (l) => l.semester === filters.semester || selected.includes(l.id),
          )
        : lectures,
    [lectures, filters.semester, selected],
  )

  const activeCount = activeFilterCount(filters)

  /** Persists the year as well as setting it — it is a profile fact, not a view. */
  const chooseYear = (years: string[]) => {
    const next = years.length > 0 ? Number(years[0]) : null
    setStudyYear(next)
    void getProvider()
      .setStudyYear(next)
      .catch(() => toast(copy.syncError, 'error'))
  }

  const selectedLectures = useMemo(
    () =>
      selected
        .map((id) => lectures.find((l) => l.id === id))
        .filter((l): l is Lecture => Boolean(l)),
    [selected, lectures],
  )

  // Conflicts are recomputed on every tick, not just at the confirm step —
  // finding out you double-booked only after pressing Review is too late to be
  // useful. The modal keeps its own copy as the last line of defence.
  const conflicts = useMemo(() => detectConflicts(selectedLectures), [selectedLectures])

  /** Lecture ids involved in at least one conflict, for row highlighting. */
  const conflictedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of conflicts) {
      ids.add(c.a.id)
      ids.add(c.b.id)
    }
    return ids
  }, [conflicts])

  /** Course codes taught in more than one section, which need a slot marker. */
  const multiSectionCodes = useMemo(() => {
    const seen = new Set<string>()
    const dupes = new Set<string>()
    for (const l of lectures) {
      if (seen.has(l.course_code)) dupes.add(l.course_code)
      else seen.add(l.course_code)
    }
    return dupes
  }, [lectures])

  const diff = useMemo(() => computeDiff(entries, selected), [entries, selected])

  /**
   * Already-enrolled lectures with no Calendar event — see unsyncedLectureIds.
   * They make a save worthwhile even when the selection itself is unchanged.
   * Empty unless Calendar sync is on, and empty under the mock provider, which
   * reports an event id for every entry.
   */
  const repairIds = useMemo(
    () => (CALENDAR_SYNC_ENABLED ? unsyncedLectureIds(entries) : []),
    [entries],
  )

  const changeSummary = useMemo(() => {
    if (mode !== 'edit') return null
    if (isEmptyDiff(diff)) {
      return repairIds.length > 0
        ? copy.calendarRepair(repairIds.length)
        : 'No changes to sync.'
    }
    const parts: string[] = []
    if (diff.to_add.length) parts.push(`${diff.to_add.length} added`)
    if (diff.to_remove.length) parts.push(`${diff.to_remove.length} removed`)
    return parts.join(' · ')
  }, [diff, mode, repairIds])

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )

  /**
   * Confirms marking a course passed: hides every section optimistically, drops
   * them from the current selection, persists the passed flag, and removes any
   * enrolled sections from the schedule (and Calendar) via the normal sync path.
   */
  const confirmPassed = async () => {
    const code = passingCode
    if (!code) return
    setPassingCode(null)

    setPassedCodes((current) =>
      current.includes(code) ? current : [...current, code],
    )
    const sectionIds = lectures
      .filter((l) => l.course_code === code)
      .map((l) => l.id)
    setSelected((current) => current.filter((id) => !sectionIds.includes(id)))

    try {
      await getProvider().markCoursePassed(code)
    } catch {
      toast(copy.syncError, 'error')
      return
    }

    // Take any enrolled sections off the timetable, reusing the schedule +
    // Calendar removal path rather than a second write of our own.
    const toRemove = entries
      .filter((e) => e.lecture.course_code === code)
      .map((e) => ({ lecture_id: e.lecture_id, google_event_id: e.google_event_id }))
    if (toRemove.length > 0) {
      await sync({ to_add: [], to_remove: toRemove })
    }

    toast(copy.coursePassed(code), 'success')
  }

  /** Un-marks a passed course so it returns to the selectable catalogue. */
  const restore = async (code: string) => {
    setPassedCodes((current) => current.filter((c) => c !== code))
    try {
      await getProvider().unmarkCoursePassed(code)
      toast(copy.courseRestored(code), 'success')
    } catch {
      toast(copy.syncError, 'error')
    }
  }

  const handleConfirm = async () => {
    // Nothing changed and nothing to repair — skip the round trip entirely
    // (§10). A pending repair is worth the trip even with an empty diff: the
    // provider folds those lectures into the Calendar call.
    if (isEmptyDiff(diff) && repairIds.length === 0) {
      setConfirming(false)
      navigate('/dashboard')
      return
    }

    const result = await sync(diff)
    setConfirming(false)

    // `success` is about the enrolment only. A Calendar failure is worth
    // saying out loud, but it is not a reason to keep the student on this
    // screen — their schedule is already saved.
    if (!result.success) {
      toast(result.errors[0]?.message ?? copy.syncError, 'error')
      return
    }

    if (result.calendar === 'failed') {
      toast(copy.calendarWarning, 'warning')
    } else if (result.calendar === 'skipped') {
      toast(copy.scheduleSaved, 'success')
    } else {
      toast(copy.syncSuccess, 'success')
    }
    navigate('/dashboard')
  }

  return (
    <div className="min-h-dvh bg-canvas pb-[68px]">
      <Header />

      <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">
              {mode === 'edit' ? copy.editSchedule : copy.selectTitle}
            </h1>
            <p className="mt-1 text-sm text-muted">{copy.selectSubtitle}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="sm:max-w-[380px]">
            <SearchBar
              value={filters.search ?? ''}
              onChange={(v) => setFilter('search', v)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label={copy.filterDepartment}
              options={distinct.departments}
              values={filters.departments ?? []}
              onChange={(v) => setFilter('departments', v)}
            />
            <FilterPill
              label={copy.filterDay}
              options={DAYS}
              values={filters.days ?? []}
              onChange={(v) => setFilter('days', v as DayOfWeek[])}
            />
            {semesters.length > 1 && (
              <FilterPill
                single
                label={copy.filterTerm}
                plural={copy.filterTermPlural}
                options={semesters.map((t) => t.name)}
                values={filters.semester ? [filters.semester] : []}
                onChange={(v) => setFilter('semester', v[0] ?? null)}
              />
            )}
            <FilterPill
              label={copy.filterSubject}
              options={distinct.subjects}
              values={filters.subjects ?? []}
              onChange={(v) => setFilter('subjects', v)}
            />
            <FilterPill
              label={copy.filterProfessor}
              options={distinct.professors}
              values={filters.professors ?? []}
              onChange={(v) => setFilter('professors', v)}
            />
            <FilterPill
              label={copy.filterTime}
              plural={copy.filterTimePlural}
              options={TIME_BANDS}
              values={filters.bands ?? []}
              onChange={(v) => setFilter('bands', v as TimeBand[])}
              renderOption={(o) => BAND_LABELS[o as TimeBand]}
            />
            <FilterPill
              single
              label={copy.filterYear}
              plural={copy.filterYearPlural}
              options={distinct.years.map(String)}
              values={studyYear === null ? [] : [String(studyYear)]}
              onChange={chooseYear}
              renderOption={(o) => copy.yearOption(Number(o))}
            />

            <TogglePill
              label={copy.filterMandatory}
              active={Boolean(filters.mandatoryOnly)}
              onChange={(v) => setFilter('mandatoryOnly', v)}
            />
            <TogglePill
              label={copy.filterSelected}
              active={Boolean(filters.selectedOnly)}
              onChange={(v) => setFilter('selectedOnly', v)}
            />
            <TogglePill
              label={copy.filterPassed}
              active={Boolean(filters.passedOnly)}
              onChange={(v) => setFilter('passedOnly', v)}
            />
          </div>

          {/* Count and reset, shown only while something is actually filtered —
              an unfiltered list needs neither. */}
          {activeCount > 0 && (
            <div className="flex items-center gap-3 text-[13px]">
              <span className="text-muted">
                {copy.showingCount(filtered.length, inScope.length)}
              </span>
              <button
                type="button"
                onClick={() => setFilters({ semester: filters.semester })}
                className="font-medium text-ink underline underline-offset-2 hover:text-body"
              >
                {copy.clearFilters}
              </button>
            </div>
          )}
        </div>

        {conflicts.length > 0 && (
          <div className="mt-5">
            <ConflictWarning conflicts={conflicts} />
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-panel border border-line bg-canvas shadow-panel">
          {loading ? (
            // 7 skeleton rows at 56px, per §13.
            <div>
              {Array.from({ length: 7 }, (_, i) => (
                <div
                  key={i}
                  className="flex h-14 items-center gap-3 border-b border-line-faint px-4"
                >
                  <Skeleton className="h-4 w-4 rounded-[4px]" />
                  <Skeleton className="h-5 w-16 rounded-pill" />
                  <Skeleton className="h-3.5 flex-1 max-w-[220px]" />
                  <Skeleton className="hidden h-3 w-32 sm:block" />
                  <Skeleton className="hidden h-3 w-28 lg:block" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-16 text-center text-[13px] text-faded">
              {filters.passedOnly ? copy.passedEmpty : copy.noResults}
            </p>
          ) : (
            filtered.map((lecture) =>
              filters.passedOnly ? (
                <CourseListItem
                  key={lecture.id}
                  lecture={lecture}
                  checked={false}
                  onToggle={() => {}}
                  onRestore={() => void restore(lecture.course_code)}
                />
              ) : (
                <CourseListItem
                  key={lecture.id}
                  lecture={lecture}
                  checked={selected.includes(lecture.id)}
                  onToggle={() => toggle(lecture.id)}
                  multiSection={multiSectionCodes.has(lecture.course_code)}
                  conflicted={conflictedIds.has(lecture.id)}
                  onMarkPassed={() => setPassingCode(lecture.course_code)}
                />
              ),
            )
          )}
        </div>
      </main>

      {/* Sticky action bar (§8.3) */}
      <div className="fixed inset-x-0 bottom-0 z-40 h-[68px] border-t border-line bg-canvas/95 backdrop-blur-[8px]">
        <div className="mx-auto flex h-full max-w-[1180px] items-center justify-between gap-4 px-5 sm:px-6">
          <span className="text-sm font-medium text-body">
            {copy.coursesSelected(selected.length)}
          </span>
          <Button
            onClick={() => setConfirming(true)}
            disabled={selected.length === 0 && mode === 'select'}
          >
            {copy.reviewConfirm}
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={confirming}
        lectures={selectedLectures}
        syncing={syncing}
        changeSummary={changeSummary}
        onClose={() => setConfirming(false)}
        onConfirm={handleConfirm}
      />

      <Modal
        open={passingCode !== null}
        onClose={() => setPassingCode(null)}
        labelledBy="passed-confirm-title"
      >
        <div className="px-6 pt-6 pb-5">
          <h2 id="passed-confirm-title" className="text-[22px] font-semibold text-ink">
            {copy.passedConfirmTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {passingCode && copy.passedConfirmBody(passingCode)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line-soft px-6 py-4">
          <Button variant="ghost" onClick={() => setPassingCode(null)} className="px-1">
            {copy.back}
          </Button>
          <Button onClick={() => void confirmPassed()}>{copy.passedConfirmAction}</Button>
        </div>
      </Modal>
    </div>
  )
}
