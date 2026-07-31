/**
 * Recurrence rules shared by the `sync-schedule` and `admin` Edge Functions.
 *
 * Both build the same RRULE + EXDATE pair for a lecture — sync-schedule when a
 * student first enrols, admin when a change is pushed out afterwards — and the
 * two must agree exactly, or publishing an override would silently rewrite the
 * series into something different from what enrolling produced.
 *
 * This file cannot import from src/: it runs on Deno, and the frontend does not
 * ship to the edge. It is imported by relative path from both functions and is
 * deployed with them automatically (Supabase bundles `_shared`).
 */

export const BYDAY: Record<string, string> = {
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
}

/** JavaScript's getUTCDay numbering: Sunday is 0. */
const WEEKDAY_INDEX: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
}

export interface AcademicEventRow {
  start_date: string
  end_date: string
  blocks_teaching: boolean
}

export interface OverrideRow {
  kind: string
  occurrence_date: string
  new_date?: string | null
  new_start_time?: string | null
  new_end_time?: string | null
  new_room?: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * The first date on or after `semesterStart` that falls on `day`.
 *
 * This walks forward rather than adding a fixed offset. The offset version was
 * only correct while semesters were required to begin on a Monday; the real
 * spring term opens on Tuesday 24/02/2026, and a Monday lecture there must
 * start on 02/03, not on the Tuesday itself.
 */
export function firstOccurrence(semesterStart: string, day: string): string {
  const start = parse(semesterStart)
  const target = WEEKDAY_INDEX[day] ?? 1
  const delta = (target - start.getUTCDay() + 7) % 7
  start.setUTCDate(start.getUTCDate() + delta)
  return iso(start)
}

/** 'YYYY-MM-DD' -> 'YYYYMMDDT235959Z' for the RRULE UNTIL clause. */
export function untilStamp(endDate: string): string {
  return `${endDate.replace(/-/g, '')}T235959Z`
}

/** Every date in [start, end] that falls on the given weekday. */
export function occurrenceDates(start: string, end: string, day: string): string[] {
  const out: string[] = []
  const last = parse(end).getTime()
  let cursor = parse(firstOccurrence(start, day))
  while (cursor.getTime() <= last) {
    out.push(iso(cursor))
    cursor = new Date(cursor.getTime() + 7 * DAY_MS)
  }
  return out
}

/**
 * Dates on which this lecture does not happen, as ISO days.
 *
 * An academic event that blocks teaching (a holiday or a break) suppresses
 * every occurrence inside it. So does any override that replaces a single
 * instance — 'cancelled' outright, 'moved' to another slot, or 'room_change'.
 * The last two then reappear as a separate one-off event (see
 * `overrideSession`); excluding the original is what stops the student seeing
 * that session twice.
 *
 * 'extra' is the exception: it adds a session that the weekly pattern never
 * produced, so there is nothing to exclude.
 *
 * Rebuilt from scratch on every call rather than appended to, which is what
 * makes republishing an override idempotent.
 */
export function exdateDays(
  lecture: { day_of_week: string },
  semester: { start_date: string; end_date: string },
  events: AcademicEventRow[],
  overrides: OverrideRow[],
): string[] {
  const days = new Set<string>()

  const blocking = events.filter((e) => e.blocks_teaching)
  for (const date of occurrenceDates(semester.start_date, semester.end_date, lecture.day_of_week)) {
    if (blocking.some((e) => date >= e.start_date && date <= e.end_date)) {
      days.add(date)
    }
  }

  for (const o of overrides) {
    if (o.kind === 'cancelled' || o.kind === 'moved' || o.kind === 'room_change') {
      days.add(o.occurrence_date)
    }
  }

  return [...days].sort()
}

/**
 * The `recurrence` array for a Google Calendar event.
 *
 * EXDATE carries the lecture's own start time and the university's zone, not a
 * bare date: Google matches exclusions against the instance start, so a
 * date-only EXDATE does not cancel a timed occurrence.
 */
export function buildRecurrence(
  lecture: { day_of_week: string; start_time: string },
  semester: { start_date: string; end_date: string; time_zone?: string | null },
  events: AcademicEventRow[],
  overrides: OverrideRow[],
): string[] {
  const zone = semester.time_zone ?? 'Europe/Athens'
  const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[lecture.day_of_week]};UNTIL=${untilStamp(semester.end_date)}`

  const days = exdateDays(lecture, semester, events, overrides)
  if (days.length === 0) return [rrule]

  // 'HH:MM' or 'HH:MM:SS' from Postgres — normalise to HHMMSS.
  const time = `${lecture.start_time.slice(0, 5).replace(':', '')}00`
  const stamps = days.map((d) => `${d.replace(/-/g, '')}T${time}`)
  return [rrule, `EXDATE;TZID=${zone}:${stamps.join(',')}`]
}

/**
 * Start and end of the one-off session an override describes, or null when the
 * override does not produce a separate event (a plain cancellation).
 */
export function overrideSession(
  lecture: { start_time: string; end_time: string; room?: string | null },
  override: OverrideRow,
): { date: string; start_time: string; end_time: string; room: string | null } | null {
  if (override.kind === 'moved') {
    return {
      date: override.new_date as string,
      start_time: override.new_start_time as string,
      end_time: override.new_end_time as string,
      room: override.new_room ?? lecture.room ?? null,
    }
  }
  if (override.kind === 'extra') {
    return {
      date: override.occurrence_date,
      start_time: override.new_start_time as string,
      end_time: override.new_end_time as string,
      room: override.new_room ?? lecture.room ?? null,
    }
  }
  if (override.kind === 'room_change') {
    // The original instance is EXDATEd, so this replaces it in place: same
    // date and time, new room.
    return {
      date: override.occurrence_date,
      start_time: override.new_start_time ?? lecture.start_time,
      end_time: override.new_end_time ?? lecture.end_time,
      room: override.new_room ?? null,
    }
  }
  return null
}
