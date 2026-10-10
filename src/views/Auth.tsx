import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Compass, Eye, EyeOff, Loader2, LogIn, Moon, Sun, UserPlus } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import {
  LoginFormSchema,
  RegisterFormSchema,
  type LoginFormValues,
  type RegisterFormValues,
} from '../types/user'

export function AuthView() {
  const { user, isInitializing, login, register: registerUser, isAuthenticating, error, clearError } = useAuth()
  const routerLocation = useLocation()
  const initialMode = (routerLocation.state as { mode?: 'login' | 'register' } | null)?.mode ?? 'login'
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const { theme, toggleTheme } = useTheme()

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { email: '', password: '' },
  })

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  if (isInitializing) return null
  if (user) return <Navigate to="/map" replace />

  const switchMode = (next: 'login' | 'register') => {
    setMode(next)
    clearError()
    loginForm.reset()
    registerForm.reset()
  }

  const onLoginSubmit = async (values: LoginFormValues) => {
    try {
      await login(values.email, values.password)
    } catch {
      // Error surfaced via useAuth().error
    }
  }

  const onRegisterSubmit = async (values: RegisterFormValues) => {
    try {
      await registerUser(values.name, values.email, values.password)
    } catch {
      // Error surfaced via useAuth().error
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-gradient-to-br from-mist via-mist-light to-brass/20 px-4 py-20 dark:from-ink dark:via-ink-light dark:to-harbor-dark/20">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-harbor/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brass/20 blur-3xl" />

      {/* Top bar: back to the landing page + the same theme toggle the rest of the app has. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4">
        <Link
          to="/"
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-black/5 hover:text-ink dark:text-mist-light/70 dark:hover:bg-white/10 dark:hover:text-mist-light"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-black/5 dark:text-mist-light/70 dark:hover:bg-white/10"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="glass-panel relative z-10 w-full max-w-sm rounded-3xl p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo className="h-12 w-12" showWordmark={false} />
          <h1 className="font-display text-2xl font-semibold text-ink dark:text-mist-light">
            Going<span className="text-harbor">Roam</span>
          </h1>
          <p className="flex items-center gap-1 text-sm text-ink/60 dark:text-mist-light/60">
            <Compass size={14} /> Plan the trips you keep meaning to take
          </p>
        </div>

        <div className="mb-6 flex rounded-full bg-black/5 p-1 dark:bg-white/5">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-harbor text-white shadow-sm' : 'text-ink/60 dark:text-mist-light/60'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              mode === 'register' ? 'bg-harbor text-white shadow-sm' : 'text-ink/60 dark:text-mist-light/60'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="flex flex-col gap-3">
            <Field label="Email" error={loginForm.formState.errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                required
                {...loginForm.register('email')}
                className={inputClass}
              />
            </Field>
            <Field label="Password" error={loginForm.formState.errors.password?.message}>
              <PasswordInput autoComplete="current-password" required {...loginForm.register('password')} />
            </Field>
            <SubmitButton isSubmitting={isAuthenticating} icon={LogIn} label="Sign in" />
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="flex flex-col gap-3">
            <Field label="Name" error={registerForm.formState.errors.name?.message}>
              <input
                type="text"
                autoComplete="name"
                required
                {...registerForm.register('name')}
                className={inputClass}
              />
            </Field>
            <Field label="Email" error={registerForm.formState.errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                required
                {...registerForm.register('email')}
                className={inputClass}
              />
            </Field>
            <Field label="Password" error={registerForm.formState.errors.password?.message} hint="At least 6 characters">
              <PasswordInput autoComplete="new-password" required {...registerForm.register('password')} />
            </Field>
            <Field label="Confirm password" error={registerForm.formState.errors.confirmPassword?.message}>
              <PasswordInput autoComplete="new-password" required {...registerForm.register('confirmPassword')} />
            </Field>
            <SubmitButton isSubmitting={isAuthenticating} icon={UserPlus} label="Create account" />
          </form>
        )}
      </div>
    </div>
  )
}

// 16px text below lg: iOS Safari zooms the page when focusing an input under 16px. Visible border in light mode.
const inputClass =
  'w-full rounded-lg border border-black/15 bg-white/60 px-3 py-2 text-base lg:text-sm dark:border-white/20 text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  // Error/hint sit outside the <label> so the input's accessible name stays exactly the label text.
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70">{label}</span>
        {children}
      </label>
      {error ? (
        <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink/50 dark:text-mist-light/50">{hint}</span>
      )}
    </div>
  )
}

// Password field with a show/hide toggle. forwardRef so react-hook-form's register() can attach its ref.
const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function PasswordInput(props, ref) {
    const [isVisible, setIsVisible] = useState(false)
    return (
      <span className="relative block">
        <input ref={ref} type={isVisible ? 'text' : 'password'} {...props} className={`${inputClass} pr-11`} />
        <button
          type="button"
          onClick={() => setIsVisible((v) => !v)}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          title={isVisible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink/50 hover:text-ink dark:text-mist-light/50 dark:hover:text-mist-light"
        >
          {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    )
  },
)

function SubmitButton({
  isSubmitting,
  icon: Icon,
  label,
}: {
  isSubmitting: boolean
  icon: typeof LogIn
  label: string
}) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="mt-2 flex items-center justify-center gap-2 rounded-full bg-harbor py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
      {label}
    </button>
  )
}
