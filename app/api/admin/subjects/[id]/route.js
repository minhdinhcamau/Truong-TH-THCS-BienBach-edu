import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../../lib/authHelpers'

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const { name } = await request.json()
  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Ten mon khong duoc de trong' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ subject: data })
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const { error } = await supabaseAdmin.from('subjects').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Không thể xoá môn này vì đang được dùng trong bài tập hoặc phân công giảng dạy.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
