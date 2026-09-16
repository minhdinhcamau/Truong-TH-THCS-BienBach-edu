import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../lib/authHelpers'

// Doc cau hinh so ngay luu tru / xoa tu dong + trang thai bat/tat cua Hoi bai.
// Bang qa_settings chi co dung 1 dong (id = 1) - neu vi ly do nao do chua
// co dong nay thi tra ve gia tri mac dinh 5/7/bat de UI khong bi vo.
export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabaseAdmin
    .from('qa_settings')
    .select('archive_after_days, delete_after_days, auto_enabled, updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    settings: data || {
      archive_after_days: 5,
      delete_after_days: 7,
      auto_enabled: true,
      updated_at: null,
    },
  })
}

// Cap nhat cau hinh. Validate ky truoc khi ghi de tranh cau hinh vo ly
// (VD xoa som hon luu tru, hoac so ngay <= 0) lam hong logic an/hien bai.
export async function PATCH(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { archiveAfterDays, deleteAfterDays, autoEnabled } = await request.json()

  const archiveDays = Number(archiveAfterDays)
  const deleteDays = Number(deleteAfterDays)

  if (!Number.isInteger(archiveDays) || archiveDays < 1) {
    return NextResponse.json(
      { error: 'Số ngày lưu trữ phải là số nguyên lớn hơn 0.' },
      { status: 400 }
    )
  }
  if (!Number.isInteger(deleteDays) || deleteDays <= archiveDays) {
    return NextResponse.json(
      { error: 'Số ngày xoá vĩnh viễn phải lớn hơn số ngày lưu trữ.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('qa_settings')
    .upsert({
      id: 1,
      archive_after_days: archiveDays,
      delete_after_days: deleteDays,
      auto_enabled: typeof autoEnabled === 'boolean' ? autoEnabled : true,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ settings: data })
}
