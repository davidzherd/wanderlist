import { useEffect, useLayoutEffect, useState } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AlertModal } from './AlertModal'

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

  if (mode === 'warning') {
    return (
      <AlertModal
        icon={<Clock size={32} className="text-harbor" />}
        title="Still there?"
        confirmLabel="Stay signed in"
        onConfirm={handleStay}
        cancelLabel="Log out now"
        onCancel={logout}
        isBusy={isStaying}
      >
        You've been inactive for a while. To keep your account secure you'll be signed out in {secondsLeft}s — stay
        signed in to pick up where you left off.
      </AlertModal>
    )
  }

  return (
    <AlertModal
      icon={<AlertTriangle size={32} className="text-amber-500" />}
      title="Session expired"
      confirmLabel="Log in again"
      onConfirm={logout}
    >
      Your session has expired for security reasons. You'll be signed out automatically in {secondsLeft}s, or you can
      sign in again now.
    </AlertModal>
  )
}
