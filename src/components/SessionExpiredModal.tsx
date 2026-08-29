import { useEffect, useLayoutEffect, useState } from 'react'
import { AlertTriangle, Clock, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Warning countdown: kept in sync with WARN_LEAD_MS in AuthContext so it reaches zero right as the
// token expires. Expired countdown: a short grace period before we sign the user out for them.
const SESSION_WARNING_SECONDS = 120
const EXPIRED_LOGOUT_SECONDS = 10

/**
 * A single modal for both ends of a session ending:
 *  - `warning`  — the session is still valid but about to expire and the user has gone idle. Offers
 *                 "Stay signed in" (refreshes the token) with a countdown to automatic sign-out.
 *  - `expired`  — the session already ended unrecoverably. Offers "Log in again", auto-signing out
 *                 when the short countdown elapses.
 */
export function SessionExpiredModal() {
  const { sessionWarning, sessionExpired, staySignedIn, logout } = useAuth()
  const mode = sessionWarning ? 'warning' : sessionExpired ? 'expired' : null
  const totalSeconds = mode === 'warning' ? SESSION_WARNING_SECONDS : EXPIRED_LOGOUT_SECONDS

  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [isStaying, setIsStaying] = useState(false)

  // Reset the countdown whenever the modal opens or switches mode, before paint so the user never
  // sees a stale number flash (e.g. the expired mode's 10 before the warning's 120).
  useLayoutEffect(() => {
    if (mode) setSecondsLeft(totalSeconds)
  }, [mode, totalSeconds])

  useEffect(() => {
    if (!mode) return
    if (secondsLeft <= 0) {
      logout()
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [mode, secondsLeft, logout])

  if (!mode) return null

  const handleStay = async () => {
    setIsStaying(true)
    await staySignedIn()
    setIsStaying(false)
  }

  const isWarning = mode === 'warning'

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4">
      <div role="alertdialog" aria-modal="true" className="glass-panel w-full max-w-sm rounded-2xl p-6 text-center shadow-glass">
        {isWarning ? (
          <Clock size={32} className="mx-auto mb-3 text-harbor" />
        ) : (
          <AlertTriangle size={32} className="mx-auto mb-3 text-amber-500" />
        )}
        <h2 className="font-display text-lg font-semibold text-ink dark:text-mist-light">
          {isWarning ? 'Still there?' : 'Session expired'}
        </h2>
        <p className="mt-2 text-sm text-ink/70 dark:text-mist-light/70">
          {isWarning ? (
            <>
              You've been inactive for a while. To keep your account secure you'll be signed out in {secondsLeft}s — stay
              signed in to pick up where you left off.
            </>
          ) : (
            <>
              Your session has expired for security reasons. You'll be signed out automatically in {secondsLeft}s, or you
              can sign in again now.
            </>
          )}
        </p>

        {isWarning ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleStay}
              disabled={isStaying}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-harbor px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStaying && <Loader2 size={16} className="animate-spin" />}
              Stay signed in
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={isStaying}
              className="w-full rounded-full px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink disabled:opacity-60 dark:text-mist-light/60 dark:hover:text-mist-light"
            >
              Log out now
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full rounded-full bg-harbor px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Log in again
          </button>
        )}
      </div>
    </div>
  )
}
