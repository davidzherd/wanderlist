import { LocationListSchema, LocationSchema, type Location, type LocationFormValues } from '../types/location'
import { ApiError, makeId, mockDelay, readStore, writeStore, STORAGE_KEYS } from './client'

function seedIfEmpty(username: string): void {
  if (readStore<boolean>(STORAGE_KEYS.seeded, false)) return

  const now = new Date().toISOString()
  const seedLocations: Location[] = [
    // Tokyo cluster
    { id: makeId(), username, name: 'Shibuya Crossing', country: 'Japan', category: 'Landmark', priority: 5, latitude: 35.6595, longitude: 139.7005, notes: 'Iconic scramble crossing.', visited: false, createdAt: now },
    { id: makeId(), username, name: 'Senso-ji Temple', country: 'Japan', category: 'Culture', priority: 4, latitude: 35.7148, longitude: 139.7967, notes: "Tokyo's oldest temple.", visited: false, createdAt: now },
    { id: makeId(), username, name: 'Tsukiji Outer Market', country: 'Japan', category: 'Food', priority: 4, latitude: 35.6654, longitude: 139.7707, notes: 'Fresh sushi breakfast.', visited: false, createdAt: now },
    { id: makeId(), username, name: 'Shinjuku Gyoen', country: 'Japan', category: 'Nature', priority: 3, latitude: 35.6852, longitude: 139.7100, notes: 'Cherry blossoms in spring.', visited: false, createdAt: now },
    // Paris cluster
    { id: makeId(), username, name: 'Eiffel Tower', country: 'France', category: 'Landmark', priority: 5, latitude: 48.8584, longitude: 2.2945, notes: 'Sunset view from Trocadéro.', imageUrl: 'https://picsum.photos/seed/eiffel-tower/400/300', visited: false, createdAt: now },
    { id: makeId(), username, name: 'Louvre Museum', country: 'France', category: 'Culture', priority: 5, latitude: 48.8606, longitude: 2.3376, notes: 'Book tickets online in advance.', visited: false, createdAt: now },
    { id: makeId(), username, name: 'Montmartre', country: 'France', category: 'Culture', priority: 3, latitude: 48.8867, longitude: 2.3431, notes: 'Sacré-Cœur and artists square.', visited: false, createdAt: now },
    { id: makeId(), username, name: 'Le Marais', country: 'France', category: 'Food', priority: 3, latitude: 48.8575, longitude: 2.3622, notes: 'Falafel and boutique shopping.', visited: false, createdAt: now },
    // Standalone pins
    { id: makeId(), username, name: 'Machu Picchu', country: 'Peru', category: 'Landmark', priority: 5, latitude: -13.1631, longitude: -72.5450, notes: 'Book the Inca Trail early.', imageUrl: 'https://picsum.photos/seed/machu-picchu/400/300', visited: false, createdAt: now },
    { id: makeId(), username, name: 'Serengeti National Park', country: 'Tanzania', category: 'Nature', priority: 4, latitude: -2.3333, longitude: 34.8333, notes: 'Great migration season.', visited: false, createdAt: now },
  ]

  writeStore(STORAGE_KEYS.locations, seedLocations)
  writeStore(STORAGE_KEYS.seeded, true)
}

export async function fetchLocations(username: string): Promise<Location[]> {
  seedIfEmpty(username)
  const all = readStore<unknown[]>(STORAGE_KEYS.locations, [])
  const parsed = LocationListSchema.parse(all)
  const filtered = parsed.filter((loc) => loc.username === username)
  return mockDelay(filtered)
}

export async function createLocation(username: string, values: LocationFormValues): Promise<Location> {
  const all = readStore<unknown[]>(STORAGE_KEYS.locations, [])
  const parsed = LocationListSchema.parse(all)

  const newLocation: Location = LocationSchema.parse({
    id: makeId(),
    username,
    ...values,
    visited: false,
    createdAt: new Date().toISOString(),
  })

  writeStore(STORAGE_KEYS.locations, [...parsed, newLocation])
  return mockDelay(newLocation)
}

export async function updateLocation(username: string, id: string, patch: Partial<LocationFormValues & { visited: boolean }>): Promise<Location> {
  const all = readStore<unknown[]>(STORAGE_KEYS.locations, [])
  const parsed = LocationListSchema.parse(all)

  const index = parsed.findIndex((loc) => loc.id === id && loc.username === username)
  if (index === -1) throw new ApiError('Location not found')

  const updated = LocationSchema.parse({ ...parsed[index], ...patch })
  const next = [...parsed]
  next[index] = updated

  writeStore(STORAGE_KEYS.locations, next)
  return mockDelay(updated)
}

export async function deleteLocation(username: string, id: string): Promise<void> {
  const all = readStore<unknown[]>(STORAGE_KEYS.locations, [])
  const parsed = LocationListSchema.parse(all)
  const next = parsed.filter((loc) => !(loc.id === id && loc.username === username))

  writeStore(STORAGE_KEYS.locations, next)
  return mockDelay(undefined)
}
