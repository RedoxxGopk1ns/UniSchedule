import { describe, expect, it } from 'vitest'
import type { Course } from '../data/types'
import { matchCourse } from './lectureMatch'

function makeCourse(overrides: Partial<Course> & Pick<Course, 'id'>): Course {
  return {
    course_code: 'TPT6-EXAMPLE',
    course_name: 'Παράδειγμα Μαθήματος',
    professor: 'Καθηγητής',
    department: 'Πληροφορικής και Τηλεματικής',
    color_tag: null,
    subject: null,
    is_mandatory: false,
    study_year: null,
    semester_number: null,
    ects: null,
    ...overrides,
  }
}

describe('matchCourse', () => {
  it('matches a course with the same title', () => {
    const course = makeCourse({ id: 'a' })
    expect(matchCourse({ course_name: course.course_name }, [course])).toEqual({
      status: 'matched',
      course,
    })
  })

  it('reports unmatched when no course shares the title', () => {
    const catalogue = [makeCourse({ id: 'a', course_name: 'Κάτι Άλλο' })]
    expect(matchCourse({ course_name: 'Παράδειγμα Μαθήματος' }, catalogue)).toEqual({
      status: 'unmatched',
    })
  })

  it('matches regardless of accents or case, via foldGreek', () => {
    const course = makeCourse({
      id: 'a',
      course_name: 'ΑΛΓΌΡΙΘΜΟΙ ΚΑΙ ΠΟΛΥΠΛΟΚΌΤΗΤΑ',
    })
    expect(
      matchCourse({ course_name: 'αλγοριθμοι και πολυπλοκοτητα' }, [course]),
    ).toEqual({ status: 'matched', course })
  })

  /**
   * The property the whole feature rests on. Matching used to key on name + day
   * + start time, which meant a course stopped being recognised the moment its
   * slot moved — the one case a timetable re-import exists to handle.
   */
  it('matches a course whose day and time have changed', () => {
    const course = makeCourse({ id: 'a' })
    expect(
      matchCourse(
        {
          course_name: course.course_name,
          // Deliberately unlike anything on the course: neither is consulted.
          day_of_week: 'Friday',
          start_time: '19:00',
        } as { course_name: string },
        [course],
      ),
    ).toEqual({ status: 'matched', course })
  })

  it('tells a course apart from its lab group, which has its own title', () => {
    const lecture = makeCourse({ id: 'a', course_name: 'Προγραμματισμός ΙΙ' })
    const lab = makeCourse({ id: 'b', course_name: 'Προγραμματισμός ΙΙ — Ομάδα 1' })
    const catalogue = [lecture, lab]

    expect(matchCourse({ course_name: 'Προγραμματισμός ΙΙ' }, catalogue)).toEqual({
      status: 'matched',
      course: lecture,
    })
    expect(
      matchCourse({ course_name: 'Προγραμματισμός ΙΙ — Ομάδα 1' }, catalogue),
    ).toEqual({ status: 'matched', course: lab })
  })

  it('reports unmatched for an empty title rather than matching at random', () => {
    // A garbled cell can parse to nothing; folding '' against a catalogue must
    // not quietly resolve to whichever course also folds to ''.
    expect(matchCourse({ course_name: '   ' }, [makeCourse({ id: 'a' })])).toEqual({
      status: 'unmatched',
    })
  })

  it('reports ambiguous when two courses share a title', () => {
    // courses.course_name is unique in the database, so this should be
    // unreachable in practice — it is reported rather than guessed at.
    const first = makeCourse({ id: 'a' })
    const second = makeCourse({ id: 'b', course_code: 'TPT4-EXAMPLE', study_year: 2 })
    expect(matchCourse({ course_name: first.course_name }, [first, second])).toEqual({
      status: 'ambiguous',
      candidates: [first, second],
    })
  })
})
