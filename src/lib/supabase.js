import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// If env vars aren't set (initial prototype state), we fall back to a
// no-op stub so the frontend still renders with mock data.
const hasRealSupabase = Boolean(url && anon && !url.includes('your-project'))

export const supabase = hasRealSupabase
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

export const isSupabaseConfigured = hasRealSupabase
