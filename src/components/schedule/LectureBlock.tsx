import { forwardRef, type MouseEvent } from 'react'
import { copy } from '../../lib/copy'
import type { ScheduleEntry } from '../../lib/data/types'
import type { OccurrenceStatus } from '../../lib/occurrences'
import { hhmm, timeRange } from '../../lib/time'
import { cn } from '../../lib/utils'

interface LectureBlockProps {
  entry: ScheduleEntry
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  compact?: boolean
  interactive?: boolean
  /** How this week's session differs from the weekly pattern (§22). */
  status?: OccurrenceStatus
}

/** Short badge shown on a block whose session is not running as usual. */
const STATUS_LABEL: Record<Exclude<OccurrenceStatus, 'normal'>, string> = {
  cancelled: copy.occurrenceCancelled,
  'moved-out': copy.occurrenceMovedOut,
  'moved-in': copy.occurrenceMovedIn,
  'room-changed': copy.occurrenceRoomChanged,
  extra: copy.occurrenceExtra,
}

/**
 * A single positioned card inside the weekly grid (§8.2.1).
 *
 * The 3px left stripe is the block's only colour, taken from the lecture's
 * color_tag and falling back to black — the accent system for the whole app.
 *
 * A session that is cancelled or has been moved away keeps its slot, struck
 * through and dimmed: a student scanning Monday needs to see that the class is
 * off, and an empty space says nothing.
 */
export const LectureBlock = forwardRef<HTMLButtonElement, LectureBlockProps>(
  function LectureBlock(
    { entry, onClick, compact = false, interactive = true, status = 'normal' },
    ref,
  ) {
    const { lecture } = entry
    const stripe = lecture.color_tag ?? 'var(--color-ink)'
    const off = status === 'cancelled' || status === 'moved-out'
    const badge = status === 'normal' ? null : STATUS_LABEL[status]

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        tabIndex={interactive ? 0 : -1}
        aria-label={`${lecture.course_code} ${lecture.course_name}, ${lecture.day_of_week} ${timeRange(lecture.start_time, lecture.end_time)}, ${lecture.room ?? 'room to be announced'}${badge ? `, ${badge}` : ''}`}
        className={cn(
          'group flex h-full w-full flex-col overflow-hidden rounded-input border border-line bg-canvas px-2.5 py-2 text-left shadow-block transition-shadow duration-150',
          interactive && 'hover:shadow-block-hover',
          !interactive && 'cursor-default',
          off && 'border-dashed opacity-60',
        )}
        style={{ borderLeft: `3px solid ${stripe}` }}
      >
        <span
          className={cn(
            'truncate text-[11px] font-semibold tracking-[0.02em] text-ink uppercase',
            off && 'line-through',
          )}
        >
          {lecture.course_code}
        </span>

        {!compact && (
          <span
            className={cn(
              'truncate text-[13px] leading-4 font-medium text-ink',
              off && 'line-through',
            )}
          >
            {lecture.course_name}
          </span>
        )}

        {badge && (
          <span className="mt-0.5 truncate text-[10px] font-semibold tracking-[0.04em] text-muted uppercase">
            {badge}
          </span>
        )}

        <span className="mt-auto truncate text-[11px] text-faded">
          {compact
            ? hhmm(lecture.start_time)
            : `${lecture.room ?? '—'} · ${timeRange(lecture.start_time, lecture.end_time)}`}
        </span>
      </button>
    )
  },
)
