import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { User } from '../types/user'
import * as authApi from '../api/supabaseAuth'
import { supabase } from '../api/supabaseClient'

// How long before the access token expires we act. If the user has been active recently we refresh
// silently; if they've gone idle we surface the "stay signed in?" warning instead, giving them this
// long to respond before the session lapses. Keep in sync with SESSION_WARNING_SECONDS in
// SessionExpiredModal so the modal's countdown lands right at expiry.
const WARN_LEAD_MS = 120_000

// Treat the user as "active" — and so worth keeping signed in without a prompt — if they've
// interacted within this window. Longer than WARN_LEAD_MS so someone actively using the app never
// sees the warning; someone who walked away does.
const ACTIVITY_WINDOW_MS = 10 * 60_000

interface AuthContextValue {
  user: User | null
  isAuthenticating: boolean
  isInitializing: boolean
  error: string | null
  /** An established session ended unexpectedly (dead/failed refresh) — recovery isn't possible. */
  sessionExpired: boolean
  /** The session is still valid but about to expire and the user has gone idle — recoverable. */
  sessionWarning: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
  expireSession: () => void
  /** Refresh the token to extend the session; resolves true on success, false if it couldn't. */
  staySignedIn: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function sameUser(a: User | null, b: User | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.email === b.email &&
    a.isPremium === b.isPremium &&
    a.isAdmin === b.isAdmin
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [sessionWarning, setSessionWarning] = useState(false)
  // Set right before we call signOut() ourselves, so the resulting SIGNED_OUT event is treated as
  // an intentional logout (clear the user) rather than an unexpected expiry (show the warning).
  const intentionalSignOutRef = useRef(false)
  const warnTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const lastActivityRef = useRef(Date.now())

  // Track genuine user interaction so we can tell an active session (keep alive silently) from an
  // idle one (warn before signing out). Ref writes only — no re-renders.
  useEffect(() => {
    const mark = () => {
      lastActivityRef.current = Date.now()
    }
    window.addEventListener('pointerdown', mark)
    window.addEventListener('keydown', mark)
    window.addEventListener('scroll', mark, { passive: true })
    document.addEventListener('visibilitychange', mark)
    return () => {
      window.removeEventListener('pointerdown', mark)
      window.removeEventListener('keydown', mark)
      window.removeEventListener('scroll', mark)
      document.removeEventListener('visibilitychange', mark)
    }
  }, [])

  useEffect(() => {
    const clearWarnTimer = () => {
      if (warnTimerRef.current) {
        clearTimeout(warnTimerRef.current)
        warnTimerRef.current = undefined
      }
    }

    // Fire shortly before the current session expires. An active user is kept signed in silently by
    // refreshing the token (Supabase fires TOKEN_REFRESHED and we reschedule off the new expiry). An
    // idle user gets the warning modal instead, so they can choose to stay or be signed out. Either
    // way the app never hard-bounces to /auth with no notice.
    const scheduleWarn = (session: Session) => {
      clearWarnTimer()
      if (!session.expires_at) return
      const msUntilExpiry = session.expires_at * 1000 - Date.now()
      const fireIn = Math.max(0, msUntilExpiry - WARN_LEAD_MS)
      warnTimerRef.current = setTimeout(async () => {
        const isActive = Date.now() - lastActivityRef.current < ACTIVITY_WINDOW_MS
        if (isActive) {
          const { data, error } = await supabase.auth.refreshSession()
          if (error || !data.session) setSessionExpired(true)
        } else {
          setSessionWarning(true)
        }
      }, fireIn)
    }

    authApi.getSession().then((result) => {
      setUser(result)
      setIsInitializing(false)
    })

    // Keeps `user` in sync with token refreshes and sign-outs from other tabs,
    // not just the login()/logout() calls made through this context.
    //
    // Supabase fires this with SIGNED_IN every time the tab regains focus, so we must
    // preserve the existing `user` reference when nothing actually changed — otherwise a
    // fresh object identity cascades into a locations refetch and remounts the map,
    // snapping it back to the fit-all-locations view on every tab switch.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const next = await authApi.toUser(session.user)
        setUser((prev) => (sameUser(prev, next) ? prev : next))
        setSessionExpired(false)
        setSessionWarning(false)
        scheduleWarn(session)
        return
      }

      // Null session. Only SIGNED_OUT means an established session actually ended — the initial
      // anonymous load fires INITIAL_SESSION with no session and must not trip the warning.
      if (event === 'SIGNED_OUT') {
        clearWarnTimer()
        setSessionWarning(false)
        if (intentionalSignOutRef.current) {
          intentionalSignOutRef.current = false
          setUser(null)
          setSessionExpired(false)
        } else {
          // Unexpected sign-out (failed refresh, revoked/expired refresh token). Keep `user` set so
          // the app stays mounted and SessionExpiredModal can render over it, instead of a silent
          // redirect to /auth that would also discard any in-progress form.
          setSessionExpired(true)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
      clearWarnTimer()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true)
    setError(null)
    try {
      const result = await authApi.login(email, password)
      setUser(result)
      setSessionExpired(false)
      setSessionWarning(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      throw err
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    setIsAuthenticating(true)
    setError(null)
    try {
      const result = await authApi.register(name, email, password)
      setUser(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      throw err
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const logout = useCallback(() => {
    intentionalSignOutRef.current = true
    void authApi.logout()
    setUser(null)
    setSessionExpired(false)
    setSessionWarning(false)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const expireSession = useCallback(() => setSessionExpired(true), [])

  // Extend the session on demand (the warning modal's "Stay signed in" button). Counts as activity
  // so the next cycle stays silent. On success the resulting TOKEN_REFRESHED reschedules the warning
  // off the new expiry; on failure the refresh token is dead, so fall through to the expired state.
  const staySignedIn = useCallback(async () => {
    lastActivityRef.current = Date.now()
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) {
      setSessionWarning(false)
      setSessionExpired(true)
      return false
    }
    setSessionWarning(false)
    return true
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticating,
      isInitializing,
      error,
      sessionExpired,
      sessionWarning,
      login,
      register,
      logout,
      clearError,
      expireSession,
      staySignedIn,
    }),
    [
      user,
      isAuthenticating,
      isInitializing,
      error,
      sessionExpired,
      sessionWarning,
      login,
      register,
      logout,
      clearError,
      expireSession,
      staySignedIn,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
