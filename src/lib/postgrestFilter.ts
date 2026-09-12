/**
 * Quoting for values that go inside a PostgREST `or(...)` filter.
 *
 * Inside an `or(...)` group, commas separate the disjuncts and parentheses
 * delimit them, so a value pasted in raw is not data — it is grammar. A
 * semester an admin named `Spring 2026, Part B` turns
 *
 *   or=(semester.eq.Spring 2026, Part B,semester.is.null)
 *
 * into a filter PostgREST rejects with `PGRST100 failed to parse filter`, and
 * the caller sees a failed request rather than a term with a comma in it. That
 * matters more than it sounds: the query it breaks is the academic calendar,
 * and both readers of that calendar fail open — the grid stops hiding holidays
 * and `sync-schedule` stops excluding them from the Google Calendar series,
 * with nothing on screen to say so.
 *
 * Double quotes make the value opaque to the filter parser. Backslash first,
 * then the quote, or the escapes escape each other.
 *
 * This is duplicated at supabase/functions/_shared/postgrest.ts, which the Edge
 * Functions use because they run on Deno and cannot import from src — change
 * one, change the other.
 */
export function pgFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
