import type { ScheduleEntry } from '../../lib/data/types'
import { hhmm } from '../../lib/time'
import { cn } from '../../lib/utils'

/** Compact 'Later today' row (§8.2.2). */
export function UpcomingLectureCard({
  entry,
  className,
}: {
  entry: ScheduleEntry
  className?: string
}) {
  const { lecture } = entry

  return (
    <article
      className={cn(
        'flex items-center gap-3 rounded-btn border border-line-soft bg-canvas px-3 py-2.5',
        className,
      )}
    >
      <span className="shrink-0 text-[13px] font-semibold text-ink tabular-nums">
        {hhmm(lecture.start_time)}
      </span>
      <span className="truncate text-[13px] font-medium text-body">
        {lecture.course_name}
      </span>
    </article>
  )
}
