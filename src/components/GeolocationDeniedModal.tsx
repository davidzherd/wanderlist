import { MapPinOff } from 'lucide-react'

interface GeolocationDeniedModalProps {
  onClose: () => void
}

/**
 * Shown when the user declines (or has blocked) the location permission. We never store the denial —
 * this just explains why the map can't show their position and points them at re-enabling it, then
 * they can tap Locate again whenever they're ready. Styling mirrors SessionExpiredModal.
 */
export function GeolocationDeniedModal({ onClose }: GeolocationDeniedModalProps) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white/95 p-6 text-center shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-[#16212b]/95"
      >
        <MapPinOff size={32} className="mx-auto mb-3 text-harbor dark:text-harbor-light" />
        <h2 className="font-display text-lg font-semibold text-ink dark:text-mist-light">Location access needed</h2>
        <p className="mt-2 text-sm text-ink/70 dark:text-mist-light/70">
          Showing yourself on the map only works with location permission. Nothing is saved — allow access in your
          browser's site settings, then tap the locate button again whenever you're ready.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-harbor px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
