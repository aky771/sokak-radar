import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: true,
  },
})

// Admin e-postası .env'den okunur — kaynak koduna gömülmez
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''
