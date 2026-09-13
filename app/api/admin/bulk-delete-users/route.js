import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'

// Xoa nhieu tai khoan cung luc: nhan { userIds: [...] }.
// Xoa lan luot tung tai khoan qua Supabase Auth (khong dung Promise.all de tranh
// rate-limit tu phia Supabase khi xoa hang loat), bo qua neu trung voi chinh
// nguoi dang thao tac. Tra ve ket qua tung dong de client bao loi ro rang.
export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { userIds } = await request.json()

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'Danh sach tai khoan trong' }, { status: 400 })
  }

  const results = []

  for (const userId of userIds) {
    if (userId === auth.user.id) {
      results.push({ userId, success: false, error: 'Khong the tu xoa chinh minh' })
      continue
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) {
      results.push({ userId, success: false, error: error.message })
      continue
    }

    results.push({ userId, success: true })
  }

  // Bang profiles co "on delete cascade" theo auth.users nen tu dong bi xoa theo.
  return NextResponse.json({ results })
}
