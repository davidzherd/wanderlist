import { z } from 'zod'

export const TripItemSchema = z.object({
  id: z.string(),
  locationId: z.string().optional(),
  name: z.string().min(1),
  country: z.string().optional(),
  custom: z.boolean().default(false),
})
export type TripItem = z.infer<typeof TripItemSchema>

export const TripSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().min(2, 'Trip name must be at least 2 characters').max(80),
  items: z.array(TripItemSchema).default([]),
  createdAt: z.string(),
})
export type Trip = z.infer<typeof TripSchema>

export const TripListSchema = z.array(TripSchema)

export const TripFormSchema = z.object({
  name: z.string().min(2, 'Trip name must be at least 2 characters').max(80),
})
export type TripFormValues = z.infer<typeof TripFormSchema>

export const CustomTripItemFormSchema = z.object({
  name: z.string().min(2, 'Item name must be at least 2 characters').max(80),
  country: z.string().max(60).optional(),
})
export type CustomTripItemFormValues = z.infer<typeof CustomTripItemFormSchema>
