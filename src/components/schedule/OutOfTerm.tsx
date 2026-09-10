import { useNavigate } from 'react-router-dom'
import { copy } from '../../lib/copy'
import { Button } from '../ui/Button'
import { CalendarOutline } from '../ui/icons'

/**
 * Shown in place of the grid when the student has courses but none of them are
 * taught this week, because the week falls outside their semester (§22).
 *
 * Deliberately not EmptySchedule: that one tells a student to add courses,
 * which is the wrong instruction when their selection is intact and it is
 * simply the summer. The call to action is a review, not a prompt to fix
 * something.
 */
export function OutOfTerm() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-line bg-canvas px-6 py-20 text-center shadow-panel">
      <CalendarOutline className="h-10 w-10 text-line-strong" />
      <p className="mt-4 text-[15px] font-medium text-body">{copy.outOfTermTitle}</p>
      <p className="mt-1 max-w-[380px] text-[13px] text-faded">
        {copy.outOfTermSubtitle}
      </p>
      <Button
        variant="outline"
        shape="pill"
        className="mt-5"
        onClick={() => navigate('/select-courses')}
      >
        {copy.outOfTermCta}
      </Button>
    </div>
  )
}
