import { useNow, useUpcoming } from '../../hooks/useUpcoming'
import { copy } from '../../lib/copy'
import type { ResolvedOccurrence } from '../../lib/occurrences'
import { formatToday, hhmm } from '../../lib/time'
import { Skeleton } from '../ui/Skeleton'
import { NextLectureCard } from './NextLectureCard'
import { UpcomingLectureCard } from './UpcomingLectureCard'

interface UpcomingSidebarProps {
  /**
   * This week resolved against the academic calendar, passed down from the
   * dashboard so the panel does not refetch what the grid already loaded. A
   * cancelled session is dropped from 'Today' rather than counted down to.
   */
  occurrences?: ResolvedOccurrence[]
}

/**
 * 'Today' panel (§8.2.2). Sits beside the grid on desktop, stacks below on
 * tablet, and becomes a horizontal card strip on mobile (§14).
 */
export function UpcomingSidebar({ occurrences }: UpcomingSidebarProps = {}) {
  const { upcoming, loading } = useUpcoming(occurrences)
  const now = useNow()

  return (
    <aside className="rounded-panel border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{copy.today}</h2>
        <span className="text-[13px] text-faded">{formatToday(now)}</span>
      </div>

      {loading || !upcoming ? (
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-[132px] rounded-card" />
          <Skeleton className="h-[46px] rounded-btn" />
          <Skeleton className="h-[46px] rounded-btn" />
        </div>
      ) : upcoming.next ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium tracking-[0.06em] text-faded uppercase">
            {copy.nextUp}
          </p>
          <NextLectureCard entry={upcoming.next} now={now} />

          {upcoming.laterToday.length > 0 && (
            <>
              <p className="mt-5 mb-2 text-[11px] font-medium tracking-[0.06em] text-faded uppercase">
                {copy.laterToday}
              </p>
              {/* Horizontal strip on mobile, stacked list from tablet up. */}
              <div className="no-scrollbar flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
                {upcoming.laterToday.map((entry) => (
                  <UpcomingLectureCard
                    key={entry.id}
                    entry={entry}
                    className="min-w-[200px] md:min-w-0"
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-[13px] text-faded">{copy.noMoreClasses}</p>
          {upcoming.nextOtherDay && (
            <p className="mt-3 text-[13px] text-body">
              Next: {upcoming.nextOtherDay.lecture.day_of_week},{' '}
              {hhmm(upcoming.nextOtherDay.lecture.start_time)} –{' '}
              {upcoming.nextOtherDay.lecture.course_name}
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
