// Gọi nhiều mô hình AI theo thứ tự TỪ THÔNG MINH NHẤT ĐẾN YẾU HƠN, tự chuyển sang mô hình kế tiếp khi
// mô hình trước hết hạn mức, quá tải, bị ngừng hoặc trả kết quả sai định dạng.
// Mỗi mô hình còn xoay vòng qua NHIỀU KHÓA (nhiều tài khoản) — khóa nào hết hạn mức thì tự chuyển
// sang khóa kế của cùng mô hình, hết cả mô hình đó mới chuyển xuống mô hình yếu hơn.
// CHỈ dùng trong app/api/**/route.js (chạy trên máy chủ).
//
// Khóa (Vercel > Settings > Environment Variables):
//   Một khóa:     GEMINI_API_KEY=...
//   Nhiều khóa:   GEMINI_API_KEYS=khoa_tk1,khoa_tk2,khoa_tk3   (mỗi khóa từ một tài khoản Google khác nhau)
//                 — có cả hai biến thì dùng GEMINI_API_KEYS, bỏ qua GEMINI_API_KEY.
//   Tương tự cho DeepSeek: DEEPSEEK_API_KEY / DEEPSEEK_API_KEYS
//   Và Claude:             ANTHROPIC_API_KEY / ANTHROPIC_API_KEYS
//
// Thứ tự mặc định (mô hình Gemini mạnh -> yếu; DeepSeek và Claude ĐANG TẮT):
//   gemini-3.8-flash -> gemini-3.7-flash -> gemini-3.6-flash -> gemini-3.5-flash-lite
// Muốn tự đặt thứ tự, hoặc BẬT LẠI DeepSeek / Claude làm dự phòng: đặt biến AI_CHAIN, dạng
//   nhà:mô_hình,nhà:mô_hình  (nhà = gemini | deepseek | anthropic), ví dụ:
//   AI_CHAIN=gemini:gemini-3.8-flash,gemini:gemini-3.7-flash,gemini:gemini-3.6-flash,gemini:gemini-3.5-flash-lite,deepseek:deepseek-flash
// (Chỉ cần đặt biến AI_CHAIN, không cần sửa file này.)

const DEFAULT_CHAIN = [
  { provider: 'gemini', model: 'gemini-3.8-flash' },
  { provider: 'gemini', model: 'gemini-3.7-flash' },
  { provider: 'gemini', model: 'gemini-3.6-flash' },
  { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Danh sách khóa của một nhà cung cấp: ưu tiên biến số nhiều (…_KEYS, cách nhau bằng dấu phẩy),
// không có thì dùng biến số ít (…_KEY). Mỗi khóa được đặt tên ngắn (tk1, tk2…) để ghi log/nghỉ theo từng khóa.
function keysOf(envPrefix) {
  const many = (process.env[`${envPrefix}_KEYS`] || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (many.length) return many.map((key, i) => ({ key, label: `tk${i + 1}` }));
  const one = (process.env[`${envPrefix}_KEY`] || '').trim();
  return one ? [{ key: one, label: 'tk1' }] : [];
}

async function postJson(url, headers, body, timeoutMs) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.detail = (await res.text()).slice(0, 300);
    throw err;
  }
  return res.json();
}

// Gemini: dùng Interactions API — endpoint chính thức theo tài liệu Google (ai.google.dev) là
// v1beta/interactions (KHÔNG PHẢI v1beta2 — bản trước ghi nhầm v1beta2 khiến mọi request bị 404).
async function callGemini({ apiKey, model, system, user, maxTokens, temperature, timeoutMs }) {
  const data = await postJson(
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    { 'x-goog-api-key': apiKey },
    {
      model,
      input: user,
      system_instruction: system,
      generation_config: { max_output_tokens: maxTokens, temperature },
    },
    timeoutMs
  );
  const outputStep = (data.steps || []).filter((s) => s.type === 'model_output').pop();
  const text = (outputStep?.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('\n');
  if (!text.trim()) throw new Error('Gemini trả về nội dung rỗng');
  return text;
}

async function callDeepSeek({ apiKey, model, system, user, maxTokens, temperature, timeoutMs }) {
  const data = await postJson(
    'https://api.deepseek.com/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    {
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      thinking: { type: 'disabled' }, // không cần "suy nghĩ" dài: nhanh và rẻ hơn cho việc tách chữ / viết gợi ý
      temperature,
      max_tokens: maxTokens,
    },
    timeoutMs
  );
  const text = data.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('DeepSeek trả về nội dung rỗng');
  return text;
}

async function callAnthropic({ apiKey, model, system, user, maxTokens, timeoutMs }) {
  const data = await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] },
    timeoutMs
  );
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  if (!text.trim()) throw new Error('Claude trả về nội dung rỗng');
  return text;
}

const PROVIDERS = {
  gemini: { name: 'Gemini', envPrefix: 'GEMINI_API', call: callGemini },
  deepseek: { name: 'DeepSeek', envPrefix: 'DEEPSEEK_API', call: callDeepSeek },
  anthropic: { name: 'Claude', envPrefix: 'ANTHROPIC_API', call: callAnthropic },
};

