import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { validateLectureInput } from '../../lib/adminValidation'
import { getProvider } from '../../lib/data/provider'
import { DAYS } from '../../lib/data/types'
import type {
  AdminSemester,
  Course,
  DayOfWeek,
  Lecture,
  LectureInput,
} from '../../lib/data/types'
import { matchesSearch } from '../../lib/filters'
import { copy } from '../../lib/copy'
import { LectureOverridesModal } from './LectureOverridesModal'
import { catalogueOptions } from './catalogueOptions'
import { parseLectureCsv } from './lectureCsv'

/** 'HH:MM:SS' | 'HH:MM' -> 'HH:MM' for <input type="time">. */
const hhmm = (t: string) => t.slice(0, 5)

/**
 * The room names the department is standardising on. These are *added* to
 * whatever the catalogue already uses rather than replacing it — see
 * catalogueOptions.ts for why a closed list would misrepresent existing rows.
 */
const CANONICAL_ROOMS = [
  'Αμφιθέατρο 1ου ορόφου',
  'Εργαστήριο 2ου ορόφου',
  'Αμφιθέατρο 2ου ορόφου',
  'Εργαστήριο 3ου ορόφου',
  'Αμφιθέατρο 3ου ορόφου',
  'Αμφιθέατρο 4ου ορόφου',
]

/**
 * A blank lecture. `course_id` starts empty so the picker opens on its
 * placeholder rather than silently defaulting to whichever course sorts first
 * — the wrong course saved by accident is worse than a validation error.
 */
function blankInput(semester: string): LectureInput {
  return {
    course_id: '',
    room: null,
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
    semester,
  }
}

function toInput(l: Lecture): LectureInput {
  return {
    course_id: l.course_id,
    room: l.room,
    day_of_week: l.day_of_week,
    start_time: hhmm(l.start_time),
    end_time: hhmm(l.end_time),
    semester: l.semester,
  }
}

export function AdminLectures() {
  const { toast } = useToast()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [semesters, setSemesters] = useState<AdminSemester[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // The form is open when `editing` is set: an id means edit, null id means create.
  const [editing, setEditing] = useState<{ id: string | null; input: LectureInput } | null>(null)
  const [deleting, setDeleting] = useState<Lecture | null>(null)
  const [importing, setImporting] = useState(false)
  const [overriding, setOverriding] = useState<Lecture | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [lecs, cs, sems] = await Promise.all([
        getProvider().admin.listLectures(),
        getProvider().admin.listCourses(),
        getProvider().admin.listSemesters(),
      ])
      setLectures(lecs)
      setCourses(cs)
      setSemesters(sems)
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(
    () => lectures.filter((l) => matchesSearch(l, search)),
    [lectures, search],
  )

  // Derived from the loaded catalogue rather than hardcoded, so the pickers
  // describe the data that is actually there — whichever backend served it.
  const roomOptions = useMemo(
    () => catalogueOptions(lectures.map((l) => l.room), CANONICAL_ROOMS),
    [lectures],
  )
  const defaultSemester =
    semesters.find((s) => s.is_current)?.name ?? semesters[0]?.name ?? ''

  const columns: Column<Lecture>[] = [
    {
      key: 'course',
      header: 'Course',
      render: (l) => (
        <span>
          <span className="font-medium text-ink">{l.course_code}</span>{' '}
          <span className="text-muted">{l.course_name}</span>
        </span>
      ),
    },
    {
      key: 'slot',
      header: 'Day / time',
      render: (l) => `${l.day_of_week.slice(0, 3)} ${hhmm(l.start_time)}–${hhmm(l.end_time)}`,
    },
    { key: 'prof', header: 'Professor', render: (l) => l.professor },
    { key: 'room', header: 'Room', render: (l) => l.room ?? '—' },
    { key: 'sem', header: 'Semester', render: (l) => l.semester },
    { key: 'year', header: 'Year', render: (l) => l.study_year ?? '—', className: 'text-center' },
    {
      key: 'actions',
      header: '',
      className: 'text-right whitespace-nowrap',
      render: (l) => (
        <span className="inline-flex gap-1">
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => setEditing({ id: l.id, input: toInput(l) })}
          >
            {copy.adminEdit}
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => setOverriding(l)}
          >
            {copy.adminOverrides}
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs text-danger hover:text-danger"
            onClick={() => setDeleting(l)}
          >
            {copy.adminDelete}
          </Button>
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.adminSearchLectures}
            aria-label={copy.adminSearchLectures}
          />
        </div>
        <Button variant="outline" onClick={() => setImporting(true)}>
          {copy.adminImport}
        </Button>
        <Button
          onClick={() => setEditing({ id: null, input: blankInput(defaultSemester) })}
          disabled={semesters.length === 0}
        >
          {copy.adminAddLecture}
        </Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading…
          </div>
        ) : (
          <Table
            columns={columns}
            rows={filtered}
            rowKey={(l) => l.id}
            empty={copy.adminNoLectures}
          />
        )}
      </div>

      {editing && (
        <LectureFormModal
          initial={editing.input}
          isEdit={editing.id !== null}
          semesters={semesters}
          courses={courses}
          roomOptions={roomOptions}
          onCancel={() => setEditing(null)}
          onSaved={async (input) => {
            const api = getProvider().admin
            if (editing.id) await api.updateLecture(editing.id, input)
            else await api.createLecture(input)
            toast(copy.adminLectureSaved, 'success')
            setEditing(null)
            await load()
          }}
        />
      )}

      {deleting && (
        <DeleteLectureModal
          lecture={deleting}
          enrolled={0}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await getProvider().admin.deleteLecture(deleting.id)
              toast(copy.adminLectureDeleted, 'success')
              setDeleting(null)
              await load()
            } catch (e) {
              toast(e instanceof Error ? e.message : copy.adminError, 'error')
            }
          }}
        />
      )}

      {overriding && (
        <LectureOverridesModal
          lecture={overriding}
          semesters={semesters}
          onClose={() => setOverriding(null)}
        />
      )}

      {importing && (
        <ImportModal
          courses={courses}
          onCancel={() => setImporting(false)}
          onDone={async () => {
            setImporting(false)
            await load()
          }}
        />
      )}
    </div>
  )
}

