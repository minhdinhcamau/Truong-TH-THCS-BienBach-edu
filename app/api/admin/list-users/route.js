import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select(
      'id, role, full_name, student_code, class_id, date_of_birth, photo_url, expires_at, is_retained, created_at'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // profiles khong luu email, phai lay tu auth.users rieng.
  // Luu y: perPage toi da huu ich - truong qua 1000 tai khoan can them phan trang.
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = {}
  for (const u of authList?.users || []) {
    emailById[u.id] = u.email
  }

  const users = profiles.map((p) => ({ ...p, email: emailById[p.id] || '' }))

  return NextResponse.json({ users })
}
