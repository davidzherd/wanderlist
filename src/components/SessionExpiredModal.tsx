import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const AUTO_LOGOUT_SECONDS = 10

export function SessionExpiredModal() {
  const { sessionExpired, logout } = useAuth()
  const [secondsLeft, setSecondsLeft] = useState(AUTO_LOGOUT_SECONDS)

  useEffect(() => {
    if (!sessionExpired) {
      setSecondsLeft(AUTO_LOGOUT_SECONDS)
      return
    }
    if (secondsLeft <= 0) {
      logout()
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [sessionExpired, secondsLeft, logout])

  if (!sessionExpired) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4">
      <div role="alertdialog" aria-modal="true" className="glass-panel w-full max-w-sm rounded-2xl p-6 text-center shadow-glass">
        <AlertTriangle size={32} className="mx-auto mb-3 text-amber-500" />
        <h2 className="font-display text-lg font-semibold text-ink dark:text-mist-light">Session expired</h2>
        <p className="mt-2 text-sm text-ink/70 dark:text-mist-light/70">
          Your session has expired for security reasons. You'll be signed out automatically in {secondsLeft}s, or you can
          sign in again now.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-4 w-full rounded-full bg-harbor px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Log in again
        </button>
      </div>
    </div>
  )
}
