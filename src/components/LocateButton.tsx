import { createPortal } from 'react-dom'
import { LocateFixed, LocateOff, Loader2 } from 'lucide-react'
import type { GeolocationStatus } from '../hooks/useGeolocation'

interface LocateButtonProps {
  status: GeolocationStatus
  // The map is currently focused on the user's dot — tapping now turns tracking off.
  isCentered: boolean
  onClick: () => void
  /** Phones: the map's control-stack element — the button renders inside it instead of floating bottom-left. */
  stackEl?: HTMLElement | null
}

/**
 * Floating "Locate me" control, mirroring AddLocationButton but anchored bottom-left. First tap
 * triggers the permission prompt (via the geolocation hook's start()); once tracking, tapping again
 * recenters the map on the user, and tapping while already focused on the user turns tracking off
 * (the icon switches to LocateOff to signal that). Spins while acquiring the first fix.
 */
export function LocateButton({ status, isCentered, onClick, stackEl }: LocateButtonProps) {
  const isLocating = status === 'locating'
  const isActive = status === 'active'
  const willTurnOff = isActive && isCentered

  const label = willTurnOff
    ? 'Hide my location'
    : isActive
      ? 'Recenter map on my location'
      : 'Show my location on the map'

  const icon = isLocating ? (
    <Loader2 size={stackEl ? 20 : 24} className="animate-spin" />
  ) : willTurnOff ? (
    <LocateOff size={stackEl ? 20 : 24} strokeWidth={2} />
  ) : (
    <LocateFixed size={stackEl ? 20 : 24} strokeWidth={2} />
  )

  if (stackEl) {
    return createPortal(
      <button
        type="button"
        onClick={onClick}
        disabled={isLocating}
        aria-label={label}
        title={label}
        className={`order-2 flex h-11 w-11 items-center justify-center rounded-b-xl only:rounded-xl disabled:cursor-wait ${
          isActive ? 'bg-harbor text-white' : 'text-harbor dark:text-harbor-light'
        }`}
      >
        {icon}
      </button>,
      stackEl,
    )
  }

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-[900]">
      <button
        type="button"
        onClick={onClick}
        disabled={isLocating}
        aria-label={label}
        title={label}
        className={`pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 disabled:cursor-wait ${
          isActive ? 'bg-harbor text-white' : 'glass-panel text-harbor dark:text-harbor-light'
        }`}
      >
        {icon}
      </button>
    </div>
  )
}
