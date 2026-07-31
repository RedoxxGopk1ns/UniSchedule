import { useEffect, useState } from 'react'

/** Subscribes to a media query. Used for the mobile day-view switch (§14). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Below 768px the weekly grid collapses to a single-day view. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
