import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCurrentTerm } from '../../hooks/useCurrentTerm'
import { copy } from '../../lib/copy'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { SemesterPill } from '../ui/Pill'
import { CloseIcon, GoogleMark, LogoMark, MenuIcon } from '../ui/icons'

/**
 * Sticky 56px header with two variants (§8.1, §8.2).
 *
 * Unauthenticated: logo + 'Sign in with Google' outlined pill.
 * Authenticated: logo + semester pill + avatar/name + sign out, collapsing to a
 * hamburger drawer below 768px (§14).
 */
export function Header() {
  const { isAuthenticated, isAdmin, user, signIn, signingIn, signOut } = useAuth()
  const term = useCurrentTerm()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const handleSignIn = async () => {
    await signIn()
    navigate('/dashboard')
  }

  const handleSignOut = async () => {
    setDrawerOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-line-soft bg-canvas/80 backdrop-blur-[8px]">
      <div className="mx-auto flex h-full max-w-[1180px] items-center justify-between px-5 sm:px-6">
        <Link
          to={isAuthenticated ? '/dashboard' : '/'}
          className="flex items-center gap-2 rounded text-ink md:flex-none"
        >
          <LogoMark className="h-5 w-5" />
          <span className="text-[15px] font-medium tracking-[-0.01em]">
            {copy.brand}
          </span>
        </Link>

        {isAuthenticated && term && (
          <div className="hidden md:block">
            <SemesterPill semester={term} />
          </div>
        )}

        {/* Desktop right cluster */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated && user ? (
            <>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="rounded px-1 text-sm text-muted transition-colors hover:text-ink"
                >
                  {copy.adminNav}
                </Link>
              )}
              <div className="flex items-center gap-2">
                <Avatar name={user.full_name} src={user.avatar_url} size={28} />
                <span className="text-sm text-ink">{user.full_name}</span>
              </div>
              <span className="h-4 w-px bg-line" aria-hidden="true" />
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded px-1 text-sm text-muted transition-colors hover:text-ink"
              >
                {copy.signOut}
              </button>
            </>
          ) : (
            <Button
              variant="outline"
              shape="pill"
              loading={signingIn}
              onClick={handleSignIn}
              className="border-ink text-ink"
            >
              {!signingIn && <GoogleMark className="h-4 w-4" />}
              {copy.signIn}
            </Button>
          )}
        </div>

        {/* Mobile right cluster */}
        <div className="md:hidden">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="rounded p-1.5 text-ink"
            >
              <MenuIcon className="h-[18px] w-[18px]" />
            </button>
          ) : (
            <Button
              variant="outline"
              shape="pill"
              loading={signingIn}
              onClick={handleSignIn}
              className="border-ink px-3 text-ink"
            >
              {!signingIn && <GoogleMark className="h-4 w-4" />}
              <span className="text-[13px]">Sign in</span>
            </Button>
          )}
        </div>
      </div>

      {drawerOpen && user && (
        <div
          className="fixed inset-0 z-60 md:hidden"
          style={{ backgroundColor: 'rgb(0 0 0 / 0.32)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false)
          }}
        >
          <div className="ml-auto flex h-full w-[280px] flex-col gap-6 border-l border-line bg-canvas p-5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-medium">{copy.brand}</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="rounded p-1 text-muted"
              >
                <CloseIcon className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <Avatar name={user.full_name} src={user.avatar_url} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {user.full_name}
                </p>
                <p className="truncate text-xs text-faded">{user.email}</p>
              </div>
            </div>

            {term && <SemesterPill semester={term} />}

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setDrawerOpen(false)}
                className="rounded-btn px-1 py-2 text-sm text-body transition-colors hover:text-ink"
              >
                {copy.adminNav}
              </Link>
            )}

            <div className="mt-auto border-t border-line-soft pt-4">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-btn px-1 py-2 text-left text-sm text-muted transition-colors hover:text-ink"
              >
                {copy.signOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
