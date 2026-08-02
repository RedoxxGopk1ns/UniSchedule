import { foldGreek } from '../../lib/import/greek'

/**
 * Builds the option list for a free-text-in-the-database field (room,
 * department) that the admin form presents as a dropdown.
 *
 * A hardcoded list is wrong here: the columns are plain text with no enum or
 * check constraint, three of the four write paths (PDF import, CSV, overrides)
 * still accept anything, and the published timetable's own wording changes year
 * to year. A dropdown offering only invented names would show a blank field for
 * a row that has a perfectly good value — misrepresenting the record and, worse,
 * making the only available action overwrite it.
 *
 * So the options are whatever the catalogue actually contains, plus a canonical
 * set to steer new entries towards, plus the current value so an edit can never
 * silently drop it.
 *
 * Values differing only in case or spacing are one option: the catalogue holds
 * 'Εργ. 2ου ορόφου', 'εργ. 2ου ορόφου' and 'εργ.2ου ορόφου' for one room.
 * Stripping whitespace (not punctuation — 'Αίθουσα 2.3' must stay distinct)
 * folds those together, and the most frequently used spelling represents the
 * group, so the tidiest form in the data wins. Abbreviations are deliberately
 * *not* equated with their long forms: treating 'Εργ.' as 'Εργαστήριο' would
 * rewrite a value on save, and this list must never mutate data.
 */
export function catalogueOptions(
  values: readonly (string | null | undefined)[],
  canonical: readonly string[] = [],
  current?: string | null,
): string[] {
  const key = (value: string) => foldGreek(value).replace(/\s+/g, '')
  interface Group {
    /** Each distinct spelling seen, and how often. */
    spellings: Map<string, number>
    canonical: string | null
  }
  const groups = new Map<string, Group>()

  const add = (raw: string | null | undefined, isCanonical = false) => {
    const value = raw?.trim()
    if (!value) return
    const k = key(value)
    let group = groups.get(k)
    if (!group) {
      group = { spellings: new Map(), canonical: null }
      groups.set(k, group)
    }
    if (isCanonical) group.canonical = value
    else group.spellings.set(value, (group.spellings.get(value) ?? 0) + 1)
  }

  for (const value of values) add(value)
  for (const value of canonical) add(value, true)
  add(current)

  const represent = (group: Group): string => {
    if (group.canonical) return group.canonical
    // Most-used spelling wins; ties broken alphabetically so the list is stable
    // across renders rather than depending on catalogue order.
    return [...group.spellings.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el'),
    )[0]![0]
  }

  return [...groups.values()]
    .map(represent)
    .sort((a, b) => a.localeCompare(b, 'el'))
}
