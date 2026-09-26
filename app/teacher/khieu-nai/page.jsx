'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

// Trang /teacher/khieu-nai - Giáo viên chủ nhiệm xem và xử lý khiếu nại của học sinh về các
// lần bị ghi nhận vi phạm trong lớp mình chủ nhiệm (mục Ban cán sự / Chủ nhiệm lớp ghi nhận).
// Trang tự kiểm tra đăng nhập, không phụ thuộc khung giao diện khác nên đặt ở URL riêng
// /teacher/khieu-nai — có thể gắn thêm đường link tới đây từ trang Chủ nhiệm lớp nếu cần.

const TABS = [
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Đã từ chối' },
];

const STATUS_STYLE = {
  pending: { bg: '#fff4dc', color: '#9a6708', label: 'Chờ xử lý' },
  approved: { bg: '#e6f6ee', color: '#1a8a58', label: 'Đã duyệt' },
  rejected: { bg: '#fdeceb', color: '#b3261e', label: 'Đã từ chối' },
};

function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function TeacherAppealsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('pending');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null); // { row, approve, reply }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login');
        return;
      }
      setReady(true);
    });
  }, [router]);

  const load = useCallback(async (status) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('gvcn_list_appeals', { p_status: status });
    setLoading(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else setList(data || []);
  }, []);

  useEffect(() => {
    if (ready) load(tab);
  }, [ready, tab, load]);

  async function confirmAction() {
    setBusy(true);
    const { error } = await supabase.rpc('gvcn_resolve_appeal', {
      p_id: acting.row.id, p_approve: acting.approve, p_reply: acting.reply.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: acting.approve ? 'Đã duyệt và khôi phục điểm cho học sinh.' : 'Đã từ chối, giữ nguyên điểm.' });
    setActing(null);
    load(tab);
  }

  if (!ready) return <p style={{ padding: 24 }}>Đang tải…</p>;

  return (
    <div style={{ padding: '20px 16px 60px', maxWidth: 760, margin: '0 auto' }}>
      <Link href="/teacher" style={{ fontSize: 14, color: '#2563eb', textDecoration: 'none' }}>← Quay lại trang giáo viên</Link>

      <h1 style={{ fontSize: 22, margin: '14px 0 4px' }}>Khiếu nại của học sinh</h1>
      <p style={{ color: '#627083', fontSize: 13.5, margin: '0 0 18px' }}>
        Học sinh trong lớp bạn chủ nhiệm gửi khiếu nại khi thấy một bạn bị ghi nhận vi phạm chưa đúng. Duyệt sẽ khôi phục điểm ngay.
      </p>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13.5, fontWeight: 600,
          background: msg.type === 'ok' ? '#e6f6ee' : '#fdeceb', color: msg.type === 'ok' ? '#1a8a58' : '#b3261e',
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: '1.5px solid ' + (tab === t.key ? '#c4262e' : '#e2e7ee'),
              background: tab === t.key ? '#c4262e' : '#fff', color: tab === t.key ? '#fff' : '#627083',
              borderRadius: 999, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#627083', fontSize: 13.5 }}>Đang tải…</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#627083', fontSize: 13.5 }}>
          {tab === 'pending' ? 'Không có khiếu nại nào đang chờ xử lý. 🎉' : 'Chưa có mục nào ở đây.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((r) => {
            const st = STATUS_STYLE[r.status];
            return (
              <div key={r.id} style={{ border: '1.5px solid #e2e7ee', borderRadius: 12, padding: '14px 16px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14.5 }}>Lớp {r.class_name}</strong>
                    <span style={{ fontSize: 12, color: '#627083' }}>{fmtDate(r.occurred_date)}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                    {!r.record_exists && r.status === 'pending' && (
                      <span style={{ fontSize: 11.5, color: '#627083' }}>(mục gốc đã bị gỡ)</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: '#627083' }}>Gửi lúc {new Date(r.created_at).toLocaleString('vi-VN')}</span>
                </div>

                <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
                  <div><span style={{ color: '#627083' }}>Học sinh bị ghi nhận: </span><strong>{r.student_name}</strong></div>
                  <div><span style={{ color: '#627083' }}>Lỗi bị ghi: </span>{r.label} · <b style={{ color: '#b3261e' }}>{r.points} điểm</b></div>
                  {r.note && <div><span style={{ color: '#627083' }}>Ghi chú lúc ghi nhận: </span>{r.note}</div>}
                  <div><span style={{ color: '#627083' }}>Người gửi khiếu nại: </span>{r.submitted_by_name || '—'}</div>
                  <div style={{ marginTop: 4, background: '#f9fafb', borderRadius: 8, padding: '6px 10px' }}>
                    <span style={{ color: '#627083' }}>Lý do khiếu nại: </span>{r.appeal_reason}
                  </div>
                  {r.gvcn_reply && (
                    <div style={{ marginTop: 4, background: '#f0f6ff', borderRadius: 8, padding: '6px 10px' }}>
                      <span style={{ color: '#627083' }}>Phản hồi đã gửi: </span>{r.gvcn_reply}
                    </div>
                  )}
                </div>

                {tab === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                    <button
                      onClick={() => setActing({ row: r, approve: false, reply: '' })}
                      style={{ border: '1px solid #f0c4c0', background: '#fff', color: '#b3261e', borderRadius: 9, padding: '7px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() => setActing({ row: r, approve: true, reply: '' })}
                      style={{ border: 'none', background: '#1a8a58', color: '#fff', borderRadius: 9, padding: '7px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
                    >
                      Duyệt · khôi phục điểm
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {acting && (
        <div onClick={() => setActing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,40,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 300 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>{acting.approve ? 'Duyệt khiếu nại' : 'Từ chối khiếu nại'}</h3>
            <p style={{ color: '#627083', fontSize: 13, margin: '0 0 10px' }}>
              {acting.row.student_name} · {acting.row.label} ({acting.row.points} điểm) · {fmtDate(acting.row.occurred_date)}
            </p>
            <p style={{ fontSize: 13.5, margin: '0 0 12px' }}>
              {acting.approve
                ? 'Điểm sẽ được khôi phục ngay (xoá mục ghi nhận này). Không thể hoàn tác sau khi duyệt.'
                : 'Điểm giữ nguyên. Nên ghi rõ lý do để học sinh hiểu.'}
            </p>
            <label htmlFor="reply" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Phản hồi cho học sinh (không bắt buộc)</label>
            <textarea
              id="reply" rows={3} value={acting.reply} maxLength={500}
              onChange={(e) => setActing({ ...acting, reply: e.target.value })}
              placeholder={acting.approve ? 'VD: Đã hỏi lại, đúng là bạn khác làm.' : 'VD: Cô đã xác minh, ghi nhận là đúng.'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => setActing(null)} style={{ border: '1px solid #d5dbe4', background: '#fff', borderRadius: 10, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Huỷ
              </button>
              <button
                onClick={confirmAction} disabled={busy}
                style={{
                  border: 'none', color: '#fff', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13,
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                  background: acting.approve ? '#1a8a58' : '#b3261e',
                }}
              >
                {busy ? 'Đang lưu…' : acting.approve ? 'Duyệt · khôi phục điểm' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
