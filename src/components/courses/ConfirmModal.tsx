import { useMemo } from 'react'
import type { Lecture } from '../../lib/data/types'
import { detectConflicts } from '../../lib/conflicts'
import { copy } from '../../lib/copy'
import { timeRange } from '../../lib/time'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Pill } from '../ui/Pill'
import { ConflictWarning } from './ConflictWarning'

interface ConfirmModalProps {
  open: boolean
  lectures: Lecture[]
  syncing: boolean
  onClose: () => void
  onConfirm: () => void
  /** Summary of what will change, e.g. '2 added · 1 removed'. */
  changeSummary: string | null
}

/** Step 2 of course selection: review, warn about clashes, then sync (§8.4). */
export function ConfirmModal({
  open,
  lectures,
  syncing,
  onClose,
  onConfirm,
  changeSummary,
}: ConfirmModalProps) {
  const conflicts = useMemo(() => detectConflicts(lectures), [lectures])

  return (
    <Modal open={open} onClose={syncing ? () => {} : onClose} labelledBy="confirm-title">
      <div className="border-b border-line-soft px-6 pt-6 pb-5">
        <h2 id="confirm-title" className="text-[22px] font-semibold text-ink">
          {copy.reviewTitle}
        </h2>
        <p className="mt-1 text-sm text-muted">{copy.reviewSubtitle}</p>
        {changeSummary && (
          <p className="mt-2 text-[13px] text-faded">{changeSummary}</p>
        )}
      </div>

      <div className="max-h-[46vh] overflow-y-auto px-6 py-4">
        {conflicts.length > 0 && (
          <div className="mb-4">
            <ConflictWarning conflicts={conflicts} />
          </div>
        )}

        <ul className="divide-y divide-line-faint">
          {lectures.map((lecture) => (
            <li key={lecture.id} className="flex items-center gap-3 py-2.5">
              <Pill className="shrink-0">{lecture.course_code}</Pill>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {lecture.course_name}
                </span>
                <span className="block truncate text-[12px] text-faded">
                  {lecture.professor}
                </span>
              </span>
              <span className="shrink-0 text-[12px] text-muted">
                {lecture.day_of_week.slice(0, 3)}{' '}
                {timeRange(lecture.start_time, lecture.end_time)}
              </span>
            </li>
          ))}
        </ul>

        {lectures.length === 0 && (
          <p className="py-6 text-center text-[13px] text-faded">
            Your schedule will be empty. All existing lectures will be removed from
            your Google Calendar.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line-soft px-6 py-4">
        <Button variant="ghost" onClick={onClose} disabled={syncing} className="px-1">
          ← {copy.back}
        </Button>
        <Button onClick={onConfirm} loading={syncing}>
          {syncing ? copy.syncing : copy.confirmSync}
        </Button>
      </div>
    </Modal>
  )
}
