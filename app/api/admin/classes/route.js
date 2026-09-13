import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('id, name, grade, teacher_id')
    .order('grade', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ classes: data })
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { name, grade, teacherId } = await request.json()
  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Thieu ten lop' }, { status: 400 })
  }

  const gradeNum = grade === '' || grade === undefined || grade === null ? null : Number(grade)
  if (gradeNum !== null && (Number.isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12)) {
    return NextResponse.json({ error: 'Khoi khong hop le (1-12)' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('classes')
    .insert({ name: name.trim(), grade: gradeNum, teacher_id: teacherId || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ class: data })
}
