import type { Conflict } from '../../lib/conflicts'
import { describeConflict } from '../../lib/conflicts'
import { WarningTriangle } from '../ui/icons'

/**
 * Amber advisory card (§8.4). Deliberately non-blocking: a student may have a
 * genuine reason to double-book, and the app should not decide otherwise.
 */
export function ConflictWarning({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null

  return (
    <div className="flex gap-2.5 rounded-btn border border-warn-line bg-warn-surface p-3">
      <WarningTriangle className="mt-px h-4 w-4 shrink-0 text-warn" />
      <div className="min-w-0 space-y-1">
        {conflicts.map((c, i) => (
          <p key={i} className="text-[13px] leading-5 text-body">
            Conflict detected: {describeConflict(c)}
          </p>
        ))}
      </div>
    </div>
  )
}
