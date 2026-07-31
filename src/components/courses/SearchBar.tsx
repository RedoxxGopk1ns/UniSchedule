import { useEffect, useState } from 'react'
import { copy } from '../../lib/copy'
import { SearchIcon } from '../ui/icons'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  debounceMs?: number
}

/**
 * Controlled search input with local echo and debounced commit (§8.3), so
 * typing stays instant while filtering runs at most once per pause.
 */
export function SearchBar({ value, onChange, debounceMs = 250 }: SearchBarProps) {
  const [local, setLocal] = useState(value)

  // Keep in step when the parent clears the query (e.g. a reset button).
  useEffect(() => setLocal(value), [value])

  useEffect(() => {
    if (local === value) return
    const id = setTimeout(() => onChange(local), debounceMs)
    return () => clearTimeout(id)
  }, [local, value, onChange, debounceMs])

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-faded" />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={copy.searchPlaceholder}
        aria-label="Search courses"
        className="h-10 w-full rounded-btn border border-line bg-canvas pr-3 pl-9 text-sm text-ink transition-shadow placeholder:text-line-strong focus:border-ink focus:shadow-[0_0_0_3px_rgb(0_0_0/0.06)] focus:outline-none"
      />
    </div>
  )
}
