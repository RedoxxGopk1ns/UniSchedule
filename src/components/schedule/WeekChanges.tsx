import { copy } from '../../lib/copy'
import type { ResolvedOccurrence } from '../../lib/occurrences'
import { timeRange } from '../../lib/time'

interface WeekChangesProps {
  changes: ResolvedOccurrence[]
}

/** One line explaining what happened to a session, in the student's terms. */
function describe(change: ResolvedOccurrence): string {
  const { entry, status } = change
  const where = `${change.day_of_week} ${timeRange(change.start_time, change.end_time)}`
  switch (status) {
    case 'cancelled':
      return `${copy.occurrenceCancelled} · ${where}`
    case 'moved-out':
      return `${copy.occurrenceMovedOut} · ${where}`
    case 'moved-in':
      return `${copy.occurrenceMovedIn} · ${where}`
    case 'room-changed':
      return `${copy.occurrenceRoomChanged} · ${change.room ?? '—'} · ${where}`
    case 'extra':
      return `${copy.occurrenceExtra} · ${where}`
    default:
      return `${entry.lecture.course_code} · ${where}`
  }
}

/**
 * A summary of everything that differs from the usual week (§22).
 *
 * Rendered above the grid rather than inside it, because a cancellation is
 * something a student needs to notice without hunting for a struck-through
 * block. It disappears entirely in an ordinary week.
 */
export function WeekChanges({ changes }: WeekChangesProps) {
  if (changes.length === 0) return null

  return (
    <section
      aria-label={copy.weekChangesTitle}
      className="mb-4 rounded-card border border-line bg-surface px-4 py-3"
    >
      <h2 className="text-[13px] font-semibold text-ink">
        {changes.length === 1 ? copy.weekChangesOne : copy.weekChangesMany(changes.length)}
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {changes.map((change) => (
          <li
            key={`${change.entry.id}@${change.date}:${change.status}`}
            className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-muted"
          >
            <span className="font-semibold tracking-[0.02em] text-ink uppercase">
              {change.entry.lecture.course_code}
            </span>
            <span>{describe(change)}</span>
            {change.note && <span className="text-faded">{change.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
