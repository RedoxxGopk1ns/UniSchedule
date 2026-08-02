/**
 * Every user-facing string in the app. Transcribed from PRD §11 "UX Microcopy
 * Standards": sentence case, no exclamation marks, no emoji.
 *
 * Components import from here rather than inlining strings, so the copy audit
 * is a single file read.
 */
export const copy = {
  brand: 'UniSchedule',

  // Auth
  signIn: 'Sign in with Google',
  signOut: 'Sign out',

  // Landing
  heroTag: 'For university students',
  heroTitle: 'Your semester, perfectly organised.',
  heroSubtitle:
    'Pick your lectures once. UniSchedule builds your weekly timetable and keeps it in sync with your Google Calendar.',
  heroSecondary: 'No account needed — just your Google login',

  // Dashboard
  scheduleTitle: 'My Schedule',
  editSchedule: 'Edit Schedule',
  exportPdf: 'Export PDF',
  today: 'Today',
  nextUp: 'Next up',
  laterToday: 'Later today',
  noMoreClasses: 'No more classes today.',
  emptyTitle: 'No lectures added yet.',
  emptySubtitle: 'Add your courses to get started.',
  emptyCta: 'Add courses',
  viewInCalendar: 'View in Google Calendar',

  // Course selection
  selectTitle: 'Select your courses',
  selectSubtitle: 'Choose the lectures you are enrolled in this semester.',
  searchPlaceholder: 'Search by course, code, or professor',
  noResults: 'No courses match your search.',
  reviewConfirm: 'Review & Confirm',
  coursesSelected: (n: number) => `${n} ${n === 1 ? 'course' : 'courses'} selected`,

  // Filters
  filterDepartment: 'Department',
  filterDay: 'Day',
  filterSubject: 'Subject',
  filterProfessor: 'Professor',
  filterTime: 'Time of day',
  /** '2 times of day' reads better than the default '2 time of days'. */
  filterTimePlural: 'times of day',
  filterYear: 'Year of study',
  filterYearPlural: 'years of study',
  filterMandatory: 'Mandatory only',
  filterSelected: 'Selected only',
  filterPassed: 'Passed courses',
  clearFilters: 'Clear all',
  yearOption: (n: number) => `Year ${n}`,
  /** '12 of 31 lectures' — shown whenever a filter is narrowing the list. */
  showingCount: (shown: number, total: number) =>
    `${shown} of ${total} ${total === 1 ? 'lecture' : 'lectures'}`,

  // Confirm modal
  reviewTitle: 'Review your schedule',
  reviewSubtitle:
    'These lectures will be added to your weekly schedule and your Google Calendar.',
  back: 'Back',
  confirmSync: 'Confirm & Sync to Google Calendar',
  syncing: 'Syncing…',
  syncingLong: 'Syncing your schedule…',

  // Toasts
  syncSuccess: 'Schedule synced to Google Calendar',
  /** Calendar sync is switched off — the schedule itself still saved. */
  scheduleSaved: 'Schedule saved',
  /** The schedule saved, but the Calendar half of the sync did not. */
  calendarWarning: 'Schedule saved, but Google Calendar sync failed',
  syncError: 'Something went wrong. Please try again.',
  /**
   * Shown in place of "No changes to sync" when the selection is unchanged but
   * some lectures are still missing from Calendar — saving repairs them.
   */
  calendarRepair: (n: number) =>
    n === 1
      ? '1 lecture missing from Google Calendar will be added.'
      : `${n} lectures missing from Google Calendar will be added.`,

  // Passed courses
  markPassed: 'Mark as passed',
  restoreCourse: 'Restore',
  passedConfirmTitle: 'Mark course as passed?',
  passedConfirmBody: (code: string) =>
    `${code} will be removed from your schedule and hidden from the course list. You can restore it any time from Passed courses.`,
  passedConfirmAction: 'Mark as passed',
  passedEmpty: 'You have not marked any courses as passed yet.',
  coursePassed: (code: string) => `${code} marked as passed`,
  courseRestored: (code: string) => `${code} restored`,

  // Quick delete
  removeCourse: 'Remove from schedule',
  courseRemoved: (code: string) => `${code} removed from your schedule`,

  // Privacy policy
  privacyLink: 'Privacy',
  privacyTitle: 'Privacy policy',
  privacySubtitle: 'What UniSchedule accesses, why, and how it is protected.',
  privacyUpdated: 'Last updated 24 July 2026',

  // Conflicts
  conflict: (day: string, time: string) =>
    `Schedule conflict detected on ${day} at ${time}`,
  conflictDetail: (a: string, b: string, day: string, time: string) =>
    `Conflict detected: ${a} overlaps with ${b} on ${day} ${time}`,

  // This week's changes (§22)
  weekChangesTitle: 'Changes this week',
  weekChangesOne: 'One change to your schedule this week',
  weekChangesMany: (n: number) => `${n} changes to your schedule this week`,
  occurrenceCancelled: 'Cancelled',
  occurrenceMovedOut: 'Moved',
  occurrenceMovedIn: 'Moved here',
  occurrenceRoomChanged: 'New room',
  occurrenceExtra: 'Extra session',
  occurrenceMovedTo: (day: string, time: string) => `Moved to ${day} ${time}`,
  occurrenceMovedFrom: (day: string) => `Moved from ${day}`,

  // Admin
  adminNav: 'Admin',
  adminTitle: 'Admin',
  adminSubtitle: 'Manage the catalogue, semesters, users, and see usage.',
  adminTabOverview: 'Overview',
  adminTabLectures: 'Lectures',
  adminTabSemesters: 'Semesters',
  adminTabUsers: 'Users',

  // Admin — overview
  statUsers: 'Users',
  statAdmins: 'Admins',
  statLectures: 'Lectures',
  statEnrollments: 'Enrollments',
  statSemesters: 'Semesters',
  statCalendarAdoption: 'Calendar sync adoption',
  statTopCourses: 'Most enrolled',
  statNoData: 'No data yet.',

  // Admin — lectures
  adminAddLecture: 'Add lecture',
  adminEditLecture: 'Edit lecture',
  adminNewLecture: 'New lecture',
  adminEdit: 'Edit',
  adminDelete: 'Delete',
  adminImport: 'Import CSV',
  adminSearchLectures: 'Search lectures by code, name, or professor',
  adminNoLectures: 'No lectures match.',
  adminLectureSaved: 'Lecture saved',
  adminLectureDeleted: 'Lecture deleted',
  adminDeleteLectureTitle: 'Delete lecture?',
  adminDeleteLectureBody: (code: string, enrolled: number) =>
    enrolled > 0
      ? `${code} will be permanently deleted. ${enrolled} enrolled student${enrolled === 1 ? '' : 's'} will lose it from their schedule and Google Calendar.`
      : `${code} will be permanently deleted. No students are currently enrolled.`,

  // Admin — semesters
  adminAddSemester: 'Add semester',
  adminNewSemester: 'New semester',
  adminEditSemester: 'Edit semester',
  adminSetCurrent: 'Set current',
  adminCurrent: 'Current',
  adminSemesterSaved: 'Semester saved',
  adminSemesterDeleted: 'Semester deleted',
  adminDeleteSemesterTitle: 'Delete semester?',
  adminDeleteSemesterBody: (name: string) =>
    `${name} will be deleted. This is only possible when no lectures reference it.`,

  // Admin — users
  adminUserSchedule: 'Schedule',
  adminGrantAdmin: 'Grant admin',
  adminRevokeAdmin: 'Revoke admin',
  adminRevokeTokens: 'Revoke Google access',
  adminDeleteUser: 'Delete user',
  adminCalendarConnected: 'Connected',
  adminCalendarNotConnected: 'Not connected',
  adminCalendarNoRefresh: 'No refresh token',
  adminRoleUpdated: 'Role updated',
  adminTokensRevoked: 'Google access revoked',
  adminUserDeleted: 'User deleted',
  adminDeleteUserTitle: 'Delete user?',
  adminDeleteUserBody: (name: string) =>
    `${name}'s account, schedule, and calendar events will be permanently removed. This cannot be undone.`,

  // Admin — import
  adminTabImport: 'Import',
  adminImportTitle: 'Import from PDF',
  adminImportIntro:
    'Drop the timetable or the academic calendar PDF. Everything it finds is shown for review before anything is saved.',
  adminImportDrop: 'Drop a PDF here, or choose a file',
  adminImportChoose: 'Choose file',
  adminImportReading: 'Reading the PDF',
  adminImportUnknown:
    'This does not look like a timetable or an academic calendar. Pick which parser to use.',
  adminImportKindTimetable: 'Weekly timetable',
  adminImportKindCalendar: 'Academic calendar',
  adminImportFailed: 'The PDF could not be read.',
  adminImportReviewLectures: 'Review lectures',
  adminImportReviewEvents: 'Review calendar entries',
  adminImportReviewHint:
    'Every row is matched against an existing lecture by name, day and time; matched lectures are marked as offered this semester. Nothing here creates a new lecture — add those in the Lectures tab first.',
  adminImportInclude: 'Include',
  adminImportWarnings: 'Needs a look',
  adminImportCommit: 'Save to catalogue',
  adminImportApplySemester: 'Add to semester',
  adminImportPreview: 'Preview',
  adminImportSheet: (page: number, semester: number | null, year: number | null) =>
    semester === null
      ? `Page ${page}`
      : `Page ${page} · ${semester}ο εξάμηνο · year ${year ?? '—'}`,
  adminImportSemesterProposal: (name: string, start: string, end: string) =>
    `The calendar describes ${name}, ${start} to ${end}. It will be created if it does not exist.`,
  adminImportDone: (created: number, failed: number) =>
    failed > 0 ? `Imported ${created}, ${failed} skipped` : `Imported ${created}`,
  adminImportSyncDone: (updated: number, failed: number) =>
    failed > 0 ? `Added to semester: ${updated}, ${failed} failed` : `Added to semester: ${updated}`,
  adminImportNothing: 'Nothing is selected to import.',
  adminImportRowInvalid: 'This row cannot be saved yet.',
  adminImportNoMatch:
    'No existing lecture matches this name, day and time — add it in the Lectures tab, then re-import.',
  adminImportAmbiguousMatch: (count: number) =>
    `${count} existing lectures match this name, day and time — rename one so the import can tell them apart.`,

  // Admin — academic calendar
  adminTabCalendar: 'Calendar',
  adminAddEvent: 'Add entry',
  adminNewEvent: 'New calendar entry',
  adminEditEvent: 'Edit calendar entry',
  adminEventSaved: 'Calendar entry saved',
  adminEventDeleted: 'Calendar entry deleted',
  adminDeleteEventTitle: 'Delete calendar entry?',
  adminDeleteEventBody: (title: string) =>
    `${title} will be deleted. Lectures it currently suppresses will run again once schedules are re-synced.`,
  adminBlocksTeaching: 'Cancels lectures',
  adminEventKind: 'Type',
  adminEventTitle: 'Title',
  adminEventStart: 'From',
  adminEventEnd: 'To',
  adminEventWholeYear: 'Whole academic year',

  // Admin — per-occurrence changes
  adminOverrides: 'Changes',
  adminOverridesFor: (code: string) => `Changes to ${code}`,
  adminAddOverride: 'Add change',
  adminOverrideSaved: 'Change saved',
  adminOverrideDeleted: 'Change deleted',
  adminOverrideKind: 'What changed',
  adminOverrideDate: 'Session date',
  adminOverrideNewDate: 'New date',
  adminOverrideNewStart: 'New start time',
  adminOverrideNewEnd: 'New end time',
  adminOverrideNewRoom: 'New room',
  adminOverrideNote: 'Note for students',
  adminOverrideNoSessions:
    'This lecture has no sessions in its semester, so there is nothing to change.',
  adminOverrideKindCancelled: 'Cancel this session',
  adminOverrideKindMoved: 'Move this session',
  adminOverrideKindRoom: 'Change the room',
  adminOverrideKindExtra: 'Add an extra session',
  adminOverridePublish: 'Push to calendars',
  adminOverridePublished: (users: number, failed: number) =>
    failed > 0
      ? `Updated ${users} calendar${users === 1 ? '' : 's'}, ${failed} failed`
      : `Updated ${users} calendar${users === 1 ? '' : 's'}`,
  adminOverrideUnpublished: 'Not pushed yet',
  adminDeleteOverrideTitle: 'Delete change?',
  adminDeleteOverrideBody: (date: string) =>
    `The change on ${date} will be removed, and any one-off events it created will be deleted from students' calendars.`,

  // Admin — shared
  adminSave: 'Save',
  adminCancel: 'Cancel',
  adminError: 'Something went wrong. Please try again.',
} as const
