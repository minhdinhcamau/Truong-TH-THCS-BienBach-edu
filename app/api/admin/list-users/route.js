import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select(
      'id, role, full_name, student_code, class_id, date_of_birth, photo_url, expires_at, is_retained, created_at, password_changed_at'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // profiles khong luu email, phai lay tu auth.users rieng.
  // Luu y: perPage toi da huu ich - truong qua 1000 tai khoan can them phan trang.
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = {}
  for (const u of authList?.users || []) {
    emailById[u.id] = u.email
  }

  // Lay danh sach mon giao vien dang day (tu bang phan cong) de admin loc
  // giao vien theo mon o trang danh sach tai khoan. 1 giao vien co the day
  // nhieu mon/nhieu lop nen gom lai thanh mang, bo trung bang Set.
  const { data: assignments } = await supabaseAdmin
    .from('teacher_assignments')
    .select('teacher_id, subject_id')

  const subjectIdsByTeacher = {}
  for (const a of assignments || []) {
    if (!subjectIdsByTeacher[a.teacher_id]) subjectIdsByTeacher[a.teacher_id] = new Set()
    subjectIdsByTeacher[a.teacher_id].add(a.subject_id)
  }

  const users = profiles.map((p) => ({
    ...p,
    email: emailById[p.id] || '',
    subjectIds: p.role === 'teacher' ? Array.from(subjectIdsByTeacher[p.id] || []) : [],
  }))

  return NextResponse.json({ users })
}
