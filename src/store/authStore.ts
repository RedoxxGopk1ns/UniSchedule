import { create } from 'zustand'
import { getProvider } from '../lib/data/provider'
import type { Session } from '../lib/data/types'

interface AuthState {
  session: Session | null
  /** True until the initial getSession() settles — gates protected routes. */
  loading: boolean
  signingIn: boolean
  initialise: () => () => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,
  signingIn: false,

  /**
   * Resolves the current session and subscribes to changes. Called once from
   * App; returns the unsubscribe so React can clean it up.
   */
  initialise: () => {
    const provider = getProvider()

    void provider
      .getSession()
      .then((session) => set({ session, loading: false }))
      .catch(() => set({ session: null, loading: false }))

    return provider.onAuthChange((session) => set({ session, loading: false }))
  },

  signIn: async () => {
    set({ signingIn: true })
    try {
      await getProvider().signInWithGoogle()
    } finally {
      set({ signingIn: false })
    }
  },

  signOut: async () => {
    await getProvider().signOut()
    set({ session: null })
  },
}))
