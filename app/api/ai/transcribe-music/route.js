// app/api/ai/transcribe-music/route.js
//
// Nhận 1 ảnh bản nhạc → Claude đọc ra DANH SÁCH NỐT (bản nháp). Giáo viên bắt buộc
// nghe lại / sửa trước khi lưu — AI không bao giờ ghi thẳng vào bài của học sinh.
//
// So với bản cũ:
//  1. Có đăng nhập + chặn học sinh + giới hạn số lần gọi (trước đây ai biết URL cũng gọi được → đốt tiền API).
//  2. export maxDuration = 60 (không có dòng này Vercel cắt request ở ~10-15 giây → lỗi timeout).
//  3. DẤU LẶNG được tính vào thời gian (bản cũ bỏ qua dấu lặng nên các nốt sau bị dồn lên sớm).
//  4. Dùng tool_use để ép Claude trả JSON đúng schema (không còn lỗi "định dạng không đọc được").
//  5. AI báo số ô nhịp của từng nốt → server kiểm tra tổng phách mỗi ô nhịp, cảnh báo ô nào có thể đọc sai.
//  6. Trả thêm nhịp / giọng / tempo AI đọc được để giao diện điền sẵn.
//
// Biến môi trường: ANTHROPIC_API_KEY (hoặc ANTHROPIC_API_KEYS cách nhau dấu phẩy).
// Tuỳ chọn: MUSIC_AI_MODEL (mặc định claude-sonnet-5-5, tự lùi về claude-sonnet-4-6 nếu tài khoản chưa có).

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { durationBeats, beatsPerMeasure, normalizePitch, DURATIONS, TIME_SIGNATURES } from '@/lib/musicNotes';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODELS = [process.env.MUSIC_AI_MODEL || 'claude-sonnet-5-5', 'claude-sonnet-4-6'].filter((m, i, a) => a.indexOf(m) === i);
const DURATION_LIST = DURATIONS.filter((d) => d.key !== 'grace');
const DURATION_KEYS = DURATION_LIST.map((d) => d.key);
const DURATION_HELP = DURATION_LIST.map((d) => `${d.key} (${d.beats} phách)`).join(', ');
const VALID_DURATION = new Set(DURATION_KEYS);

// Vai trò KHÔNG được dùng AI (tránh học sinh gọi). Chỉnh theo bảng profiles của bạn nếu cần.
const BLOCKED_ROLES = ['student', 'hoc_sinh'];

function keysOf() {
  const many = (process.env.ANTHROPIC_API_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (many.length) return many;
  const one = (process.env.ANTHROPIC_API_KEY || '').trim();
  return one ? [one] : [];
}

// Giới hạn đơn giản trong bộ nhớ (đủ để chặn bấm liên tục; mỗi instance serverless đếm riêng).
const hits = new Map();
function rateLimited(userId, max = 12, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(userId) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(userId, arr); return true; }
  arr.push(now);
  hits.set(userId, arr);
  return false;
}

