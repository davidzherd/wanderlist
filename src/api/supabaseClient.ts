import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

// Falls back to a placeholder URL rather than letting createClient() throw synchronously on an
// empty string — that would crash the whole app at import time before .env is filled in. With
// the placeholder, the app still boots; auth/data calls just fail (caught and surfaced normally)
// until real credentials are set.
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key')
