import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import { copy } from '../lib/copy'
import type { DataProvider } from '../lib/data/provider'
import { getProvider } from '../lib/data/provider'
import type { Session } from '../lib/data/types'

/**
 * The PKCE code exchange runs asynchronously inside supabase-js, so on a cold
 * load `getSession()` can resolve to null a moment before the session lands.
 * Give it one auth event's worth of grace rather than bouncing the user back to
 * the landing page for what is really just a race.
 */
const SESSION_GRACE_MS = 3000

function awaitSession(provider: DataProvider): Promise<Session | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (session: Session | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsubscribe()
      resolve(session)
    }

    const timer = setTimeout(() => finish(null), SESSION_GRACE_MS)
    const unsubscribe = provider.onAuthChange((session) => {
      if (session) finish(session)
    })

    void provider.getSession().then((session) => {
      if (session) finish(session)
    })
  })
}

/**
 * OAuth redirect target (§6).
 *
 * Supabase's detectSessionInUrl consumes the code around the time this
 * component mounts, so the work here is only: wait for the session to exist,
 * then route by whether the user already has a schedule — first-time users go
 * straight to course selection, returning users to the dashboard.
 */
export function AuthCallback() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const run = async () => {
      const provider = getProvider()
      try {
        const session = await awaitSession(provider)
        if (!session) {
          toast(copy.syncError, 'error')
          navigate('/', { replace: true })
          return
        }

        // Must happen before anything else: the Google tokens are only
        // readable from the session on this one render.
        await provider.captureProviderTokens()

        const schedule = await provider.getMySchedule()
        navigate(schedule.length === 0 ? '/select-courses' : '/dashboard', {
          replace: true,
        })
      } catch {
        toast(copy.syncError, 'error')
        navigate('/', { replace: true })
      }
    }

    void run()
  }, [navigate, toast])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[320px] space-y-3" aria-busy="true">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-11 rounded-card" />
        <Skeleton className="h-11 rounded-card" />
      </div>
    </div>
  )
}
