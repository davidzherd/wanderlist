import { z } from 'zod'
import { DEFAULT_CURRENCY } from '../data/currencies'

/**
 * Per-user preferences, stored in Supabase Auth's `user_metadata.settings` so they follow the user across devices.
 * (Harmless if a user edits them client-side — unlike is_premium/is_admin, which live in `profiles`.) Every field
 * has a default, and an unreadable value falls back to it, so a missing or stale blob never breaks the app.
 */
export const UserSettingsSchema = z.object({
  /** Days start collapsed when a trip opens (each one can still be toggled by hand). */
  daysStartCollapsed: z.boolean().catch(false),
  /** ISO 4217 code every new trip starts in. */
  defaultCurrency: z.string().length(3).catch(DEFAULT_CURRENCY),
  /** 'locations' = only errors and bucket-list location added/updated/removed messages. */
  notifications: z.enum(['all', 'locations']).catch('all'),
})

export type UserSettings = z.infer<typeof UserSettingsSchema>

export const DEFAULT_NOTIFICATIONS: UserSettings['notifications'] = 'all'

/** Never throws: each field's `.catch` swaps a missing or invalid value for its default. */
export function parseUserSettings(raw: unknown): UserSettings {
  return UserSettingsSchema.parse(raw && typeof raw === 'object' ? raw : {})
}
