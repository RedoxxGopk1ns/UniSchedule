/**
 * Resolves a week of the timetable against the academic calendar and any
 * per-occurrence changes (§22).
 *
 * A `Lecture` is a weekly *pattern* — a weekday and a time, with no dates on
 * it — which is all the grid needed while every week looked the same. Once
 * holidays and one-off changes exist, the same Monday 12:00 block means
 * different things on different Mondays, so the screen has to know which week
 * it is showing.
 *
 * This is the client-side twin of supabase/functions/_shared/recurrence.ts,
 * which computes the same exclusions for Google Calendar. They are separate
 * because one runs on Deno and cannot import from src; the rules they encode
 * are the same and must be changed together.
 */
import type {
  AcademicEvent,
  DayOfWeek,
  LectureOverride,
  ScheduleEntry,
} from './data/types'
import { DAYS } from './data/types'

/**
 * What happened to one scheduled session.
 *
 * `moved-out` is kept rather than dropped so the grid can leave a struck-through
 * marker in the original slot — a student looking at Monday should see that the
 * class was moved, not find an unexplained gap.
 */
export type OccurrenceStatus =
  | 'normal'
  | 'cancelled'
  | 'moved-out'
  | 'moved-in'
  | 'room-changed'
  | 'extra'

export interface ResolvedOccurrence {
  entry: ScheduleEntry
  /** ISO date of this session within the resolved week. */
  date: string
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  room: string | null
  status: OccurrenceStatus
  /** Free-text note from the override, or the holiday's title. */
  note: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The Monday of the week containing `date`, as a UTC-normalised Date. */
export function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // getUTCDay: 0 = Sunday. Sunday belongs to the week that is about to start,
  // which is what a student looking at the app on Sunday evening expects.
  const shift = d.getUTCDay() === 0 ? 1 : 1 - d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + shift)
  return d
}

/** Monday–Friday dates of the week containing `date`, as ISO days. */
export function weekDates(date: Date): Record<DayOfWeek, string> {
  const monday = startOfWeek(date)
  const out = {} as Record<DayOfWeek, string>
  DAYS.forEach((day, i) => {
    out[day] = iso(new Date(monday.getTime() + i * DAY_MS))
  })
  return out
}

/**
 * Every date in [start, end] on which a lecture of the given weekday runs.
 *
 * Used by the admin override form so a change can only be pinned to a session
 * that actually exists. The Edge Functions compute the same list in
 * supabase/functions/_shared/recurrence.ts — that copy cannot import from here,
 * and the two must be changed together.
 */
