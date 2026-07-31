import { useEffect, useState } from 'react'
import { Spinner } from '../../components/ui/Spinner'
import { getProvider } from '../../lib/data/provider'
import type { AdminStats } from '../../lib/data/types'
import { copy } from '../../lib/copy'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-panel border border-line bg-canvas p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.01em] text-ink">{value}</p>
    </div>
  )
}

/** Read-only analytics overview: totals, calendar adoption, top courses, sign-ups. */
export function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getProvider()
      .admin.getStats()
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : copy.adminError))
    return () => {
      alive = false
    }
  }, [])

  if (error) return <p className="text-sm text-danger">{error}</p>
  if (!stats) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner /> Loading…
      </div>
    )
  }

  const adoption = Math.round(stats.calendar.adoption_rate * 100)
  const maxTop = Math.max(1, ...stats.top_courses.map((c) => c.count))

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label={copy.statUsers} value={stats.totals.users} />
        <StatCard label={copy.statAdmins} value={stats.totals.admins} />
        <StatCard label={copy.statLectures} value={stats.totals.lectures} />
        <StatCard label={copy.statEnrollments} value={stats.totals.enrollments} />
        <StatCard label={copy.statSemesters} value={stats.totals.semesters} />
      </div>

      <section className="rounded-panel border border-line p-4">
        <h2 className="text-[15px] font-semibold text-ink">{copy.statCalendarAdoption}</h2>
        <p className="mt-1 text-sm text-muted">
          {stats.calendar.connected_users} of {stats.totals.users} users connected ·{' '}
          {stats.calendar.users_with_refresh_token} with a refresh token
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-subtle">
          <div className="h-full rounded-pill bg-ink" style={{ width: `${adoption}%` }} />
        </div>
        <p className="mt-1 text-right text-xs text-faded">{adoption}%</p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink">{copy.statTopCourses}</h2>
        {stats.top_courses.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{copy.statNoData}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stats.top_courses.map((c) => (
              <li key={c.lecture_id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-ink">
                  <span className="font-medium">{c.course_code}</span>{' '}
                  <span className="text-muted">{c.course_name}</span>
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-pill bg-subtle">
                  <span
                    className="block h-full rounded-pill bg-ink"
                    style={{ width: `${(c.count / maxTop) * 100}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-body">
                  {c.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink">{copy.statSignups}</h2>
        {stats.signups.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{copy.statNoData}</p>
        ) : (
          <div className="mt-3 flex items-end gap-1" style={{ height: 96 }}>
            {stats.signups.map((s) => {
              const max = Math.max(1, ...stats.signups.map((x) => x.count))
              return (
                <div
                  key={s.date}
                  title={`${s.date}: ${s.count}`}
                  className="flex-1 rounded-t bg-ink/80"
                  style={{ height: `${(s.count / max) * 100}%`, minHeight: 2 }}
                />
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
