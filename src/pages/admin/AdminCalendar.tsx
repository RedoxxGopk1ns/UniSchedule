import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pill } from '../../components/ui/Pill'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { validateAcademicEventInput } from '../../lib/adminValidation'
import { copy } from '../../lib/copy'
import { getProvider } from '../../lib/data/provider'
import {
  ACADEMIC_EVENT_KINDS,
  type AcademicEvent,
  type AcademicEventInput,
  type AcademicEventKind,
  type AdminSemester,
} from '../../lib/data/types'

function blank(semester: string | null): AcademicEventInput {
  return {
    semester,
    kind: 'holiday',
    title: '',
    start_date: '',
    end_date: '',
    blocks_teaching: true,
  }
}

function toInput(event: AcademicEvent): AcademicEventInput {
  return {
    semester: event.semester,
    kind: event.kind,
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    blocks_teaching: event.blocks_teaching,
  }
}

/**
 * The academic calendar: holidays, breaks, exam periods and the term's date
 * markers.
 *
 * Entries with "cancels lectures" set are what produce the EXDATEs on students'
 * recurring Calendar events, so this screen is the one place where deleting a
 * row silently puts classes back on people's calendars — hence the wording in
 * the delete dialog.
 */
export function AdminCalendar() {
  const { toast } = useToast()
  const [rows, setRows] = useState<AcademicEvent[]>([])
  const [semesters, setSemesters] = useState<AdminSemester[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{
    id: string | null
    input: AcademicEventInput
  } | null>(null)
  const [deleting, setDeleting] = useState<AcademicEvent | null>(null)

  async function load() {
    setLoading(true)
    try {
      const api = getProvider().admin
      const [events, terms] = await Promise.all([api.listAcademicEvents(), api.listSemesters()])
      setRows(events)
      setSemesters(terms)
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

  const currentSemester = semesters.find((s) => s.is_current)?.name ?? null

  const columns: Column<AcademicEvent>[] = [
    {
      key: 'title',
      header: copy.adminEventTitle,
      render: (e) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium text-ink">{e.title}</span>
          {e.blocks_teaching && <Pill>{copy.adminBlocksTeaching}</Pill>}
        </span>
      ),
    },
    { key: 'kind', header: copy.adminEventKind, render: (e) => e.kind },
    {
      key: 'dates',
      header: copy.adminEventStart,
      render: (e) => (e.start_date === e.end_date ? e.start_date : `${e.start_date} – ${e.end_date}`),
    },
    {
      key: 'semester',
      header: copy.adminTabSemesters,
      render: (e) => e.semester ?? copy.adminEventWholeYear,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right whitespace-nowrap',
      render: (e) => (
        <span className="inline-flex gap-1">
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => setEditing({ id: e.id, input: toInput(e) })}
          >
            {copy.adminEdit}
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs text-danger hover:text-danger"
            onClick={() => setDeleting(e)}
          >
            {copy.adminDelete}
          </Button>
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ id: null, input: blank(currentSemester) })}>
          {copy.adminAddEvent}
        </Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading…
          </div>
        ) : (
          <Table columns={columns} rows={rows} rowKey={(e) => e.id} />
        )}
      </div>

      {editing && (
        <EventFormModal
          initial={editing.input}
          isEdit={editing.id !== null}
          semesters={semesters}
          onCancel={() => setEditing(null)}
          onSaved={async (input) => {
            const api = getProvider().admin
            if (editing.id) await api.updateAcademicEvent(editing.id, input)
            else await api.createAcademicEvent(input)
            toast(copy.adminEventSaved, 'success')
            setEditing(null)
            await load()
          }}
        />
      )}

      {deleting && (
        <Modal open onClose={() => setDeleting(null)} labelledBy="del-event-title">
          <div className="px-5 py-5">
            <h2 id="del-event-title" className="text-[17px] font-semibold text-ink">
              {copy.adminDeleteEventTitle}
            </h2>
            <p className="mt-2 text-sm text-body">
              {copy.adminDeleteEventBody(deleting.title)}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                {copy.adminCancel}
              </Button>
              <Button
                className="bg-danger text-white hover:bg-danger"
                onClick={async () => {
                  try {
                    await getProvider().admin.deleteAcademicEvent(deleting.id)
                    toast(copy.adminEventDeleted, 'success')
                    setDeleting(null)
                    await load()
                  } catch (e) {
                    toast(e instanceof Error ? e.message : copy.adminError, 'error')
                  }
                }}
              >
                {copy.adminDelete}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

interface EventFormModalProps {
  initial: AcademicEventInput
  isEdit: boolean
  semesters: AdminSemester[]
  onCancel: () => void
  onSaved: (input: AcademicEventInput) => Promise<void>
}

function EventFormModal({
  initial,
  isEdit,
  semesters,
  onCancel,
  onSaved,
}: EventFormModalProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<AcademicEventInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof AcademicEventInput>(key: K, value: AcademicEventInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function submit() {
    const err = validateAcademicEventInput(form)
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
    <Modal open onClose={onCancel} labelledBy="event-form-title">
      <div className="border-b border-line px-5 py-4">
        <h2 id="event-form-title" className="text-[17px] font-semibold text-ink">
          {isEdit ? copy.adminEditEvent : copy.adminNewEvent}
        </h2>
      </div>

      <div className="max-h-[65vh] space-y-3 overflow-y-auto px-5 py-4">
        <Input
          label={copy.adminEventTitle}
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
        />
        <Select
          label={copy.adminEventKind}
          value={form.kind}
          options={ACADEMIC_EVENT_KINDS.map((k) => ({ value: k, label: k }))}
          onChange={(e) => set('kind', e.target.value as AcademicEventKind)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={copy.adminEventStart}
            type="date"
            value={form.start_date}
            onChange={(e) => set('start_date', e.target.value)}
          />
          <Input
            label={copy.adminEventEnd}
            type="date"
            value={form.end_date}
            onChange={(e) => set('end_date', e.target.value)}
          />
        </div>
        <Select
          label={copy.adminTabSemesters}
          value={form.semester ?? ''}
          placeholder={copy.adminEventWholeYear}
          options={semesters.map((s) => ({ value: s.name, label: s.name }))}
          onChange={(e) => set('semester', e.target.value === '' ? null : e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.blocks_teaching}
            onChange={(e) => set('blocks_teaching', e.target.checked)}
          />
          {copy.adminBlocksTeaching}
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button variant="ghost" onClick={onCancel}>
          {copy.adminCancel}
        </Button>
        <Button loading={saving} onClick={submit}>
          {copy.adminSave}
        </Button>
      </div>
    </Modal>
  )
}
