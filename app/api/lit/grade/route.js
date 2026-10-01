import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireUser, gradeAndSave } from '@/lib/litServer';

export const maxDuration = 60;

export async function POST(request) {
  const auth = await requireUser(request, ['teacher', 'admin']);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { submissionId } = await request.json().catch(() => ({}));
  if (!submissionId) return NextResponse.json({ error: 'Thiếu mã bài làm' }, { status: 400 });

  const { data: sub } = await supabaseAdmin
    .from('lit_submissions').select('id, assignment_id, status').eq('id', submissionId).maybeSingle();
  if (!sub || sub.status === 'draft') {
    return NextResponse.json({ error: 'Bài này chưa được nộp' }, { status: 400 });
  }

  const { data: a } = await supabaseAdmin
    .from('lit_assignments').select('teacher_id').eq('id', sub.assignment_id).single();
  const isOwner = a?.teacher_id === auth.user.id;
  if (!isOwner && auth.profile.role !== 'admin' && !auth.profile.is_tpt) {
    return NextResponse.json({ error: 'Đây không phải đề của thầy/cô' }, { status: 403 });
  }

  try {
    const result = await gradeAndSave(submissionId);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    if (e.code === 'not_configured') {
      return NextResponse.json({ error: 'Chưa cấu hình khóa AI (GEMINI_API_KEY hoặc ANTHROPIC_API_KEY) trên Vercel.' }, { status: 501 });
    }
    // Lỗi nghiệp vụ (đã công bố, chưa có barem...) giữ nguyên nội dung; lỗi AI thì báo chung
    const business = /công bố|barem|Không tìm thấy/.test(e.message || '');
    return NextResponse.json(
      { error: business ? e.message : 'AI đang bận hoặc trả kết quả sai định dạng. Thử lại sau ít phút.' },
      { status: business ? 400 : 502 }
    );
  }
}