const SYSTEM_PROMPT = `Bạn là trợ lý đọc bản nhạc cho giáo viên Âm nhạc. Người dùng gửi 1 ảnh chụp/scan bản nhạc khóa Sol (treble clef).
Hãy đọc giai điệu CHÍNH (nếu có nhiều bè hoặc hợp âm, chỉ lấy nốt trên cùng) theo thứ tự trái → phải, trên → dưới, rồi gọi công cụ submit_score để nộp kết quả.

Quy tắc:
- Trước hết nhìn đầu khuông nhạc: ghi nhịp (time_signature, vd "4/4", "3/4", "2/4"), giọng (key_signature, vd "G major", "D minor") và tempo nếu có ghi (♩ = 90), không có thì để null.
- "pitch" là CAO ĐỘ THẬT SẼ VANG RA, đã tính cả hóa biểu ở đầu khuông và dấu hóa bất thường trong ô nhịp (dấu thăng/giáng/bình tác dụng đến hết ô nhịp đó). Ví dụ giọng Sol trưởng (1 thăng ở Fa): nốt Fa không có dấu hóa riêng phải ghi "F#4". Ký hiệu quốc tế, C4 = Đô giữa. Ghi dấu thăng bằng "#", giáng bằng "b" (vd F#4, Bb3).
- Nhịp 6/8: một ô nhịp = 6 móc đơn = 3 phách (đen = 1 phách). Nhịp 2/4 = 2 phách, 3/4 = 3 phách, 4/4 = 4 phách.
- Mỗi sự kiện có "measure" = số thứ tự ô nhịp (đếm các vạch nhịp, ô đầu là 1; nếu có ô lấy đà không đủ phách thì vẫn đánh số 1).
- Dấu lặng: đưa vào với type "rest" và duration tương ứng (không có pitch) để giữ đúng thời gian. Nốt thì type "note".
- Giá trị duration chỉ được là một trong: ${DURATION_HELP}. Nốt chấm dôi hoặc nốt nối nhau thì chọn giá trị gần đúng nhất có trong danh sách.
- "lyric": chữ lời ứng với nốt nếu có, mỗi âm tiết một nốt; không có lời thì bỏ trống.
- Không chắc về một nốt thì vẫn đoán giá trị hợp lý nhất theo ngữ cảnh, đừng bỏ sót nốt.
- Nếu ảnh không phải bản nhạc hoặc không đọc được: nộp events là mảng rỗng.`;

const TOOL = {
  name: 'submit_score',
  description: 'Nộp kết quả đọc bản nhạc.',
  input_schema: {
    type: 'object',
    properties: {
      time_signature: { type: ['string', 'null'] },
      key_signature: { type: ['string', 'null'] },
      tempo_bpm: { type: ['number', 'null'] },
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            measure: { type: 'integer', minimum: 1 },
            type: { type: 'string', enum: ['note', 'rest'] },
            pitch: { type: 'string', description: 'vd C4, F#4, Bb3; bỏ trống nếu là dấu lặng' },
            duration: { type: 'string', enum: DURATION_KEYS },
            lyric: { type: 'string' },
          },
          required: ['measure', 'type', 'duration'],
        },
      },
    },
    required: ['events'],
  },
};

async function callClaude(apiKey, model, imageBase64, mediaType, hint) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Đọc bản nhạc trong ảnh và nộp kết quả bằng công cụ submit_score.' + (hint ? ` (Giáo viên cho biết bài đang soạn ở nhịp ${hint}; chỉ dùng thông tin này nếu ảnh không ghi rõ nhịp.)` : '') },
        ],
      }],
    }),
    signal: AbortSignal.timeout(55000),
  });
}

