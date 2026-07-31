import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { GridSkeleton } from '../schedule/GridSkeleton'
import { Skeleton } from '../ui/Skeleton'

/**
 * Gates the /admin routes. Like ProtectedRoute it holds the skeleton while the
 * session resolves (so a reload does not flash a redirect), then:
 *   - unauthenticated  -> '/'
 *   - signed in, not admin -> '/dashboard'
 *
 * This is a UX gate only. The admin Edge Function re-checks the caller's admin
 * claim on every call, so a non-admin who forces their way here can still do
 * nothing.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh bg-canvas">
        <div className="h-14 border-b border-line-soft" />
        <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-6">
          <Skeleton className="h-8 w-48" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <GridSkeleton />
            <Skeleton className="h-64 rounded-panel" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
