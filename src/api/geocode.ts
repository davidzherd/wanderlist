import { NominatimResultsSchema, type NominatimResult } from '../types/location'
import { ApiError } from './client'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

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
