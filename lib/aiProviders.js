// Gọi nhiều mô hình AI theo thứ tự TỪ THÔNG MINH NHẤT ĐẾN YẾU HƠN, tự chuyển sang mô hình kế tiếp khi
// mô hình trước hết hạn mức, quá tải, bị ngừng hoặc trả kết quả sai định dạng.
// CHỈ dùng trong app/api/**/route.js (chạy trên máy chủ).
//
// Khóa (Vercel > Settings > Environment Variables) — có khóa nào thì dùng được các mô hình của nhà đó:
//   GEMINI_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY
//
// Thứ tự mặc định (mô hình mạnh -> yếu; nhà nào chưa có khóa sẽ tự bỏ qua):
//   gemini-3.8-flash -> gemini-3.7-flash -> gemini-3.6-flash -> deepseek-v4-pro
//   -> gemini-3.5-flash-lite -> deepseek-flash -> claude-haiku-4-5
// Muốn tự đặt thứ tự: biến AI_CHAIN, dạng  nhà:mô_hình,nhà:mô_hình  (nhà = gemini | deepseek | anthropic), ví dụ
//   AI_CHAIN=gemini:gemini-3.8-flash,deepseek:deepseek-flash,gemini:gemini-3.5-flash-lite

const DEFAULT_CHAIN = [
  { provider: 'gemini', model: 'gemini-3.8-flash' },
  { provider: 'gemini', model: 'gemini-3.7-flash' },
  { provider: 'gemini', model: 'gemini-3.6-flash' },
  { provider: 'deepseek', model: 'deepseek-v4-pro' },
  { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
  { provider: 'deepseek', model: 'deepseek-flash' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function callGemini({ model, system, user, timeoutMs }) {
  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    { system_instruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }] },
    timeoutMs
  );
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
  if (!text.trim()) throw new Error('Gemini trả về nội dung rỗng');
  return text;
}

async function callDeepSeek({ model, system, user, maxTokens, temperature, timeoutMs }) {
  const data = await postJson(
    'https://api.deepseek.com/chat/completions',
    { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
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

async function callAnthropic({ model, system, user, maxTokens, timeoutMs }) {
  const data = await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] },
    timeoutMs
  );
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  if (!text.trim()) throw new Error('Claude trả về nội dung rỗng');
  return text;
}

const PROVIDERS = {
  gemini: { name: 'Gemini', enabled: () => !!process.env.GEMINI_API_KEY, call: callGemini },
  deepseek: { name: 'DeepSeek', enabled: () => !!process.env.DEEPSEEK_API_KEY, call: callDeepSeek },
  anthropic: { name: 'Claude', enabled: () => !!process.env.ANTHROPIC_API_KEY, call: callAnthropic },
};

// Danh sách (nhà, mô hình) sẽ thử, theo thứ tự ưu tiên
export function modelChain(allow) {
  let chain = DEFAULT_CHAIN;
  const custom = (process.env.AI_CHAIN || '').trim();
  if (custom) {
    chain = custom.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const i = s.indexOf(':');
      return { provider: s.slice(0, i).toLowerCase(), model: s.slice(i + 1) };
    });
  }
  chain = chain.filter((c) => PROVIDERS[c.provider] && c.model && (!allow || allow.includes(c.provider)) && PROVIDERS[c.provider].enabled());
  // AI_PROVIDER (tuỳ chọn): đưa các mô hình của nhà này lên trước
  const pref = (process.env.AI_PROVIDER || 'auto').toLowerCase();
  if (pref !== 'auto') chain = [...chain.filter((c) => c.provider === pref), ...chain.filter((c) => c.provider !== pref)];
  return chain;
}

// Ghi nhớ tạm (trong bộ nhớ máy chủ) mô hình nào đang hết hạn mức / bị ngừng để lần sau bỏ qua ngay, đỡ mất thời gian.
const state = (globalThis.__aiState ||= { cool: new Map(), dead: new Map() });
const cooling = (key) => (state.cool.get(key) || 0) > Date.now();
const setCool = (key, ms) => state.cool.set(key, Date.now() + ms);
export function resetAiState() { state.cool.clear(); state.dead.clear(); }

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

// parse(text) (tuỳ chọn): kiểm tra / chuyển đổi kết quả; ném lỗi nếu sai định dạng => chuyển sang mô hình kế tiếp.
// Trả về { value, provider, model, tried }.
export async function generateText({ system, user, maxTokens = 4000, temperature = 0.3, parse, allow }) {
  const chain = modelChain(allow);
  if (chain.length === 0) {
    const err = new Error('Chưa cấu hình khóa AI (GEMINI_API_KEY, DEEPSEEK_API_KEY hoặc ANTHROPIC_API_KEY)');
    err.code = 'not_configured';
    throw err;
  }

  const deadline = Date.now() + 52000; // tổng thời gian tối đa cho mọi lần thử
  const tried = [];
  for (const { provider, model } of chain) {
    const key = `${provider}:${model}`;
    const p = PROVIDERS[provider];
    if (cooling(key) || (state.dead.get(provider) || 0) > Date.now()) {
      tried.push({ provider: p.name, model, skipped: true });
      continue;
    }
    const remaining = deadline - Date.now();
    if (remaining < 4000) break;
    const timeoutMs = Math.min(38000, remaining - 500);
    try {
      const text = await callWithRetry(() => p.call({ model, system, user, maxTokens, temperature, timeoutMs }), () => deadline - Date.now() > 8000);
      const value = parse ? parse(text) : text;
      tried.push({ provider: p.name, model, ok: true });
      return { value, provider: p.name, model, tried };
    } catch (e) {
      const st = e.status;
      if (st === 429) setCool(key, 10 * 60 * 1000); // hết hạn mức: nghỉ 10 phút
      else if (st === 404) setCool(key, 60 * 60 * 1000); // mô hình không còn: nghỉ 1 giờ
      else if (st === 401 || st === 403) state.dead.set(provider, Date.now() + 10 * 60 * 1000); // khóa sai / không có quyền: bỏ cả nhà
      else if (st === 503) setCool(key, 60 * 1000);
      tried.push({ provider: p.name, model, error: st ? `lỗi ${st}` : e.message });
      console.error(`[AI] ${p.name}/${model} lỗi`, st || '', e.detail || e.message);
    }
  }
  const err = new Error(`Các mô hình AI đều gặp lỗi (${tried.map((t) => `${t.model}: ${t.skipped ? 'đang nghỉ' : t.error || 'không rõ'}`).join('; ')})`);
  err.code = 'all_failed';
  err.tried = tried;
  throw err;
}
