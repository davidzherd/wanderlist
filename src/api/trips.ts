import { TripListSchema, TripSchema, type Trip, type TripDay, type TripItem } from '../types/trip'
import { ApiError, makeId, mockDelay, readStore, writeStore, STORAGE_KEYS } from './client'

const MAX_TRIP_DAYS = 60

function addDaysToIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function computeDaySpan(startDate?: string, endDate?: string): string[] {
  if (!startDate || !endDate) return []
  const span: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    span.push(cursor)
    cursor = addDaysToIso(cursor, 1)
  }
  return span
}

/** Grows `existingDays` to cover the date span, updating dates by position. Never removes days, so item -> day references never orphan. */
function syncDays(existingDays: TripDay[], startDate?: string, endDate?: string): TripDay[] {
  const span = computeDaySpan(startDate, endDate)
  if (span.length === 0) return existingDays

  const next = [...existingDays]
  for (let i = 0; i < span.length; i++) {
    next[i] = next[i] ? { ...next[i], date: span[i] } : { id: makeId(), date: span[i] }
  }
  return next
}

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

export async function reorderTripItems(username: string, tripId: string, items: TripItem[]): Promise<Trip> {
  const all = readStore<unknown[]>(STORAGE_KEYS.trips, [])
  const parsed = TripListSchema.parse(all)

  const index = parsed.findIndex((trip) => trip.id === tripId && trip.username === username)
  if (index === -1) throw new ApiError('Trip not found')

  const updated: Trip = { ...parsed[index], items }
  const next = [...parsed]
  next[index] = TripSchema.parse(updated)

  writeStore(STORAGE_KEYS.trips, next)
  return mockDelay(next[index])
}

export async function updateTripDates(
  username: string,
  tripId: string,
  startDate?: string,
  endDate?: string,
): Promise<Trip> {
  const all = readStore<unknown[]>(STORAGE_KEYS.trips, [])
  const parsed = TripListSchema.parse(all)

  const index = parsed.findIndex((trip) => trip.id === tripId && trip.username === username)
  if (index === -1) throw new ApiError('Trip not found')

  if (startDate && endDate) {
    if (endDate < startDate) throw new ApiError('End date must be on or after the start date')
    if (daysBetweenInclusive(startDate, endDate) > MAX_TRIP_DAYS) {
      throw new ApiError(`Trips can span at most ${MAX_TRIP_DAYS} days`)
    }
  }

  const updated: Trip = {
    ...parsed[index],
    startDate,
    endDate,
    days: syncDays(parsed[index].days, startDate, endDate),
  }
  const next = [...parsed]
  next[index] = TripSchema.parse(updated)

  writeStore(STORAGE_KEYS.trips, next)
  return mockDelay(next[index])
}

export async function addTripDay(username: string, tripId: string): Promise<Trip> {
  const all = readStore<unknown[]>(STORAGE_KEYS.trips, [])
  const parsed = TripListSchema.parse(all)

  const index = parsed.findIndex((trip) => trip.id === tripId && trip.username === username)
  if (index === -1) throw new ApiError('Trip not found')

  const days = parsed[index].days
  if (days.length >= MAX_TRIP_DAYS) throw new ApiError(`Trips can span at most ${MAX_TRIP_DAYS} days`)

  const lastDay = days[days.length - 1]
  const nextDate = lastDay?.date ? addDaysToIso(lastDay.date, 1) : undefined
  const updated: Trip = { ...parsed[index], days: [...days, { id: makeId(), date: nextDate }] }
  const next = [...parsed]
  next[index] = TripSchema.parse(updated)

  writeStore(STORAGE_KEYS.trips, next)
  return mockDelay(next[index])
}

export async function removeTripDay(username: string, tripId: string, dayId: string): Promise<Trip> {
  const all = readStore<unknown[]>(STORAGE_KEYS.trips, [])
  const parsed = TripListSchema.parse(all)

  const index = parsed.findIndex((trip) => trip.id === tripId && trip.username === username)
  if (index === -1) throw new ApiError('Trip not found')

  if (parsed[index].items.some((item) => item.dayId === dayId)) {
    throw new ApiError('Move or remove this day’s items before deleting it')
  }

  const updated: Trip = { ...parsed[index], days: parsed[index].days.filter((d) => d.id !== dayId) }
  const next = [...parsed]
  next[index] = TripSchema.parse(updated)

  writeStore(STORAGE_KEYS.trips, next)
  return mockDelay(next[index])
}
