import { describe, expect, it } from 'vitest'
import {
  buildRecurrence,
  exdateDays,
  firstOccurrence,
  occurrenceDates,
  overrideSession,
} from '../../supabase/functions/_shared/recurrence'

/**
 * Tests for the recurrence rules the two Edge Functions share.
 *
 * The module lives under supabase/functions/_shared because it is deployed to
 * Deno, but it is pure TypeScript with no Deno APIs, so it is imported here
 * directly rather than duplicated. This is the only test in the suite that
 * reaches outside src/, and it is deliberate: the EXDATE list is the one piece
 * of logic where a bug is invisible until a student's calendar is silently
 * wrong for a whole term.
 */

// The real spring term: opens Tuesday 24/02/2026, ends Friday 05/06/2026.
const SEMESTER = {
  start_date: '2026-02-24',
  end_date: '2026-06-05',
  time_zone: 'Europe/Athens',
}

const MONDAY_LECTURE = {
  day_of_week: 'Monday',
  start_time: '12:00',
  end_time: '15:00',
  room: 'Αίθουσα 2.3',
}

// Straight from the academic calendar PDF.
const EASTER = { start_date: '2026-04-06', end_date: '2026-04-17', blocks_teaching: true }
const MAY_DAY = { start_date: '2026-05-01', end_date: '2026-05-01', blocks_teaching: true }
const HOLY_SPIRIT = { start_date: '2026-06-01', end_date: '2026-06-01', blocks_teaching: true }
const MAKEUP_WEEK = {
  start_date: '2026-06-08',
  end_date: '2026-06-12',
  blocks_teaching: false,
}

describe('firstOccurrence', () => {
  it('walks forward to the weekday rather than adding an offset', () => {
    // 24/02/2026 is itself a Tuesday.
    expect(firstOccurrence('2026-02-24', 'Tuesday')).toBe('2026-02-24')
    // A Monday lecture in a term opening on a Tuesday starts the *next* week.
    // The old offset-based version returned the 24th here, putting a Monday
    // lecture on a Tuesday for the whole semester.
    expect(firstOccurrence('2026-02-24', 'Monday')).toBe('2026-03-02')
    expect(firstOccurrence('2026-02-24', 'Wednesday')).toBe('2026-02-25')
    expect(firstOccurrence('2026-02-24', 'Friday')).toBe('2026-02-27')
  })

  it('is a no-op when the term already opens on that weekday', () => {
    expect(firstOccurrence('2026-03-02', 'Monday')).toBe('2026-03-02')
  })
})

describe('occurrenceDates', () => {
  it('lists every matching weekday inside the term, inclusive', () => {
    const mondays = occurrenceDates(SEMESTER.start_date, SEMESTER.end_date, 'Monday')
    expect(mondays[0]).toBe('2026-03-02')
    expect(mondays.at(-1)).toBe('2026-06-01')
    expect(mondays).toHaveLength(14)
    expect(mondays.every((d, i) => i === 0 || d > mondays[i - 1]!)).toBe(true)
  })
})

describe('exdateDays', () => {
  it('excludes the holidays that fall on the lecture’s own weekday', () => {
    const days = exdateDays(MONDAY_LECTURE, SEMESTER, [EASTER, MAY_DAY, HOLY_SPIRIT], [])
    // Two Mondays inside the Easter break, plus Αγίου Πνεύματος. Πρωτομαγιά is
    // a Friday, so it does not touch a Monday lecture.
    expect(days).toEqual(['2026-04-06', '2026-04-13', '2026-06-01'])
  })

  it('ignores events that do not block teaching', () => {
    expect(exdateDays(MONDAY_LECTURE, SEMESTER, [MAKEUP_WEEK], [])).toEqual([])
  })

  it('excludes a cancelled, moved or relocated session but never an extra one', () => {
    const days = exdateDays(
      MONDAY_LECTURE,
      SEMESTER,
      [],
      [
        { kind: 'cancelled', occurrence_date: '2026-03-09' },
        {
          kind: 'moved',
          occurrence_date: '2026-03-16',
          new_date: '2026-03-18',
          new_start_time: '12:00',
          new_end_time: '15:00',
        },
        {
          kind: 'room_change',
          occurrence_date: '2026-03-23',
          new_room: 'Αμφιθέατρο',
        },
        // An extra session has no counterpart in the weekly pattern, so there
        // is nothing to exclude — excluding it would delete the class.
        {
          kind: 'extra',
          occurrence_date: '2026-03-30',
          new_start_time: '09:00',
          new_end_time: '11:00',
        },
      ],
    )
    expect(days).toEqual(['2026-03-09', '2026-03-16', '2026-03-23'])
  })

  it('deduplicates a cancellation that lands on a holiday', () => {
    const days = exdateDays(MONDAY_LECTURE, SEMESTER, [HOLY_SPIRIT], [
      { kind: 'cancelled', occurrence_date: '2026-06-01' },
    ])
    expect(days).toEqual(['2026-06-01'])
  })
})

