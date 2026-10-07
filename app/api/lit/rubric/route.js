import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/litServer';
import { generateRubric } from '@/lib/litAi';

export const maxDuration = 120;

export async function POST(request) {
  const auth = await requireUser(request, ['teacher', 'admin']);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Hãy nhập đề bài trước khi nhờ AI soạn barem' }, { status: 400 });
  }
  const maxScore = Number(body.maxScore) > 0 ? Number(body.maxScore) : 10;

  try {
    const criteria = await generateRubric({
      title: body.title.trim(),
      prompt: (body.prompt || '').trim(),
      genre: body.genre,
      grade: body.grade,
      maxScore,
    });
    return NextResponse.json({ criteria });
  } catch (e) {
    console.error('lit/rubric lỗi:', e?.message, e?.attempts || e?.errors || '');
    if (e.code === 'not_configured') {
      return NextResponse.json({ error: 'Chưa cấu hình khóa AI (GEMINI_API_KEY hoặc ANTHROPIC_API_KEY) trên Vercel.' }, { status: 501 });
    }
    return NextResponse.json({ error: 'AI đang bận hoặc trả kết quả sai định dạng. Thầy/cô thử lại sau ít phút.', detail: String(e?.message || '').slice(0, 300) }, { status: 502 });
  }
}
