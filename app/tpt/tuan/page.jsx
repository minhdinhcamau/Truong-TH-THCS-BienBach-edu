'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import { addDays, fmtDate, mondayOf } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

// Trang /tpt/tuan - Lịch năm học: TPT chọn ngày bắt đầu tuần 1, hệ thống tự chia tuần 1..35
// và cho phép mở lại tuần cũ để Sao đỏ nhập bù.

export default function TptCalendarPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const [cal, setCal] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(null); // { week, note }
  const [busyWeek, setBusyWeek] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const [c, w] = await Promise.all([supabase.rpc('get_school_calendar'), supabase.rpc('get_school_weeks')]);
    if (c.error || w.error) {
      setMsg({ type: 'error', text: (c.error || w.error).message });
      setLoading(false);
      return;
    }
    const row = c.data?.[0] || null;
    setCal(row);
    setWeeks(w.data || []);
    if (row) {
      setForm({
        week1: row.week1_start, total: row.total_weeks, year: row.school_year,
        hk1: row.hk1_end_week, mid1: row.mid1_week, mid2: row.mid2_week,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const currentWeek = useMemo(() => weeks.find((w) => w.is_current), [weeks]);
  const previewStart = form?.week1 ? mondayOf(form.week1) : null;

  function milestone(no) {
    if (!cal) return null;
    if (no === cal.mid1_week) return 'Giữa HK1';
    if (no === cal.hk1_end_week) return 'Cuối HK1';
    if (no === cal.mid2_week) return 'Giữa HK2';
    if (no === cal.total_weeks) return 'Cuối HK2';
    return null;
  }

  async function saveCalendar() {
    if (!form.week1) {
      setMsg({ type: 'error', text: 'Hãy chọn ngày bắt đầu tuần 1.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('tpt_set_calendar', {
      p_week1_start: form.week1,
      p_total_weeks: Number(form.total),
      p_school_year: form.year,
      p_hk1_end_week: Number(form.hk1),
      p_mid1_week: Number(form.mid1),
      p_mid2_week: Number(form.mid2),
    });
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: 'Đã lưu lịch năm học. Các tuần được tự cập nhật.' });
    load();
  }

  async function confirmOpen() {
    const w = opening.week;
    setBusyWeek(w.week_no);
    const { data, error } = await supabase.rpc('tpt_set_week_open', {
      p_week_start: w.week_start, p_open: true, p_note: opening.note.trim() || null,
    });
    setBusyWeek(null);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setOpening(null);
    setMsg({ type: 'ok', text: `Đã mở tuần ${w.week_no}. Đã báo cho ${data} bạn Sao đỏ.` });
    load();
  }

  async function closeWeek(w) {
    if (!window.confirm(`Đóng tuần ${w.week_no}? Sao đỏ sẽ không nhập bù được nữa (dữ liệu đã nhập vẫn giữ nguyên).`)) return;
    setBusyWeek(w.week_no);
    const { error } = await supabase.rpc('tpt_set_week_open', { p_week_start: w.week_start, p_open: false });
    setBusyWeek(null);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: `Đã đóng tuần ${w.week_no}.` });
      load();
    }
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/tuan" onLogout={logout}>
      <h1 className="pg-title">Lịch năm học & tuần thi đua</h1>
      <p className="pg-sub">
        Chọn ngày bắt đầu tuần 1, hệ thống tự chia các tuần tiếp theo (mỗi tuần từ Thứ 2 đến Chủ nhật). Tuần đã qua có thể mở lại để Sao đỏ nhập bù.
      </p>

      {loading || !form ? (
        <div className="card"><div className="empty">Đang tải…</div></div>
      ) : (
        <>
          {cal && !cal.confirmed && (
            <div className="card" style={{ borderColor: '#f0d28a', background: '#fffaf0' }}>
              <strong style={{ color: 'var(--warn)' }}>Chưa xác nhận ngày bắt đầu tuần 1.</strong>{' '}
              Hệ thống đang dùng ngày gợi ý {fmtDate(cal.week1_start)}. Hãy chọn đúng ngày của trường rồi bấm “Lưu lịch”.
            </div>
          )}

          <div className="card">
            <div className="card-h">
              <h3>Cài đặt năm học</h3>
              <div className="chips">
                {currentWeek
                  ? <span className="chip">Hôm nay là <strong>tuần {currentWeek.week_no}</strong>/{cal.total_weeks}</span>
                  : <span className="chip">Hôm nay ngoài khoảng tuần 1–{cal?.total_weeks} của năm học</span>}
              </div>
            </div>

            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div>
                <label className="lbl" htmlFor="c-w1" style={{ marginTop: 0 }}>Tuần 1 bắt đầu từ ngày</label>
                <input id="c-w1" type="date" className="input" style={{ width: 170 }} value={form.week1}
                  onChange={(e) => setForm({ ...form, week1: e.target.value })} />
              </div>
              <div>
                <label className="lbl" htmlFor="c-tot" style={{ marginTop: 0 }}>Tổng số tuần</label>
                <input id="c-tot" type="number" min={1} max={52} className="input" style={{ width: 100 }} value={form.total}
                  onChange={(e) => setForm({ ...form, total: e.target.value })} />
              </div>
              <div>
                <label className="lbl" htmlFor="c-year" style={{ marginTop: 0 }}>Năm học</label>
                <input id="c-year" className="input" style={{ width: 140 }} value={form.year} placeholder="2026-2027"
                  onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
            </div>
            {previewStart && (
              <p className="hint" style={{ marginTop: 8 }}>
                Tuần 1 sẽ tính từ Thứ 2 <strong>{fmtDate(previewStart)}</strong> đến Chủ nhật {fmtDate(addDays(previewStart, 6))}
                {previewStart !== form.week1 ? ' (hệ thống tự lấy Thứ 2 của tuần bạn chọn).' : '.'}
              </p>
            )}

            <div className="lbl" style={{ marginTop: 14 }}>Mốc học kì (dùng cho phân tích giữa kì, cuối kì)</div>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div>
                <label className="lbl" htmlFor="c-m1" style={{ marginTop: 0 }}>Giữa HK1: hết tuần</label>
                <input id="c-m1" type="number" min={1} className="input" style={{ width: 100 }} value={form.mid1}
                  onChange={(e) => setForm({ ...form, mid1: e.target.value })} />
              </div>
              <div>
                <label className="lbl" htmlFor="c-h1" style={{ marginTop: 0 }}>Cuối HK1: hết tuần</label>
                <input id="c-h1" type="number" min={1} className="input" style={{ width: 100 }} value={form.hk1}
                  onChange={(e) => setForm({ ...form, hk1: e.target.value })} />
              </div>
              <div>
                <label className="lbl" htmlFor="c-m2" style={{ marginTop: 0 }}>Giữa HK2: hết tuần</label>
                <input id="c-m2" type="number" min={1} className="input" style={{ width: 100 }} value={form.mid2}
                  onChange={(e) => setForm({ ...form, mid2: e.target.value })} />
              </div>
              <button className="btn btn-red" disabled={saving} onClick={saveCalendar}>{saving ? 'Đang lưu…' : 'Lưu lịch'}</button>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Cuối HK2 là tuần cuối cùng của năm học. Mặc định: giữa HK1 tuần 9, cuối HK1 tuần 18, giữa HK2 tuần 27, cả năm 35 tuần.</p>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>Các tuần trong năm học ({weeks.length})</h3>
              <span className="hint" style={{ margin: 0 }}>Bấm “Mở nhập bù” để Sao đỏ nhập lại các mục còn thiếu của tuần cũ.</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Tuần</th><th>Thời gian</th><th>Học kì</th><th>Trạng thái</th><th>Sao đỏ nhập bù</th></tr>
                </thead>
                <tbody>
                  {weeks.map((w) => {
                    const ms = milestone(w.week_no);
                    return (
                      <tr key={w.week_no} style={w.is_current ? { background: '#fff8f7' } : undefined}>
                        <td className="num"><strong>{w.week_no}</strong></td>
                        <td>{fmtDate(w.week_start)} – {fmtDate(w.week_end)}</td>
                        <td>
                          {w.term === 'hk1' ? 'HK1' : 'HK2'}
                          {ms && <span className="chip" style={{ marginLeft: 8 }}>{ms}</span>}
                        </td>
                        <td>
                          {w.is_current ? <span className="pill ok">Tuần này</span>
                            : w.is_past ? <span className="pill mute">Đã qua</span>
                              : <span className="pill mute">Sắp tới</span>}
                        </td>
                        <td>
                          {w.is_past && !w.is_current ? (
                            w.is_open ? (
                              <span className="row" style={{ gap: 8 }}>
                                <span className="pill warn">Đang mở</span>
                                <button className="btn btn-sm" disabled={busyWeek === w.week_no} onClick={() => closeWeek(w)}>Đóng lại</button>
                              </span>
                            ) : (
                              <button className="btn btn-sm" disabled={busyWeek === w.week_no} onClick={() => setOpening({ week: w, note: '' })}>Mở nhập bù</button>
                            )
                          ) : <span style={{ color: '#c3cad4' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {opening && (
        <Modal title={`Mở tuần ${opening.week.week_no} cho Sao đỏ nhập bù`} onClose={() => setOpening(null)}>
          <p className="hint" style={{ margin: 0 }}>
            Tuần {fmtDate(opening.week.week_start)} – {fmtDate(opening.week.week_end)}. Tất cả bạn Sao đỏ sẽ nhận thông báo và nhập / sửa được báo cáo của tuần này cho đến khi bạn đóng lại.
          </p>
          <label className="lbl" htmlFor="o-note">Ghi chú gửi Sao đỏ (không bắt buộc)</label>
          <textarea id="o-note" className="input" rows={3} value={opening.note}
            onChange={(e) => setOpening({ ...opening, note: e.target.value })}
            placeholder="VD: Nhập bù các ngày nghỉ lễ còn thiếu, hạn nhập đến Chủ nhật…" />
          <div className="modal-f">
            <button className="btn" onClick={() => setOpening(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={busyWeek === opening.week.week_no} onClick={confirmOpen}>
              {busyWeek === opening.week.week_no ? 'Đang mở…' : 'Mở và báo Sao đỏ'}
            </button>
          </div>
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