describe('buildRecurrence', () => {
  it('emits only an RRULE when nothing is excluded', () => {
    expect(buildRecurrence(MONDAY_LECTURE, SEMESTER, [], [])).toEqual([
      'RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260605T235959Z',
    ])
  })

  it('stamps EXDATEs with the lecture’s start time and the university’s zone', () => {
    const rules = buildRecurrence(MONDAY_LECTURE, SEMESTER, [HOLY_SPIRIT], [])
    // A date-only EXDATE does not cancel a timed instance — Google matches on
    // the instance start, so the time and zone have to be carried.
    expect(rules[1]).toBe('EXDATE;TZID=Europe/Athens:20260601T120000')
  })

  it('accepts a Postgres time with seconds', () => {
    const rules = buildRecurrence(
      { ...MONDAY_LECTURE, start_time: '12:00:00' },
      SEMESTER,
      [HOLY_SPIRIT],
      [],
    )
    expect(rules[1]).toBe('EXDATE;TZID=Europe/Athens:20260601T120000')
  })

  it('is idempotent — republishing produces the identical rule', () => {
    // The exclusion list is rebuilt from the database on every publish rather
    // than appended to. If that ever changed, publishing twice would grow the
    // EXDATE list and the second call would not be a no-op.
    const events = [EASTER, HOLY_SPIRIT]
    const overrides = [{ kind: 'cancelled', occurrence_date: '2026-03-09' }]
    const first = buildRecurrence(MONDAY_LECTURE, SEMESTER, events, overrides)
    const second = buildRecurrence(MONDAY_LECTURE, SEMESTER, events, overrides)
    expect(second).toEqual(first)
  })
})

describe('overrideSession', () => {
  it('produces nothing for a plain cancellation', () => {
    expect(
      overrideSession(MONDAY_LECTURE, { kind: 'cancelled', occurrence_date: '2026-03-09' }),
    ).toBeNull()
  })

  it('moves a session to its new date, keeping the room when none is given', () => {
    expect(
      overrideSession(MONDAY_LECTURE, {
        kind: 'moved',
        occurrence_date: '2026-03-16',
        new_date: '2026-03-18',
        new_start_time: '10:00',
        new_end_time: '13:00',
      }),
    ).toEqual({
      date: '2026-03-18',
      start_time: '10:00',
      end_time: '13:00',
      room: 'Αίθουσα 2.3',
    })
  })

  it('replaces a relocated session in place, at the lecture’s usual time', () => {
    expect(
      overrideSession(MONDAY_LECTURE, {
        kind: 'room_change',
        occurrence_date: '2026-03-23',
        new_room: 'Αμφιθέατρο',
      }),
    ).toEqual({
      date: '2026-03-23',
      start_time: '12:00',
      end_time: '15:00',
      room: 'Αμφιθέατρο',
    })
  })

  it('adds an extra session on its own date', () => {
    expect(
      overrideSession(MONDAY_LECTURE, {
        kind: 'extra',
        occurrence_date: '2026-06-10',
        new_start_time: '09:00',
        new_end_time: '11:00',
        new_room: 'Εργ. 2ου ορόφου',
      }),
    ).toEqual({
      date: '2026-06-10',
      start_time: '09:00',
      end_time: '11:00',
      room: 'Εργ. 2ου ορόφου',
    })
  })
})
