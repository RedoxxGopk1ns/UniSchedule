import { describe, expect, it } from 'vitest'
import { LECTURES } from '../../lib/data/seed'
import { catalogueOptions } from './catalogueOptions'

const CANONICAL_ROOMS = [
  'Αμφιθέατρο 1ου ορόφου',
  'Εργαστήριο 2ου ορόφου',
  'Αμφιθέατρο 2ου ορόφου',
  'Εργαστήριο 3ου ορόφου',
  'Αμφιθέατρο 3ου ορόφου',
  'Αμφιθέατρο 4ου ορόφου',
]

describe('catalogueOptions', () => {
  it('offers every value the catalogue actually uses', () => {
    const options = catalogueOptions(['Αμφιθέατρο', 'Αίθουσα 2.3'])
    expect(options).toContain('Αμφιθέατρο')
    expect(options).toContain('Αίθουσα 2.3')
  })

  it('always includes the canonical set, even when nothing uses it yet', () => {
    const options = catalogueOptions([], CANONICAL_ROOMS)
    expect(options).toEqual([...CANONICAL_ROOMS].sort((a, b) => a.localeCompare(b, 'el')))
  })

  it('folds spellings that differ only in case or spacing', () => {
    const options = catalogueOptions([
      'Εργ. 2ου ορόφου',
      'Εργ. 2ου ορόφου',
      'εργ. 2ου ορόφου',
      'εργ.2ου ορόφου',
    ])
    expect(options).toEqual(['Εργ. 2ου ορόφου'])
  })

  it('represents a folded group by its most-used spelling', () => {
    // The lowercase form is used twice, so it is the one offered.
    expect(catalogueOptions(['Εργ. 4ου ορόφου', 'εργ.4ου ορόφου', 'εργ.4ου ορόφου'])).toEqual([
      'εργ.4ου ορόφου',
    ])
  })

  it('keeps an abbreviation distinct from its long form', () => {
    // Equating these would silently rewrite the stored value on save.
    const options = catalogueOptions(['Εργ. 2ου ορόφου'], ['Εργαστήριο 2ου ορόφου'])
    expect(options).toHaveLength(2)
  })

  it('keeps rooms that differ only by a numeric suffix apart', () => {
    const options = catalogueOptions(['Αίθουσα 2.3', 'Αίθουσα 3.9', 'Αίθουσα 3.7'])
    expect(options).toHaveLength(3)
  })

  it('prefers the canonical spelling when the catalogue has a scruffier one', () => {
    const options = catalogueOptions(
      ['αμφιθέατρο 3ου ορόφου'],
      ['Αμφιθέατρο 3ου ορόφου'],
    )
    expect(options).toEqual(['Αμφιθέατρο 3ου ορόφου'])
  })

  it('includes the current value so an edit cannot silently drop it', () => {
    const options = catalogueOptions([], CANONICAL_ROOMS, 'Κάποια Παλιά Αίθουσα')
    expect(options).toContain('Κάποια Παλιά Αίθουσα')
  })

  it('ignores null, undefined and blank entries', () => {
    expect(catalogueOptions([null, undefined, '', '   '])).toEqual([])
  })

  /**
   * The regression guard for the real defect: the dropdown showed six invented
   * names and the catalogue used none of them, so 40 of 42 lectures rendered as
   * blank. Every room in the seed catalogue must be selectable.
   */
  it('covers every room in the seed catalogue', () => {
    const options = catalogueOptions(
      LECTURES.map((l) => l.room),
      CANONICAL_ROOMS,
    )
    const missing = LECTURES.map((l) => l.room).filter(
      (room) => room !== null && !options.includes(room),
    )
    // Folded variants resolve to their representative rather than themselves.
    const key = (v: string) => v.replace(/\s+/g, '').toUpperCase()
    const offered = new Set(options.map(key))
    expect(missing.every((room) => offered.has(key(room!)))).toBe(true)
  })

  it('covers every department in the seed catalogue', () => {
    const options = catalogueOptions(LECTURES.map((l) => l.department))
    for (const department of new Set(LECTURES.map((l) => l.department))) {
      if (department) expect(options).toContain(department)
    }
  })
})
