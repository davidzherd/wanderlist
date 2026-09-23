import { MapPinOff } from 'lucide-react'
import { AlertModal } from './AlertModal'

interface GeolocationDeniedModalProps {
  onClose: () => void
}

/**
 * Shown when the user declines (or has blocked) the location permission. We never store the denial —
 * this just explains why the map can't show their position and points them at re-enabling it, then
 * they can tap Locate again whenever they're ready.
 */
export function GeolocationDeniedModal({ onClose }: GeolocationDeniedModalProps) {
  return (
    <AlertModal
      icon={<MapPinOff size={32} className="text-harbor dark:text-harbor-light" />}
      title="Location access needed"
      confirmLabel="Got it"
      onConfirm={onClose}
      onDismiss={onClose}
    >
      Showing yourself on the map only works with location permission. Nothing is saved — allow access in your
      browser's site settings, then tap the locate button again whenever you're ready.
    </AlertModal>
  )
}
