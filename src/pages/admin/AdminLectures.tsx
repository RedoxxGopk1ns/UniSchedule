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
import type { AdminSemester, DayOfWeek, Lecture, LectureInput } from '../../lib/data/types'
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

function blankInput(semester: string): LectureInput {
  return {
    course_code: '',
    course_name: '',
    professor: '',
    room: null,
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
    semester,
    department: null,
    color_tag: null,
    subject: null,
    is_mandatory: false,
    study_year: null,
  }
}

function toInput(l: Lecture): LectureInput {
  return {
    course_code: l.course_code,
    course_name: l.course_name,
    professor: l.professor,
    room: l.room,
    day_of_week: l.day_of_week,
    start_time: hhmm(l.start_time),
    end_time: hhmm(l.end_time),
    semester: l.semester,
    department: l.department,
    color_tag: l.color_tag,
    subject: l.subject,
    is_mandatory: l.is_mandatory,
    study_year: l.study_year,
  }
}

export function AdminLectures() {
  const { toast } = useToast()
  const [lectures, setLectures] = useState<Lecture[]>([])
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
      const [lecs, sems] = await Promise.all([
        getProvider().admin.listLectures(),
        getProvider().admin.listSemesters(),
      ])
      setLectures(lecs)
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
  const departmentOptions = useMemo(
    () => catalogueOptions(lectures.map((l) => l.department)),
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
          roomOptions={roomOptions}
          departmentOptions={departmentOptions}
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
  roomOptions,
  departmentOptions,
  onCancel,
  onSaved,
}: {
  initial: LectureInput
  isEdit: boolean
  semesters: AdminSemester[]
  roomOptions: string[]
  departmentOptions: string[]
  onCancel: () => void
  onSaved: (input: LectureInput) => Promise<void>
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<LectureInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof LectureInput>(key: K, value: LectureInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

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
          <Input
            label="Course code"
            value={form.course_code}
            onChange={(e) => set('course_code', e.target.value)}
          />
          <Input
            label="Course name"
            value={form.course_name}
            onChange={(e) => set('course_name', e.target.value)}
          />
          <Input
            label="Professor"
            value={form.professor}
            onChange={(e) => set('professor', e.target.value)}
          />
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
          <Select
            label="Department"
            value={form.department ?? ''}
            onChange={(e) => set('department', e.target.value || null)}
            options={[
              { value: '', label: '—' },
              ...catalogueOptions(departmentOptions, [], form.department).map((d) => ({
                value: d,
                label: d,
              })),
            ]}
          />
          <Input
            label="Subject"
            value={form.subject ?? ''}
            onChange={(e) => set('subject', e.target.value || null)}
          />
          <Input
            label="Colour tag"
            placeholder="#111111"
            value={form.color_tag ?? ''}
            onChange={(e) => set('color_tag', e.target.value || null)}
          />
          <Select
            label="Year of study"
            value={form.study_year === null ? '' : String(form.study_year)}
            onChange={(e) => set('study_year', e.target.value ? Number(e.target.value) : null)}
            placeholder="None"
            options={[1, 2, 3, 4].map((y) => ({ value: String(y), label: `Year ${y}` }))}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={form.is_mandatory}
            onChange={(e) => set('is_mandatory', e.target.checked)}
          />
          Mandatory course
        </label>

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

function ImportModal({ onCancel, onDone }: { onCancel: () => void; onDone: () => Promise<void> }) {
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setError(null)
    let rows
    try {
      rows = parseLectureCsv(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse CSV.')
      return
    }
    if (rows.length === 0) {
      setError('No rows found.')
      return
    }
    setBusy(true)
    try {
      const result = await getProvider().admin.bulkImportLectures(rows)
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
