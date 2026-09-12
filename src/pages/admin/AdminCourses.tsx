import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { validateCourseInput } from '../../lib/adminValidation'
import { copy } from '../../lib/copy'
import { getProvider } from '../../lib/data/provider'
import type { Course, CourseInput, Lecture } from '../../lib/data/types'
import { foldGreek } from '../../lib/import/greek'
import { catalogueOptions } from './catalogueOptions'

function blankInput(): CourseInput {
  return {
    course_code: '',
    course_name: '',
    professor: '',
    department: null,
    color_tag: null,
    subject: null,
    is_mandatory: false,
    study_year: null,
    semester_number: null,
    ects: null,
  }
}

function toInput(c: Course): CourseInput {
  return {
    course_code: c.course_code,
    course_name: c.course_name,
    professor: c.professor,
    department: c.department,
    color_tag: c.color_tag,
    subject: c.subject,
    is_mandatory: c.is_mandatory,
    study_year: c.study_year,
    semester_number: c.semester_number,
    ects: c.ects,
  }
}

/**
 * The courses the department teaches — the stable half of the catalogue.
 *
 * This is the only place a course is created, renamed or re-staffed. Lectures
 * inherit every field here through `course_id` (migration 0006), so an edit
 * made once shows up on every meeting of that course in every term, with
 * nothing to backfill.
 *
 * It is also the only way a timetable import can grow: the PDF matches its
 * parsed titles against this table and refuses to invent anything, so a course
 * missing from here is added by hand before importing.
 */
export function AdminCourses() {
  const { toast } = useToast()
  const [courses, setCourses] = useState<Course[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Open when set: an id means edit, a null id means create.
  const [editing, setEditing] = useState<{ id: string | null; input: CourseInput } | null>(
    null,
  )
  const [deleting, setDeleting] = useState<Course | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [cs, ls] = await Promise.all([
        getProvider().admin.listCourses(),
        // Only to show, and warn about, how many lectures each course has.
        getProvider().admin.listLectures(),
      ])
      setCourses(cs)
      setLectures(ls)
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

  /** How many lectures each course has, for the table and the delete warning. */
  const lectureCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of lectures) counts.set(l.course_id, (counts.get(l.course_id) ?? 0) + 1)
    return counts
  }, [lectures])

  const filtered = useMemo(() => {
    const q = foldGreek(search.trim())
    if (!q) return courses
    return courses.filter((c) =>
      [c.course_code, c.course_name, c.professor].some((f) => foldGreek(f).includes(q)),
    )
  }, [courses, search])

  // Derived from the data rather than hardcoded — see catalogueOptions.ts.
  const departmentOptions = useMemo(
    () => catalogueOptions(courses.map((c) => c.department)),
    [courses],
  )

  const columns: Column<Course>[] = [
    {
      key: 'course',
      header: 'Course',
      render: (c) => (
        <span>
          <span className="font-medium text-ink">{c.course_code}</span>{' '}
          <span className="text-muted">{c.course_name}</span>
        </span>
      ),
    },
    { key: 'professor', header: 'Professor', render: (c) => c.professor },
    {
      key: 'subject',
      header: 'Subject',
      render: (c) => c.subject ?? '—',
    },
    {
      key: 'semester',
      header: 'Semester',
      // The programme is published by semester, so that is what the admin
      // scans for; the year of study is derived from it.
      render: (c) =>
        c.semester_number === null
          ? '—'
          : `${c.semester_number}ο · year ${c.study_year ?? '—'}`,
    },
    {
      key: 'ects',
      header: 'ECTS',
      render: (c) => (c.ects === null ? '—' : String(c.ects)),
    },
    {
      key: 'lectures',
      header: 'Scheduled',
      render: (c) => copy.adminCourseLectures(lectureCount.get(c.id) ?? 0),
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            onClick={() => setEditing({ id: c.id, input: toInput(c) })}
          >
            {copy.adminEdit}
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(c)}>
            {copy.adminDelete}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <p className="max-w-[70ch] text-sm text-muted">{copy.adminCoursesIntro}</p>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-[360px]">
          <Input
            label={copy.adminSearchCourses}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setEditing({ id: null, input: blankInput() })}>
          {copy.adminAddCourse}
        </Button>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <Table
            columns={columns}
            rows={filtered}
            rowKey={(c) => c.id}
            empty={copy.adminNoCourses}
          />
        )}
      </div>

      {editing && (
        <CourseFormModal
          initial={editing.input}
          isEdit={editing.id !== null}
          departmentOptions={departmentOptions}
          onCancel={() => setEditing(null)}
          onSaved={async (input) => {
            const api = getProvider().admin
            if (editing.id) await api.updateCourse(editing.id, input)
            else await api.createCourse(input)
            toast(copy.adminCourseSaved, 'success')
            setEditing(null)
            await load()
          }}
        />
      )}

      {deleting && (
        <DeleteCourseModal
          course={deleting}
          lectures={lectureCount.get(deleting.id) ?? 0}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await getProvider().admin.deleteCourse(deleting.id)
              toast(copy.adminCourseDeleted, 'success')
              setDeleting(null)
              await load()
            } catch (e) {
              toast(e instanceof Error ? e.message : copy.adminError, 'error')
            }
          }}
        />
      )}
    </div>
  )
}

