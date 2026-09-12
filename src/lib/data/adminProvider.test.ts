import { beforeEach, describe, expect, it } from 'vitest'
import { getProvider } from './provider'
import { resetMockCatalogue } from './mockProvider'
import type { CourseInput, LectureInput } from './types'

/**
 * Exercises the admin surface of the data provider. Runs against the mock
 * provider (VITE_DATA_SOURCE=mock in the test env), the same one the UI uses in
 * tests, so a create/edit/delete verified here is the path the admin screens
 * take.
 */

const admin = () => getProvider().admin

const newCourse = (code: string): CourseInput => ({
  course_code: code,
  course_name: `${code} Course`,
  professor: 'Dr. Test',
  department: 'Computer Science',
  color_tag: null,
  subject: 'Systems',
  is_mandatory: false,
  study_year: 3,
  semester_number: 6,
  ects: 5,
})

const newLecture = (courseId: string): LectureInput => ({
  course_id: courseId,
  room: 'Room 1',
  day_of_week: 'Monday',
  start_time: '09:00',
  end_time: '10:30',
  semester: 'Spring 2026',
})

/** A course to hang test lectures off, created fresh for each test. */
async function aCourse(code: string) {
  return await admin().createCourse(newCourse(code))
}

// The mock's catalogue is a module singleton, so courses created by one test
// would otherwise collide with the next on the unique title.
beforeEach(() => {
  resetMockCatalogue()
})

describe('admin courses CRUD', () => {
  it('creates, updates, then deletes a course', async () => {
    const created = await aCourse('ZZ001')
    expect(created.id).toBeTruthy()

    let all = await admin().listCourses()
    expect(all.find((c) => c.id === created.id)?.course_code).toBe('ZZ001')

    const updated = await admin().updateCourse(created.id, {
      ...newCourse('ZZ001'),
      course_name: 'Renamed',
    })
    expect(updated.course_name).toBe('Renamed')

    await admin().deleteCourse(created.id)
    all = await admin().listCourses()
    expect(all.find((c) => c.id === created.id)).toBeUndefined()
  })

  /**
   * The inheritance the whole 0006 split exists for: a lecture holds no copy of
   * its course's fields, so renaming the course renames every lecture of it
   * with nothing else written.
   */
  it('propagates a course rename to its lectures', async () => {
    const course = await aCourse('ZZ002')
    const lecture = await admin().createLecture(newLecture(course.id))
    expect(lecture.course_name).toBe('ZZ002 Course')

    await admin().updateCourse(course.id, {
      ...newCourse('ZZ002'),
      course_name: 'Renamed Course',
      professor: 'Dr. Replacement',
    })

    const all = await admin().listLectures()
    const after = all.find((l) => l.id === lecture.id)!
    expect(after.course_name).toBe('Renamed Course')
    expect(after.professor).toBe('Dr. Replacement')
  })

  it('deletes a course together with its lectures', async () => {
    const course = await aCourse('ZZ003')
    const lecture = await admin().createLecture(newLecture(course.id))

    await admin().deleteCourse(course.id)

    const all = await admin().listLectures()
    expect(all.find((l) => l.id === lecture.id)).toBeUndefined()
  })

  it('refuses two courses with the same title', async () => {
    await aCourse('ZZ004')
    await expect(
      admin().createCourse({ ...newCourse('ZZ005'), course_name: 'ZZ004 Course' }),
    ).rejects.toThrow(/already exists/i)
  })

  it('rejects an invalid course', async () => {
    await expect(
      admin().createCourse({ ...newCourse('ZZ006'), professor: '  ' }),
    ).rejects.toThrow(/professor/i)
  })
})

