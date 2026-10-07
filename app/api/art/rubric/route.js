import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/litServer';
import { generateArtRubric } from '@/lib/artAi';

export const maxDuration = 120;

export async function POST(request) {
  const auth = await requireUser(request, ['teacher', 'admin']);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Hãy nhập tên bài vẽ trước khi nhờ AI soạn barem' }, { status: 400 });
  }
  const maxScore = Number(body.maxScore) > 0 ? Number(body.maxScore) : 10;

  try {
    const criteria = await generateArtRubric({
      title: body.title.trim().slice(0, 300),
      prompt: (body.prompt || '').trim().slice(0, 2000),
      grade: body.grade,
      maxScore,
      mode: body.mode,
    });
    return NextResponse.json({ criteria });
  } catch (e) {
    console.error('art/rubric lỗi:', e?.message, e?.attempts || e?.errors || '');
    if (e.code === 'not_configured') {
      return NextResponse.json({ error: 'Chưa cấu hình khóa AI (GEMINI_API_KEY hoặc ANTHROPIC_API_KEY) trên Vercel.' }, { status: 501 });
    }
    return NextResponse.json({ error: 'AI đang bận hoặc trả kết quả sai định dạng. Thầy/cô thử lại sau ít phút.', detail: String(e?.message || '').slice(0, 300) }, { status: 502 });
  }
}
