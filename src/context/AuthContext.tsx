import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { User } from '../types/user'
import * as authApi from '../api/auth'

interface AuthContextValue {
  user: User | null
  isAuthenticating: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => authApi.getSession())
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async (username: string, password: string) => {
    setIsAuthenticating(true)
    setError(null)
    try {
      const result = await authApi.login(username, password)
      setUser(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      throw err
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    setIsAuthenticating(true)
    setError(null)
    try {
      const result = await authApi.register(username, password)
      setUser(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      throw err
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const logout = useCallback(() => {
    authApi.clearSession()
    setUser(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo(
    () => ({ user, isAuthenticating, error, login, register, logout, clearError }),
    [user, isAuthenticating, error, login, register, logout, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
