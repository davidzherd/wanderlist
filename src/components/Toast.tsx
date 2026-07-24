import { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastData {
  id: string
  type: ToastType
  message: string
}

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: AlertTriangle,
}

const STYLES: Record<ToastType, string> = {
  success: 'border-emerald-400/40 text-emerald-100 bg-emerald-600/20',
  error: 'border-red-400/40 text-red-100 bg-red-600/20',
  info: 'border-amber/40 text-amber-100 bg-amber/20',
}

interface ToastProps {
  toast: ToastData
  onDismiss: (id: string) => void
}

function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = ICONS[toast.type]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      role="alert"
      className={`glass-panel flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-espresso dark:text-sand-light shadow-glass ${STYLES[toast.type]}`}
    >
      <Icon size={18} className="shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  )
}

interface ToastStackProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-[1000] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
