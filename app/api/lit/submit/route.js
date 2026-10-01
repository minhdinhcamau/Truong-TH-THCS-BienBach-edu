import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireUser, gradeAndSave } from '@/lib/litServer';
import { countWords, MAX_ESSAY_CHARS } from '@/lib/litConfig';

export const maxDuration = 60;

export async function POST(request) {
  const auth = await requireUser(request, ['student']);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { assignmentId, content: rawContent } = await request.json().catch(() => ({}));
  const content = String(rawContent || '').replace(/\r\n/g, '\n').trimEnd();
  if (!assignmentId) return NextResponse.json({ error: 'Thiếu mã bài tập' }, { status: 400 });

  const { data: a } = await supabaseAdmin
    .from('lit_assignments').select('*').eq('id', assignmentId).maybeSingle();
  if (!a || a.class_id !== auth.profile.class_id) {
    return NextResponse.json({ error: 'Bài tập này không thuộc lớp của em' }, { status: 403 });
  }
  if (a.due_date && new Date(a.due_date) < new Date()) {
    return NextResponse.json({ error: 'Đã quá hạn nộp bài' }, { status: 400 });
  }

  const words = countWords(content);
  if (content.length < 20) {
    return NextResponse.json({ error: 'Bài viết còn quá ngắn để nộp' }, { status: 400 });
  }
  if (content.length > MAX_ESSAY_CHARS) {
    return NextResponse.json({ error: `Bài dài quá ${MAX_ESSAY_CHARS} ký tự, em hãy rút gọn lại` }, { status: 400 });
  }
  if (a.min_words && words < a.min_words) {
    return NextResponse.json(
      { error: `Bài chưa đủ số chữ tối thiểu (${words}/${a.min_words} chữ)` }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('lit_submissions').select('id, status')
    .eq('assignment_id', assignmentId).eq('student_id', auth.user.id).maybeSingle();
  if (existing && existing.status !== 'draft') {
    return NextResponse.json({ error: 'Em đã nộp bài này rồi' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: sub, error } = await supabaseAdmin
    .from('lit_submissions')
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: auth.user.id,
        content,
        word_count: words,
        status: 'submitted',
        submitted_at: now,
        updated_at: now,
      },
      { onConflict: 'assignment_id,student_id' }
    )
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Chấm ngay. Nếu AI lỗi thì bài vẫn được nộp, giáo viên bấm chấm lại sau.
  try {
    await gradeAndSave(sub.id);
    return NextResponse.json({ ok: true, graded: true });
  } catch (e) {
    console.error('Lỗi chấm AI:', e.message);
    return NextResponse.json({ ok: true, graded: false });
  }
}
