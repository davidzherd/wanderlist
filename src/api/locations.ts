import { LocationSchema, type Location, type LocationFormValues } from '../types/location'
import { toIsoString, xanoRequest, XANO_LOCATIONS_URL } from './client'

interface XanoLocation {
  id: number
  user_id: number
  name: string
  country: string
  category: string
  priority: number
  latitude: number
  longitude: number
  notes?: string | null
  image_url?: string | null
  visited: boolean
  created_at: string | number
}

interface LocationListResponse {
  items: XanoLocation[]
}

function normalize(raw: XanoLocation): Location {
  return LocationSchema.parse({
    id: String(raw.id),
    name: raw.name,
    country: raw.country,
    category: raw.category,
    priority: raw.priority,
    latitude: raw.latitude,
    longitude: raw.longitude,
    notes: raw.notes || undefined,
    imageUrl: raw.image_url || undefined,
    visited: raw.visited,
    createdAt: toIsoString(raw.created_at),
  })
}

export async function fetchLocations(token: string): Promise<Location[]> {
  const result = await xanoRequest<LocationListResponse>(XANO_LOCATIONS_URL, '/locations?per_page=200', {
    method: 'GET',
    token,
  })
  return result.items.map(normalize)
}

export async function createLocation(token: string, values: LocationFormValues): Promise<Location> {
  const created = await xanoRequest<XanoLocation>(XANO_LOCATIONS_URL, '/locations', {
    method: 'POST',
    token,
    body: {
      name: values.name,
      country: values.country,
      category: values.category,
      priority: values.priority,
      latitude: values.latitude,
      longitude: values.longitude,
      notes: values.notes || undefined,
      image_url: values.imageUrl || undefined,
    },
  })
  return normalize(created)
}

export async function updateLocation(
  token: string,
  id: string,
  patch: Partial<LocationFormValues & { visited: boolean }>,
): Promise<Location> {
  const { imageUrl, ...rest } = patch
  const updated = await xanoRequest<XanoLocation>(XANO_LOCATIONS_URL, `/locations/${id}`, {
    method: 'PATCH',
    token,
    body: {
      ...rest,
      ...(imageUrl !== undefined ? { image_url: imageUrl || undefined } : {}),
    },
  })
  return normalize(updated)
}

export async function deleteLocation(token: string, id: string): Promise<void> {
  await xanoRequest<{ success: boolean }>(XANO_LOCATIONS_URL, `/locations/${id}`, {
    method: 'DELETE',
    token,
  })
}
