import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/authHelpers';

// PATCH: admin sửa tên hiển thị và/hoặc đổi lớp của một tài khoản (giáo viên hoặc học sinh).
// Đổi lớp CHỈ áp dụng cho tài khoản học sinh — dùng chung route này để gọn, tách theo trường được gửi lên.
// body: { userId, fullName?: string, classId?: string | null }
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body?.userId) {
    return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 });
  }
  const { userId, fullName, classId } = body;

  const { data: target, error: findErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single();
  if (findErr || !target) {
    return NextResponse.json({ error: 'Không tìm thấy tài khoản này' }, { status: 404 });
  }

  const patch = {};
  if (fullName !== undefined) {
    const name = String(fullName || '').trim();
    if (!name) return NextResponse.json({ error: 'Họ tên không được để trống' }, { status: 400 });
    patch.full_name = name;
  }
  if (classId !== undefined) {
    if (target.role !== 'student') {
      return NextResponse.json({ error: 'Chỉ đổi được lớp cho tài khoản học sinh' }, { status: 400 });
    }
    patch.class_id = classId || null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 });
  }

  const { error: updateErr } = await supabaseAdmin.from('profiles').update(patch).eq('id', userId);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
