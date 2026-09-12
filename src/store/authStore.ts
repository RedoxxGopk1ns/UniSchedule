import { create } from 'zustand'
import { getProvider } from '../lib/data/provider'
import type { Session } from '../lib/data/types'
import { useScheduleStore } from './scheduleStore'

interface AuthState {
  session: Session | null
  /** True until the initial getSession() settles — gates protected routes. */
  loading: boolean
  signingIn: boolean
  initialise: () => () => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  loading: true,
  signingIn: false,

  /**
   * Resolves the current session and subscribes to changes. Called once from
   * App; returns the unsubscribe so React can clean it up.
   */
  initialise: () => {
    const provider = getProvider()

    /**
     * Applies a session, dropping the schedule when the account behind it
     * changes.
     *
     * `scheduleStore` is a module singleton holding one user's enrolments, and
     * nothing was clearing it. Signing in through Google is a full page load,
     * which has been hiding this — but the store outliving its owner is a
     * property of the code, not of the OAuth flow, and it stops being hidden
     * the moment a second sign-in path exists or a session is restored in
     * place. Compared by id so a token refresh, which re-emits the same user,
     * does not throw the schedule away.
     */
    const apply = (session: Session | null) => {
      if ((get().session?.user.id ?? null) !== (session?.user.id ?? null)) {
        useScheduleStore.getState().reset()
      }
      set({ session, loading: false })
    }

    void provider
      .getSession()
      .then(apply)
      .catch(() => apply(null))

    return provider.onAuthChange(apply)
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
    // Immediately, rather than waiting for the auth event to come back round:
    // the next screen renders before that arrives.
    useScheduleStore.getState().reset()
    set({ session: null })
  },
}))
