import { describe, expect, it } from 'vitest'
import type { Lecture } from '../data/types'
import { matchLecture } from './lectureMatch'

function makeLecture(overrides: Partial<Lecture> & Pick<Lecture, 'id'>): Lecture {
  return {
    course_code: 'TPT6-EXAMPLE',
    course_name: 'Παράδειγμα Μαθήματος',
    professor: 'Καθηγητής',
    room: null,
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '12:00',
    semester: 'Fall 2025',
    department: 'Πληροφορικής και Τηλεματικής',
    color_tag: null,
    subject: null,
    is_mandatory: false,
    study_year: null,
    ...overrides,
  }
}

describe('matchLecture', () => {
  it('matches a single lecture with the same name, day and start time', () => {
    const lecture = makeLecture({ id: 'a' })
    const result = matchLecture(
      { course_name: lecture.course_name, day_of_week: lecture.day_of_week, start_time: lecture.start_time },
      [lecture],
    )
    expect(result).toEqual({ status: 'matched', lecture })
  })

  it('reports unmatched when no lecture shares the name', () => {
    const catalogue = [makeLecture({ id: 'a', course_name: 'Κάτι Άλλο' })]
    const result = matchLecture(
      { course_name: 'Παράδειγμα Μαθήματος', day_of_week: 'Monday', start_time: '09:00' },
      catalogue,
    )
    expect(result).toEqual({ status: 'unmatched' })
  })

  it('reports unmatched when the name matches but the day does not', () => {
    const catalogue = [makeLecture({ id: 'a', day_of_week: 'Tuesday' })]
    const result = matchLecture(
      { course_name: 'Παράδειγμα Μαθήματος', day_of_week: 'Monday', start_time: '09:00' },
      catalogue,
    )
    expect(result).toEqual({ status: 'unmatched' })
  })

  it('resolves a lecture and its lab independently — same name, different days', () => {
    const lecture = makeLecture({ id: 'a', day_of_week: 'Monday' })
    const lab = makeLecture({ id: 'b', day_of_week: 'Wednesday' })
    const catalogue = [lecture, lab]

    expect(
      matchLecture({ course_name: lecture.course_name, day_of_week: 'Monday', start_time: '09:00' }, catalogue),
    ).toEqual({ status: 'matched', lecture })
    expect(
      matchLecture({ course_name: lab.course_name, day_of_week: 'Wednesday', start_time: '09:00' }, catalogue),
    ).toEqual({ status: 'matched', lecture: lab })
  })

  it('resolves a lecture and its lab independently — same name and day, different start time', () => {
    const morning = makeLecture({ id: 'a', day_of_week: 'Monday', start_time: '09:00', end_time: '12:00' })
    const afternoon = makeLecture({ id: 'b', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00' })
    const catalogue = [morning, afternoon]

    expect(
      matchLecture(
        { course_name: morning.course_name, day_of_week: 'Monday', start_time: '09:00' },
        catalogue,
      ),
    ).toEqual({ status: 'matched', lecture: morning })
    expect(
      matchLecture(
        { course_name: afternoon.course_name, day_of_week: 'Monday', start_time: '12:00' },
        catalogue,
      ),
    ).toEqual({ status: 'matched', lecture: afternoon })
  })

  it('matches regardless of accents or case, via foldGreek', () => {
    const lecture = makeLecture({ id: 'a', course_name: 'ΑΛΓΌΡΙΘΜΟΙ ΚΑΙ ΠΟΛΥΠΛΟΚΌΤΗΤΑ' })
    const result = matchLecture(
      { course_name: 'αλγοριθμοι και πολυπλοκοτητα', day_of_week: 'Monday', start_time: '09:00' },
      [lecture],
    )
    expect(result).toEqual({ status: 'matched', lecture })
  })

  it('reports ambiguous when two catalogue rows share name, day and start time', () => {
    const first = makeLecture({ id: 'a' })
    const second = makeLecture({ id: 'b', course_code: 'TPT4-EXAMPLE', study_year: 2 })
    const result = matchLecture(
      { course_name: first.course_name, day_of_week: first.day_of_week, start_time: first.start_time },
      [first, second],
    )
    expect(result).toEqual({ status: 'ambiguous', candidates: [first, second] })
  })
})
