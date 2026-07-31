import type { ScheduleEntry, SyncDiff } from './data/types'

/**
 * Computes the minimal change set between the current enrolment and the new
 * selection (§10 "Diff Logic").
 *
 * The point of this function is what it *omits*: unchanged courses produce no
 * entry, and therefore no Google Calendar API call. Re-saving an unmodified
 * schedule is free.
 */
export function computeDiff(
  current: ScheduleEntry[],
  selectedIds: string[],
): SyncDiff {
  const previous = new Map(current.map((e) => [e.lecture_id, e]))
  const next = new Set(selectedIds)

  // Deduplicated: a repeated id in the selection would otherwise enrol the
  // student twice and create two identical Google Calendar events.
  const to_add = [...next].filter((id) => !previous.has(id))

  const to_remove = current
    .filter((e) => !next.has(e.lecture_id))
    .map((e) => ({ lecture_id: e.lecture_id, google_event_id: e.google_event_id }))

  return { to_add, to_remove }
}

/** True when the diff would produce no API calls at all. */
export function isEmptyDiff(diff: SyncDiff): boolean {
  return diff.to_add.length === 0 && diff.to_remove.length === 0
}

/**
 * Enrolments that never received a Calendar event.
 *
 * These arise two ways: the student enrolled while Calendar sync was switched
 * off, or the Calendar call failed while the enrolment itself succeeded (the
 * split described in syncSchedule). Either way `computeDiff` will never mention
 * them again — it reports what the student *changed*, and these are already
 * enrolled — so without an explicit repair they stay missing from Calendar for
 * good.
 */
export function unsyncedLectureIds(entries: ScheduleEntry[]): string[] {
  return entries
    .filter((e) => e.google_event_id === null)
    .map((e) => e.lecture_id)
}

/**
 * Folds repair work into the payload handed to sync-schedule.
 *
 * Kept separate from `computeDiff` so the counts the student is shown stay
 * honest: "1 added" must mean they added one course, not one course plus four
 * silent repairs. Anything being removed in the same save is skipped — there is
 * no sense creating an event we are about to delete.
 */
export function withBackfill(diff: SyncDiff, unsynced: string[]): SyncDiff {
  const removing = new Set(diff.to_remove.map((x) => x.lecture_id))
  const to_add = new Set(diff.to_add)
  for (const id of unsynced) {
    if (!removing.has(id)) to_add.add(id)
  }
  return { to_add: [...to_add], to_remove: diff.to_remove }
}
