import { useEffect, useRef, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface AlertModalProps {
  icon: ReactNode
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  // Optional secondary action (e.g. "Cancel", "Log out now").
  cancelLabel?: string
  onCancel?: () => void
  // What Escape / a backdrop click does. Omit to make the dialog non-dismissible — kept separate from
  // onCancel because some secondary actions (like logging out) must never fire by accident.
  onDismiss?: () => void
  // 'danger' styles the confirm button red for destructive actions (delete, remove…).
  tone?: 'default' | 'danger'
  // Shows a spinner on the confirm button and disables both buttons while an action is in flight.
  isBusy?: boolean
}

/**
 * The app's shared centered alert/confirm dialog: dimmed backdrop, frosted card, icon + title +
 * message, a primary pill button and an optional quieter secondary one. Used for the session
 * timeout warning, the location-permission notice, and destructive confirmations.
 *
 * For destructive dialogs (tone="danger") focus starts on the cancel button, so a stray Enter
 * press can't confirm the action.
 */
export function AlertModal({
  icon,
  title,
  children,
  confirmLabel,
  onConfirm,
  cancelLabel,
  onCancel,
  onDismiss,
  tone = 'default',
  isBusy = false,
}: AlertModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isDanger = tone === 'danger'

  useEffect(() => {
    ;(isDanger && cancelRef.current ? cancelRef.current : confirmRef.current)?.focus()
  }, [isDanger])

  useEffect(() => {
    if (!onDismiss) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onDismiss()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onDismiss, isBusy])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && onDismiss && !isBusy) onDismiss()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white/95 p-6 text-center shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-[#16212b]/95"
      >
        <div className="mb-3 flex justify-center">{icon}</div>
        <h2 id="alert-modal-title" className="font-display text-lg font-semibold text-ink dark:text-mist-light">
          {title}
        </h2>
        <div className="mt-2 text-sm text-ink/70 dark:text-mist-light/70">{children}</div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${
              isDanger ? 'bg-red-600' : 'bg-harbor'
            }`}
          >
            {isBusy && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
          {cancelLabel && onCancel && (
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="w-full rounded-full px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink disabled:opacity-60 dark:text-mist-light/60 dark:hover:text-mist-light"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
