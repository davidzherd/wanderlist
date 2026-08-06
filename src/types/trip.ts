import { z } from 'zod'

export const TripItemKindSchema = z.enum(['location', 'note', 'transport', 'lodging'])
export type TripItemKind = z.infer<typeof TripItemKindSchema>

export const TransportTypeSchema = z.enum(['plane', 'train', 'bus'])
export type TransportType = z.infer<typeof TransportTypeSchema>

export const TripItemSchema = z.object({
  id: z.string(),
  kind: TripItemKindSchema.default('location'),
  locationId: z.string().optional(),
  name: z.string().min(1),
  country: z.string().optional(),
  custom: z.boolean().default(false),
  imageUrl: z.string().optional(),
  description: z.string().max(500).optional(),
  transportType: TransportTypeSchema.optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  dayId: z.string().optional(),
})
export type TripItem = z.infer<typeof TripItemSchema>

export const TripDaySchema = z.object({
  id: z.string(),
  date: z.string().optional(),
})
export type TripDay = z.infer<typeof TripDaySchema>

export const TripSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().min(2, 'Trip name must be at least 2 characters').max(80),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.array(TripDaySchema).default([]),
  items: z.array(TripItemSchema).default([]),
  createdAt: z.string(),
})
export type Trip = z.infer<typeof TripSchema>

export const TripListSchema = z.array(TripSchema)

export const TripFormSchema = z.object({
  name: z.string().min(2, 'Trip name must be at least 2 characters').max(80),
})
export type TripFormValues = z.infer<typeof TripFormSchema>

export const NoteItemFormSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(80),
  description: z.string().max(500).optional(),
})
export type NoteItemFormValues = z.infer<typeof NoteItemFormSchema>

export const TransportItemFormSchema = z.object({
  transportType: TransportTypeSchema,
  departureTime: z.string().min(1, 'Departure time is required'),
  arrivalTime: z.string().min(1, 'Arrival time is required'),
  description: z.string().max(500).optional(),
})
export type TransportItemFormValues = z.infer<typeof TransportItemFormSchema>

export const LodgingItemFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().max(500).optional(),
  checkInTime: z.string().min(1, 'Check-in time is required'),
  checkOutTime: z.string().min(1, 'Check-out time is required'),
})
export type LodgingItemFormValues = z.infer<typeof LodgingItemFormSchema>
