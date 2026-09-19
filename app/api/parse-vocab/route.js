import { NextResponse } from 'next/server';

// API route: nhận đoạn văn bản từ vựng (lộn xộn), gọi Gemini để tách thành
// mảng {word, meaning, example}. Cần biến môi trường GEMINI_API_KEY trên Vercel.

const SYSTEM_PROMPT = `Bạn là công cụ trích xuất từ vựng tiếng Anh cho giáo viên THCS ở Việt Nam.
Người dùng dán một đoạn văn bản chứa danh sách từ vựng tiếng Anh, có thể lộn xộn, sai định dạng,
thiếu dấu phân cách rõ ràng, hoặc chép từ nhiều nguồn khác nhau (sách giáo khoa, ghi chú...).

Nhiệm vụ:
- Tách ra từng từ/cụm từ tiếng Anh riêng biệt.
- Với mỗi từ, xác định nghĩa tiếng Việt (nếu văn bản có sẵn nghĩa thì dùng đúng nghĩa đó,
  không tự bịa nghĩa khác).
- Nếu văn bản có sẵn câu ví dụ đi kèm từ đó thì giữ nguyên câu ví dụ đó.
  Nếu không có, hãy tự đặt 1 câu ví dụ tiếng Anh đơn giản, ngắn gọn, phù hợp học sinh THCS,
  có dùng đúng từ đó.
- Bỏ qua các dòng tiêu đề, số thứ tự, hoặc nội dung không phải từ vựng.

CHỈ trả lời bằng JSON thuần túy, dạng mảng, KHÔNG kèm giải thích, KHÔNG dùng markdown code fence,
KHÔNG có chữ nào khác ngoài JSON. Định dạng bắt buộc:
[{"word": "...", "meaning": "...", "example": "..."}]`;

function cleanItems(items) {
  if (!Array.isArray(items)) return null;
  return items
    .map((it) => ({
      word: (it.word || '').toString().trim(),
      meaning: (it.meaning || '').toString().trim(),
      example: (it.example || '').toString().trim(),
    }))
    .filter((it) => it.word && it.meaning);
}

function extractJsonArray(rawText) {
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const jsonSlice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(jsonSlice);
}

// ⚠️ Tên model Gemini có thể đổi theo thời gian (Google ngừng hỗ trợ bản cũ).
// Nếu sau này lại báo lỗi 404 "model ... no longer available", đổi giá trị
// bên dưới theo đúng tên model mới mà thông báo lỗi đó gợi ý.
const GEMINI_MODEL = 'gemini-3.6-flash';

async function callGemini(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Chưa cấu hình GEMINI_API_KEY');

  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text }] }],
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
      return extractJsonArray(rawText);
    }

    // Lỗi 503 (quá tải tạm thời) hoặc 429 (vượt hạn mức tức thời) -> thử lại sau vài giây
    if ((res.status === 503 || res.status === 429) && attempt < maxAttempts) {
      lastError = new Error(`Gemini lỗi ${res.status}: ${await res.text()}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }

    throw new Error(`Gemini lỗi ${res.status}: ${await res.text()}`);
  }

  throw lastError;
}

export async function POST(request) {
  const { text } = await request.json();
  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'Thiếu nội dung để xử lý' }, { status: 400 });
  }

  try {
    const rawItems = await callGemini(text);
    const items = cleanItems(rawItems);
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'AI không tách được từ vựng nào từ đoạn văn bản này. Thử dán lại rõ ràng hơn.' }, { status: 500 });
    }
    return NextResponse.json({ items, provider: 'Gemini' });
  } catch (e) {
    const msg = (e.message || '').includes('503') || (e.message || '').includes('UNAVAILABLE')
      ? 'Gemini đang quá tải tạm thời (đã tự thử lại 3 lần). Vui lòng đợi khoảng 1 phút rồi bấm lại.'
      : (e.message || 'Lỗi không xác định khi gọi Gemini');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
