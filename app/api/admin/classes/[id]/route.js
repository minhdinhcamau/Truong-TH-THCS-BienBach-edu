import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../../lib/authHelpers'

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const { name, grade } = await request.json()

  const update = {}
  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: 'Ten lop khong duoc de trong' }, { status: 400 })
    }
    update.name = name.trim()
  }
  if (grade !== undefined) {
    const gradeNum = grade === null || grade === '' ? null : Number(grade)
    if (gradeNum !== null && (Number.isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12)) {
      return NextResponse.json({ error: 'Khoi khong hop le (1-12)' }, { status: 400 })
    }
    update.grade = gradeNum
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Khong co gi de cap nhat' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('classes')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ class: data })
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params

  const { error } = await supabaseAdmin.from('classes').delete().eq('id', id)

  if (error) {
    // Ma loi 23503 = vi pham khoa ngoai: lop nay dang co bai tap gan vao,
    // Postgres tu chan xoa de tranh mo coi du lieu bai tap.
    if (error.code === '23503') {
      return NextResponse.json(
        {
          error:
            'Không thể xoá lớp này vì đang có bài tập được giao cho lớp. Hãy xoá các bài tập đó trước, hoặc giữ lại lớp.',
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
