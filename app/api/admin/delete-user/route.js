import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'Thieu userId' }, { status: 400 })
  }

  if (userId === auth.user.id) {
    return NextResponse.json({ error: 'Khong the tu xoa chinh minh' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Bang profiles co "on delete cascade" theo auth.users nen tu dong bi xoa theo.
  return NextResponse.json({ success: true })
}
