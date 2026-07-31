import { Header } from '../components/layout/Header'
import { copy } from '../lib/copy'

/**
 * Public privacy policy (§ Google OAuth verification). It must disclose exactly
 * which Google user data the app touches, why, how it is stored, and how to
 * revoke — including the verbatim Google API Services User Data Policy / Limited
 * Use statement that verification for a sensitive scope requires.
 *
 * Support address must match the support email set on the Google OAuth consent
 * screen (Branding).
 */
const SUPPORT_EMAIL = 'moneymangoat21@gmail.com'

interface Section {
  heading: string
  body: React.ReactNode
}

const SECTIONS: Section[] = [
  {
    heading: 'What we access',
    body: (
      <>
        When you sign in with Google, UniSchedule requests:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-ink">Your name, email, and profile picture</span>{' '}
            (<code>openid email profile</code>) — to identify your account and show who is signed
            in.
          </li>
          <li>
            <span className="font-medium text-ink">
              Permission to manage events on your Google Calendar
            </span>{' '}
            (<code>calendar.events</code>) — to create, update, and delete the lecture events for the
            courses you select. This scope is requested only if calendar sync is enabled for the
            deployment you are using.
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: 'How we use it',
    body: (
      <>
        Your Google Calendar permission is used for one purpose only: to keep the events for the
        courses you have chosen in sync with your weekly schedule. When you add a course we create a
        recurring event for it; when you remove or mark a course passed we delete that event. We
        never read, modify, or delete events we did not create, and we do not use your Google data
        for advertising, analytics, or any form of profiling.
      </>
    ),
  },
  {
    heading: 'How your data is protected',
    body: (
      <>
        Google access and refresh tokens are stored on our backend (Supabase Postgres), encrypted at
        rest and protected by row-level security so that each account can reach only its own row.
        These tokens are <span className="font-medium text-ink">never sent to your browser</span> and
        are never exposed to other users — all Google Calendar calls happen server-side. We do not
        sell your data or share it with third parties.
      </>
    ),
  },
  {
    heading: 'Retention and revoking access',
    body: (
      <>
        You can revoke UniSchedule&apos;s access at any time from your{' '}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-ink underline underline-offset-2 hover:opacity-70"
        >
          Google Account permissions
        </a>
        . Revoking access stops all future calendar sync; calendar events already created remain on
        your calendar until you delete them. To have your stored tokens and schedule data removed
        from our database, contact us and we will delete them.
      </>
    ),
  },
  {
    heading: 'Google API Services User Data Policy',
    body: (
      <>
        UniSchedule&apos;s use of information received from Google APIs adheres to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-ink underline underline-offset-2 hover:opacity-70"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </>
    ),
  },
  {
    heading: 'Contact',
    body: (
      <>
        Questions about this policy or your data:{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-medium text-ink underline underline-offset-2 hover:opacity-70"
        >
          {SUPPORT_EMAIL}
        </a>
        .
      </>
    ),
  },
]

/** Public route — reachable without signing in (Google verification needs it). */
export function Privacy() {
  return (
    <div className="min-h-dvh bg-canvas">
      <Header />

      <main className="mx-auto max-w-[720px] px-5 py-12 sm:px-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">
          {copy.privacyTitle}
        </h1>
        <p className="mt-1 text-sm text-muted">{copy.privacySubtitle}</p>
        <p className="mt-1 text-[13px] text-faded">{copy.privacyUpdated}</p>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="text-[15px] font-semibold text-ink">{section.heading}</h2>
              <div className="mt-2 text-sm leading-6 text-body">{section.body}</div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