export async function POST(request) {
  try {
    // 1) Đăng nhập + phân quyền
    const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Thiếu token đăng nhập' }, { status: 401 });
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ' }, { status: 401 });
    const { data: prof } = await supabaseAdmin.from('profiles').select('role, is_tpt').eq('id', userData.user.id).single();
    if (!prof || BLOCKED_ROLES.includes(String(prof.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Chỉ giáo viên mới dùng được tính năng này' }, { status: 403 });
    }
    if (rateLimited(userData.user.id)) {
      return NextResponse.json({ error: 'Bạn gọi AI hơi nhiều, vui lòng đợi vài phút rồi thử lại.' }, { status: 429 });
    }

    // 2) Đọc dữ liệu gửi lên
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ' }, { status: 400 }); }
    const { imageBase64, mediaType, timeSignature } = body || {};
    if (!imageBase64) return NextResponse.json({ error: 'Thiếu ảnh.' }, { status: 400 });
    if (imageBase64.length > 6_000_000) return NextResponse.json({ error: 'Ảnh quá lớn, hãy chụp/cắt nhỏ lại.' }, { status: 413 });
    const mt = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType) ? mediaType : 'image/jpeg';

    const keys = keysOf();
    if (keys.length === 0) {
      return NextResponse.json({ error: 'Chưa cấu hình ANTHROPIC_API_KEY trên máy chủ (Vercel > Settings > Environment Variables).' }, { status: 500 });
    }

    // 3) Gọi Claude (thử lần lượt khóa, rồi model dự phòng)
    let result = null;
    let lastErr = null;
    outer: for (const apiKey of keys) {
      for (const model of MODELS) {
        try {
          const res = await callClaude(apiKey, model, imageBase64, mt, timeSignature);
          if (!res.ok) {
            const detail = await res.text();
            lastErr = new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
            if (res.status === 404 || (res.status === 400 && /model/i.test(detail))) continue; // model chưa có → thử model dự phòng
            if (res.status === 401 || res.status === 403 || res.status === 429) continue outer; // thử khóa kế tiếp
            break outer;
          }
          const data = await res.json();
          if (data.stop_reason === 'max_tokens') {
            return NextResponse.json({ error: 'Bản nhạc quá dài để đọc một lần — hãy cắt ảnh thành từng đoạn (vài dòng nhạc) rồi đọc từng phần.' }, { status: 422 });
          }
          const block = (data.content || []).find((b) => b.type === 'tool_use' && b.name === TOOL.name);
          if (!block?.input) { lastErr = new Error('AI không trả kết quả đúng định dạng'); continue; }
          result = block.input;
          break outer;
        } catch (e) {
          lastErr = e;
        }
      }
    }
    if (!result) return NextResponse.json({ error: 'Gọi AI thất bại: ' + (lastErr?.message || 'không rõ lỗi') }, { status: 502 });

    // 4) Chuyển thành danh sách nốt, tính startBeat (có cộng cả dấu lặng)
    const events = Array.isArray(result.events) ? result.events : [];
    if (events.length === 0) return NextResponse.json({ error: 'AI không nhận ra bản nhạc trong ảnh này — thử ảnh rõ hơn, chụp thẳng góc hơn.' }, { status: 422 });

    const sigFromAi = TIME_SIGNATURES.includes(result.time_signature) ? result.time_signature : null;
    const sig = sigFromAi || (TIME_SIGNATURES.includes(timeSignature) ? timeSignature : '4/4');
    const perMeasure = beatsPerMeasure(sig);

    let cursor = 0;
    const notes = [];
    const measureSum = new Map(); // ô nhịp → tổng phách (nốt + lặng)
    let dropped = 0;
    for (const ev of events) {
      if (!ev || !VALID_DURATION.has(ev.duration)) { dropped++; continue; }
      const beats = durationBeats(ev.duration);
      const m = Number.isInteger(ev.measure) ? ev.measure : null;
      if (m != null) measureSum.set(m, (measureSum.get(m) || 0) + beats);
      if (ev.type === 'rest') { cursor += beats; continue; }
      if (!/^[A-G](#|b)?\d$/.test(ev.pitch || '')) { dropped++; cursor += beats; continue; }
      notes.push({ pitch: normalizePitch(ev.pitch), duration: ev.duration, startBeat: cursor, lyric: ev.lyric || '' });
      cursor += beats;
    }

    // 5) Cảnh báo ô nhịp có tổng phách bất thường (bỏ qua ô đầu và ô cuối vì có thể là ô lấy đà / ô kết)
    const warnings = [];
    const ms = [...measureSum.keys()].sort((a, b) => a - b);
    const first = ms[0], last = ms[ms.length - 1];
    for (const m of ms) {
      if (m === first || m === last) continue;
      const s = measureSum.get(m);
      if (Math.abs(s - perMeasure) > 0.01) warnings.push(`Ô nhịp ${m}: AI đọc được ${s} phách, nhịp ${sig} cần ${perMeasure} phách — nên kiểm tra lại ô này.`);
    }
    if (dropped > 0) warnings.push(`Có ${dropped} nốt AI đọc ra nhưng không hợp lệ nên đã bỏ qua — hãy đối chiếu số nốt với bản nhạc gốc.`);

    return NextResponse.json({
      notes,
      rawCount: events.length,
      warnings: warnings.slice(0, 12),
      meta: {
        timeSignature: sigFromAi,
        keySignature: result.key_signature || null,
        tempoBpm: Number.isFinite(result.tempo_bpm) ? Math.round(result.tempo_bpm) : null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
