import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const teacherId = searchParams.get('teacherId')
  if (!teacherId) {
    return NextResponse.json({ error: 'Thieu teacherId' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('teacher_assignments')
    .select('id, school_year, class_id, subject_id, classes(name), subjects(name)')
    .eq('teacher_id', teacherId)
    .order('school_year', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const assignments = data.map((a) => ({
    id: a.id,
    schoolYear: a.school_year,
    classId: a.class_id,
    subjectId: a.subject_id,
    className: a.classes?.name || '—',
    subjectName: a.subjects?.name || '—',
  }))

  return NextResponse.json({ assignments })
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { teacherId, classId, subjectId, schoolYear } = await request.json()
  if (!teacherId || !classId || !subjectId || !schoolYear) {
    return NextResponse.json({ error: 'Thieu thong tin bat buoc' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('teacher_assignments')
    .insert({ teacher_id: teacherId, class_id: classId, subject_id: subjectId, school_year: schoolYear })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Giáo viên này đã được phân công đúng môn/lớp/năm học này rồi.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ assignment: data })
}
