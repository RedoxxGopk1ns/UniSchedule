import { describe, expect, it } from 'vitest'
import type { AcademicEvent, Lecture, LectureOverride, ScheduleEntry } from './data/types'
import {
  isTeachingBlocked,
  occurrencesToEntries,
  resolveWeek,
  startOfWeek,
  weekChanges,
  weekDates,
} from './occurrences'

const lecture: Lecture = {
  id: 'lec-1',
  course_code: 'TPT6-PROGRAMMATISMOS-SYSTIMATON',
  course_name: 'Προγραμματισμός Συστημάτων',
  professor: 'Εξωτερικός Διδάσκων',
  room: 'Αίθουσα 2.3',
  day_of_week: 'Monday',
  start_time: '12:00',
  end_time: '15:00',
  semester: 'Spring 2026',
  department: 'Πληροφορικής και Τηλεματικής',
  color_tag: '#4B5563',
  subject: 'Προγραμματισμός',
  is_mandatory: false,
  study_year: 3,
}

const entry: ScheduleEntry = {
  id: 'sched-1',
  lecture_id: lecture.id,
  google_event_id: 'evt-1',
  lecture,
}

const override = (o: Partial<LectureOverride>): LectureOverride => ({
  id: 'ovr-1',
  lecture_id: lecture.id,
  kind: 'cancelled',
  occurrence_date: '2026-03-09',
  new_date: null,
  new_start_time: null,
  new_end_time: null,
  new_room: null,
  note: null,
  ...o,
})

const holiday: AcademicEvent = {
  id: 'evt-holiday',
  semester: 'Spring 2026',
  kind: 'holiday',
  title: 'Αργία Αγίου Πνεύματος',
  start_date: '2026-06-01',
  end_date: '2026-06-01',
  blocks_teaching: true,
}

const makeupWeek: AcademicEvent = {
  id: 'evt-makeup',
  semester: 'Spring 2026',
  kind: 'makeup_week',
  title: 'Εβδομάδα αναπληρώσεων',
  start_date: '2026-06-08',
  end_date: '2026-06-12',
  blocks_teaching: false,
}

// A Wednesday inside the week of Monday 09/03/2026.
const IN_WEEK = new Date('2026-03-11T10:00:00Z')

