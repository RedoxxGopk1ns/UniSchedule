/**
 * Quoting for values that go inside a PostgREST `or(...)` filter.
 *
 * The Deno twin of src/lib/postgrestFilter.ts — this file cannot import from
 * src, and the two must stay identical. See that file for why raw
 * interpolation is a correctness bug rather than a style one.
 */
export function pgFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
