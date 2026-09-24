import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'
import { generateStrongPassword } from '../../../../lib/generatePassword'

// Cap lai mat khau moi cho nhieu hoc sinh cung luc (dung cho cong cu "Xuat tai
// khoan theo lop"). Chi ap dung cho tai khoan role = 'student'.
//
// Nhan: { userIds: [uuid, ...] }  (toi da MAX_PER_REQUEST moi lan goi - trang
// admin tu chia lo nen lop 40-50 em van chay on)
// Tra:  { results: [{ userId, fullName, studentCode, success, password?, error? }] }
//       theo dung thu tu userIds gui len.
//
// Mat khau chi tra ve DUNG MOT LAN trong response nay; he thong khong luu lai.

export const maxDuration = 60

const MAX_PER_REQUEST = 50
const CONCURRENCY = 5

async function runPool(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  async function run() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const ids = Array.from(new Set(Array.isArray(body.userIds) ? body.userIds : []))

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Chưa chọn học sinh nào' }, { status: 400 })
  }
  if (ids.length > MAX_PER_REQUEST) {
    return NextResponse.json(
      { error: `Mỗi lần chỉ được cấp lại tối đa ${MAX_PER_REQUEST} tài khoản` },
      { status: 400 }
    )
  }

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, full_name, student_code')
    .in('id', ids)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  const profileById = new Map((profiles || []).map((p) => [p.id, p]))

  const results = await runPool(ids, CONCURRENCY, async (userId) => {
    const p = profileById.get(userId)
    if (!p) {
      return { userId, fullName: '', studentCode: '', success: false, error: 'Không tìm thấy tài khoản' }
    }
    const base = { userId, fullName: p.full_name || '', studentCode: p.student_code || '' }

    // An toan: cong cu nay chi danh cho hoc sinh, khong dung duoc de doi mat khau giao vien/admin
    if (p.role !== 'student') {
      return { ...base, success: false, error: 'Không phải tài khoản học sinh' }
    }

    const password = generateStrongPassword(12)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
    if (error) {
      return { ...base, success: false, error: error.message }
    }
    return { ...base, success: true, password }
  })

  // Mat khau vua duoc admin cap lai -> danh dau "chua tu doi"
  const okIds = results.filter((r) => r.success).map((r) => r.userId)
  if (okIds.length > 0) {
    const { error: stampError } = await supabaseAdmin
      .from('profiles')
      .update({ password_changed_at: null })
      .in('id', okIds)
    if (stampError) {
      console.error('bulk-reset-passwords: khong cap nhat duoc password_changed_at:', stampError.message)
    }
  }

  return NextResponse.json({ results })
}
