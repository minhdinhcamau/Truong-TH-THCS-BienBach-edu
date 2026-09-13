import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'

// Gia han thu cong cho hoc sinh o lai lop: cong them so nam vao ngay het han
// hien tai (hoac tu hom nay neu chua co) va danh dau is_retained = true de
// script tu dong xoa (delete_expired_students) bo qua tai khoan nay.
export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { userId, extraYears = 1 } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'Thieu userId' }, { status: 400 })
  }

  const { data: profile, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('expires_at')
    .eq('id', userId)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 })
  }

  const base = profile.expires_at ? new Date(profile.expires_at) : new Date()
  base.setFullYear(base.getFullYear() + Number(extraYears))

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ expires_at: base.toISOString(), is_retained: true })
    .eq('id', userId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, newExpiresAt: base.toISOString() })
}
