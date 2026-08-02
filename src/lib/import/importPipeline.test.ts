import { describe, expect, it } from 'vitest'
import { LECTURES } from '../data/seed'
import type { Lecture } from '../data/types'
import fixture from './__fixtures__/timetable.json'
import { matchLecture } from './lectureMatch'
import type { PdfPage } from './pdfText'
import { parseTimetable } from './timetableParser'

/**
 * The seam between the real parser and the matcher.
 *
 * Both halves were well covered in isolation and still shipped a bug that made
 * the feature match nothing in production: the parser emits 'HH:MM', the
 * catalogue arrives as 'HH:MM:SS' from Postgres, and the admin screen's own
 * test stubbed the parser out entirely, so nothing ever ran real parser output
 * against a realistically-shaped catalogue. That is exactly what this does.
 */
const pages = fixture as PdfPage[]
const parsed = parseTimetable(pages, { semester: 'Spring 2026' })

/** The seed catalogue as Postgres would serve it — `time` carries seconds. */
const postgresShaped: Lecture[] = LECTURES.map((l) => ({
  ...l,
  start_time: `${l.start_time}:00`,
  end_time: `${l.end_time}:00`,
}))

describe('parsed timetable -> catalogue matching', () => {
  it('parses a non-trivial number of lectures out of the real PDF', () => {
    // Guards the premise of everything below.
    expect(parsed.lectures.length).toBeGreaterThan(30)
  })

  it.each([
    ['seed shape (HH:MM)', LECTURES as Lecture[]],
    ['Postgres shape (HH:MM:SS)', postgresShaped],
  ])('matches most of the real PDF against the catalogue — %s', (_name, catalogue) => {
    const matched = parsed.lectures.filter(
      (l) => matchLecture(l, catalogue).status === 'matched',
    )
    // The seed catalogue was itself generated from this PDF, so the overwhelming
    // majority must resolve. A regression in either half — or a shape mismatch
    // between them — collapses this to roughly zero.
    expect(matched.length).toBeGreaterThan(parsed.lectures.length * 0.8)
  })

  it('resolves identically whichever shape the catalogue arrives in', () => {
    // The property that actually matters: the provider's serialisation must not
    // change the outcome. This fails loudly if raw string comparison creeps back.
    const statuses = (catalogue: Lecture[]) =>
      parsed.lectures.map((l) => matchLecture(l, catalogue).status)
    expect(statuses(postgresShaped)).toEqual(statuses(LECTURES as Lecture[]))
  })

  it('never reports an ambiguous match against the real catalogue', () => {
    // Ambiguity means two catalogue rows share name + day + start time, which
    // is the duplicate condition the catalogue was cleaned up to remove.
    const ambiguous = parsed.lectures.filter(
      (l) => matchLecture(l, postgresShaped).status === 'ambiguous',
    )
    expect(ambiguous).toEqual([])
  })
})
