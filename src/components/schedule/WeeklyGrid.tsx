import { useMemo, useState } from 'react'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { DAYS, type DayOfWeek, type ScheduleEntry } from '../../lib/data/types'
import { layoutWeek } from '../../lib/layout'
import type { ResolvedOccurrence } from '../../lib/occurrences'
import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  SLOT_COUNT,
  dayName,
  minutesOfDay,
} from '../../lib/time'
import { cn } from '../../lib/utils'
import { LectureBlock } from './LectureBlock'
import { LecturePopover } from './LecturePopover'

/** One 30-minute slot, in pixels. Must match --spacing-slot in globals.css. */
const SLOT_PX = 28
const AXIS_PX = 56
const HEADER_PX = 44

/**
 * A schedule entry, optionally carrying how this week's session differs from
 * the weekly pattern. `occurrencesToEntries` in src/lib/occurrences.ts attaches
 * it; the landing preview and the print view pass plain entries and get the
 * ordinary rendering.
 */
export type GridEntry = ScheduleEntry & { occurrence?: ResolvedOccurrence }

interface WeeklyGridProps {
  entries: GridEntry[]
  /** Disables clicks and the current-time marker — used by the landing preview. */
  preview?: boolean
  className?: string
}

interface PopoverState {
  entry: ScheduleEntry
  anchor: { top: number; left: number }
}

/**
 * The weekly schedule (§8.2.1): Monday–Friday columns, GRID_START_HOUR to
 * GRID_END_HOUR on a 30-minute time axis.
 *
 * Lectures are absolutely positioned rather than placed in grid cells, because
 * a lecture can start on a half hour and span an arbitrary duration; row
 * placement would force everything onto slot boundaries. `layoutWeek` handles
 * the geometry, including splitting overlapping blocks side by side.
 *
 * Below 768px this becomes a single-day view with pill tabs (§14).
 */
export function WeeklyGrid({ entries, preview = false, className }: WeeklyGridProps) {
  const isMobile = useIsMobile()
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [activeDay, setActiveDay] = useState<DayOfWeek>(
    () => dayName(new Date()) ?? 'Monday',
  )

  const positioned = useMemo(() => layoutWeek(entries, DAYS), [entries])
  const visibleDays = isMobile ? [activeDay] : DAYS

  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR },
    (_, i) => GRID_START_HOUR + i,
  )

  // Current-time marker, only while today is a weekday inside the window.
  const now = new Date()
  const todayName = dayName(now)
  const nowOffset = (minutesOfDay(now) - GRID_START_HOUR * 60) / 30
  const showNowLine =
    !preview && todayName !== null && nowOffset >= 0 && nowOffset <= SLOT_COUNT
  const nowLabel = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`

  const openPopover = (entry: ScheduleEntry, el: HTMLElement) => {
    if (preview) return
    const rect = el.getBoundingClientRect()
    setPopover({ entry, anchor: { top: rect.top, left: rect.right + 8 } })
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-panel border border-line bg-canvas shadow-panel',
        className,
      )}
    >
      {isMobile && !preview && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line-soft p-3">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setActiveDay(day)}
              aria-pressed={day === activeDay}
              className={cn(
                'rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors',
                day === activeDay
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-canvas text-body',
              )}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      <div
        role="grid"
        aria-label="Weekly lecture schedule"
        aria-rowcount={SLOT_COUNT}
        aria-colcount={visibleDays.length}
        className="overflow-x-auto"
      >
        <div style={{ minWidth: isMobile ? undefined : 640 }}>
          {/* Column headers */}
          <div
            role="row"
            className="grid border-b border-line-soft bg-surface"
            style={{
              gridTemplateColumns: `${AXIS_PX}px repeat(${visibleDays.length}, minmax(0, 1fr))`,
              height: HEADER_PX,
            }}
          >
            <div aria-hidden="true" />
            {visibleDays.map((day) => (
              <div
                key={day}
                role="columnheader"
                className="flex items-center justify-center text-[13px] font-medium tracking-[0.04em] text-muted uppercase"
              >
                {isMobile ? day : day.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Body */}
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `${AXIS_PX}px repeat(${visibleDays.length}, minmax(0, 1fr))`,
              height: SLOT_COUNT * SLOT_PX,
            }}
          >
            {/* Time axis */}
            <div className="relative border-r border-line-soft bg-surface">
              {hours.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[12px] text-faded tabular-nums"
                  style={{ top: i * 2 * SLOT_PX }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {visibleDays.map((day) => (
              <div
                key={day}
                role="gridcell"
                aria-label={day}
                className="relative border-r border-line-soft last:border-r-0"
              >
                {/* Slot lines: full hours are darker than half hours. */}
                {Array.from({ length: SLOT_COUNT }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'absolute right-0 left-0 border-t',
                      i % 2 === 0 ? 'border-line-soft' : 'border-line-faint',
                    )}
                    style={{ top: i * SLOT_PX, height: SLOT_PX }}
                  />
                ))}

                {/* Lectures */}
                {(positioned[day] ?? []).map((item) => {
                  const gutter = 3
                  const widthPct = 100 / item.columns
                  return (
                    <div
                      key={item.entry.id}
                      className="absolute"
                      style={{
                        top: item.top * SLOT_PX + 1,
                        height: item.height * SLOT_PX - 3,
                        left: `calc(${item.column * widthPct}% + ${gutter}px)`,
                        width: `calc(${widthPct}% - ${gutter * 2}px)`,
                      }}
                    >
                      <LectureBlock
                        entry={item.entry}
                        status={(item.entry as GridEntry).occurrence?.status}
                        interactive={!preview}
                        compact={item.height <= 2 || item.columns > 1}
                        onClick={
                          preview
                            ? undefined
                            : (e) => openPopover(item.entry, e.currentTarget)
                        }
                      />
                    </div>
                  )
                })}

                {/* Current time marker */}
                {showNowLine && day === todayName && (
                  <div
                    className="pointer-events-none absolute right-0 left-0 z-10 border-t border-ink"
                    style={{ top: nowOffset * SLOT_PX }}
                    aria-hidden="true"
                  >
                    <span className="absolute -top-[3px] -left-[3px] block h-1.5 w-1.5 rounded-full bg-ink" />
                    <span className="absolute top-0 left-1.5 -translate-y-1/2 rounded-sm bg-ink px-1 py-px text-[10px] leading-none font-medium text-white tabular-nums">
                      {nowLabel}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {popover && (
        <LecturePopover
          entry={popover.entry}
          anchor={popover.anchor}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  )
}
