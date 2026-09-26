'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Trang /student/khieu-nai - học sinh khiếu nại khi thấy bị/lớp bị trừ điểm chưa đúng.
// Có 2 loại, gửi cho 2 nơi khác nhau nên tách 2 tab:
//   - "Điểm lớp"  : lớp bị Sao đỏ/cô Tổng phụ trách trừ điểm thi đua chung -> gửi cho TPT.
//   - "Cá nhân"   : một bạn bị ban cán sự (lớp trưởng, tổ trưởng...) ghi nhận vi phạm riêng
//                    trong sổ theo dõi của lớp -> gửi thẳng cho GIÁO VIÊN CHỦ NHIỆM.
// Bất kỳ bạn nào trong lớp cũng gửi được (không chỉ người bị ghi nhận), phòng khi bạn ấy
// thấy oan cho bạn khác. Trang tự có header/tab vì nằm trong app/student/layout.jsx.

const STATUS_LABEL = { pending: 'Đang chờ xử lý', approved: 'Đã duyệt · đã khôi phục điểm', rejected: 'Đã từ chối · giữ nguyên điểm' };
const STATUS_COLOR = { pending: '#9a6708', approved: '#1a8a58', rejected: '#b3261e' };
const STATUS_BG = { pending: '#fff4dc', approved: '#e6f6ee', rejected: '#fdeceb' };

const KINDS = {
  class: {
    tabLabel: 'Điểm lớp',
    heading: 'Lớp bị trừ điểm gần đây',
    emptyList: 'Không có mục trừ điểm nào trong 3 tuần gần đây.',
    who: 'cô Tổng phụ trách',
    listFn: 'student_class_deductions',
    submitFn: 'student_submit_appeal',
    historyFn: 'student_my_appeals',
  },
  personal: {
    tabLabel: 'Cá nhân',
    heading: 'Vi phạm cá nhân gần đây trong lớp',
    emptyList: 'Không có bạn nào bị ghi nhận vi phạm trong 3 tuần gần đây.',
    who: 'giáo viên chủ nhiệm',
    listFn: 'class_recent_violations',
    submitFn: 'class_submit_appeal',
    historyFn: 'class_my_appeals',
  },
};