// Danh sách (nhà, mô hình) sẽ thử, theo thứ tự ưu tiên — chỉ giữ lại nhà đang có ít nhất 1 khóa.
export function modelChain(allow) {
  let chain = DEFAULT_CHAIN;
  const custom = (process.env.AI_CHAIN || '').trim();
  if (custom) {
    chain = custom.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const i = s.indexOf(':');
      return { provider: s.slice(0, i).toLowerCase(), model: s.slice(i + 1) };
    });
  }
  chain = chain.filter((c) => PROVIDERS[c.provider] && c.model && (!allow || allow.includes(c.provider)) && keysOf(PROVIDERS[c.provider].envPrefix).length > 0);
  // AI_PROVIDER (tuỳ chọn): đưa các mô hình của nhà này lên trước
  const pref = (process.env.AI_PROVIDER || 'auto').toLowerCase();
  if (pref !== 'auto') chain = [...chain.filter((c) => c.provider === pref), ...chain.filter((c) => c.provider !== pref)];
  return chain;
}

// Ghi nhớ tạm (trong bộ nhớ máy chủ) mô hình/khóa nào đang hết hạn mức, bị ngừng hoặc sai, để lần sau bỏ qua ngay.
const state = (globalThis.__aiState ||= { cool: new Map(), dead: new Map(), rr: new Map() });
const cooling = (key) => (state.cool.get(key) || 0) > Date.now();
const setCool = (key, ms) => state.cool.set(key, Date.now() + ms);
export function resetAiState() { state.cool.clear(); state.dead.clear(); state.rr.clear(); }

// Chỉ thử lại 1 lần khi quá tải tạm thời (503)
async function callWithRetry(fn, budgetOk) {
  try {
    return await fn();
  } catch (e) {
    if (e.status === 503 && budgetOk()) {
      await sleep(1200);
      return fn();
    }
    throw e;
  }
}

// parse(text) (tuỳ chọn): kiểm tra / chuyển đổi kết quả; ném lỗi nếu sai định dạng => chuyển sang mô hình/khóa kế tiếp.
// Trả về { value, provider, model, tried }.
export async function generateText({ system, user, maxTokens = 4000, temperature = 0.3, parse, allow }) {
  const chain = modelChain(allow);
  if (chain.length === 0) {
    const err = new Error('Chưa cấu hình khóa AI (GEMINI_API_KEY/GEMINI_API_KEYS, DEEPSEEK_API_KEY hoặc ANTHROPIC_API_KEY)');
    err.code = 'not_configured';
    throw err;
  }

  const deadline = Date.now() + 52000; // tổng thời gian tối đa cho mọi lần thử
  const tried = [];
  for (const { provider, model } of chain) {
    const p = PROVIDERS[provider];
    if ((state.dead.get(provider) || 0) > Date.now()) {
      tried.push({ provider: p.name, model, skipped: 'nhà đang tạm khoá' });
      continue;
    }
    const keys = keysOf(p.envPrefix);
    // Xoay vòng điểm bắt đầu giữa các khóa để chia đều lượt gọi, không dồn hết vào khóa đầu tiên
    const rrKey = `${provider}:${model}`;
    const start = (state.rr.get(rrKey) || 0) % keys.length;
    state.rr.set(rrKey, start + 1);

    let modelDown = false;
    for (let i = 0; i < keys.length && !modelDown; i += 1) {
      const { key: apiKey, label } = keys[(start + i) % keys.length];
      const cd = `${provider}:${model}:${label}`;
      if (cooling(cd)) {
        tried.push({ provider: p.name, model, key: label, skipped: 'đang nghỉ (hết hạn mức)' });
        continue;
      }
      const remaining = deadline - Date.now();
      if (remaining < 4000) break;
      const timeoutMs = Math.min(38000, remaining - 500);
      try {
        const text = await callWithRetry(
          () => p.call({ apiKey, model, system, user, maxTokens, temperature, timeoutMs }),
          () => deadline - Date.now() > 8000
        );
        const value = parse ? parse(text) : text;
        tried.push({ provider: p.name, model, key: label, ok: true });
        return { value, provider: p.name, model, tried };
      } catch (e) {
        const st = e.status;
        if (st === 429) setCool(cd, 10 * 60 * 1000); // tài khoản này hết hạn mức: nghỉ 10 phút, thử khóa khác
        else if (st === 401 || st === 403) setCool(cd, 60 * 60 * 1000); // khóa sai / không có quyền: nghỉ 1 giờ
        else if (st === 402) state.dead.set(provider, Date.now() + 10 * 60 * 1000); // hết tiền: bỏ cả nhà 10 phút
        else if (st === 503) setCool(cd, 60 * 1000);
        else if (st === 404) { modelDown = true; setCool(`${provider}:${model}`, 60 * 60 * 1000); } // mô hình không còn tồn tại: bỏ mô hình (mọi khóa), không phải lỗi của riêng khóa này
        tried.push({ provider: p.name, model, key: label, error: st ? `lỗi ${st}` : e.message });
        console.error(`[AI] ${p.name}/${model}/${label} lỗi`, st || '', e.detail || e.message);
      }
    }
  }
  const err = new Error(`Các mô hình AI đều gặp lỗi (${tried.map((t) => `${t.model}${t.key ? '/' + t.key : ''}: ${t.skipped || t.error || 'không rõ'}`).join('; ')})`);
  err.code = 'all_failed';
  err.tried = tried;
  throw err;
}
