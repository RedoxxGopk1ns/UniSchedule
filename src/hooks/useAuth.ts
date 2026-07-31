import { useAuthStore } from '../store/authStore'

/** Convenience read of the auth store. */
export function useAuth() {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)
  const signingIn = useAuthStore((s) => s.signingIn)
  const signIn = useAuthStore((s) => s.signIn)
  const signOut = useAuthStore((s) => s.signOut)

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    isAdmin: session?.user.role === 'admin',
    loading,
    signingIn,
    signIn,
    signOut,
  }
}
