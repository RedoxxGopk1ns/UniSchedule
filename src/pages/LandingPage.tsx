import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { WeeklyGrid } from '../components/schedule/WeeklyGrid'
import { Button } from '../components/ui/Button'
import { Pill } from '../components/ui/Pill'
import { GoogleMark } from '../components/ui/icons'
import { useAuth } from '../hooks/useAuth'
import { copy } from '../lib/copy'
import { DEFAULT_ENROLMENT, LECTURES } from '../lib/data/seed'
import type { ScheduleEntry } from '../lib/data/types'

/**
 * Preview data for the hero card. A live grid rather than a screenshot: it can
 * never drift from the real component, and there is no image to ship.
 */
const PREVIEW_ENTRIES: ScheduleEntry[] = DEFAULT_ENROLMENT.map((id) => {
  const lecture = LECTURES.find((l) => l.id === id)!
  return { id: `preview-${id}`, lecture_id: id, google_event_id: null, lecture }
})

/** Marketing page (§8.1). Unauthenticated, no data fetching. */
export function LandingPage() {
  const { isAuthenticated, signIn, signingIn } = useAuth()
  const navigate = useNavigate()

  // A signed-in user has no reason to see the marketing page.
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const handleSignIn = async () => {
    await signIn()
    navigate('/dashboard')
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <Header />

      <main>
        <section className="mx-auto max-w-[1180px] px-5 pt-20 pb-16 text-center sm:px-6 md:pt-[120px] md:pb-20">
          <Pill>{copy.heroTag}</Pill>

          <h1 className="mx-auto mt-6 max-w-[720px] text-[40px] leading-[1.05] font-bold tracking-[-0.03em] text-ink md:text-[64px]">
            {copy.heroTitle}
          </h1>

          <p className="mx-auto mt-5 max-w-[480px] text-[18px] leading-7 text-muted">
            {copy.heroSubtitle}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              shape="pill"
              loading={signingIn}
              onClick={handleSignIn}
              className="px-5 py-2.5 text-[15px]"
            >
              {!signingIn && <GoogleMark className="h-4 w-4" />}
              {copy.signIn}
            </Button>
            <p className="text-[13px] text-faded">{copy.heroSecondary}</p>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 pb-24 sm:px-6">
          <div className="mx-auto max-w-[980px] rounded-modal border border-line bg-surface p-3 shadow-hero sm:p-4">
            <WeeklyGrid entries={PREVIEW_ENTRIES} preview />
          </div>
        </section>
      </main>

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-2 px-5 py-8 text-[13px] text-faded sm:flex-row sm:px-6">
          <span>{copy.brand}</span>
          <div className="flex items-center gap-4">
            <span>Built for students. Synced with Google Calendar.</span>
            <Link to="/privacy" className="text-ink underline underline-offset-2 hover:opacity-70">
              {copy.privacyLink}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
