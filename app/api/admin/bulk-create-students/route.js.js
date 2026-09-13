import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'
import { studentCodeToEmail } from '../../../../lib/generateStudentCode'
import { generateStrongPassword } from '../../../../lib/generatePassword'

// Nhan tu client (trang admin da doc san file soo diem/diem danh cua giao vien):
//   { classId, students: [{ studentCode, fullName }] }
//
// Ma hoc sinh lay THANG tu file cua giao vien (da co san trong so diem/diem danh),
// KHONG con tu sinh ma moi nua. Lop thi admin chon 1 lan cho ca file (dropdown
// truoc khi upload), ap dung chung cho tat ca cac dong.
export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { classId, students } = await request.json()

  if (!classId) {
    return NextResponse.json({ error: 'Thieu lop' }, { status: 400 })
  }
  if (!Array.isArray(students) || students.length === 0) {
    return NextResponse.json({ error: 'Danh sach hoc sinh trong' }, { status: 400 })
  }

  const { data: classRow, error: classError } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .single()

  if (classError || !classRow) {
    return NextResponse.json({ error: 'Khong tim thay lop da chon' }, { status: 400 })
  }

  // Kiem tra truoc nhung ma hoc sinh da co tai khoan trong he thong, de bao loi
  // ro rang thay vi tao trung (VD admin lo tai lai dung file mot lan nua).
  const codes = students
    .map((s) => String(s.studentCode || '').trim())
    .filter(Boolean)

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('student_code')
    .in('student_code', codes)

  const existingCodes = new Set((existing || []).map((r) => r.student_code))

  const expiry = new Date()
  expiry.setFullYear(expiry.getFullYear() + 5)

  const results = []

  for (const row of students) {
    const studentCode = String(row.studentCode || '').trim()
    const fullName = String(row.fullName || '').trim()

    if (!studentCode || !fullName) {
      results.push({ fullName, studentCode, success: false, error: 'Thieu ma hoc sinh hoac ho ten' })
      continue
    }

    if (existingCodes.has(studentCode)) {
      results.push({ fullName, studentCode, success: false, error: 'Ma hoc sinh nay da co tai khoan roi' })
      continue
    }

    const email = studentCodeToEmail(studentCode)
    const password = generateStrongPassword(12)

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      results.push({ fullName, studentCode, success: false, error: createError.message })
      continue
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      role: 'student',
      full_name: fullName,
      student_code: studentCode,
      class_id: classId,
      expires_at: expiry.toISOString(),
      created_by: auth.user.id,
    })

    if (profileError) {
      // Ghi ho so that bai -> xoa lai tai khoan auth vua tao de tranh tai khoan mo coi
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      results.push({ fullName, studentCode, success: false, error: profileError.message })
      continue
    }

    // Phong khi file co 2 dong trung ma hoc sinh trong cung 1 lan tai len
    existingCodes.add(studentCode)

    results.push({ fullName, studentCode, success: true, password })
  }

  return NextResponse.json({ results })
}
