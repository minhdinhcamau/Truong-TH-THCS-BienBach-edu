import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../../../lib/authHelpers'

// Xoa 1 binh luan (cau tra loi) trong Hoi bai — SOFT DELETE, tan dung cot
// deleted_at/deleted_by/delete_reason da co san tren qa_replies, thay vi
// xoa cung nhu truoc (thay the RPC admin_delete_qa_reply da bi xoa).
export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const { reason } = await request.json().catch(() => ({}))

  const { error } = await supabaseAdmin
    .from('qa_replies')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: auth.user.id,
      delete_reason: reason || 'Quản trị viên xoá',
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
