'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useRankingPing } from '@/lib/useRankingPing';
import { TPT_NAV } from '@/lib/nav';
import { defaultDateIso, fmtIso, getWeekdays } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

export default function TptOverviewPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const weekdays = useMemo(() => getWeekdays(), []);
  const [date, setDate] = useState(defaultDateIso);
  const [classes, setClasses] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(null); // { class_id, class_name, alert_date }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadOverview = useCallback(async (d) => {
    const { data, error } = await supabase.rpc('tpt_class_overview', { p_date: d });
    if (error) setMsg({ type: 'error', text: error.message });
    else setClasses(data || []);
  }, []);

  const loadAlerts = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_missing_checkins', { p_days_back: 14 });
    if (!error) setAlerts(data || []);
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      await Promise.all([loadOverview(date), loadAlerts()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, date]);

  useRankingPing(() => {
    if (!ready) return;
    loadOverview(date);
    loadAlerts();
  });

  const selectedDay = weekdays.find((d) => d.iso === date) || weekdays[0];
  const done = classes.filter((c) => c.day_completed).length;
  const noSaodo = classes.filter((c) => !c.saodo_names);

  function statusOf(c) {
    if (c.day_completed) return <span className="pill ok">Đã hoàn tất</span>;
    if (c.day_reports > 0) return <span className="pill warn">Đang kiểm tra · {c.day_reports} mục</span>;
    if (selectedDay.isFuture) return <span className="pill mute">Chưa đến ngày</span>;
    if (selectedDay.isToday) return <span className="pill mute">Chưa kiểm tra</span>;
    return <span className="pill bad">Chưa báo cáo</span>;
  }

  async function dismiss() {
    if (!dismissing) return;
    setBusy(true);
    const { error } = await supabase.rpc('tpt_dismiss_missing_checkin', {
      p_class_id: dismissing.class_id,
      p_alert_date: dismissing.alert_date,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setDismissing(null);
    setNote('');
    setMsg({ type: 'ok', text: 'Đã xử lý cảnh báo.' });
    loadAlerts();
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt" onLogout={logout}>
      <h1 className="pg-title">Tổng quan kiểm tra lớp</h1>
      <p className="pg-sub">Theo dõi Sao đỏ đã kiểm tra lớp nào, lớp nào còn thiếu. Số liệu tự cập nhật khi Sao đỏ báo cáo.</p>

      {alerts.length > 0 && (
        <div className="card" style={{ borderColor: '#e9a8a4', background: '#fff6f5' }}>
          <div className="card-h">
            <h3 style={{ color: 'var(--bad)' }}>⚠ {alerts.length} lượt bỏ sót kiểm tra</h3>
            <span className="hint" style={{ margin: 0 }}>Bấm “Xử lý” để ẩn cảnh báo, có thể ghi chú lý do (nghỉ lễ, Sao đỏ ốm…).</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Ngày</th><th>Lớp</th><th>Sao đỏ phụ trách</th><th></th></tr>
              </thead>
              <tbody>
                {alerts.slice(0, 40).map((a) => (
                  <tr key={`${a.class_id}-${a.alert_date}`}>
                    <td><strong>{fmtIso(a.alert_date)}</strong></td>
                    <td>{a.class_name}</td>
                    <td>{a.saodo_names}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm" onClick={() => { setDismissing(a); setNote(''); }}>Xử lý</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {alerts.length > 40 && <div className="hint" style={{ marginTop: 8 }}>Đang hiện 40 lượt gần nhất.</div>}
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <h3>Tình hình ngày {selectedDay.label} ({selectedDay.shortLabel})</h3>
          <div className="row">
            {weekdays.map((d) => (
              <button
                key={d.iso}
                disabled={d.isFuture}
                className={`btn btn-sm ${date === d.iso ? 'btn-red' : ''}`}
                onClick={() => setDate(d.iso)}
              >
                {d.label}{d.isToday ? ' •' : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="chips" style={{ marginBottom: 12 }}>
          <span className="chip">Đã hoàn tất: <strong>{done}</strong>/{classes.length} lớp</span>
          {noSaodo.length > 0 && (
            <span className="chip" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
              {noSaodo.length} lớp chưa có Sao đỏ phụ trách
            </span>
          )}
        </div>

        {loading ? (
          <div className="empty">Đang tải…</div>
        ) : classes.length === 0 ? (
          <div className="empty">Chưa có lớp nào trong hệ thống.</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Lớp</th><th>Sao đỏ phụ trách</th><th>Trạng thái</th><th>Hạng tuần</th><th>Điểm tuần</th></tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.class_id}>
                    <td><strong>{c.class_name}</strong></td>
                    <td>{c.saodo_names || <span className="pill warn">Chưa phân công</span>}</td>
                    <td>{statusOf(c)}</td>
                    <td className="num">{c.rank != null ? `#${c.rank}` : '—'}</td>
                    <td className="num">{c.total_score != null ? c.total_score : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dismissing && (
        <Modal title="Xử lý cảnh báo" onClose={() => setDismissing(null)}>
          <p className="hint" style={{ margin: 0 }}>
            Lớp <strong>{dismissing.class_name}</strong> — {fmtIso(dismissing.alert_date)}
          </p>
          <label className="lbl" htmlFor="dismiss-note">Ghi chú (không bắt buộc)</label>
          <textarea
            id="dismiss-note"
            className="input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Ngày nghỉ lễ / Sao đỏ nghỉ ốm, đã nhắc nhở…"
          />
          <div className="modal-f">
            <button className="btn" onClick={() => setDismissing(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={busy} onClick={dismiss}>{busy ? 'Đang lưu…' : 'Ẩn cảnh báo'}</button>
          </div>
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
