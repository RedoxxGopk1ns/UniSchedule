import { useNow } from '../../hooks/useUpcoming'
import { copy } from '../../lib/copy'
import type { AcademicEvent, AcademicEventKind } from '../../lib/data/types'
import { upcomingTermEvents } from '../../lib/occurrences'
import { formatEventRange } from '../../lib/time'
import { Skeleton } from '../ui/Skeleton'

const KIND_LABELS: Record<AcademicEventKind, string> = {
  holiday: copy.eventKindHoliday,
  break: copy.eventKindBreak,
  exam_period: copy.eventKindExamPeriod,
  makeup_week: copy.eventKindMakeupWeek,
  teaching_start: copy.eventKindTeachingStart,
  teaching_end: copy.eventKindTeachingEnd,
  presentations: copy.eventKindPresentations,
  other: copy.eventKindOther,
}

interface TermCalendarProps {
  /**
   * The academic calendar, passed down from the dashboard so the panel does not
   * refetch what `useWeek` already loaded for the grid.
   */
  events: AcademicEvent[]
  loading?: boolean
}

/**
 * What is coming in the term (§22): the next few holidays, breaks, exam periods
 * and teaching boundaries.
 *
 * The grid already explains an empty Thursday — `resolveWeek` marks the session
 * cancelled and hands `WeekChanges` the holiday's title. What it cannot do is
 * look further than the week on screen, so a student had no way to see the
 * Easter break or the start of the exam period until the week it arrived. This
 * panel is that view, and it costs no extra request.
 *
 * It renders whether or not the student has picked any courses: the academic
 * calendar belongs to the department, not to a selection.
 */
export function TermCalendar({ events, loading = false }: TermCalendarProps) {
  // The same five-minute tick the 'Today' panel runs on, so an entry that ends
  // overnight drops off without a reload.
  const now = useNow()
  const entries = upcomingTermEvents(events, now)

  return (
    <aside className="rounded-panel border border-line bg-surface p-5">
      <h2 className="text-[15px] font-semibold text-ink">{copy.termTitle}</h2>

      {loading ? (
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-[38px] rounded-btn" />
          <Skeleton className="h-[38px] rounded-btn" />
          <Skeleton className="h-[38px] rounded-btn" />
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-[13px] text-faded">{copy.termEmpty}</p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {entries.map(({ event, current }) => (
            <li key={event.id} className="flex gap-3">
              <span className="w-[74px] shrink-0 text-[12px] tabular-nums text-muted">
                {formatEventRange(event.start_date, event.end_date)}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-body">{event.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.06em] text-faded uppercase">
                  {KIND_LABELS[event.kind]}
                  {current && (
                    <span className="rounded-pill bg-subtle px-1.5 py-0.5 text-ink">
                      {copy.termNow}
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
