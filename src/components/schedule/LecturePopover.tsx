import { useEffect, useRef } from 'react'
import { useSchedule } from '../../hooks/useSchedule'
import type { ScheduleEntry } from '../../lib/data/types'
import { copy } from '../../lib/copy'
import { timeRange } from '../../lib/time'
import { useToast } from '../ui/Toast'
import { ArrowUpRight, CloseIcon } from '../ui/icons'

interface LecturePopoverProps {
  entry: ScheduleEntry
  onClose: () => void
  /** Anchor position in viewport coordinates. */
  anchor: { top: number; left: number }
}

/**
 * Detail card shown on clicking a lecture block (§8.2.1).
 *
 * Positioned fixed against the trigger's rect and clamped to the viewport so it
 * never hangs off the right edge on a narrow window.
 */
export function LecturePopover({ entry, onClose, anchor }: LecturePopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { lecture } = entry
  const { entries, sync } = useSchedule()
  const { toast } = useToast()

  // Quick delete: drop the whole course (every enrolled section sharing this
  // code, e.g. a lecture and its lab), matching mark-as-passed. The store
  // re-reads the schedule after syncing, so the grid and sidebar update on their
  // own; the popover just closes.
  const handleRemove = async () => {
    onClose()
    const sections = entries.filter(
      (e) => e.lecture.course_code === lecture.course_code,
    )
    // `entry` is itself one of `entries`, so this is never empty.
    const to_remove = (sections.length > 0 ? sections : [entry]).map((e) => ({
      lecture_id: e.lecture_id,
      google_event_id: e.google_event_id,
    }))
    const result = await sync({ to_add: [], to_remove })
    if (!result.success) {
      toast(result.errors[0]?.message ?? copy.syncError, 'error')
      return
    }
    toast(copy.courseRemoved(lecture.course_code), 'success')
  }

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const width = 240
  const left = Math.min(anchor.left, window.innerWidth - width - 12)
  const top = Math.min(anchor.top, window.innerHeight - 200)

  const calendarUrl = entry.google_event_id
    ? `https://calendar.google.com/calendar/u/0/r/eventedit/${entry.google_event_id}`
    : 'https://calendar.google.com/calendar/u/0/r/week'

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${lecture.course_name} details`}
      className="animate-pop-in fixed z-80 rounded-card border border-line bg-canvas p-3.5 shadow-pop"
      style={{ top, left: Math.max(12, left), width }}
    >
      <p className="text-[13px] leading-4 font-semibold text-ink">
        {lecture.course_name}
      </p>
      <p className="mt-0.5 text-[11px] font-medium tracking-[0.02em] text-faded uppercase">
        {lecture.course_code}
      </p>

      <dl className="mt-3 space-y-1.5 text-[12px]">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-faded">Professor</dt>
          <dd className="text-body">{lecture.professor}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-faded">Room</dt>
          <dd className="text-body">{lecture.room ?? '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-faded">Time</dt>
          <dd className="text-body">
            {lecture.day_of_week}, {timeRange(lecture.start_time, lecture.end_time)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-col gap-2 border-t border-line-soft pt-2.5">
        <a
          href={calendarUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 self-start rounded text-[12px] font-medium text-ink transition-opacity hover:opacity-70"
        >
          {copy.viewInCalendar}
          <ArrowUpRight className="h-3 w-3" />
        </a>
        <button
          type="button"
          onClick={handleRemove}
          className="inline-flex items-center gap-1 self-start rounded text-[12px] font-medium text-muted transition-colors hover:text-ink"
        >
          <CloseIcon className="h-3 w-3" />
          {copy.removeCourse}
        </button>
      </div>
    </div>
  )
}
