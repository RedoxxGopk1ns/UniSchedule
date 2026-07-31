import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { validateOverrideInput } from '../../lib/adminValidation'
import { copy } from '../../lib/copy'
import { getProvider } from '../../lib/data/provider'
import type {
  AdminSemester,
  Lecture,
  LectureOverride,
  OverrideInput,
  OverrideKind,
} from '../../lib/data/types'
import { occurrenceDatesFor } from '../../lib/occurrences'
import { timeRange } from '../../lib/time'

const KIND_LABELS: { value: OverrideKind; label: string }[] = [
  { value: 'cancelled', label: copy.adminOverrideKindCancelled },
  { value: 'moved', label: copy.adminOverrideKindMoved },
  { value: 'room_change', label: copy.adminOverrideKindRoom },
  { value: 'extra', label: copy.adminOverrideKindExtra },
]

function blank(lecture: Lecture, firstDate: string): OverrideInput {
  return {
    lecture_id: lecture.id,
    kind: 'cancelled',
    occurrence_date: firstDate,
    new_date: null,
    new_start_time: null,
    new_end_time: null,
    new_room: null,
    note: null,
  }
}

interface LectureOverridesModalProps {
  lecture: Lecture
  semesters: AdminSemester[]
  onClose: () => void
}

/**
 * Per-occurrence changes to one lecture (§22).
 *
 * Scoped to a single lecture rather than given its own admin tab, because a
 * change is always *about* a lecture — "cancel the 16th of March" only means
 * something once you know which class.
 *
 * Saving a change and pushing it to students' calendars are two separate
 * actions on purpose: an admin drafting next month's timetable should not
 * silently rewrite thirty people's Google Calendars as they type.
 */
