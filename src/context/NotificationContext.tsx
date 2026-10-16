import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react'
import { PushNotification, type PushNotificationData, type PushTone } from '../components/PushNotification'
import { useSettings } from './SettingsContext'

/** The simple, text-only messages: each maps to an icon tile (check / warning / info / X). */
export type ToastType = PushTone

const TOAST_ICONS: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  removed: X,
}

/**
 * What a message is about, for the "Only location notifications" setting: that mode keeps errors (always) and
 * `location` messages (bucket-list location added/updated/removed) and drops the rest. Defaults to `general`.
 */
export type NotificationCategory = 'location' | 'general'

export type NotifyInput = Omit<PushNotificationData, 'id'> & { category?: NotificationCategory }

interface NotificationContextValue {
  /** Text-only message: an icon tile for the type, then the message. */
  pushToast: (type: ToastType, message: string, category?: NotificationCategory) => void
  /** Rich message (photo, custom icon, tap action). */
  notify: (notification: NotifyInput) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/**
 * App-wide phone-style notifications (one at a time — a new one replaces the one showing). Mounted inside
 * Layout's <main>, so the card sits just under the navbar on every page.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PushNotificationData | null>(null)
  const { settings } = useSettings()
  const onlyLocations = settings.notifications === 'locations'

  // A tone without an explicit icon gets that tone's standard icon (check / warning / info / X).
  const notify = useCallback(
    ({ category = 'general', ...notification }: NotifyInput) => {
      if (onlyLocations && notification.tone !== 'error' && category !== 'location') return
      const icon = notification.icon ?? (notification.tone ? TOAST_ICONS[notification.tone] : undefined)
      setCurrent({ ...notification, icon, id: newId() })
    },
    [onlyLocations],
  )

  const pushToast = useCallback(
    (type: ToastType, message: string, category?: NotificationCategory) => notify({ title: message, tone: type, category }),
    [notify],
  )

  const dismiss = useCallback(() => setCurrent(null), [])
  const value = useMemo(() => ({ pushToast, notify }), [pushToast, notify])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <PushNotification notification={current} onDismiss={dismiss} />
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider> (Layout)')
  return ctx
}
