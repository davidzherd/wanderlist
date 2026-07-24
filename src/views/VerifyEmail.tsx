import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Compass, Loader2, XCircle } from 'lucide-react'
import { Logo } from '../components/Logo'
import { verifyEmail } from '../api/auth'
import { ApiError } from '../api/client'

type Status = 'verifying' | 'success' | 'error'

export function VerifyEmailView() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    if (!token) {
      setStatus('error')
      setMessage('This verification link is missing its token.')
      return
    }

    verifyEmail(token)
      .then((email) => {
        setStatus('success')
        setMessage(`${email} is now verified. You can sign in.`)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err instanceof ApiError ? err.message : 'Could not verify this link. Try again.')
      })
  }, [token])

  return (
    <div className="relative flex h-screen w-screen items-start justify-center overflow-hidden bg-gradient-to-br from-sand via-sand-light to-amber/20 pt-20 dark:from-espresso dark:via-espresso-light dark:to-terracotta-dark/20 sm:pt-28">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-terracotta/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber/20 blur-3xl" />

      <div className="glass-panel relative z-10 w-full max-w-sm rounded-3xl p-8 text-center">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo className="h-12 w-12" showWordmark={false} />
          <h1 className="font-display text-2xl font-semibold text-espresso dark:text-sand-light">
            Wander<span className="text-terracotta">List</span>
          </h1>
          <p className="flex items-center gap-1 text-sm text-espresso/60 dark:text-sand-light/60">
            <Compass size={14} /> Plan the trips you keep meaning to take
          </p>
        </div>

        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 size={28} className="animate-spin text-terracotta" />
            <p className="text-sm text-espresso/70 dark:text-sand-light/70">Verifying your email…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <p className="text-sm text-espresso/70 dark:text-sand-light/70">{message}</p>
            <Link
              to="/auth"
              className="mt-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <XCircle size={28} className="text-red-500" />
            <p className="text-sm text-espresso/70 dark:text-sand-light/70">{message}</p>
            <Link
              to="/auth"
              className="mt-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
