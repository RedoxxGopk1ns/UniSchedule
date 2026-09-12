import { describe, expect, it } from 'vitest'
import { COURSES } from '../data/seed'
import fixture from './__fixtures__/timetable.json'
import { matchCourse } from './lectureMatch'
import type { PdfPage } from './pdfText'
import { parseTimetable } from './timetableParser'

/**
 * The seam between the real parser and the matcher.
 *
 * Both halves were well covered in isolation and still shipped a bug that made
 * the feature match nothing in production, because the admin screen's own test
 * stubbed the parser out entirely and nothing ever ran real parser output
 * against a realistically-shaped catalogue. That is exactly what this does.
 */
const pages = fixture as PdfPage[]
const parsed = parseTimetable(pages, { semester: 'Spring 2026' })

describe('parsed timetable -> course matching', () => {
  it('parses a non-trivial number of lectures out of the real PDF', () => {
    // Guards the premise of everything below.
    expect(parsed.lectures.length).toBeGreaterThan(30)
  })

  it('matches most of the real PDF against the course catalogue', () => {
    const matched = parsed.lectures.filter(
      (l) => matchCourse(l, COURSES).status === 'matched',
    )
    // The seed catalogue was itself generated from this PDF, so the
    // overwhelming majority must resolve. A regression in either half collapses
    // this to roughly zero.
    expect(matched.length).toBeGreaterThan(parsed.lectures.length * 0.8)
  })

  /**
   * Matching is on title alone, so it must be indifferent to when a course
   * meets. This re-runs the match with every row's day and time scrambled: the
   * outcome has to be identical, or a moved lecture would stop being
   * recognised — which is the whole case a timetable re-import handles.
   */
  it('resolves identically when every day and time is changed', () => {
    const statuses = (rows: typeof parsed.lectures) =>
      rows.map((l) => matchCourse(l, COURSES).status)
    const moved = parsed.lectures.map((l) => ({
      ...l,
      day_of_week: 'Friday' as const,
      start_time: '19:00',
      end_time: '22:00',
    }))
    expect(statuses(moved)).toEqual(statuses(parsed.lectures))
  })

  it('never reports an ambiguous match against the real catalogue', () => {
    // Ambiguity means two courses share a title, which the unique constraint on
    // courses.course_name rules out. This is the fixture's own check on that.
    const ambiguous = parsed.lectures.filter(
      (l) => matchCourse(l, COURSES).status === 'ambiguous',
    )
    expect(ambiguous).toEqual([])
  })

  it('never proposes a course that is not already in the catalogue', () => {
    // The guarantee the admin is being asked to trust: an import can only ever
    // point a row at something that already exists.
    const ids = new Set(COURSES.map((c) => c.id))
    for (const lecture of parsed.lectures) {
      const match = matchCourse(lecture, COURSES)
      if (match.status === 'matched') expect(ids.has(match.course.id)).toBe(true)
    }
  })
})
