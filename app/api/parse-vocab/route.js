import { NextResponse } from 'next/server';

// API route: nhận đoạn văn bản từ vựng (lộn xộn), gọi lần lượt Claude -> ChatGPT -> Gemini
// để tách thành mảng {word, meaning, example}. Cái nào lỗi/hết hạn mức thì tự chuyển
// sang cái tiếp theo. Cần ít nhất 1 trong 3 biến môi trường sau trên Vercel:
//   ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY

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
  // AI thỉnh thoảng bọc thêm chữ thừa quanh JSON -> cắt lấy đúng đoạn [ ... ]
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const jsonSlice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(jsonSlice);
}

// ---- Claude (Anthropic) ----
async function callClaude(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Chưa cấu hình ANTHROPIC_API_KEY');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Claude lỗi ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const rawText = (data.content || []).map((b) => b.text || '').join('\n');
  return extractJsonArray(rawText);
}

// ---- ChatGPT (OpenAI) ----
async function callOpenAI(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Chưa cấu hình OPENAI_API_KEY');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + '\n\nTrả lời dưới dạng JSON object có 1 khóa duy nhất "items" chứa mảng kết quả, ví dụ: {"items": [...]}.' },
        { role: 'user', content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ChatGPT lỗi ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || '';
  const parsed = JSON.parse(rawText);
  return parsed.items || parsed;
}

// ---- Gemini (Google) ----
async function callGemini(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Chưa cấu hình GEMINI_API_KEY');

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini lỗi ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
  return extractJsonArray(rawText);
}

export async function POST(request) {
  const { text } = await request.json();
  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'Thiếu nội dung để xử lý' }, { status: 400 });
  }

  const providers = [
    { name: 'Claude', fn: callClaude },
    { name: 'ChatGPT', fn: callOpenAI },
    { name: 'Gemini', fn: callGemini },
  ];

  const errors = [];
  for (const provider of providers) {
    try {
      const rawItems = await provider.fn(text);
      const items = cleanItems(rawItems);
      if (items && items.length > 0) {
        return NextResponse.json({ items, provider: provider.name });
      }
      errors.push(`${provider.name}: không tách được từ nào`);
    } catch (e) {
      errors.push(`${provider.name}: ${e.message}`);
    }
  }

  return NextResponse.json(
    { error: `Cả 3 AI đều không xử lý được. Chi tiết:\n${errors.join('\n')}` },
    { status: 500 }
  );
}
