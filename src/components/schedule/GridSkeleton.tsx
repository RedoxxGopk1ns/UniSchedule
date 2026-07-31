import { SLOT_COUNT } from '../../lib/time'
import { Skeleton } from '../ui/Skeleton'

/**
 * Loading placeholder for the weekly grid (§13): shimmer blocks at plausible
 * positions rather than a spinner, so the layout does not shift when real data
 * arrives.
 */

/** [column, topSlot, spanSlots] — a believable-looking week. */
const BLOCKS: [number, number, number][] = [
  [0, 4, 3],
  [0, 9, 4],
  [1, 6, 3],
  [1, 14, 4],
  [2, 4, 4],
  [2, 10, 3],
  [3, 5, 4],
  [3, 15, 5],
  [4, 7, 4],
]

const SLOT_PX = 28

export function GridSkeleton() {
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-canvas shadow-panel">
      <div
        className="grid border-b border-line-soft bg-surface"
        style={{ gridTemplateColumns: `56px repeat(5, minmax(0, 1fr))`, height: 44 }}
      >
        <div />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center justify-center">
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>

      <div
        className="relative grid"
        style={{
          gridTemplateColumns: `56px repeat(5, minmax(0, 1fr))`,
          height: SLOT_COUNT * SLOT_PX,
        }}
      >
        <div className="relative border-r border-line-soft bg-surface">
          {Array.from({ length: 13 }, (_, i) => (
            <Skeleton
              key={i}
              className="absolute right-2 h-2.5 w-8"
              style={{ top: i * 2 * SLOT_PX - 5 }}
            />
          ))}
        </div>

        {Array.from({ length: 5 }, (_, col) => (
          <div key={col} className="relative border-r border-line-soft last:border-r-0">
            {Array.from({ length: SLOT_COUNT }, (_, i) => (
              <div
                key={i}
                className="absolute right-0 left-0 border-t border-line-faint"
                style={{ top: i * SLOT_PX, height: SLOT_PX }}
              />
            ))}
            {BLOCKS.filter(([c]) => c === col).map(([, top, span], i) => (
              <Skeleton
                key={i}
                className="absolute right-[3px] left-[3px] rounded-input"
                style={{ top: top * SLOT_PX + 1, height: span * SLOT_PX - 3 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