describe('admin lectures CRUD', () => {
  it('creates, updates, then deletes a lecture', async () => {
    const course = await aCourse('ZZ101')
    const created = await admin().createLecture(newLecture(course.id))
    expect(created.id).toBeTruthy()

    let all = await admin().listLectures()
    // Read back with the course's fields folded in, as the UI consumes it.
    expect(all.find((l) => l.id === created.id)?.course_code).toBe('ZZ101')

    const updated = await admin().updateLecture(created.id, {
      ...newLecture(course.id),
      day_of_week: 'Thursday',
      room: 'Room 9',
    })
    expect(updated.day_of_week).toBe('Thursday')
    expect(updated.room).toBe('Room 9')
    // Unchanged, because a lecture write cannot touch the course.
    expect(updated.course_name).toBe('ZZ101 Course')

    await admin().deleteLecture(created.id)
    all = await admin().listLectures()
    expect(all.find((l) => l.id === created.id)).toBeUndefined()
  })

  it('rejects an invalid lecture', async () => {
    const course = await aCourse('ZZ102')
    await expect(
      admin().createLecture({
        ...newLecture(course.id),
        start_time: '11:00',
        end_time: '10:00',
      }),
    ).rejects.toThrow(/after start/i)
  })

  /** A lecture can only ever point at a course that exists — the FK. */
  it('refuses a lecture naming a course that does not exist', async () => {
    await expect(
      admin().createLecture(newLecture('00000000-0000-4000-8000-00000000dead')),
    ).rejects.toThrow(/unknown course/i)
  })

  it('reports per-row errors on bulk import', async () => {
    const course = await aCourse('BULK1')
    const result = await admin().bulkImportLectures([
      newLecture(course.id),
      { ...newLecture(course.id), end_time: '08:00' }, // invalid
    ])
    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.row).toBe(2)
  })

  /**
   * What committing a parsed timetable does. It replaces the term wholesale
   * rather than diffing: a lecture holds only where and when, and the PDF is
   * the authority on both.
   */
  describe('replaceSemesterSchedule', () => {
    it('replaces the term and reports what it removed', async () => {
      const before = (await admin().listLectures()).filter(
        (l) => l.semester === 'Spring 2026',
      )
      expect(before.length).toBeGreaterThan(0)

      const course = await aCourse('REPL1')
      const result = await admin().replaceSemesterSchedule('Spring 2026', [
        newLecture(course.id),
      ])

      expect(result.deleted).toBe(before.length)
      expect(result.created).toBe(1)
      expect(result.errors).toEqual([])

      const after = (await admin().listLectures()).filter(
        (l) => l.semester === 'Spring 2026',
      )
      expect(after).toHaveLength(1)
      expect(after[0]!.course_code).toBe('REPL1')
    })

    it('leaves other terms alone', async () => {
      const others = (await admin().listLectures()).filter(
        (l) => l.semester !== 'Spring 2026',
      )
      expect(others.length).toBeGreaterThan(0)

      const course = await aCourse('REPL2')
      await admin().replaceSemesterSchedule('Spring 2026', [newLecture(course.id)])

      const after = (await admin().listLectures()).filter(
        (l) => l.semester !== 'Spring 2026',
      )
      expect(after.map((l) => l.id).sort()).toEqual(others.map((l) => l.id).sort())
    })

    /**
     * A row filed under another term would survive the delete while that term's
     * real lectures were removed and never put back — so it is refused rather
     * than quietly accepted.
     */
    it('refuses a row belonging to a different term', async () => {
      const course = await aCourse('REPL3')
      await expect(
        admin().replaceSemesterSchedule('Spring 2026', [
          { ...newLecture(course.id), semester: 'Demo Term' },
        ]),
      ).rejects.toThrow(/not Spring 2026/i)
    })

    it('refuses a term that does not exist', async () => {
      await expect(
        admin().replaceSemesterSchedule('Winter 1999', []),
      ).rejects.toThrow(/unknown semester/i)
    })
  })

  /**
   * `lectures.semester` is a foreign key and the Edge Function checks it on
   * every write. These pin the mock to that behaviour: without them the PDF
   * import's "add to semester" commit fails every row in production while
   * passing here.
   */
  it('refuses a lecture filed under a semester that does not exist', async () => {
    const course = await aCourse('ZZ103')
    await expect(
      admin().createLecture({ ...newLecture(course.id), semester: 'Winter 1999' }),
    ).rejects.toThrow(/unknown semester/i)
  })

  it('refuses to move an existing lecture to a semester that does not exist', async () => {
    const all = await admin().listLectures()
    const target = all[0]!
    await expect(
      admin().updateLecture(target.id, {
        course_id: target.course_id,
        room: target.room,
        day_of_week: target.day_of_week,
        start_time: target.start_time,
        end_time: target.end_time,
        semester: 'Winter 1999',
      }),
    ).rejects.toThrow(/unknown semester/i)
  })

  it('rejects a bulk import naming a semester that does not exist', async () => {
    const course = await aCourse('BULK3')
    await expect(
      admin().bulkImportLectures([
        { ...newLecture(course.id), semester: 'Winter 1999' },
      ]),
    ).rejects.toThrow(/unknown semester/i)
  })
})

describe('admin semesters', () => {
  it('lists at least the current semester', async () => {
    const sems = await admin().listSemesters()
    expect(sems.some((s) => s.is_current)).toBe(true)
  })

  it('refuses to delete a semester that still has lectures', async () => {
    await expect(admin().deleteSemester('Spring 2026')).rejects.toThrow(/lectures/i)
  })
})

describe('admin users', () => {
  let firstUserId: string

  beforeEach(async () => {
    const users = await admin().listUsers()
    firstUserId = users[0]!.id
  })

  it('grants and revokes the admin role', async () => {
    await admin().setUserRole(firstUserId, 'admin')
    let users = await admin().listUsers()
    expect(users.find((u) => u.id === firstUserId)?.role).toBe('admin')

    await admin().setUserRole(firstUserId, null)
    users = await admin().listUsers()
    expect(users.find((u) => u.id === firstUserId)?.role).toBeNull()
  })

  it('revokes stored Google tokens', async () => {
    await admin().revokeUserTokens(firstUserId)
    const users = await admin().listUsers()
    const u = users.find((x) => x.id === firstUserId)!
    expect(u.calendar.connected).toBe(false)
    expect(u.calendar.has_refresh_token).toBe(false)
  })
})
