import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// Nguoi dung (hoc sinh / giao vien / admin) tu doi mat khau cua chinh minh.
//
// Nhan: { currentPassword, newPassword }  + header Authorization: Bearer <access token>
//
// Buoc 1: xac minh token de biet ai dang goi (KHONG tin userId gui tu client).
// Buoc 2: kiem tra mat khau hien tai bang 1 client tam (anon key, khong luu
//         session) - tuyet doi khong goi signInWithPassword tren supabaseAdmin
//         vi se lam client service_role bi doi sang phien cua nguoi dung.
// Buoc 3: dat mat khau moi bang quyen admin roi ghi password_changed_at.

const MIN_LENGTH = 8
const MAX_LENGTH = 72 // gioi han cua bcrypt / Supabase

export async function POST(request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) {
    return NextResponse.json({ error: 'Bạn chưa đăng nhập.' }, { status: 401 })
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.' }, { status: 401 })
  }
  const user = userData.user

  const body = await request.json().catch(() => ({}))
  const currentPassword = String(body.currentPassword || '')
  const newPassword = String(body.newPassword || '')

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới.' }, { status: 400 })
  }
  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json({ error: `Mật khẩu mới phải có ít nhất ${MIN_LENGTH} ký tự.` }, { status: 400 })
  }
  if (newPassword.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Mật khẩu mới tối đa ${MAX_LENGTH} ký tự.` }, { status: 400 })
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    console.error('change-password: thieu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return NextResponse.json({ error: 'Máy chủ chưa cấu hình xong, hãy báo quản trị viên.' }, { status: 500 })
  }

  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (verifyError) {
    // 400 (khong phai 401) de giao dien khong nham voi "het phien dang nhap"
    return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng.' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const { error: stampError } = await supabaseAdmin
    .from('profiles')
    .update({ password_changed_at: new Date().toISOString() })
    .eq('id', user.id)
  if (stampError) {
    // Mat khau da doi thanh cong; chi ghi log, khong bao loi cho nguoi dung
    console.error('change-password: khong cap nhat duoc password_changed_at:', stampError.message)
  }

  return NextResponse.json({ success: true })
}
