import { TripListSchema, TripSchema, type Trip, type TripItem } from '../types/trip'
import { ApiError, makeId, mockDelay, readStore, writeStore, STORAGE_KEYS } from './client'

export async function fetchTrips(username: string): Promise<Trip[]> {
  const all = readStore<unknown[]>(STORAGE_KEYS.trips, [])
  const parsed = TripListSchema.parse(all)
  return mockDelay(parsed.filter((trip) => trip.username === username))
}

export async function createTrip(username: string, name: string): Promise<Trip> {
  const all = readStore<unknown[]>(STORAGE_KEYS.trips, [])
  const parsed = TripListSchema.parse(all)

  const newTrip: Trip = TripSchema.parse({
    id: makeId(),
    username,
    name,
    items: [],
    createdAt: new Date().toISOString(),
  })

  writeStore(STORAGE_KEYS.trips, [...parsed, newTrip])
  return mockDelay(newTrip)
}

export async function deleteTrip(username: string, id: string): Promise<void> {
  const all = readStore<unknown[]>(STORAGE_KEYS.trips, [])
  const parsed = TripListSchema.parse(all)
  const next = parsed.filter((trip) => !(trip.id === id && trip.username === username))
  writeStore(STORAGE_KEYS.trips, next)
  return mockDelay(undefined)
}

export async function addTripItem(username: string, tripId: string, item: Omit<TripItem, 'id'>): Promise<Trip> {
  const all = readStore<unknown[]>(STORAGE_KEYS.trips, [])
  const parsed = TripListSchema.parse(all)

  const index = parsed.findIndex((trip) => trip.id === tripId && trip.username === username)
  if (index === -1) throw new ApiError('Trip not found')

  const updated: Trip = { ...parsed[index], items: [...parsed[index].items, { ...item, id: makeId() }] }
  const next = [...parsed]
  next[index] = TripSchema.parse(updated)

  writeStore(STORAGE_KEYS.trips, next)
  return mockDelay(next[index])
}

export async function removeTripItem(username: string, tripId: string, itemId: string): Promise<Trip> {
  const all = readStore<unknown[]>(STORAGE_KEYS.trips, [])
  const parsed = TripListSchema.parse(all)

  const index = parsed.findIndex((trip) => trip.id === tripId && trip.username === username)
  if (index === -1) throw new ApiError('Trip not found')

  const updated: Trip = { ...parsed[index], items: parsed[index].items.filter((i) => i.id !== itemId) }
  const next = [...parsed]
  next[index] = TripSchema.parse(updated)

  writeStore(STORAGE_KEYS.trips, next)
  return mockDelay(next[index])
}
