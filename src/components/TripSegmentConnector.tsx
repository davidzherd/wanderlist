import { Car, Footprints, Info, TriangleAlert } from 'lucide-react'
import type { TravelMode } from '../types/trip'
import { useSegmentTravelMode } from '../hooks/useSegmentTravelMode'
import {
  estimateTravel,
  formatDistanceKm,
  formatDurationMinutes,
  haversineKm,
  type Coordinates,
} from '../utils/travelEstimate'

// Straight-line distance (km) below which an untouched segment defaults to walking
// rather than driving — short hops are more likely walked.
const WALK_DEFAULT_THRESHOLD_KM = 2

// Above this straight-line distance (km) we stop estimating a walk/drive time — no
// one walks or drives it in one leg — and instead nudge the user to add a stop/flight.
const EXTREME_DISTANCE_THRESHOLD_KM = 1000

interface TripSegmentConnectorProps {
  from: Coordinates
  to: Coordinates
  /** Arrival stop's id — the localStorage key for this segment's walk/drive choice. */
  itemId: string
}

const MODES: { mode: TravelMode; Icon: typeof Car; label: string }[] = [
  { mode: 'walk', Icon: Footprints, label: 'Walking' },
  { mode: 'drive', Icon: Car, label: 'Driving' },
]

const railClass = 'h-4 w-px shrink-0 bg-black/10 dark:bg-white/10'

export function TripSegmentConnector({ from, to, itemId }: TripSegmentConnectorProps) {
  const [chosenMode, setMode] = useSegmentTravelMode(itemId)
  const straightKm = haversineKm(from, to)

  // Too far to walk or drive in one hop — skip the (meaningless) time estimate and
  // suggest breaking the leg up instead.
  if (straightKm > EXTREME_DISTANCE_THRESHOLD_KM) {
    return (
      <li
        role="presentation"
        className="flex break-inside-avoid items-center gap-2 pl-9 pr-1 text-xs text-amber-700 dark:text-amber-400/90"
      >
        <span className={railClass} aria-hidden="true" />
        <TriangleAlert size={13} className="shrink-0" aria-hidden="true" />
        <span>
          Those locations are more than 1,000&nbsp;km apart — maybe add a stop or a flight in between.
        </span>
      </li>
    )
  }

  // Distance is mode-independent, so we can pick the default before resolving mode.
  const defaultMode: TravelMode = straightKm < WALK_DEFAULT_THRESHOLD_KM ? 'walk' : 'drive'
  const mode = chosenMode ?? defaultMode
  const estimate = estimateTravel(from, to, mode)

  return (
    <li
      // Not a sortable stop — purely a derived divider between two place stops.
      role="presentation"
      className="flex break-inside-avoid items-center gap-2 pl-9 pr-1 text-xs text-ink/60 dark:text-mist-light/60"
    >
      <span className={railClass} aria-hidden="true" />

      {/* Compact walk/drive segmented control — the two options sit side by side so
          the choice is obvious and the toggle is one glance, not a hunt. */}
      <div
        role="group"
        aria-label="Travel mode"
        className="inline-flex shrink-0 overflow-hidden rounded-full border border-black/10 dark:border-white/10"
      >
        {MODES.map(({ mode: m, Icon, label }) => {
          const isActive = m === mode
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-label={label}
              aria-pressed={isActive}
              title={label}
              className={`flex h-5 w-6 items-center justify-center transition-colors ${
                isActive
                  ? 'bg-harbor text-white'
                  : 'text-ink/45 hover:bg-harbor/10 hover:text-harbor dark:text-mist-light/45'
              }`}
            >
              <Icon size={12} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      <span className="font-medium text-ink/75 dark:text-mist-light/75">
        ~{formatDurationMinutes(estimate.durationMinutes)}
        <span className="text-ink/40 dark:text-mist-light/40"> · </span>
        ~{formatDistanceKm(estimate.distanceKm)}
      </span>

      <span
        className="inline-flex items-center gap-0.5 text-ink/35 dark:text-mist-light/35"
        title="Estimated from straight-line distance — actual road time and distance will vary."
      >
        <Info size={11} aria-hidden="true" />
        <span className="italic">estimated</span>
      </span>
    </li>
  )
}
