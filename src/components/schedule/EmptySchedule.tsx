import { useNavigate } from 'react-router-dom'
import { copy } from '../../lib/copy'
import { Button } from '../ui/Button'
import { CalendarOutline } from '../ui/icons'

/** Shown when the user has no enrolled lectures (§8.2.1 "Empty State"). */
export function EmptySchedule() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-line bg-canvas px-6 py-20 text-center shadow-panel">
      <CalendarOutline className="h-10 w-10 text-line-strong" />
      <p className="mt-4 text-[15px] font-medium text-body">{copy.emptyTitle}</p>
      <p className="mt-1 text-[13px] text-faded">{copy.emptySubtitle}</p>
      <Button
        shape="pill"
        className="mt-5"
        onClick={() => navigate('/select-courses')}
      >
        {copy.emptyCta}
      </Button>
    </div>
  )
}
