import { beforeEach, describe, expect, it } from 'vitest'
import { getProvider } from './provider'
import type { LectureInput } from './types'

/**
 * Exercises the admin surface of the data provider. Runs against the mock
 * provider (VITE_DATA_SOURCE=mock in the test env), the same one the UI uses in
 * tests, so a create/edit/delete verified here is the path the admin screens
 * take.
 */

const admin = () => getProvider().admin

const newLecture = (code: string): LectureInput => ({
  course_code: code,
  course_name: `${code} Course`,
  professor: 'Dr. Test',
  room: 'Room 1',
  day_of_week: 'Monday',
  start_time: '09:00',
  end_time: '10:30',
  semester: 'Spring 2026',
  department: 'Computer Science',
  color_tag: null,
  subject: 'Systems',
  is_mandatory: false,
  study_year: 3,
})

describe('admin lectures CRUD', () => {
  it('creates, updates, then deletes a lecture', async () => {
    const created = await admin().createLecture(newLecture('ZZ101'))
    expect(created.id).toBeTruthy()

    let all = await admin().listLectures()
    expect(all.find((l) => l.id === created.id)?.course_code).toBe('ZZ101')

    const updated = await admin().updateLecture(created.id, {
      ...newLecture('ZZ101'),
      course_name: 'Renamed',
    })
    expect(updated.course_name).toBe('Renamed')

    await admin().deleteLecture(created.id)
    all = await admin().listLectures()
    expect(all.find((l) => l.id === created.id)).toBeUndefined()
  })

  it('rejects an invalid lecture', async () => {
    await expect(
      admin().createLecture({ ...newLecture('ZZ102'), start_time: '11:00', end_time: '10:00' }),
    ).rejects.toThrow(/after start/i)
  })

  it('reports per-row errors on bulk import', async () => {
    const result = await admin().bulkImportLectures([
      newLecture('BULK1'),
      { ...newLecture('BULK2'), end_time: '08:00' }, // invalid
    ])
    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.row).toBe(2)
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
