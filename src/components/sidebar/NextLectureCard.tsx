import type { ScheduleEntry } from '../../lib/data/types'
import { countdownLabel, minutesOfDay, timeRange, toMinutes } from '../../lib/time'
import { Pill } from '../ui/Pill'
import { ClockIcon, PinIcon } from '../ui/icons'

interface NextLectureCardProps {
  entry: ScheduleEntry
  /** Passed in from a ticking clock so the countdown stays live (§8.2.2). */
  now: Date
}

/** The highlighted 'Next up' card at the top of the sidebar. */
export function NextLectureCard({ entry, now }: NextLectureCardProps) {
  const { lecture } = entry
  const minutesUntil = toMinutes(lecture.start_time) - minutesOfDay(now)
  const inProgress = minutesUntil <= 0

  return (
    <article className="rounded-card border border-line bg-canvas p-3.5 shadow-raised">
      <p className="text-[14px] leading-5 font-semibold text-ink">
        {lecture.course_name}
      </p>
      <p className="mt-0.5 text-[12px] text-muted">{lecture.professor}</p>

      <div className="mt-3 space-y-1.5">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <ClockIcon className="h-3.5 w-3.5 text-faded" />
          {timeRange(lecture.start_time, lecture.end_time)}
        </p>
        <p className="flex items-center gap-1.5 text-[12px] text-faded">
          <PinIcon className="h-3.5 w-3.5" />
          {lecture.room ?? '—'}
        </p>
      </div>

      <Pill className="mt-3">
        {inProgress ? 'In progress' : countdownLabel(minutesUntil)}
      </Pill>
    </article>
  )
}