// --- Create / edit form ----------------------------------------------------

function CourseFormModal({
  initial,
  isEdit,
  departmentOptions,
  onCancel,
  onSaved,
}: {
  initial: CourseInput
  isEdit: boolean
  departmentOptions: string[]
  onCancel: () => void
  onSaved: (input: CourseInput) => Promise<void>
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<CourseInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof CourseInput>(key: K, value: CourseInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function submit() {
    const err = validateCourseInput(form)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSaved(form)
    } catch (e) {
      // A duplicate name lands here: the title is unique because the timetable
      // import matches on it, and the server says so in its own words.
      setError(e instanceof Error ? e.message : copy.adminError)
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onCancel} labelledBy="course-form-title" className="max-w-[640px]">
      <div className="border-b border-line px-5 py-4">
        <h2 id="course-form-title" className="text-[17px] font-semibold text-ink">
          {isEdit ? copy.adminEditCourse : copy.adminNewCourse}
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
          {/* Semester drives the year of study, so setting one fills the
              other in rather than letting them contradict each other. */}
          <Select
            label="Semester"
            value={form.semester_number === null ? '' : String(form.semester_number)}
            onChange={(e) => {
              const sem = e.target.value ? Number(e.target.value) : null
              setForm((f) => ({
                ...f,
                semester_number: sem,
                study_year: sem === null ? f.study_year : Math.ceil(sem / 2),
              }))
            }}
            placeholder="None"
            options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
              value: String(n),
              label: `${n}ο εξάμηνο`,
            }))}
          />
          <Select
            label="Year of study"
            value={form.study_year === null ? '' : String(form.study_year)}
            onChange={(e) => set('study_year', e.target.value ? Number(e.target.value) : null)}
            placeholder="None"
            options={[1, 2, 3, 4].map((y) => ({ value: String(y), label: `Year ${y}` }))}
          />
          <Input
            label="ECTS"
            type="number"
            value={form.ects === null ? '' : String(form.ects)}
            onChange={(e) => set('ects', e.target.value ? Number(e.target.value) : null)}
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

// --- Delete ----------------------------------------------------------------

function DeleteCourseModal({
  course,
  lectures,
  onCancel,
  onConfirm,
}: {
  course: Course
  lectures: number
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  return (
    <Modal open onClose={onCancel} labelledBy="delete-course-title" className="max-w-[460px]">
      <div className="px-5 py-4">
        <h2 id="delete-course-title" className="text-[17px] font-semibold text-ink">
          {copy.adminDeleteCourseTitle}
        </h2>
        {/* The lecture count is the part that matters: deleting a course takes
            its lectures, and the students' calendar events, with it. */}
        <p className="mt-2 text-sm text-body">
          {copy.adminDeleteCourseBody(course.course_name, lectures)}
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
