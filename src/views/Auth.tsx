import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate } from 'react-router-dom'
import { Compass, Loader2, LogIn, UserPlus } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import {
  LoginFormSchema,
  RegisterFormSchema,
  type LoginFormValues,
  type RegisterFormValues,
} from '../types/user'

export function AuthView() {
  const { user, isInitializing, login, register: registerUser, isAuthenticating, error, clearError } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { email: '', password: '' },
  })

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  if (isInitializing) return null
  if (user) return <Navigate to="/" replace />

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
    <div className="relative flex h-screen w-screen items-start justify-center overflow-hidden bg-gradient-to-br from-mist via-mist-light to-brass/20 pt-20 dark:from-ink dark:via-ink-light dark:to-harbor-dark/20 sm:pt-28">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-harbor/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brass/20 blur-3xl" />

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
                {...loginForm.register('email')}
                className={inputClass}
              />
            </Field>
            <Field label="Password" error={loginForm.formState.errors.password?.message}>
              <input
                type="password"
                autoComplete="current-password"
                {...loginForm.register('password')}
                className={inputClass}
              />
            </Field>
            <SubmitButton isSubmitting={isAuthenticating} icon={LogIn} label="Sign in" />
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="flex flex-col gap-3">
            <Field label="Name" error={registerForm.formState.errors.name?.message}>
              <input
                type="text"
                autoComplete="name"
                {...registerForm.register('name')}
                className={inputClass}
              />
            </Field>
            <Field label="Email" error={registerForm.formState.errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                {...registerForm.register('email')}
                className={inputClass}
              />
            </Field>
            <Field label="Password" error={registerForm.formState.errors.password?.message}>
              <input
                type="password"
                autoComplete="new-password"
                {...registerForm.register('password')}
                className={inputClass}
              />
            </Field>
            <Field label="Confirm password" error={registerForm.formState.errors.confirmPassword?.message}>
              <input
                type="password"
                autoComplete="new-password"
                {...registerForm.register('confirmPassword')}
                className={inputClass}
              />
            </Field>
            <SubmitButton isSubmitting={isAuthenticating} icon={UserPlus} label="Create account" />
          </form>
        )}
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-white/20 bg-white/40 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  )
}

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
