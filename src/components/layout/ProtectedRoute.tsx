import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { GridSkeleton } from '../schedule/GridSkeleton'
import { Skeleton } from '../ui/Skeleton'

/**
 * Gates the authenticated routes (§7). While the session is resolving it shows
 * the dashboard skeleton rather than a blank screen or a redirect flash — a
 * premature bounce to '/' on reload is the classic bug here.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

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

  return <>{children}</>
}
