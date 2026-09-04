import { LocateFixed, Loader2 } from 'lucide-react'
import type { GeolocationStatus } from '../hooks/useGeolocation'

interface LocateButtonProps {
  status: GeolocationStatus
  onClick: () => void
}

/**
 * Floating "Locate me" control, mirroring AddLocationButton but anchored bottom-left. First tap
 * triggers the permission prompt (via the geolocation hook's start()); once tracking, tapping again
 * recenters the map on the user. Spins while acquiring the first fix.
 */
export function LocateButton({ status, onClick }: LocateButtonProps) {
  const isLocating = status === 'locating'
  const isActive = status === 'active'

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-[900]">
      <button
        type="button"
        onClick={onClick}
        disabled={isLocating}
        aria-label={isActive ? 'Recenter map on my location' : 'Show my location on the map'}
        className={`pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 disabled:cursor-wait ${
          isActive ? 'bg-harbor text-white' : 'glass-panel text-harbor dark:text-harbor-light'
        }`}
      >
        {isLocating ? <Loader2 size={24} className="animate-spin" /> : <LocateFixed size={24} strokeWidth={2} />}
      </button>
    </div>
  )
}
