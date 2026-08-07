import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '../types/user'
import * as authApi from '../api/supabaseAuth'
import { supabase } from '../api/supabaseClient'

interface AuthContextValue {
  user: User | null
  isAuthenticating: boolean
  isInitializing: boolean
  error: string | null
  sessionExpired: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
  expireSession: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    authApi.getSession().then((result) => {
      setUser(result)
      setIsInitializing(false)
    })

    // Keeps `user` in sync with token refreshes and sign-outs from other tabs,
    // not just the login()/logout() calls made through this context.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session ? await authApi.toUser(session.user) : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true)
    setError(null)
    try {
      const result = await authApi.login(email, password)
      setUser(result)
      setSessionExpired(false)
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
    void authApi.logout()
    setUser(null)
    setSessionExpired(false)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const expireSession = useCallback(() => setSessionExpired(true), [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticating,
      isInitializing,
      error,
      sessionExpired,
      login,
      register,
      logout,
      clearError,
      expireSession,
    }),
    [user, isAuthenticating, isInitializing, error, sessionExpired, login, register, logout, clearError, expireSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