describe('weekDates', () => {
  it('runs Monday to Friday of the containing week', () => {
    expect(weekDates(IN_WEEK)).toEqual({
      Monday: '2026-03-09',
      Tuesday: '2026-03-10',
      Wednesday: '2026-03-11',
      Thursday: '2026-03-12',
      Friday: '2026-03-13',
    })
  })

  it('treats Sunday as belonging to the week about to start', () => {
    // Sunday 08/03/2026 → the week beginning Monday 09/03.
    expect(startOfWeek(new Date('2026-03-08T20:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2026-03-09',
    )
  })

  it('keeps Saturday with the week that just finished', () => {
    expect(startOfWeek(new Date('2026-03-14T09:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2026-03-09',
    )
  })
})

describe('isTeachingBlocked', () => {
  it('is true inside a holiday and false during a make-up week', () => {
    expect(isTeachingBlocked([holiday, makeupWeek], '2026-06-01')).toBe(true)
    expect(isTeachingBlocked([holiday, makeupWeek], '2026-06-10')).toBe(false)
  })
})

describe('resolveWeek', () => {
  it('leaves an ordinary week untouched', () => {
    const week = resolveWeek([entry], [], [], IN_WEEK)
    expect(week).toHaveLength(1)
    expect(week[0]!.status).toBe('normal')
    expect(week[0]!.date).toBe('2026-03-09')
    expect(weekChanges(week)).toEqual([])
  })

  it('cancels every session inside a holiday and names it', () => {
    // Monday 01/06/2026 is Αγίου Πνεύματος.
    const week = resolveWeek([entry], [], [holiday], new Date('2026-06-03T10:00:00Z'))
    expect(week[0]!.status).toBe('cancelled')
    expect(week[0]!.note).toBe('Αργία Αγίου Πνεύματος')
  })

  it('does not cancel anything during a week that only adds teaching', () => {
    const week = resolveWeek([entry], [], [makeupWeek], new Date('2026-06-10T10:00:00Z'))
    expect(week[0]!.status).toBe('normal')
  })

  it('marks a cancelled session but keeps it in its slot', () => {
    const week = resolveWeek(
      [entry],
      [override({ kind: 'cancelled', note: 'Ο διδάσκων απουσιάζει' })],
      [],
      IN_WEEK,
    )
    expect(week).toHaveLength(1)
    expect(week[0]!.status).toBe('cancelled')
    expect(week[0]!.note).toBe('Ο διδάσκων απουσιάζει')
    // Still on Monday: the student needs to see that it was cancelled, not
    // find an unexplained gap.
    expect(week[0]!.day_of_week).toBe('Monday')
  })

  it('shows a moved session at both ends when it stays inside the week', () => {
    const week = resolveWeek(
      [entry],
      [
        override({
          kind: 'moved',
          occurrence_date: '2026-03-09',
          new_date: '2026-03-11',
          new_start_time: '09:00',
          new_end_time: '12:00',
          new_room: 'Αμφιθέατρο',
        }),
      ],
      [],
      IN_WEEK,
    )
    expect(week.map((o) => o.status)).toEqual(['moved-out', 'moved-in'])
    const movedIn = week[1]!
    expect(movedIn.day_of_week).toBe('Wednesday')
    expect(movedIn.start_time).toBe('09:00')
    expect(movedIn.room).toBe('Αμφιθέατρο')
  })

  it('shows only the departure when the session moves into another week', () => {
    const week = resolveWeek(
      [entry],
      [
        override({
          kind: 'moved',
          occurrence_date: '2026-03-09',
          new_date: '2026-03-18',
          new_start_time: '09:00',
          new_end_time: '12:00',
        }),
      ],
      [],
      IN_WEEK,
    )
    expect(week.map((o) => o.status)).toEqual(['moved-out'])
  })

  it('applies a room change in place', () => {
    const week = resolveWeek(
      [entry],
      [override({ kind: 'room_change', new_room: 'Αμφιθέατρο' })],
      [],
      IN_WEEK,
    )
    expect(week[0]!.status).toBe('room-changed')
    expect(week[0]!.room).toBe('Αμφιθέατρο')
    expect(week[0]!.start_time).toBe('12:00')
  })

  it('adds an extra session without disturbing the regular one', () => {
    const week = resolveWeek(
      [entry],
      [
        override({
          id: 'ovr-extra',
          kind: 'extra',
          occurrence_date: '2026-03-12',
          new_start_time: '09:00',
          new_end_time: '11:00',
        }),
      ],
      [],
      IN_WEEK,
    )
    expect(week.map((o) => o.status)).toEqual(['normal', 'extra'])
    expect(week[1]!.day_of_week).toBe('Thursday')
    expect(week[1]!.start_time).toBe('09:00')
  })

  it('lets an explicit change win over a holiday', () => {
    // A make-up class deliberately scheduled on a day the calendar blocks.
    const easter: AcademicEvent = {
      ...holiday,
      id: 'evt-easter',
      title: 'Διακοπές Πάσχα',
      start_date: '2026-04-06',
      end_date: '2026-04-17',
    }
    const week = resolveWeek(
      [entry],
      [override({ kind: 'room_change', occurrence_date: '2026-04-06', new_room: 'Αμφιθέατρο' })],
      [easter],
      new Date('2026-04-08T10:00:00Z'),
    )
    expect(week[0]!.status).toBe('room-changed')
  })

  it('sorts the week by day and then by start time', () => {
    const second: ScheduleEntry = {
      ...entry,
      id: 'sched-2',
      lecture_id: 'lec-2',
      lecture: { ...lecture, id: 'lec-2', day_of_week: 'Monday', start_time: '09:00', end_time: '12:00' },
    }
    const week = resolveWeek([entry, second], [], [], IN_WEEK)
    expect(week.map((o) => o.start_time)).toEqual(['09:00', '12:00'])
  })
})

describe('occurrencesToEntries', () => {
  it('gives a moved session a distinct key so both ends can render', () => {
    const week = resolveWeek(
      [entry],
      [
        override({
          kind: 'moved',
          occurrence_date: '2026-03-09',
          new_date: '2026-03-11',
          new_start_time: '09:00',
          new_end_time: '12:00',
        }),
      ],
      [],
      IN_WEEK,
    )
    const ids = occurrencesToEntries(week).map((e) => e.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('rewrites the lecture onto its resolved day, time and room', () => {
    const week = resolveWeek(
      [entry],
      [override({ kind: 'room_change', new_room: 'Αμφιθέατρο' })],
      [],
      IN_WEEK,
    )
    const [resolved] = occurrencesToEntries(week)
    expect(resolved!.lecture.room).toBe('Αμφιθέατρο')
    // The underlying catalogue row is untouched.
    expect(lecture.room).toBe('Αίθουσα 2.3')
  })
})
