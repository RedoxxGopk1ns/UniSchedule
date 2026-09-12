import { useEffect, useState } from 'react'
import { getProvider } from '../lib/data/provider'
import { activeSemester } from '../lib/occurrences'

/**
 * The term the app is currently operating in, for the header pill.
 *
 * Two sources, in order. The term whose window contains today wins, because
 * that is the one whose lectures the grid will actually draw and the one the
 * course picker scopes itself to — the header has to agree with what the rest
 * of the screen is doing. Between terms there is no such answer, so it falls
 * back to `is_current`: the department's own view of which term is on, which is
 * the right thing to show over a summer with no teaching in it.
 *
 * Null until it resolves, and the caller renders nothing rather than a
 * placeholder — a pill that says one term and then changes its mind is worse
 * than a pill that arrives a moment late. `getSemester` already falls back to
 * the bundled constant when the query fails, so this settles on something even
 * offline.
 *
 * Deliberately not cached across mounts: a module-level cache would have to be
 * reset in every jsdom suite that pins a different clock, and these are two
 * small queries against tables that are read-only to clients.
 */
export function useCurrentTerm(): string | null {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const provider = getProvider()
    void Promise.all([provider.listSemesters(), provider.getSemester()])
      .then(([terms, current]) => {
        if (!alive) return
        setName(activeSemester(terms, new Date())?.name ?? current.name)
      })
      .catch(() => {
        // The pill is decorative; a term we cannot name is simply not shown.
      })
    return () => {
      alive = false
    }
  }, [])

  return name
}
