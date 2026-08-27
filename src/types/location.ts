import { z } from 'zod'

// Max photos a single location can hold, by plan. The add/edit form enforces the effective cap
// based on the signed-in user's premium flag; the schema below allows up to the premium cap so a
// premium user's submission validates.
export const FREE_MAX_LOCATION_IMAGES = 5
export const PREMIUM_MAX_LOCATION_IMAGES = 10

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  country: z.string().min(2, 'Country must be at least 2 characters').max(60),
  category: z.string().min(2, 'Category must be at least 2 characters').max(40),
  priority: z
    .number()
    .int()
    .min(1, 'Priority must be between 1 and 5')
    .max(5, 'Priority must be between 1 and 5'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().max(500).optional(),
  images: z.array(z.string().url()).default([]),
  color: z.string().max(32).optional(),
  emoji: z.string().max(16).optional(),
  icon: z.string().max(40).optional(),
  visited: z.boolean().default(false),
  createdAt: z.string(),
})
export type Location = z.infer<typeof LocationSchema>

export const LocationListSchema = z.array(LocationSchema)

export const LocationFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  country: z.string().min(2, 'Country must be at least 2 characters').max(60),
  category: z.string().min(2, 'Category must be at least 2 characters').max(40),
  priority: z.coerce
    .number()
    .int()
    .min(1, 'Select a priority rating')
    .max(5, 'Priority must be between 1 and 5'),
  latitude: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  notes: z.string().max(500).optional(),
  images: z
    .array(z.string().url())
    .max(PREMIUM_MAX_LOCATION_IMAGES, `Up to ${PREMIUM_MAX_LOCATION_IMAGES} images`)
    .default([]),
  color: z.string().max(32).optional(),
  emoji: z.string().max(16).optional(),
  icon: z.string().max(40).optional(),
})
export type LocationFormValues = z.infer<typeof LocationFormSchema>

export const NominatimResultSchema = z.object({
  display_name: z.string(),
  lat: z.string(),
  lon: z.string(),
  address: z
    .object({
      country: z.string().optional(),
    })
    .optional(),
})
export const NominatimResultsSchema = z.array(NominatimResultSchema)
export type NominatimResult = z.infer<typeof NominatimResultSchema>