export function occurrenceDatesFor(
  start: string,
  end: string,
  day: DayOfWeek,
): string[] {
  const target = DAYS.indexOf(day) + 1 // getUTCDay: Monday is 1
  const cursor = new Date(`${start}T00:00:00Z`)
  cursor.setUTCDate(cursor.getUTCDate() + ((target - cursor.getUTCDay() + 7) % 7))

  const last = new Date(`${end}T00:00:00Z`).getTime()
  const out: string[] = []
  while (cursor.getTime() <= last) {
    out.push(iso(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return out
}

/** Academic events covering a given day, most specific first. */
export function eventsOn(events: AcademicEvent[], date: string): AcademicEvent[] {
  return events.filter((e) => date >= e.start_date && date <= e.end_date)
}

/** Whether teaching is suspended on a given day. */
export function isTeachingBlocked(events: AcademicEvent[], date: string): boolean {
  return eventsOn(events, date).some((e) => e.blocks_teaching)
}

/**
 * Every session in the week containing `reference`, with holidays and overrides
 * already applied.
 *
 * Order of precedence matters: an explicit override wins over a holiday. If the
 * department schedules a make-up class on a day the calendar calls a break,
 * the class happens.
 */
export function resolveWeek(
  entries: ScheduleEntry[],
  overrides: LectureOverride[],
  events: AcademicEvent[],
  reference: Date = new Date(),
): ResolvedOccurrence[] {
  const dates = weekDates(reference)
  const inWeek = new Set(Object.values(dates))
  const out: ResolvedOccurrence[] = []

  for (const entry of entries) {
    const lecture = entry.lecture
    const date = dates[lecture.day_of_week]
    const mine = overrides.filter((o) => o.lecture_id === entry.lecture_id)

    // --- The regular occurrence, if the pattern produces one this week -----
    const onDate = mine.find((o) => o.occurrence_date === date && o.kind !== 'extra')
    if (onDate?.kind === 'cancelled') {
      out.push(occurrence(entry, date, 'cancelled', onDate.note))
    } else if (onDate?.kind === 'moved') {
      out.push(occurrence(entry, date, 'moved-out', onDate.note))
    } else if (onDate?.kind === 'room_change') {
      out.push({
        ...occurrence(entry, date, 'room-changed', onDate.note),
        room: onDate.new_room ?? lecture.room,
      })
    } else {
      const holiday = eventsOn(events, date).find((e) => e.blocks_teaching)
      out.push(
        holiday
          ? occurrence(entry, date, 'cancelled', holiday.title)
          : occurrence(entry, date, 'normal', null),
      )
    }

    // --- Sessions that land in this week from elsewhere --------------------
    for (const o of mine) {
      if (o.kind === 'moved' && o.new_date && inWeek.has(o.new_date)) {
        out.push({
          ...occurrence(entry, o.new_date, 'moved-in', o.note),
          day_of_week: dayOf(o.new_date),
          start_time: o.new_start_time ?? lecture.start_time,
          end_time: o.new_end_time ?? lecture.end_time,
          room: o.new_room ?? lecture.room,
        })
      }
      if (o.kind === 'extra' && inWeek.has(o.occurrence_date)) {
        out.push({
          ...occurrence(entry, o.occurrence_date, 'extra', o.note),
          day_of_week: dayOf(o.occurrence_date),
          start_time: o.new_start_time ?? lecture.start_time,
          end_time: o.new_end_time ?? lecture.end_time,
          room: o.new_room ?? lecture.room,
        })
      }
    }
  }

  return out.sort(
    (a, b) =>
      DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) ||
      a.start_time.localeCompare(b.start_time),
  )
}

function occurrence(
  entry: ScheduleEntry,
  date: string,
  status: OccurrenceStatus,
  note: string | null,
): ResolvedOccurrence {
  return {
    entry,
    date,
    day_of_week: entry.lecture.day_of_week,
    start_time: entry.lecture.start_time,
    end_time: entry.lecture.end_time,
    room: entry.lecture.room,
    status,
    note: note ?? null,
  }
}

/** Weekday of an ISO date; weekend dates fall back to Monday (the grid is Mon–Fri). */
function dayOf(date: string): DayOfWeek {
  const index = new Date(`${date}T00:00:00Z`).getUTCDay()
  return DAYS[index - 1] ?? 'Monday'
}

/**
 * The entries the grid should draw, with a moved or relocated session shown at
 * its new slot. A cancelled block stays in place so the change is visible.
 */
export function occurrencesToEntries(
  occurrences: ResolvedOccurrence[],
): (ScheduleEntry & { occurrence: ResolvedOccurrence })[] {
  return occurrences.map((o) => ({
    ...o.entry,
    // A single entry can appear twice in one week (moved out of Monday, into
    // Wednesday), so the id has to distinguish them or React reuses the block.
    id: `${o.entry.id}@${o.date}:${o.status}`,
    lecture: {
      ...o.entry.lecture,
      day_of_week: o.day_of_week,
      start_time: o.start_time,
      end_time: o.end_time,
      room: o.room,
    },
    occurrence: o,
  }))
}

/** This week's changes, for the dashboard banner. Holidays first, then edits. */
export function weekChanges(occurrences: ResolvedOccurrence[]): ResolvedOccurrence[] {
  return occurrences.filter((o) => o.status !== 'normal')
}
