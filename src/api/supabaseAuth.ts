import type { User as SupabaseUser } from '@supabase/supabase-js'
import { UserSchema, type User } from '../types/user'
import { ApiError } from './client'
import { supabase } from './supabaseClient'

interface ProfileRow {
  is_premium: boolean
  is_admin: boolean
}

/** is_premium/is_admin live in `profiles`, not user_metadata, precisely so the user can't self-grant them (see supabase/schema.sql). Falls back to false/false if the row isn't there yet (or the query fails) rather than blocking sign-in on it. */
async function fetchProfileFlags(userId: string): Promise<{ isPremium: boolean; isAdmin: boolean }> {
  const { data } = await supabase.from('profiles').select('is_premium, is_admin').eq('id', userId).single()
  const row = data as ProfileRow | null
  return { isPremium: row?.is_premium ?? false, isAdmin: row?.is_admin ?? false }
}

export async function toUser(supabaseUser: SupabaseUser): Promise<User> {
  const { isPremium, isAdmin } = await fetchProfileFlags(supabaseUser.id)
  return UserSchema.parse({
    id: supabaseUser.id,
    name: (supabaseUser.user_metadata as { name?: string } | null)?.name || supabaseUser.email || '',
    email: supabaseUser.email,
    isPremium,
    isAdmin,
  })
}

export async function login(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new ApiError(error.message, error.status)
  return toUser(data.user)
}

/**
 * If Supabase's "Confirm email" setting is on, signUp succeeds but returns no session
 * (the account exists but can't log in yet) — surfaced as an error so the caller's
 * existing error-banner UI picks it up, same as any other auth failure.
 */
export async function register(name: string, email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw new ApiError(error.message, error.status)
  if (!data.session || !data.user) {
    throw new ApiError('Account created — check your inbox to confirm your email before signing in.')
  }
  return toUser(data.user)
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getSession(): Promise<User | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return null
  return toUser(data.session.user)
}
