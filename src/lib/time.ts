import type { DayOfWeek } from './data/types'
import { DAYS } from './data/types'

/** First slot rendered by the weekly grid (§8.2.1). */
export const GRID_START_HOUR = 7
/**
 * Last slot boundary — 23:00 is the bottom edge, not a row.
 *
 * Widened from 20:00 to cover the university's evening lectures. Everything
 * downstream (SLOT_COUNT, the grid rows, the hour gutter, the print window,
 * admin validation) derives from this pair, so the timetable is moved by
 * editing these two numbers and nothing else. The one place that must be kept
 * in step by hand is supabase/functions/admin/index.ts, which re-checks the
 * bounds server-side and cannot import from here.
 */
export const GRID_END_HOUR = 23
/** Grid resolution: one row per 30 minutes. */
export const SLOT_MINUTES = 30
export const SLOT_COUNT = ((GRID_END_HOUR - GRID_START_HOUR) * 60) / SLOT_MINUTES

/**
 * Matches a 24-hour wall-clock time, with optional seconds so Postgres `time`
 * values ('09:30:00') pass as readily as form input ('09:30').
 */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** True for a well-formed 'HH:MM' / 'HH:MM:SS' in 00:00–23:59. */
export function isValidTime(time: string): boolean {
  return TIME_PATTERN.test(time)
}

/**
 * '09:30' | '09:30:00' -> 570 (minutes since midnight); NaN for anything that
 * is not a real clock time.
 *
 * Returning NaN rather than a best-effort number is deliberate: the previous
 * version turned '' into 0 and 'abc' into NaN, so an empty time silently
 * rendered as midnight while a garbage one slipped past `end <= start` checks
 * (every comparison against NaN is false). Callers that need to reject bad
 * input should use isValidTime, which says so explicitly.
 */
export function toMinutes(time: string): number {
  if (!isValidTime(time)) return Number.NaN
  const [h, m] = time.split(':')
  return Number(h) * 60 + Number(m)
}

/** 570 -> '09:30' */
export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Normalises a Postgres `time` ('09:30:00') to display form ('09:30'). */
export function hhmm(time: string): string {
  return time.slice(0, 5)
}

/** '09:00' + '10:30' -> '09:00–10:30' (en dash, per §8.3 microcopy). */
export function timeRange(start: string, end: string): string {
  return `${hhmm(start)}–${hhmm(end)}`
}

/** 'HH:MM' for the first and last instants the weekly grid can display. */
export const GRID_START_TIME = fromMinutes(GRID_START_HOUR * 60)
export const GRID_END_TIME = fromMinutes(GRID_END_HOUR * 60)

/**
 * Whether a lecture fits the rendered grid. Outside it there is no row to draw
 * on: slotOffset would place the block above the top or below the bottom, and
 * nothing downstream clamps. Widening the timetable means moving
 * GRID_START_HOUR / GRID_END_HOUR, not bypassing this check.
 */
export function isWithinGrid(start: string, end: string): boolean {
  if (!isValidTime(start) || !isValidTime(end)) return false
  return (
    toMinutes(start) >= GRID_START_HOUR * 60 && toMinutes(end) <= GRID_END_HOUR * 60
  )
}

/** Fractional slot offset from the top of the grid. Drives absolute positioning. */
export function slotOffset(time: string): number {
  return (toMinutes(time) - GRID_START_HOUR * 60) / SLOT_MINUTES
}

/** Height of a lecture block, in slots. */
export function slotSpan(start: string, end: string): number {
  return (toMinutes(end) - toMinutes(start)) / SLOT_MINUTES
}

/** Monday=0 … Friday=4; null on weekends (the grid is Mon–Fri only). */
export function dayIndex(date: Date): number | null {
  const js = date.getDay() // 0 = Sunday
  return js >= 1 && js <= 5 ? js - 1 : null
}

export function dayName(date: Date): DayOfWeek | null {
  const i = dayIndex(date)
  return i === null ? null : DAYS[i]!
}

/** Minutes since midnight for a Date, in the browser's local zone. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * Human countdown for the 'Next up' pill (§8.2.2): 'In 45 min', 'In 2 h 10 min',
 * 'Starting now'. Deliberately terse — the pill is 12px.
 */
export function countdownLabel(minutes: number): string {
  if (minutes <= 0) return 'Starting now'
  if (minutes < 60) return `In ${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `In ${h} h` : `In ${h} h ${m} min`
}

/** 'Tuesday, 21 July' — the sidebar's date line. */
export function formatToday(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** RRULE BYDAY code for a weekday name. */
export function byDayCode(day: DayOfWeek): string {
  return { Monday: 'MO', Tuesday: 'TU', Wednesday: 'WE', Thursday: 'TH', Friday: 'FR' }[
    day
  ]
}

/** Whether two [start, end) ranges on the same day overlap. */
export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
}
