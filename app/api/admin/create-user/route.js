import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'
import { formatStudentCode, studentCodeToEmail } from '../../../../lib/generateStudentCode'

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { fullName, password, role, classId } = body
  let { email } = body

  if (!fullName || !password || !role) {
    return NextResponse.json({ error: 'Thieu thong tin bat buoc' }, { status: 400 })
  }
  if (!['admin', 'teacher', 'student'].includes(role)) {
    return NextResponse.json({ error: 'Vai tro khong hop le' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Mat khau phai it nhat 8 ky tu' }, { status: 400 })
  }

  // Giao vien / quan tri vien: bat buoc phai co email that (de lien he,
  // khoi phuc mat khau...). Hoc sinh: KHONG can nhap email, tu sinh ben duoi.
  if (role !== 'student' && !email) {
    return NextResponse.json({ error: 'Thieu email' }, { status: 400 })
  }
  if (role === 'student' && !classId) {
    return NextResponse.json({ error: 'Hoc sinh phai duoc gan lop' }, { status: 400 })
  }

  // 1. Neu la hoc sinh: sinh ma hoc sinh + email noi bo TRUOC khi tao tai khoan,
  // vi email dang nhap can co ngay tu buoc goi auth.admin.createUser.
  let studentCode = null
  let expiresAt = null

  if (role === 'student') {
    const year = new Date().getFullYear()
    const yy = String(year).slice(-2)

    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student')
      .like('student_code', `HS${yy}%`)

    studentCode = formatStudentCode((count || 0) + 1, year)
    email = studentCodeToEmail(studentCode)

    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 5)
    expiresAt = expiry.toISOString()
  }

  // 2. Tao tai khoan dang nhap (email_confirm: true de khong can xac nhan email
  // - quan trong voi hoc sinh vi email noi bo khong nhan duoc mail that)
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  const newUserId = created.user.id

  // 3. Ghi ho so vao bang profiles
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: newUserId,
    role,
    full_name: fullName,
    student_code: studentCode,
    class_id: role === 'student' ? classId : null,
    expires_at: expiresAt,
    created_by: auth.user.id,
  })

  if (profileError) {
    // Ghi ho so that bai -> xoa lai tai khoan auth vua tao de tranh tai khoan mo coi
    await supabaseAdmin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ id: newUserId, email, studentCode, expiresAt })
}
