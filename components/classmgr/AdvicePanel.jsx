'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { anonymizeReport } from '@/lib/adviceRules';

// Gợi ý cách khắc phục cho học sinh vi phạm: bộ gợi ý có sẵn (luôn dùng được) + nút hỏi AI để phân tích sâu hơn.
export default function AdvicePanel({ classId, rep, advice }) {
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState('');
  const [provider, setProvider] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);

  async function askAi() {
    setBusy(true);
    setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { payload, restore } = anonymizeReport(rep);
      const res = await fetch('/api/ai/class-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ classId, payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 501) setErr('Chưa bật AI: hãy thêm biến GEMINI_API_KEY (hoặc ANTHROPIC_API_KEY) trong Vercel (Settings → Environment Variables) rồi deploy lại. Trong lúc chờ, bạn vẫn dùng được các gợi ý bên trên.');
      else if (!res.ok) setErr(json.error || 'Không nhận được câu trả lời từ AI.');
      else { setAi(restore(json.text)); setProvider(json.provider ? `${json.provider}${json.model ? ` · ${json.model}` : ''}` : ''); }
    } catch {
      setErr('Không kết nối được máy chủ.');
    }
    setBusy(false);
  }

  return (
    <div className="cm-card">
      <div className="cm-h">
        <h3>🤖 Trợ lý gợi ý cách khắc phục</h3>
        <button className="cm-btn cm-btn-main" disabled={busy} onClick={askAi}>{busy ? 'AI đang phân tích…' : '✨ Hỏi AI phân tích sâu hơn'}</button>
      </div>
      <p className="cm-hint">Gợi ý dựa trên các lỗi ghi nhận trong tuần. Đây chỉ là tham khảo — giáo viên hiểu học sinh nhất. Khi hỏi AI, tên học sinh được thay bằng mã, không gửi tên thật ra ngoài.</p>

      {advice.tips.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 12 }}>
          {advice.tips.map((t) => (
            <div key={t.title} style={{ border: '1px solid var(--cm-line)', borderRadius: 12, padding: '10px 12px', background: '#fafcfb' }}>
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>{t.icon} {t.title}</div>
              <div style={{ fontSize: 13, color: 'var(--cm-muted)', marginTop: 4 }}>{t.text}</div>
            </div>
          ))}
        </div>
      )}

      {advice.students.length === 0 ? (
        <div className="cm-empty">Tuần này không có bạn nào vi phạm từ 2 lần, chưa cần kế hoạch riêng.</div>
      ) : (
        <>
          <div className="cm-lbl" style={{ marginTop: 0 }}>Kế hoạch cho từng bạn vi phạm nhiều lần</div>
          {advice.students.map((s) => (
            <div key={s.student_id} style={{ border: '1px solid var(--cm-line)', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(open === s.student_id ? null : s.student_id)}
                aria-expanded={open === s.student_id}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: '#fff', padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}
              >
                <span><b>{s.name}</b> <span className={`cm-pill ${s.level === 'high' ? 'bad' : 'warn'}`}>{s.cnt} lần · {s.level === 'high' ? 'cần can thiệp sớm' : 'cần theo dõi'}</span>
                  <span className="cm-hint" style={{ display: 'block', margin: 0 }}>{s.issues}</span></span>
                <span aria-hidden="true">{open === s.student_id ? '▲' : '▼'}</span>
              </button>
              {open === s.student_id && (
                <ul style={{ margin: 0, padding: '4px 12px 12px 30px', fontSize: 13.5 }}>
                  {s.actions.map((a) => <li key={a} style={{ margin: '4px 0' }}>{a}</li>)}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {err && <div className="cm-pill warn" style={{ display: 'block', whiteSpace: 'normal', marginTop: 10 }}>{err}</div>}
      {ai && (
        <div style={{ marginTop: 12, border: '1px solid var(--cm-accent, #2f6f5e)', borderRadius: 12, padding: '12px 14px', background: '#f3f9f6' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>✨ Phân tích của AI{provider ? ` (${provider})` : ''}</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6 }}>{ai}</div>
        </div>
      )}
    </div>
  );
}
