// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PrintableSchedule } from './components/schedule/PrintableSchedule'
import type { Lecture, ScheduleEntry } from './lib/data/types'

/**
 * The printed page spans exactly the hours the student is taught: first row at
 * their earliest lecture, last row at their latest, with any free hours in
 * between preserved. No padding at either end.
 */

let container: HTMLDivElement
let root: Root

const entry = (start: string, end: string, day: Lecture['day_of_week'] = 'Monday'): ScheduleEntry => {
  const lecture: Lecture = {
    id: `${day}-${start}`,
    course_code: 'CS100',
    course_name: 'Course',
    professor: 'Prof',
    room: null,
    day_of_week: day,
    start_time: start,
    end_time: end,
    semester: 'Spring 2026',
    department: 'CS',
    color_tag: null,
    subject: 'Systems',
    is_mandatory: false,
    study_year: 1,
  }
  return { id: lecture.id, lecture_id: lecture.id, google_event_id: null, lecture }
}

/** The hour labels down the printed time axis, e.g. ['12:00', …, '18:00']. */
function renderedHours(entries: ScheduleEntry[]): string[] {
  act(() => {
    root.render(
      <PrintableSchedule entries={entries} studentName="Test" now={new Date('2026-03-02T10:00:00')} />,
    )
  })
  return Array.from(container.querySelectorAll('.print-hour')).map(
    (el) => el.textContent ?? '',
  )
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('printed hour range', () => {
  it('spans the taught hours and keeps the gap between them', () => {
    // 12:00–15:00 and 17:00–18:00 must print as 12:00 through 18:00.
    const hours = renderedHours([entry('12:00', '15:00'), entry('17:00', '18:00', 'Tuesday')])
    expect(hours).toEqual([
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
    ])
  })

  it('starts at the earliest lecture rather than an hour before it', () => {
    const hours = renderedHours([entry('15:00', '17:00')])
    expect(hours[0]).toBe('15:00')
    expect(hours.at(-1)).toBe('17:00')
  })

  it('encloses lectures that start and end on the half hour', () => {
    const hours = renderedHours([entry('12:30', '17:30')])
    expect(hours[0]).toBe('12:00')
    expect(hours.at(-1)).toBe('18:00')
  })

  it('prints an evening lecture up to the end of the grid', () => {
    const hours = renderedHours([entry('20:00', '23:00')])
    expect(hours[0]).toBe('20:00')
    expect(hours.at(-1)).toBe('23:00')
  })

  it('prints an empty-state message instead of a grid when nothing is enrolled', () => {
    expect(renderedHours([])).toEqual([])
    expect(container.querySelector('.print-empty')?.textContent).toMatch(/no lectures/i)
  })
})
