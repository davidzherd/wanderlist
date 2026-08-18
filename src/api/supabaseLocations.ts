import { LocationSchema, type Location, type LocationFormValues } from '../types/location'
import { ApiError } from './client'
import { supabase } from './supabaseClient'

interface SupabaseLocationRow {
  id: string
  name: string
  country: string
  category: string
  priority: number
  latitude: number
  longitude: number
  notes: string | null
  image_url: string | null
  color: string | null
  emoji: string | null
  icon: string | null
  visited: boolean
  created_at: string
}

function normalize(row: SupabaseLocationRow): Location {
  return LocationSchema.parse({
    id: row.id,
    name: row.name,
    country: row.country,
    category: row.category,
    priority: row.priority,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes || undefined,
    imageUrl: row.image_url || undefined,
    color: row.color || undefined,
    emoji: row.emoji || undefined,
    icon: row.icon || undefined,
    visited: row.visited,
    createdAt: row.created_at,
  })
}

export async function fetchLocations(): Promise<Location[]> {
  const { data, error, status } = await supabase.from('locations').select('*').order('created_at', { ascending: true })
  if (error) throw new ApiError(error.message, status)
  return (data as SupabaseLocationRow[]).map(normalize)
}

export async function createLocation(values: LocationFormValues): Promise<Location> {
  const { data, error, status } = await supabase
    .from('locations')
    .insert({
      name: values.name,
      country: values.country,
      category: values.category,
      priority: values.priority,
      latitude: values.latitude,
      longitude: values.longitude,
      notes: values.notes || null,
      image_url: values.imageUrl || null,
      color: values.color || null,
      emoji: values.emoji || null,
      icon: values.icon || null,
    })
    .select()
    .single()
  if (error) throw new ApiError(error.message, status)
  return normalize(data as SupabaseLocationRow)
}

export async function updateLocation(
  id: string,
  patch: Partial<LocationFormValues & { visited: boolean }>,
): Promise<Location> {
  const { imageUrl, ...rest } = patch
  const { data, error, status } = await supabase
    .from('locations')
    .update({
      ...rest,
      ...(imageUrl !== undefined ? { image_url: imageUrl || null } : {}),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new ApiError(error.message, status)
  return normalize(data as SupabaseLocationRow)
}

export async function deleteLocation(id: string): Promise<void> {
  const { error, status } = await supabase.from('locations').delete().eq('id', id)
  if (error) throw new ApiError(error.message, status)
}
