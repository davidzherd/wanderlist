import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../api/supabaseClient'
import { useAuth } from './AuthContext'
import { parseUserSettings, type UserSettings } from '../types/settings'

interface SettingsContextValue {
  settings: UserSettings
  /** Applies immediately (optimistic) and saves to the account in the background. */
  updateSettings: (patch: Partial<UserSettings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/**
 * The signed-in user's preferences (see types/settings.ts). Loaded from `user_metadata.settings` whenever the user
 * changes; until then (and when signed out) the defaults apply.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserSettings>(() => parseUserSettings(null))
  // The latest settings, for building the next save without waiting on a re-render.
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    if (!user) {
      setSettings(parseUserSettings(null))
      return
    }
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSettings(parseUserSettings((data.session?.user.user_metadata as { settings?: unknown } | null)?.settings))
    })
    return () => {
      cancelled = true
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- reload per account, not per user-object refresh

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    const next = { ...settingsRef.current, ...patch }
    settingsRef.current = next
    setSettings(next)
    // updateUser merges `data` into the existing user_metadata, so the display name is untouched.
    void supabase.auth.updateUser({ data: { settings: next } }).then(({ error }) => {
      if (error) console.error('Could not save settings', error)
    })
  }, [])

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