// --- Create / edit form ----------------------------------------------------

function LectureFormModal({
  initial,
  isEdit,
  semesters,
  courses,
  roomOptions,
  onCancel,
  onSaved,
}: {
  initial: LectureInput
  isEdit: boolean
  semesters: AdminSemester[]
  courses: Course[]
  roomOptions: string[]
  onCancel: () => void
  onSaved: (input: LectureInput) => Promise<void>
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<LectureInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof LectureInput>(key: K, value: LectureInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const chosen = courses.find((c) => c.id === form.course_id) ?? null

  async function submit() {
    const err = validateLectureInput(form)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSaved(form)
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onCancel} labelledBy="lecture-form-title" className="max-w-[640px]">
      <div className="border-b border-line px-5 py-4">
        <h2 id="lecture-form-title" className="text-[17px] font-semibold text-ink">
          {isEdit ? copy.adminEditLecture : copy.adminNewLecture}
        </h2>
      </div>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/*
            Which course meets, picked rather than typed. A lecture cannot name
            a course that does not exist — add it in the Courses tab first — and
            its code, lecturer and subject are inherited from whatever is chosen
            here, so there is nothing else about the course to edit.
          */}
          <div className="sm:col-span-2">
            <Select
              label={copy.adminLectureCourse}
              value={form.course_id}
              onChange={(e) => set('course_id', e.target.value)}
              placeholder={copy.adminLecturePickCourse}
              options={courses.map((c) => ({
                value: c.id,
                label: `${c.course_name} · ${c.course_code}`,
              }))}
            />
          </div>
          <Select
            label="Room"
            value={form.room ?? ''}
            onChange={(e) => set('room', e.target.value || null)}
            options={[
              { value: '', label: '—' },
              ...catalogueOptions(roomOptions, [], form.room).map((r) => ({
                value: r,
                label: r,
              })),
            ]}
          />
          <Select
            label="Day"
            value={form.day_of_week}
            onChange={(e) => set('day_of_week', e.target.value as DayOfWeek)}
            options={DAYS.map((d) => ({ value: d, label: d }))}
          />
          <Select
            label="Semester"
            value={form.semester}
            onChange={(e) => set('semester', e.target.value)}
            options={semesters.map((s) => ({ value: s.name, label: s.name }))}
          />
          <Input
            label="Start time"
            type="time"
            value={form.start_time}
            onChange={(e) => set('start_time', e.target.value)}
          />
          <Input
            label="End time"
            type="time"
            value={form.end_time}
            onChange={(e) => set('end_time', e.target.value)}
          />
        </div>

        {/* Everything the chosen course brings with it. Shown read-only so the
            admin can confirm they picked the right one without leaving the
            form; it is edited in the Courses tab. */}
        {chosen && (
          <div className="rounded-card border border-line p-3">
            <p className="text-sm text-muted">{copy.adminLectureInherited}</p>
            <p className="mt-1 text-sm text-ink">
              {chosen.course_code} · {chosen.professor}
              {chosen.subject ? ` · ${chosen.subject}` : ''}
              {chosen.study_year === null ? '' : ` · year ${chosen.study_year}`}
              {chosen.is_mandatory ? ` · ${copy.adminMandatory}` : ''}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button variant="ghost" onClick={onCancel}>
          {copy.adminCancel}
        </Button>
        <Button onClick={submit} loading={saving}>
          {copy.adminSave}
        </Button>
      </div>
    </Modal>
  )
}

// --- Delete confirmation ---------------------------------------------------

function DeleteLectureModal({
  lecture,
  enrolled,
  onCancel,
  onConfirm,
}: {
  lecture: Lecture
  enrolled: number
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal open onClose={onCancel} labelledBy="delete-lecture-title">
      <div className="px-5 py-5">
        <h2 id="delete-lecture-title" className="text-[17px] font-semibold text-ink">
          {copy.adminDeleteLectureTitle}
        </h2>
        <p className="mt-2 text-sm text-body">
          {copy.adminDeleteLectureBody(lecture.course_code, enrolled)}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {copy.adminCancel}
          </Button>
          <Button
            className="bg-danger text-white hover:bg-danger"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
          >
            {copy.adminDelete}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// --- CSV import ------------------------------------------------------------

function ImportModal({
  courses,
  onCancel,
  onDone,
}: {
  courses: Course[]
  onCancel: () => void
  onDone: () => Promise<void>
}) {
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setError(null)
    let parsed
    try {
      parsed = parseLectureCsv(text, courses)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse CSV.')
      return
    }
    // A row naming a course that does not exist is reported rather than
    // skipped quietly — a CSV cannot create a course any more than a PDF can.
    if (parsed.unmatched.length) {
      const names = [...new Set(parsed.unmatched.map((u) => u.course_name))]
      setError(
        `No course is named ${names.slice(0, 3).join(', ')}${names.length > 3 ? `, and ${names.length - 3} more` : ''}. Add them in the Courses tab first.`,
      )
      return
    }
    if (parsed.rows.length === 0) {
      setError('No rows found.')
      return
    }
    setBusy(true)
    try {
      const result = await getProvider().admin.bulkImportLectures(parsed.rows)
      if (result.errors.length) {
        toast(`Imported ${result.created}, ${result.errors.length} skipped`, 'warning')
      } else {
        toast(`Imported ${result.created} lecture${result.created === 1 ? '' : 's'}`, 'success')
      }
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.adminError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onCancel} labelledBy="import-title" className="max-w-[640px]">
      <div className="border-b border-line px-5 py-4">
        <h2 id="import-title" className="text-[17px] font-semibold text-ink">
          {copy.adminImport}
        </h2>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-muted">
          Paste CSV with a header row. Columns: course_code, course_name, professor, room,
          day_of_week, start_time, end_time, semester, department, color_tag, subject,
          is_mandatory, study_year.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="mt-3 w-full rounded-input border border-line-strong bg-canvas px-3 py-2 font-mono text-xs text-ink outline-none focus:border-ink"
          placeholder="course_code,course_name,professor,room,day_of_week,start_time,end_time,semester,department,color_tag,subject,is_mandatory,study_year"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button variant="ghost" onClick={onCancel}>
          {copy.adminCancel}
        </Button>
        <Button onClick={run} loading={busy}>
          {copy.adminImport}
        </Button>
      </div>
    </Modal>
  )
}
