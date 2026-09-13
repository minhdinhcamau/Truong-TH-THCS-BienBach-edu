// Client Supabase dung o phia trinh duyet (component co "use client").
// Chi dung publishable key (an toan de lo ra ngoai) - KHONG dung secret key o day.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
