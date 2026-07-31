/**
 * Greek-language helpers for reading the university's PDFs.
 *
 * The source documents are entirely in Greek; the app's own chrome stays in
 * English (src/lib/copy.ts). Everything here is about *data* coming in, not
 * about localising the interface — there is deliberately no i18n layer.
 */
import type { DayOfWeek } from '../data/types'

/** Column headers on the timetable, and the day names in the calendar PDF. */
const DAY_BY_GREEK: Record<string, DayOfWeek> = {
  ΔΕΥΤΕΡΑ: 'Monday',
  ΤΡΙΤΗ: 'Tuesday',
  ΤΕΤΑΡΤΗ: 'Wednesday',
  ΠΕΜΠΤΗ: 'Thursday',
  ΠΑΡΑΣΚΕΥΗ: 'Friday',
}

export const GREEK_DAY_NAMES = Object.keys(DAY_BY_GREEK)

/**
 * Strips accents and normalises case so 'Δευτέρα', 'ΔΕΥΤΕΡΑ' and 'Δευτερα' all
 * compare equal. Greek capitals are written unaccented, so the PDF's headers
 * and its body text differ by exactly this much.
 */
export function foldGreek(value: string): string {
  return (
    value
      .normalize('NFD')
      // Combining diacritics: tonos, dialytika and the rest.
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .normalize('NFC')
      .trim()
  )
}

/** 'ΔΕΥΤΕΡΑ' | 'Δευτέρα' -> 'Monday'; null for anything else. */
export function greekDay(value: string): DayOfWeek | null {
  return DAY_BY_GREEK[foldGreek(value)] ?? null
}

/**
 * "ΣΤ' ΕΞΑΜΗΝΟ (6ο)" -> 6.
 *
 * The Arabic form in the parentheses is what is actually read; the Greek
 * numeral prefix varies in how it is typed (ΣΤ', Στ') and the parenthesised
 * digit is present on every sheet.
 */
export function parseSemesterHeading(text: string): number | null {
  const folded = foldGreek(text)
  if (!folded.includes('ΕΞΑΜΗΝΟ')) return null
  const arabic = folded.match(/\((\d+)\s*Ο?\)/)
  if (arabic) return Number(arabic[1])
  const greek = folded.match(/(^|\s)(ΣΤ|[ΑΒΓΔΕΖΗ])['’΄]?\s*ΕΞΑΜΗΝΟ/)
  if (greek) {
    const numerals: Record<string, number> = {
      Α: 1,
      Β: 2,
      Γ: 3,
      Δ: 4,
      Ε: 5,
      ΣΤ: 6,
      Ζ: 7,
      Η: 8,
    }
    return numerals[greek[2]] ?? null
  }
  return null
}

/** '25/03/2026' -> '2026-03-25'; null when it is not a real calendar date. */
export function parseGreekDate(value: string): string | null {
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  // Round-tripping rejects 31/02/2026, which Date would roll into March.
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    return null
  }
  return iso
}

/** Every DD/MM/YYYY in a line, in order, as ISO dates. */
export function findDates(line: string): string[] {
  const out: string[] = []
  for (const m of line.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})/g)) {
    const iso = parseGreekDate(m[1])
    if (iso) out.push(iso)
  }
  return out
}

/**
 * Greek to Latin, for generating course codes out of course names. Follows the
 * common transliteration closely enough to stay readable ('Μηχανική' ->
 * 'MICHANIKI'); it only has to be deterministic and recognisable, not
 * standards-compliant.
 */
const TRANSLITERATION: Record<string, string> = {
  Α: 'A', Β: 'V', Γ: 'G', Δ: 'D', Ε: 'E', Ζ: 'Z', Η: 'I', Θ: 'TH',
  Ι: 'I', Κ: 'K', Λ: 'L', Μ: 'M', Ν: 'N', Ξ: 'X', Ο: 'O', Π: 'P',
  Ρ: 'R', Σ: 'S', Τ: 'T', Υ: 'Y', Φ: 'F', Χ: 'CH', Ψ: 'PS', Ω: 'O',
}

export function latinise(value: string): string {
  const folded = foldGreek(value)
  let out = ''
  for (let i = 0; i < folded.length; i++) {
    const ch = folded[i]
    // ΟΥ is the one digraph worth collapsing. ΜΠ and ΝΤ are deliberately left
    // alone: mapping them to B and D is right at the start of a word but wrong
    // inside one, and it turned 'Αντικειμενοστρεφής' into 'ADIKEIMENOSTREFIS'.
    if (folded.slice(i, i + 2) === 'ΟΥ') {
      out += 'OU'
      i++
      continue
    }
    out += TRANSLITERATION[ch] ?? (/[A-Z0-9]/.test(ch) ? ch : ' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}
