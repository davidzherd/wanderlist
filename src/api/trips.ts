import {
  TripSchema,
  type Trip,
  type TripDay,
  type TripItem,
  type TripItemKind,
  type TransportType,
} from '../types/trip'
import { ApiError } from './client'
import { supabase } from './supabaseClient'

const MAX_TRIP_DAYS = 60

interface SupabaseTripRow {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

interface SupabaseTripDayRow {
  id: string
  trip_id: string
  date: string | null
  sort_order: number
}

interface SupabaseTripItemRow {
  id: string
  trip_id: string
  day_id: string | null
  location_id: string | null
  kind: TripItemKind
  name: string
  country: string | null
  custom: boolean
  image_url: string | null
  description: string | null
  transport_type: TransportType | null
  departure_time: string | null
  arrival_time: string | null
  check_in_time: string | null
  check_out_time: string | null
  sort_order: number
}

interface SupabaseTripFullRow extends SupabaseTripRow {
  trip_days: SupabaseTripDayRow[]
  trip_items: SupabaseTripItemRow[]
}

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order

function normalizeTrip(trip: SupabaseTripRow, days: SupabaseTripDayRow[], items: SupabaseTripItemRow[]): Trip {
  return TripSchema.parse({
    id: trip.id,
    name: trip.name,
    startDate: trip.start_date || undefined,
    endDate: trip.end_date || undefined,
    days: [...days].sort(bySortOrder).map(
      (d): TripDay => ({ id: d.id, date: d.date || undefined }),
    ),
    items: [...items].sort(bySortOrder).map(
      (i): TripItem => ({
        id: i.id,
        kind: i.kind,
        locationId: i.location_id || undefined,
        name: i.name,
        country: i.country || undefined,
        custom: i.custom,
        imageUrl: i.image_url || undefined,
        description: i.description || undefined,
        transportType: i.transport_type || undefined,
        departureTime: i.departure_time || undefined,
        arrivalTime: i.arrival_time || undefined,
        checkInTime: i.check_in_time || undefined,
        checkOutTime: i.check_out_time || undefined,
        dayId: i.day_id || undefined,
      }),
    ),
    createdAt: trip.created_at,
  })
}

async function fetchTripFull(tripId: string): Promise<Trip> {
  const { data, error, status } = await supabase
    .from('trips')
    .select('*, trip_days(*), trip_items(*)')
    .eq('id', tripId)
    .single()
  if (error) throw new ApiError(error.message, status)
  const row = data as SupabaseTripFullRow
  return normalizeTrip(row, row.trip_days, row.trip_items)
}

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

export async function fetchTrips(): Promise<Trip[]> {
  const { data, error, status } = await supabase
    .from('trips')
    .select('*, trip_days(*), trip_items(*)')
    .order('created_at', { ascending: true })
  if (error) throw new ApiError(error.message, status)
  return (data as SupabaseTripFullRow[]).map((row) => normalizeTrip(row, row.trip_days, row.trip_items))
}

export async function createTrip(name: string): Promise<Trip> {
  const { data, error, status } = await supabase.from('trips').insert({ name }).select().single()
  if (error) throw new ApiError(error.message, status)
  return normalizeTrip(data as SupabaseTripRow, [], [])
}

export async function deleteTrip(id: string): Promise<void> {
  const { error, status } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw new ApiError(error.message, status)
}

export async function addTripItem(tripId: string, item: Omit<TripItem, 'id'>): Promise<Trip> {
  const { count, error: countError, status: countStatus } = await supabase
    .from('trip_items')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
  if (countError) throw new ApiError(countError.message, countStatus)

  const { error, status } = await supabase.from('trip_items').insert({
    trip_id: tripId,
    day_id: item.dayId || null,
    location_id: item.locationId || null,
    kind: item.kind,
    name: item.name,
    country: item.country || null,
    custom: item.custom,
    image_url: item.imageUrl || null,
    description: item.description || null,
    transport_type: item.transportType || null,
    departure_time: item.departureTime || null,
    arrival_time: item.arrivalTime || null,
    check_in_time: item.checkInTime || null,
    check_out_time: item.checkOutTime || null,
    sort_order: count ?? 0,
  })
  if (error) throw new ApiError(error.message, status)

  return fetchTripFull(tripId)
}

export async function removeTripItem(tripId: string, itemId: string): Promise<Trip> {
  const { error, status } = await supabase.from('trip_items').delete().eq('id', itemId)
  if (error) throw new ApiError(error.message, status)
  return fetchTripFull(tripId)
}

export async function reorderTripItems(tripId: string, items: TripItem[]): Promise<Trip> {
  const results = await Promise.all(
    items.map((item, index) =>
      supabase.from('trip_items').update({ day_id: item.dayId || null, sort_order: index }).eq('id', item.id),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw new ApiError(failed.error.message, failed.status)
  return fetchTripFull(tripId)
}

export async function updateTripDates(tripId: string, startDate?: string, endDate?: string): Promise<Trip> {
  if (startDate && endDate) {
    if (endDate < startDate) throw new ApiError('End date must be on or after the start date')
    if (daysBetweenInclusive(startDate, endDate) > MAX_TRIP_DAYS) {
      throw new ApiError(`Trips can span at most ${MAX_TRIP_DAYS} days`)
    }
  }

  const { error: tripError, status: tripStatus } = await supabase
    .from('trips')
    .update({ start_date: startDate || null, end_date: endDate || null })
    .eq('id', tripId)
  if (tripError) throw new ApiError(tripError.message, tripStatus)

  // Grows existing days to cover the new date span, updating dates by position.
  // Never removes days, so item -> day references never orphan.
  const span = computeDaySpan(startDate, endDate)
  if (span.length > 0) {
    const { data: existingDays, error: daysError, status: daysStatus } = await supabase
      .from('trip_days')
      .select('*')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true })
    if (daysError) throw new ApiError(daysError.message, daysStatus)

    const rows = existingDays as SupabaseTripDayRow[]
    const results = await Promise.all(
      span.map((date, index) => {
        const existing = rows[index]
        return existing
          ? supabase.from('trip_days').update({ date }).eq('id', existing.id)
          : supabase.from('trip_days').insert({ trip_id: tripId, date, sort_order: index })
      }),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw new ApiError(failed.error.message, failed.status)
  }

  return fetchTripFull(tripId)
}

export async function addTripDay(tripId: string): Promise<Trip> {
  const { data: existingDays, error: daysError, status: daysStatus } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
  if (daysError) throw new ApiError(daysError.message, daysStatus)

  const days = existingDays as SupabaseTripDayRow[]
  if (days.length >= MAX_TRIP_DAYS) throw new ApiError(`Trips can span at most ${MAX_TRIP_DAYS} days`)

  const lastDay = days[days.length - 1]
  const nextDate = lastDay?.date ? addDaysToIso(lastDay.date, 1) : null

  const { error, status } = await supabase
    .from('trip_days')
    .insert({ trip_id: tripId, date: nextDate, sort_order: days.length })
  if (error) throw new ApiError(error.message, status)

  return fetchTripFull(tripId)
}

export async function removeTripDay(tripId: string, dayId: string): Promise<Trip> {
  const { count, error: countError, status: countStatus } = await supabase
    .from('trip_items')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .eq('day_id', dayId)
  if (countError) throw new ApiError(countError.message, countStatus)
  if ((count ?? 0) > 0) throw new ApiError('Move or remove this day’s items before deleting it')

  const { error, status } = await supabase.from('trip_days').delete().eq('id', dayId)
  if (error) throw new ApiError(error.message, status)

  return fetchTripFull(tripId)
}
