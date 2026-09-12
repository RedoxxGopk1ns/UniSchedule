import { useState } from 'react'
import { Header } from '../../components/layout/Header'
import { cn } from '../../lib/utils'
import { copy } from '../../lib/copy'
import { AdminCalendar } from './AdminCalendar'
import { AdminCourses } from './AdminCourses'
import { AdminImport } from './AdminImport'
import { AdminLectures } from './AdminLectures'
import { AdminOverview } from './AdminOverview'
import { AdminSemesters } from './AdminSemesters'
import { AdminUsers } from './AdminUsers'

type Tab =
  | 'overview'
  | 'courses'
  | 'lectures'
  | 'calendar'
  | 'import'
  | 'semesters'
  | 'users'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: copy.adminTabOverview },
  // Courses before Lectures: a lecture cannot exist without one, so the tab
  // order matches the order the work has to be done in.
  { id: 'courses', label: copy.adminTabCourses },
  { id: 'lectures', label: copy.adminTabLectures },
  { id: 'calendar', label: copy.adminTabCalendar },
  { id: 'import', label: copy.adminTabImport },
  { id: 'semesters', label: copy.adminTabSemesters },
  { id: 'users', label: copy.adminTabUsers },
]

/**
 * Admin dashboard shell (behind AdminRoute). A single page with client-side
 * tabs rather than nested routes — the four sections are independent and each
 * owns its own data fetching and feedback.
 */
export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="min-h-dvh bg-canvas">
      <Header />

      <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">
          {copy.adminTitle}
        </h1>
        <p className="mt-1 text-sm text-muted">{copy.adminSubtitle}</p>

        <div
          role="tablist"
          aria-label={copy.adminTitle}
          className="mt-6 flex gap-1 border-b border-line"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'overview' && <AdminOverview />}
          {tab === 'courses' && <AdminCourses />}
          {tab === 'lectures' && <AdminLectures />}
          {tab === 'calendar' && <AdminCalendar />}
          {tab === 'import' && <AdminImport />}
          {tab === 'semesters' && <AdminSemesters />}
          {tab === 'users' && <AdminUsers />}
        </div>
      </main>
    </div>
  )
}
