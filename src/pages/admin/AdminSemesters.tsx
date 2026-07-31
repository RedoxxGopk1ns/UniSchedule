import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pill } from '../../components/ui/Pill'
import { Spinner } from '../../components/ui/Spinner'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { validateSemesterInput } from '../../lib/adminValidation'
import { getProvider } from '../../lib/data/provider'
import type { AdminSemester, SemesterInput } from '../../lib/data/types'
import { copy } from '../../lib/copy'

function blank(): SemesterInput {
  return { name: '', start_date: '', end_date: '', time_zone: 'Europe/Athens' }
}

export function AdminSemesters() {
  const { toast } = useToast()
  const [rows, setRows] = useState<AdminSemester[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ name: string | null; input: SemesterInput } | null>(null)
  const [deleting, setDeleting] = useState<AdminSemester | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRows(await getProvider().admin.listSemesters())
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

  async function setCurrent(name: string) {
    try {
      await getProvider().admin.setCurrentSemester(name)
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    }
  }

  const columns: Column<AdminSemester>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (s) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium text-ink">{s.name}</span>
          {s.is_current && <Pill>{copy.adminCurrent}</Pill>}
        </span>
      ),
    },
    { key: 'start', header: 'Start', render: (s) => s.start_date },
    { key: 'end', header: 'End', render: (s) => s.end_date },
    { key: 'count', header: 'Lectures', render: (s) => s.lecture_count, className: 'text-center' },
    {
      key: 'actions',
      header: '',
      className: 'text-right whitespace-nowrap',
      render: (s) => (
        <span className="inline-flex gap-1">
          {!s.is_current && (
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => setCurrent(s.name)}
            >
              {copy.adminSetCurrent}
            </Button>
          )}
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() =>
              setEditing({
                name: s.name,
                input: {
                  name: s.name,
                  start_date: s.start_date,
                  end_date: s.end_date,
                  time_zone: s.time_zone,
                },
              })
            }
          >
            {copy.adminEdit}
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs text-danger hover:text-danger"
            onClick={() => setDeleting(s)}
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
        <Button onClick={() => setEditing({ name: null, input: blank() })}>
          {copy.adminAddSemester}
        </Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading…
          </div>
        ) : (
          <Table columns={columns} rows={rows} rowKey={(s) => s.name} />
        )}
      </div>

      {editing && (
        <SemesterFormModal
          initial={editing.input}
          isEdit={editing.name !== null}
          onCancel={() => setEditing(null)}
          onSaved={async (input) => {
            const api = getProvider().admin
            if (editing.name) await api.updateSemester(editing.name, input)
            else await api.createSemester(input)
            toast(copy.adminSemesterSaved, 'success')
            setEditing(null)
            await load()
          }}
        />
      )}

      {deleting && (
        <Modal open onClose={() => setDeleting(null)} labelledBy="del-sem-title">
          <div className="px-5 py-5">
            <h2 id="del-sem-title" className="text-[17px] font-semibold text-ink">
              {copy.adminDeleteSemesterTitle}
            </h2>
            <p className="mt-2 text-sm text-body">{copy.adminDeleteSemesterBody(deleting.name)}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                {copy.adminCancel}
              </Button>
              <Button
                className="bg-danger text-white hover:bg-danger"
                onClick={async () => {
                  try {
                    await getProvider().admin.deleteSemester(deleting.name)
                    toast(copy.adminSemesterDeleted, 'success')
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

function SemesterFormModal({
  initial,
  isEdit,
  onCancel,
  onSaved,
}: {
  initial: SemesterInput
  isEdit: boolean
  onCancel: () => void
  onSaved: (input: SemesterInput) => Promise<void>
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<SemesterInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof SemesterInput>(key: K, value: SemesterInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function submit() {
    const err = validateSemesterInput(form)
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
    <Modal open onClose={onCancel} labelledBy="sem-form-title">
      <div className="border-b border-line px-5 py-4">
        <h2 id="sem-form-title" className="text-[17px] font-semibold text-ink">
          {isEdit ? copy.adminEditSemester : copy.adminNewSemester}
        </h2>
      </div>
      <div className="space-y-4 px-5 py-4">
        <Input
          label="Name"
          value={form.name}
          disabled={isEdit}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Spring 2026"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Start date (a Monday)"
            type="date"
            value={form.start_date}
            onChange={(e) => set('start_date', e.target.value)}
          />
          <Input
            label="End date"
            type="date"
            value={form.end_date}
            onChange={(e) => set('end_date', e.target.value)}
          />
        </div>
        <Input
          label="Time zone"
          value={form.time_zone}
          onChange={(e) => set('time_zone', e.target.value)}
        />
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
