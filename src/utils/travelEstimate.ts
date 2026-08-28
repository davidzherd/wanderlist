import type { TravelMode } from '../types/trip'

// Offline travel estimate between two stops.
//
// We only have straight-line ("as the crow flies") distance from each stop's
// coordinates — there's no road-network data — so this is deliberately an
// approximation, surfaced as such in the UI. Real road paths are longer than the
// straight line, so we inflate both distance and time by a correction factor that
// is larger for short city hops (lots of turns, one-ways, blocks) than for long
// inter-city legs (mostly straight highway).

export const WALK_SPEED_KMH = 4.5
export const DRIVE_SPEED_KMH = 80

// Straight-line distance at/under this (km) is treated as a dense "city drive"
// and inflated more; anything above is a longer, straighter leg.
const CITY_DISTANCE_THRESHOLD_KM = 20
const CITY_CORRECTION = 1.2 // +20%
const LONG_CORRECTION = 1.1 // +10%

const EARTH_RADIUS_KM = 6371

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface TravelEstimate {
  /** Corrected (road-approximate) distance in km. */
  distanceKm: number
  /** Corrected travel time in minutes. */
  durationMinutes: number
  mode: TravelMode
}

const toRadians = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude)
  const dLon = toRadians(to.longitude - from.longitude)
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(to.latitude)

  const a =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

/**
 * Estimate travel distance and time between two stops for the given mode.
 * The correction factor is applied to BOTH distance and time (time is derived
 * from the corrected distance, so it carries the same inflation).
 */
export function estimateTravel(from: Coordinates, to: Coordinates, mode: TravelMode): TravelEstimate {
  const straightKm = haversineKm(from, to)
  const correction = straightKm <= CITY_DISTANCE_THRESHOLD_KM ? CITY_CORRECTION : LONG_CORRECTION
  const distanceKm = straightKm * correction
  const speedKmh = mode === 'walk' ? WALK_SPEED_KMH : DRIVE_SPEED_KMH
  const durationMinutes = (distanceKm / speedKmh) * 60
  return { distanceKm, durationMinutes, mode }
}

/** e.g. 0.8 -> "800 m", 2.43 -> "2.4 km", 37.1 -> "37 km". */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

/** e.g. 23.4 -> "23 min", 95 -> "1 hr 35 min", 120 -> "2 hr". */
export function formatDurationMinutes(minutes: number): string {
  const total = Math.max(1, Math.round(minutes))
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`
}
