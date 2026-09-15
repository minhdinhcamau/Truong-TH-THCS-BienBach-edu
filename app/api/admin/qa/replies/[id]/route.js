import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../../../lib/authHelpers'

// Xoa 1 binh luan (cau tra loi) trong Hoi bai. Binh luan khong co kho luu
// tru rieng — admin xoa la xoa vinh vien luon, vi no chi la 1 dong van ban,
// khong ton dung luong Storage nhu bai dang co anh.
export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const { error } = await supabaseAdmin.from('qa_replies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
