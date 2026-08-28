import { useCallback, useState } from 'react'
import type { TravelMode } from '../types/trip'

// The walk/drive choice for a travel segment is a lightweight per-viewer UI
// preference, not trip data — so it lives in localStorage (keyed by the arrival
// stop's id), not the database.
//
// Only the user's EXPLICIT choice is stored; `null` means "untouched", so the
// caller can fall back to a live, distance-based default (short hop → walk). This
// keeps an untouched segment's default correct after a reorder instead of freezing
// whatever it was when first rendered. Every access is guarded: localStorage can
// throw or be unavailable (private mode, blocked storage), in which case the
// segment still renders on the caller's default.

const KEY_PREFIX = 'wanderlist.travelMode.'

function readStoredMode(itemId: string): TravelMode | null {
  try {
    const stored = localStorage.getItem(KEY_PREFIX + itemId)
    return stored === 'walk' || stored === 'drive' ? stored : null
  } catch {
    return null
  }
}

/**
 * The user's explicitly chosen walk/drive mode for the segment entering stop
 * `itemId`, or `null` if they haven't chosen — the caller resolves the default.
 */
export function useSegmentTravelMode(itemId: string): [TravelMode | null, (mode: TravelMode) => void] {
  const [chosen, setChosen] = useState<TravelMode | null>(() => readStoredMode(itemId))

  const setMode = useCallback(
    (next: TravelMode) => {
      setChosen(next)
      try {
        localStorage.setItem(KEY_PREFIX + itemId, next)
      } catch {
        // Non-persistent this session — the in-memory state still updates the UI.
      }
    },
    [itemId],
  )

  return [chosen, setMode]
}
