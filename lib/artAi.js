// CHỈ import file này trong API route (server). Không import từ component 'use client'.
// Soạn barem Mỹ thuật bằng AI: chỉ gửi CHỮ (không gửi ảnh, không dữ liệu học sinh) nên dùng được mọi nhà cung cấp.
import { generateText, AI_LONG } from '@/lib/aiProviders';
import { round025 } from '@/lib/litConfig';

function extractJson(text) {
  const cleaned = String(text).replace(/```json|```/g, '').trim();
  const a = cleaned.indexOf('{');
  const b = cleaned.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('AI không trả về JSON (có thể bị cắt giữa chừng)');
  const slice = cleaned.slice(a, b + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return JSON.parse(slice.replace(/\r?\n/g, ' ').replace(/,\s*([}\]])/g, '$1'));
  }
}

export async function generateArtRubric({ title, prompt, grade, maxScore, mode }) {
  const system =
    'Bạn là giáo viên Mỹ thuật THCS giàu kinh nghiệm, soạn barem chấm bài vẽ theo chương trình GDPT 2018 của Việt Nam. ' +
    'Chỉ trả về JSON thuần, không markdown, không thêm chữ nào ngoài JSON.';

  const how = mode === 'web_draw'
    ? 'Học sinh vẽ trực tiếp trên máy tính hoặc điện thoại.'
    : 'Học sinh vẽ trên giấy bằng màu thật rồi chụp ảnh nộp bài.';

  const user = `Hãy soạn barem chấm bài vẽ sau.

Đề bài: ${title}
Yêu cầu chi tiết của giáo viên: ${prompt || '(không có)'}
Khối lớp: ${grade ?? 'THCS'}
Hình thức nộp: ${how}
Thang điểm: ${maxScore}

Yêu cầu:
- 4 đến 6 tiêu chí phù hợp đề bài (ví dụ: Bố cục, Hình vẽ, Màu sắc, Sáng tạo, Hoàn thiện, Đúng yêu cầu đề). Chỉ dùng tiêu chí giáo viên có thể đánh giá bằng mắt khi xem ảnh bài vẽ.
- Tổng điểm các tiêu chí đúng bằng ${maxScore}; điểm mỗi tiêu chí là bội của 0.25.
- "description" nêu yêu cầu cần đạt và 4 mức cụ thể (Tốt / Khá / Trung bình / Yếu) kèm số điểm của từng mức, 2-4 câu, ngắn gọn, dễ hiểu với giáo viên.

Định dạng trả về:
{"criteria":[{"name":"...","description":"...","max_points":2}]}`;

  const parse = (text) => {
    const raw = extractJson(text);
    const list = (raw.criteria || [])
      .map((c) => ({
        name: String(c.name || '').trim(),
        description: String(c.description || '').trim(),
        max_points: Math.max(0.25, round025(c.max_points || 0)),
      }))
      .filter((c) => c.name)
      .slice(0, 8);
    if (list.length === 0) throw new Error('Barem rỗng');

    // Ép tổng điểm đúng bằng thang điểm: dồn phần lệch vào tiêu chí cuối
    const sum = list.reduce((s, c) => s + c.max_points, 0);
    const diff = round025(Number(maxScore) - sum);
    if (diff !== 0) {
      const last = list[list.length - 1];
      last.max_points = Math.max(0.25, round025(last.max_points + diff));
    }
    return list;
  };

  const { value } = await generateText({ system, user, maxTokens: 6000, temperature: 0.4, parse, ...AI_LONG });
  return value;
}
