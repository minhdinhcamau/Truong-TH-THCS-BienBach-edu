import { NextResponse } from 'next/server';
import { generateText } from '@/lib/aiProviders';

// API route: nhận đoạn văn bản từ vựng (lộn xộn), nhờ AI tách thành mảng {word, meaning, example}.
// Dùng chung bộ gọi AI ở lib/aiProviders.js: thử mô hình THÔNG MINH NHẤT trước (gemini-3.8-flash); khi mô hình đó hết hạn mức /
// quá tải / lỗi thì TỰ CHUYỂN sang mô hình yếu hơn kế tiếp (Gemini 3.7 → 3.6 → DeepSeek → …).
// Cần ít nhất một trong các biến: GEMINI_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY.

export const maxDuration = 60;

const SYSTEM_PROMPT = `Bạn là công cụ trích xuất từ vựng tiếng Anh cho giáo viên THCS ở Việt Nam.
Người dùng dán một đoạn văn bản chứa danh sách từ vựng tiếng Anh, có thể lộn xộn, sai định dạng,
thiếu dấu phân cách rõ ràng, hoặc chép từ nhiều nguồn khác nhau (sách giáo khoa, ghi chú...).

Nhiệm vụ:
- Tách ra từng từ/cụm từ tiếng Anh riêng biệt. QUAN TRỌNG: trường "word" CHỈ chứa đúng từ/cụm từ
  tiếng Anh, KHÔNG được kèm loại từ trong ngoặc như "(n)", "(v)", "(adj)" — những ký hiệu loại từ
  đó phải để riêng vào trường "part_of_speech" (ví dụ: "n", "v", "adj", "n, v"), để trống nếu văn
  bản không ghi rõ loại từ.
- Với mỗi từ, xác định nghĩa tiếng Việt (nếu văn bản có sẵn nghĩa thì dùng đúng nghĩa đó,
  không tự bịa nghĩa khác). QUAN TRỌNG: trường "meaning" CHỈ được chứa ĐÚNG MỘT nghĩa ngắn gọn
  (ví dụ "nhớ"), TUYỆT ĐỐI KHÔNG liệt kê nhiều nghĩa đồng nghĩa cách nhau bằng dấu phẩy
  (không viết "nhớ, ghi nhớ") — nếu từ có nhiều nghĩa, chỉ chọn nghĩa phổ biến/phù hợp nhất.
- Nếu văn bản có sẵn câu ví dụ đi kèm từ đó thì giữ nguyên câu ví dụ đó (miễn là không quá dài).
  Nếu không có, hãy tự đặt 1 câu ví dụ tiếng Anh THẬT NGẮN GỌN (tối đa 6 từ), cấu trúc đơn giản,
  dùng từ vựng cơ bản mà học sinh THCS mới học đã biết, có dùng đúng từ đang xét — vì câu này
  sẽ được dùng để học sinh ghép từng từ thành câu, càng ngắn càng dễ ghép đúng.
- Với câu ví dụ (dù lấy từ văn bản hay tự đặt), luôn kèm theo bản dịch tiếng Việt của
  chính câu ví dụ đó vào trường "example_translation".
- Bỏ qua các dòng tiêu đề, số thứ tự, hoặc nội dung không phải từ vựng.

CHỈ trả lời bằng JSON thuần túy, dạng mảng, KHÔNG kèm giải thích, KHÔNG dùng markdown code fence,
KHÔNG có chữ nào khác ngoài JSON. Định dạng bắt buộc:
[{"word": "...", "part_of_speech": "...", "meaning": "...", "example": "...", "example_translation": "..."}]`;

function cleanItems(items) {
  if (!Array.isArray(items)) return null;
  return items
    .map((it) => {
      let word = (it.word || '').toString().trim();
      let pos = (it.part_of_speech || '').toString().trim();
      // Phòng trường hợp AI vẫn lỡ nhét "(n)" vào cuối word -> tự tách ra
      const match = word.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (match) {
        word = match[1].trim();
        if (!pos) pos = match[2].trim();
      }
      return {
        word,
        part_of_speech: pos,
        meaning: (it.meaning || '').toString().trim(),
        example: (it.example || '').toString().trim(),
        example_translation: (it.example_translation || '').toString().trim(),
      };
    })
    .filter((it) => it.word && it.meaning);
}

function extractJsonArray(rawText) {
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const jsonSlice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(jsonSlice);
}

// Kết quả sai định dạng / rỗng cũng bị coi là lỗi => tự thử nhà cung cấp AI kế tiếp
function parseVocab(rawText) {
  const items = cleanItems(extractJsonArray(rawText));
  if (!items || items.length === 0) throw new Error('Không tách được từ vựng nào');
  return items;
}

export async function POST(request) {
  const { text } = await request.json();
  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'Thiếu nội dung để xử lý' }, { status: 400 });
  }
  if (text.length > 30000) {
    return NextResponse.json({ error: 'Đoạn văn bản quá dài (tối đa khoảng 30.000 ký tự). Hãy chia nhỏ rồi xử lý từng phần.' }, { status: 413 });
  }

  try {
    const { value, provider, model } = await generateText({ system: SYSTEM_PROMPT, user: text, maxTokens: 8000, temperature: 0.2, parse: parseVocab });
    return NextResponse.json({ items: value, provider, model });
  } catch (e) {
    if (e.code === 'not_configured') {
      return NextResponse.json({ error: 'Chưa cấu hình khóa AI. Hãy thêm GEMINI_API_KEY hoặc DEEPSEEK_API_KEY trong Vercel.' }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'AI không tách được từ vựng từ đoạn văn bản này, hoặc các dịch vụ AI đang quá tải. Vui lòng đợi khoảng 1 phút rồi thử lại, hoặc dán lại rõ ràng hơn.' },
      { status: 500 }
    );
  }
}