function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function StudentAppealsPage() {
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState('class');
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const cfg = KINDS[kind];

  const load = useCallback(async (k) => {
    setLoading(true);
    const c = KINDS[k];
    const [a, b] = await Promise.all([
      supabase.rpc(c.listFn, k === 'class' ? { p_days: 21 } : { p_days: 21 }),
      supabase.rpc(c.historyFn),
    ]);
    setLoading(false);
    if (a.error) {
      setMsg({ type: 'error', text: a.error.message });
      return;
    }
    setItems(a.data || []);
    setHistory(b.data || []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/login';
        return;
      }
      setReady(true);
      load('class');
    });
  }, [load]);

  function switchKind(k) {
    setKind(k);
    setPicked(null);
    setMsg(null);
    load(k);
  }

  async function submit() {
    if (!picked) return;
    if (reason.trim().length < 5) {
      setMsg({ type: 'error', text: 'Em hãy viết rõ lý do (ít nhất 5 chữ).' });
      return;
    }
    setBusy(true);
    const argKey = kind === 'class' ? 'p_deduction_id' : 'p_record_id';
    const { error } = await supabase.rpc(cfg.submitFn, { [argKey]: picked.id, p_reason: reason.trim() });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: `Đã gửi khiếu nại cho ${cfg.who}. Hãy chờ phản hồi nhé.` });
    setPicked(null);
    setReason('');
    load(kind);
  }

  if (!ready) return <p style={{ padding: 24 }}>Đang tải…</p>;

  return (
    <div style={{ padding: '20px 16px 60px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Khiếu nại</h1>
      <p style={{ color: '#627083', fontSize: 13.5, margin: '0 0 16px' }}>
        Nếu em thấy điểm bị trừ chưa đúng, hãy chọn mục đó và nêu rõ lý do. Bạn nào trong lớp cũng gửi được, kể cả khi mục đó là của bạn khác.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {Object.entries(KINDS).map(([k, c]) => (
          <button
            key={k}
            onClick={() => switchKind(k)}
            style={{
              border: '1.5px solid ' + (kind === k ? '#c4262e' : '#e2e7ee'),
              background: kind === k ? '#c4262e' : '#fff', color: kind === k ? '#fff' : '#627083',
              borderRadius: 999, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {c.tabLabel}
          </button>
        ))}
      </div>
      <p style={{ color: '#627083', fontSize: 12.5, margin: '-10px 0 16px' }}>
        {kind === 'class'
          ? 'Dùng khi cả lớp bị Sao đỏ hoặc cô Tổng phụ trách trừ điểm thi đua chung.'
          : 'Dùng khi một bạn bị lớp trưởng/tổ trưởng ghi nhận vi phạm riêng trong sổ theo dõi của lớp.'}
      </p>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13.5, fontWeight: 600,
          background: msg.type === 'ok' ? '#e6f6ee' : '#fdeceb', color: msg.type === 'ok' ? '#1a8a58' : '#b3261e',
        }}>
          {msg.text}
        </div>
      )}

      <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>{cfg.heading}</h2>
      {loading ? (
        <p style={{ color: '#627083', fontSize: 13.5 }}>Đang tải…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#627083', fontSize: 13.5 }}>{cfg.emptyList}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: '1.5px solid #e2e7ee', borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: 14.5 }}>{kind === 'class' ? it.reason_label : it.label}</strong>
                  {(kind === 'class' ? it.student_name : it.student_name) ? (
                    <span style={{ color: '#627083', fontSize: 12.5 }}> · {it.student_name}</span>
                  ) : null}
                  <div style={{ color: '#627083', fontSize: 12.5, marginTop: 2 }}>
                    {fmtDate(it.occurred_date)}{it.note ? ` · ${it.note}` : ''}
                    {kind === 'personal' && it.recorded_by_name ? ` · ghi nhận bởi ${it.recorded_by_name}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, color: '#c4262e' }}>{it.points} điểm</span>
                  {it.already_appealed ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#9a6708' }}>Đang chờ xử lý</span>
                  ) : (
                    <button
                      onClick={() => { setPicked(it); setReason(''); }}
                      style={{
                        border: '1.5px solid #c4262e', background: '#fff', color: '#c4262e', borderRadius: 999,
                        padding: '6px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      Khiếu nại
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Khiếu nại của em</h2>
      {history.length === 0 ? (
        <p style={{ color: '#627083', fontSize: 13.5 }}>Em chưa gửi khiếu nại nào ở mục này.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map((h) => (
            <div key={h.id} style={{ border: '1.5px solid #e2e7ee', borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14 }}>
                  {kind === 'class' ? h.reason_label : h.label} ({h.points} điểm) · {fmtDate(h.occurred_date)}
                </strong>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
                  color: STATUS_COLOR[h.status], background: STATUS_BG[h.status],
                }}>
                  {STATUS_LABEL[h.status]}
                </span>
              </div>
              {kind === 'personal' && h.student_name && (
                <div style={{ fontSize: 12.5, color: '#627083', marginTop: 2 }}>Học sinh: {h.student_name}</div>
              )}
              <div style={{ fontSize: 13, marginTop: 6 }}>
                <span style={{ color: '#627083' }}>Lý do em gửi: </span>{h.appeal_reason}
              </div>
              {(kind === 'class' ? h.tpt_reply : h.gvcn_reply) && (
                <div style={{ fontSize: 13, marginTop: 4, background: '#f9fafb', borderRadius: 8, padding: '6px 10px' }}>
                  <span style={{ color: '#627083' }}>Phản hồi: </span>{kind === 'class' ? h.tpt_reply : h.gvcn_reply}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {picked && (
        <div
          onClick={() => setPicked(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,40,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 300 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>Gửi khiếu nại</h3>
            <p style={{ color: '#627083', fontSize: 13, margin: '0 0 12px' }}>
              {kind === 'class' ? picked.reason_label : picked.label} ({picked.points} điểm) · {fmtDate(picked.occurred_date)}
              {kind === 'personal' && picked.student_name ? ` · ${picked.student_name}` : ''}
            </p>
            <label htmlFor="reason" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Lý do khiếu nại</label>
            <textarea
              id="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
              placeholder="VD: Hôm đó em xin phép nghỉ có phép, không phải vắng không phép…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }}
            />
            <p style={{ fontSize: 12, color: '#627083', margin: '6px 0 0' }}>Gửi cho {cfg.who} xem xét.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => setPicked(null)} style={{ border: '1px solid #d5dbe4', background: '#fff', borderRadius: 10, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Huỷ
              </button>
              <button
                onClick={submit} disabled={busy}
                style={{ border: 'none', background: '#c4262e', color: '#fff', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Đang gửi…' : 'Gửi khiếu nại'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
