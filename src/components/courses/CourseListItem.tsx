import type { Lecture } from '../../lib/data/types'
import { copy } from '../../lib/copy'
import { hhmm, timeRange } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { Pill } from '../ui/Pill'

interface CourseListItemProps {
  lecture: Lecture
  checked: boolean
  onToggle: () => void
  /**
   * True when another lecture in the catalogue shares this course code. Those
   * rows are otherwise identical at a glance — same pill, same course name —
   * so the section marker next to the code is what stops a misclick.
   */
  multiSection?: boolean
  /** True when this row overlaps another *selected* lecture. */
  conflicted?: boolean
  /**
   * When set, a "Mark as passed" action is revealed at the trailing edge on
   * hover/focus. Rendered as a sibling of the row button, never nested inside
   * it, so the two controls stay independently clickable and accessible.
   */
  onMarkPassed?: () => void
  /**
   * When set, the row is a read-only passed-course entry (the review view): no
   * checkbox, no selection, just the course and a "Restore" action. Takes
   * precedence over the normal selectable rendering.
   */
  onRestore?: () => void
}

/**
 * One course row. In the normal catalogue the whole 56px row is the select
 * hit target (§8.3); in the passed-courses review it becomes a static row with
 * a Restore action instead.
 */
export function CourseListItem({
  lecture,
  checked,
  onToggle,
  multiSection = false,
  conflicted = false,
  onMarkPassed,
  onRestore,
}: CourseListItemProps) {
  const slot = `${lecture.day_of_week}, ${timeRange(lecture.start_time, lecture.end_time)}`

  const meta = (
    <>
      <span className="flex shrink-0 items-center gap-1.5">
        <Pill className="tracking-[0.02em]">{lecture.course_code}</Pill>
        {multiSection && (
          <span className="whitespace-nowrap text-[11px] font-medium text-faded tabular-nums">
            {lecture.day_of_week.slice(0, 3)} {hhmm(lecture.start_time)}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {lecture.course_name}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-faded sm:hidden">
          {slot}
        </span>
      </span>

      <span className="hidden shrink-0 text-[13px] text-muted sm:block sm:w-44">
        {slot}
      </span>

      <span className="hidden shrink-0 truncate text-[13px] text-faded lg:block lg:w-40">
        {lecture.professor}
      </span>

      <span className="hidden shrink-0 truncate text-[12px] text-faded xl:block xl:w-44">
        {lecture.room}
      </span>
    </>
  )

  // Passed-course review row: static, no checkbox, a Restore button at the end.
  if (onRestore) {
    return (
      <div className="flex w-full items-center gap-3 border-b border-line-faint px-4 py-2.5 min-h-14">
        {meta}
        <Button
          variant="outline"
          shape="pill"
          onClick={onRestore}
          className="shrink-0 px-3 py-1 text-[13px]"
        >
          {copy.restoreCourse}
        </Button>
      </div>
    )
  }

  const row = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${lecture.course_code} — ${lecture.course_name}, ${slot}${
        conflicted ? ' (conflicts with another selected course)' : ''
      }`}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 border-b border-line-faint px-4 text-left transition-colors',
        'min-h-14 py-2.5 hover:bg-surface',
        conflicted && 'bg-warn-surface/60 hover:bg-warn-surface',
        onMarkPassed && 'pr-32',
      )}
    >
      <Checkbox checked={checked} />
      {meta}
    </button>
  )

  if (!onMarkPassed) return row

  return (
    <div className="group relative">
      {row}
      <button
        type="button"
        onClick={onMarkPassed}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-pill border border-line bg-canvas px-3 py-1 text-[13px] font-medium text-body shadow-btn-hover transition-opacity hover:border-line-strong opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      >
        {copy.markPassed}
      </button>
    </div>
  )
}
