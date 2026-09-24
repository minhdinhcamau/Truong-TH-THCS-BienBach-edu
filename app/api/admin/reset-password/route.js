import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { userId, newPassword } = await request.json()
  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'Thieu userId hoac mat khau moi' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Admin vua dat lai mat khau -> khong con la mat khau nguoi dung tu doi
  const { error: stampError } = await supabaseAdmin
    .from('profiles')
    .update({ password_changed_at: null })
    .eq('id', userId)
  if (stampError) {
    console.error('reset-password: khong cap nhat duoc password_changed_at:', stampError.message)
  }

  return NextResponse.json({ success: true })
}
