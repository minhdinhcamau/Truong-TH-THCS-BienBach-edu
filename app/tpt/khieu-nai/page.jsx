'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import { fmtDate } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

// Trang /tpt/khieu-nai - Tổng phụ trách xem và xử lý khiếu nại của học sinh về các lần
// lớp bị trừ điểm. Duyệt = khôi phục điểm (xoá bản ghi trừ gốc); Từ chối = giữ nguyên điểm.

const TABS = [
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Đã từ chối' },
];

export default function TptAppealsPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const [tab, setTab] = useState('pending');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null); // { row, approve, reply }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async (status) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('tpt_list_appeals', { p_status: status });
    setLoading(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else setList(data || []);
  }, []);

  useEffect(() => {
    if (ready) load(tab);
  }, [ready, tab, load]);

  function openAction(row, approve) {
    setActing({ row, approve, reply: '' });
  }

  async function confirmAction() {
    setBusy(true);
    const { error } = await supabase.rpc('tpt_resolve_appeal', {
      p_id: acting.row.id, p_approve: acting.approve, p_reply: acting.reply.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: acting.approve ? 'Đã duyệt và khôi phục điểm.' : 'Đã từ chối, giữ nguyên điểm.' });
    setActing(null);
    load(tab);
  }

  function statusPill(s) {
    if (s === 'pending') return <span className="pill warn">Chờ xử lý</span>;
    if (s === 'approved') return <span className="pill ok">Đã duyệt</span>;
    return <span className="pill bad">Đã từ chối</span>;
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/khieu-nai" onLogout={logout}>
      <h1 className="pg-title">Khiếu nại của học sinh</h1>
      <p className="pg-sub">Học sinh gửi khiếu nại khi thấy lớp bị trừ điểm chưa đúng. Duyệt sẽ khôi phục điểm ngay cho lớp.</p>

      <div className="card">
        <div className="row" style={{ gap: 6 }}>
          {TABS.map((t) => (
            <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-red' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          {loading ? (
            <div className="empty">Đang tải…</div>
          ) : list.length === 0 ? (
            <div className="empty">{tab === 'pending' ? 'Không có khiếu nại nào đang chờ xử lý. 🎉' : 'Chưa có mục nào ở đây.'}</div>
          ) : (
            list.map((r) => (
              <div key={r.id} className="card" style={{ marginBottom: 10 }}>
                <div className="card-h" style={{ marginBottom: 6 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <strong>Lớp {r.class_name}</strong>
                    <span className="chip">{fmtDate(r.occurred_date)}</span>
                    {statusPill(r.status)}
                    {!r.deduction_exists && r.status === 'pending' && <span className="pill mute">Mục gốc đã bị gỡ</span>}
                  </div>
                  <span className="hint" style={{ margin: 0 }}>Gửi lúc {new Date(r.created_at).toLocaleString('vi-VN')}</span>
                </div>

                <div className="tbl-wrap">
                  <table className="tbl">
                    <tbody>
                      <tr>
                        <td style={{ width: 140, color: 'var(--muted)', fontWeight: 700 }}>Lỗi bị ghi</td>
                        <td>{r.reason_label} · <b style={{ color: 'var(--bad)' }}>{r.points} điểm</b>{r.student_name ? ` · ${r.student_name}` : ''}</td>
                      </tr>
                      {r.note && (
                        <tr>
                          <td style={{ color: 'var(--muted)', fontWeight: 700 }}>Ghi chú của Sao đỏ</td>
                          <td>{r.note}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ color: 'var(--muted)', fontWeight: 700 }}>Lý do khiếu nại</td>
                        <td>{r.appeal_reason}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--muted)', fontWeight: 700 }}>Người gửi</td>
                        <td>{r.submitted_by_name || '—'}</td>
                      </tr>
                      {r.tpt_reply && (
                        <tr>
                          <td style={{ color: 'var(--muted)', fontWeight: 700 }}>Phản hồi đã gửi</td>
                          <td>{r.tpt_reply}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {tab === 'pending' && (
                  <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                    <button className="btn btn-sm btn-danger" onClick={() => openAction(r, false)}>Từ chối</button>
                    <button className="btn btn-sm btn-ok" onClick={() => openAction(r, true)}>Duyệt · khôi phục điểm</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {acting && (
        <Modal title={acting.approve ? 'Duyệt khiếu nại' : 'Từ chối khiếu nại'} onClose={() => setActing(null)}>
          <p className="hint" style={{ margin: 0 }}>
            Lớp <strong>{acting.row.class_name}</strong> · {acting.row.reason_label} ({acting.row.points} điểm) · {fmtDate(acting.row.occurred_date)}
          </p>
          {acting.approve ? (
            <p style={{ fontSize: 13.5, margin: '10px 0' }}>Điểm sẽ được <strong>khôi phục ngay</strong> cho lớp (xoá bản ghi trừ điểm này). Không thể hoàn tác sau khi duyệt.</p>
          ) : (
            <p style={{ fontSize: 13.5, margin: '10px 0' }}>Điểm trừ <strong>giữ nguyên</strong>. Nên ghi rõ lý do để học sinh và Sao đỏ hiểu.</p>
          )}
          <label className="lbl" htmlFor="reply" style={{ marginTop: 0 }}>Phản hồi cho học sinh (không bắt buộc)</label>
          <textarea id="reply" className="input" rows={3} value={acting.reply}
            onChange={(e) => setActing({ ...acting, reply: e.target.value })}
            placeholder={acting.approve ? 'VD: Đã xác minh, Sao đỏ ghi nhầm lớp.' : 'VD: Sao đỏ đã ghi đúng theo quan sát thực tế.'} />
          <div className="modal-f">
            <button className="btn" onClick={() => setActing(null)}>Huỷ</button>
            <button className={`btn ${acting.approve ? 'btn-ok' : 'btn-danger'}`} disabled={busy} onClick={confirmAction}>
              {busy ? 'Đang lưu…' : acting.approve ? 'Duyệt · khôi phục điểm' : 'Xác nhận từ chối'}
            </button>
          </div>
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
