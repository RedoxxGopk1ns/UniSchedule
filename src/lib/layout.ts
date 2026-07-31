import type { DayOfWeek, ScheduleEntry } from './data/types'
import { slotOffset, slotSpan, toMinutes } from './time'

export interface PositionedLecture {
  entry: ScheduleEntry
  /** Distance from the top of the grid, in slots. */
  top: number
  /** Height, in slots. */
  height: number
  /** 0-based column within its overlap cluster. */
  column: number
  /** How many columns the cluster was split into. */
  columns: number
}

/**
 * Lays out one day's lectures.
 *
 * Overlapping blocks are grouped into clusters and split side by side, so a
 * clash stays legible instead of one card hiding another. A cluster is a run of
 * lectures where each one starts before the running maximum end time.
 */
export function layoutDay(entries: ScheduleEntry[]): PositionedLecture[] {
  const sorted = [...entries].sort(
    (a, b) =>
      toMinutes(a.lecture.start_time) - toMinutes(b.lecture.start_time) ||
      toMinutes(a.lecture.end_time) - toMinutes(b.lecture.end_time),
  )

  const out: PositionedLecture[] = []
  let cluster: ScheduleEntry[] = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return

    // Greedy column packing: reuse the first column whose last block has ended.
    const columnEnds: number[] = []
    const placed = cluster.map((entry) => {
      const start = toMinutes(entry.lecture.start_time)
      const end = toMinutes(entry.lecture.end_time)
      let col = columnEnds.findIndex((e) => e <= start)
      if (col === -1) {
        col = columnEnds.length
        columnEnds.push(end)
      } else {
        columnEnds[col] = end
      }
      return { entry, col }
    })

    for (const { entry, col } of placed) {
      out.push({
        entry,
        top: slotOffset(entry.lecture.start_time),
        height: slotSpan(entry.lecture.start_time, entry.lecture.end_time),
        column: col,
        columns: columnEnds.length,
      })
    }

    cluster = []
    clusterEnd = -1
  }

  for (const entry of sorted) {
    const start = toMinutes(entry.lecture.start_time)
    if (cluster.length > 0 && start >= clusterEnd) flush()
    cluster.push(entry)
    clusterEnd = Math.max(clusterEnd, toMinutes(entry.lecture.end_time))
  }
  flush()

  return out
}

/** Groups a schedule into Monday–Friday buckets, each already positioned. */
export function layoutWeek(
  entries: ScheduleEntry[],
  days: DayOfWeek[],
): Record<string, PositionedLecture[]> {
  const byDay: Record<string, PositionedLecture[]> = {}
  for (const day of days) {
    byDay[day] = layoutDay(entries.filter((e) => e.lecture.day_of_week === day))
  }
  return byDay
}
