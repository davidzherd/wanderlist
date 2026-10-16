import { NominatimResultsSchema, NominatimReverseResultSchema, type NominatimResult } from '../types/location'
import { ApiError } from './client'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'

export async function geocodeSearch(query: string): Promise<NominatimResult[]> {
  if (query.trim().length < 3) return []

  const url = `${NOMINATIM_URL}?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`

  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new ApiError('Could not reach the geocoding service. Check your connection.')
  }

  if (!response.ok) {
    throw new ApiError('Geocoding lookup failed. Try again or enter coordinates manually.')
  }

  const data: unknown = await response.json()
  const parsed = NominatimResultsSchema.safeParse(data)
  if (!parsed.success) {
    throw new ApiError('Unexpected response from geocoding service.')
  }

  return parsed.data
}

/**
 * Looks up the place at a coordinate (e.g. a right-clicked map spot). Resolves to `null` when there's nothing there
 * (open sea) — throws ApiError only for network/service failures, like geocodeSearch.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<{ name: string; country: string } | null> {
  const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`

  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new ApiError('Could not reach the geocoding service. Check your connection.')
  }

  if (!response.ok) {
    throw new ApiError('Geocoding lookup failed.')
  }

  const parsed = NominatimReverseResultSchema.safeParse(await response.json())
  if (!parsed.success) return null

  const { name, display_name, address } = parsed.data
  const placeName =
    name ||
    address?.city ||
    address?.town ||
    address?.village ||
    address?.hamlet ||
    address?.suburb ||
    address?.county ||
    address?.state ||
    display_name.split(',')[0].trim()
  return { name: placeName, country: address?.country ?? '' }
}
