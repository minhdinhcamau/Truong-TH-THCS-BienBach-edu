// Client Supabase dung QUYEN ADMIN (secret key). CHI import file nay trong
// app/api/**/route.js (code chay tren server). TUYET DOI khong import file
// nay trong bat ky component co dong "use client" o dau file.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  throw new Error('Thieu SUPABASE_SERVICE_ROLE_KEY trong .env.local')
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