export function LectureOverridesModal({
  lecture,
  semesters,
  onClose,
}: LectureOverridesModalProps) {
  const { toast } = useToast()
  const [rows, setRows] = useState<LectureOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string | null; input: OverrideInput } | null>(
    null,
  )
  const [publishing, setPublishing] = useState<string | null>(null)

  const semester = semesters.find((s) => s.name === lecture.semester)

  // The dates this lecture actually runs, so a change can only be attached to a
  // real session rather than to an arbitrary date.
  const sessionDates = useMemo(
    () =>
      semester
        ? occurrenceDatesFor(semester.start_date, semester.end_date, lecture.day_of_week)
        : [],
    [semester, lecture.day_of_week],
  )

  async function load() {
    setLoading(true)
    try {
      const all = await getProvider().admin.listOverrides(lecture.semester)
      setRows(all.filter((o) => o.lecture_id === lecture.id))
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture.id])

  async function publish(id: string) {
    setPublishing(id)
    try {
      const result = await getProvider().admin.publishOverride(id)
      toast(
        copy.adminOverridePublished(result.users_updated, result.errors.length),
        result.errors.length ? 'warning' : 'success',
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    } finally {
      setPublishing(null)
    }
  }

  async function remove(row: LectureOverride) {
    try {
      await getProvider().admin.deleteOverride(row.id)
      toast(copy.adminOverrideDeleted, 'success')
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : copy.adminError, 'error')
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="overrides-title" className="max-w-[720px]">
      <div className="border-b border-line px-5 py-4">
        <h2 id="overrides-title" className="text-[17px] font-semibold text-ink">
          {copy.adminOverridesFor(lecture.course_code)}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {lecture.course_name} · {lecture.day_of_week}{' '}
          {timeRange(lecture.start_time, lecture.end_time)}
        </p>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading…
          </div>
        ) : sessionDates.length === 0 ? (
          <p className="text-sm text-muted">{copy.adminOverrideNoSessions}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {KIND_LABELS.find((k) => k.value === row.kind)?.label ?? row.kind}
                    </p>
                    <p className="text-[13px] text-muted">
                      {row.occurrence_date}
                      {row.new_date && ` → ${row.new_date}`}
                      {row.new_start_time &&
                        row.new_end_time &&
                        ` · ${timeRange(row.new_start_time, row.new_end_time)}`}
                      {row.new_room && ` · ${row.new_room}`}
                    </p>
                    {row.note && <p className="text-[13px] text-faded">{row.note}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      loading={publishing === row.id}
                      onClick={() => publish(row.id)}
                    >
                      {copy.adminOverridePublish}
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => setEditing({ id: row.id, input: toInput(row) })}
                    >
                      {copy.adminEdit}
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs text-danger hover:text-danger"
                      onClick={() => remove(row)}
                    >
                      {copy.adminDelete}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {editing ? (
              <OverrideForm
                lecture={lecture}
                sessionDates={sessionDates}
                semester={semester}
                initial={editing.input}
                onCancel={() => setEditing(null)}
                onSaved={async (input) => {
                  const api = getProvider().admin
                  if (editing.id) await api.updateOverride(editing.id, input)
                  else await api.createOverride(input)
                  toast(copy.adminOverrideSaved, 'success')
                  setEditing(null)
                  await load()
                }}
              />
            ) : (
              <div className="mt-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditing({ id: null, input: blank(lecture, sessionDates[0]!) })
                  }
                >
                  {copy.adminAddOverride}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end border-t border-line px-5 py-4">
        <Button variant="ghost" onClick={onClose}>
          {copy.adminCancel}
        </Button>
      </div>
    </Modal>
  )
}

function toInput(row: LectureOverride): OverrideInput {
  return {
    lecture_id: row.lecture_id,
    kind: row.kind,
    occurrence_date: row.occurrence_date,
    new_date: row.new_date,
    new_start_time: row.new_start_time,
    new_end_time: row.new_end_time,
    new_room: row.new_room,
    note: row.note,
  }
}

interface OverrideFormProps {
  lecture: Lecture
  sessionDates: string[]
  semester: AdminSemester | undefined
  initial: OverrideInput
  onCancel: () => void
  onSaved: (input: OverrideInput) => Promise<void>
}

function OverrideForm({
  lecture,
  sessionDates,
  semester,
  initial,
  onCancel,
  onSaved,
}: OverrideFormProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<OverrideInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof OverrideInput>(key: K, value: OverrideInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  /** Switching kind pre-fills the fields that kind requires. */
  function setKind(kind: OverrideKind) {
    setForm((f) => ({
      ...f,
      kind,
      new_date: kind === 'moved' ? (f.new_date ?? f.occurrence_date) : null,
      new_start_time:
        kind === 'moved' || kind === 'extra'
          ? (f.new_start_time ?? lecture.start_time.slice(0, 5))
          : null,
      new_end_time:
        kind === 'moved' || kind === 'extra'
          ? (f.new_end_time ?? lecture.end_time.slice(0, 5))
          : null,
      new_room: kind === 'cancelled' ? null : f.new_room,
    }))
  }

  async function submit() {
    const err = validateOverrideInput(form)
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

  const needsTime = form.kind === 'moved' || form.kind === 'extra'

  return (
    <div className="mt-4 rounded-card border border-line p-4">
      <div className="space-y-3">
        <Select
          label={copy.adminOverrideKind}
          value={form.kind}
          options={KIND_LABELS}
          onChange={(e) => setKind(e.target.value as OverrideKind)}
        />

        {/* An 'extra' session can fall on any day; every other kind replaces a
            session that the weekly pattern actually produces. */}
        {form.kind === 'extra' ? (
          <Input
            label={copy.adminOverrideDate}
            type="date"
            min={semester?.start_date}
            max={semester?.end_date}
            value={form.occurrence_date}
            onChange={(e) => set('occurrence_date', e.target.value)}
          />
        ) : (
          <Select
            label={copy.adminOverrideDate}
            value={form.occurrence_date}
            options={sessionDates.map((d) => ({ value: d, label: d }))}
            onChange={(e) => set('occurrence_date', e.target.value)}
          />
        )}

        {form.kind === 'moved' && (
          <Input
            label={copy.adminOverrideNewDate}
            type="date"
            min={semester?.start_date}
            max={semester?.end_date}
            value={form.new_date ?? ''}
            onChange={(e) => set('new_date', e.target.value || null)}
          />
        )}

        {needsTime && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={copy.adminOverrideNewStart}
              type="time"
              value={form.new_start_time ?? ''}
              onChange={(e) => set('new_start_time', e.target.value || null)}
            />
            <Input
              label={copy.adminOverrideNewEnd}
              type="time"
              value={form.new_end_time ?? ''}
              onChange={(e) => set('new_end_time', e.target.value || null)}
            />
          </div>
        )}

        {form.kind !== 'cancelled' && (
          <Input
            label={copy.adminOverrideNewRoom}
            value={form.new_room ?? ''}
            placeholder={lecture.room ?? undefined}
            onChange={(e) => set('new_room', e.target.value || null)}
          />
        )}

        <Input
          label={copy.adminOverrideNote}
          value={form.note ?? ''}
          onChange={(e) => set('note', e.target.value || null)}
        />

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {copy.adminCancel}
        </Button>
        <Button loading={saving} onClick={submit}>
          {copy.adminSave}
        </Button>
      </div>
    </div>
  )
}
