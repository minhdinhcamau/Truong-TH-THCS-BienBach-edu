'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useRankingPing } from '@/lib/useRankingPing';
import { SAODO_NAV } from '@/lib/nav';
import { defaultDateIso, fmtIso, getWeekdays, timeVN } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

const SESSION_LABEL = { sang: 'Buổi sáng', chieu: 'Buổi chiều' };

export default function SaoDoPage() {
  const { profile, ready, logout } = useGuard('saodo');
  const weekdays = useMemo(() => getWeekdays(), []);
  const [selectedDate, setSelectedDate] = useState(defaultDateIso);
  const [reasons, setReasons] = useState([]);
  const [dashboard, setDashboard] = useState([]); // các lớp được TPT phân công
  const [alerts, setAlerts] = useState([]);
  const [notices, setNotices] = useState([]); // thông báo riêng của TPT cho Sao đỏ
  const [openId, setOpenId] = useState('');
  const [tab, setTab] = useState('tiet'); // tiet | nenep | nhatky
  const [periods, setPeriods] = useState([]);
  const [dayRows, setDayRows] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const [reporting, setReporting] = useState(null); // lỗi nề nếp đang xác nhận
  const [rStudent, setRStudent] = useState('');
  const [rNote, setRNote] = useState('');
  const [editing, setEditing] = useState(null);

  const selectedDay = weekdays.find((d) => d.iso === selectedDate) || weekdays[0];
  const dayText = `${selectedDay.label} (${selectedDay.shortLabel})`;
  const isBackfill = !selectedDay.isToday;
  const openClass = dashboard.find((c) => c.class_id === openId);

  const loadDashboard = useCallback(async (date) => {
    const { data, error } = await supabase.rpc('saodo_my_dashboard', { p_date: date });
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setDashboard(data || []);
    setOpenId((cur) => (cur && (data || []).some((c) => c.class_id === cur) ? cur : data?.[0]?.class_id || ''));
  }, []);

  const loadClassData = useCallback(async (classId, date) => {
    if (!classId) {
      setPeriods([]);
      setDayRows([]);
      return;
    }
    const [p, d] = await Promise.all([
      supabase.rpc('saodo_class_periods', { p_class_id: classId, p_date: date }),
      supabase.rpc('get_class_day', { p_class_id: classId, p_date: date }),
    ]);
    if (p.error) setMsg({ type: 'error', text: p.error.message });
    else setPeriods(p.data || []);
    if (d.error) setMsg({ type: 'error', text: d.error.message });
    else setDayRows(d.data || []);
  }, []);

  const loadAlerts = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_missing_checkins', { p_days_back: 10 });
    if (!error) setAlerts(data || []);
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data } = await supabase.from('discipline_reason_types').select('*').order('category').order('sort_order');
      setReasons(data || []);
      loadAlerts();
    })();
  }, [ready, loadAlerts]);

  useEffect(() => {
    if (!ready) return;
    supabase.from('announcements').select('id, title, body, created_at, pinned').eq('audience', 'saodo')
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setNotices(data || []));
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      await loadDashboard(selectedDate);
      setLoadingBoard(false);
    })();
  }, [ready, selectedDate, loadDashboard]);

  useEffect(() => {
    if (ready) loadClassData(openId, selectedDate);
  }, [ready, openId, selectedDate, loadClassData]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadDashboard(selectedDate), loadClassData(openId, selectedDate), loadAlerts()]);
  }, [loadDashboard, loadClassData, loadAlerts, selectedDate, openId]);

  useRankingPing(() => { if (ready) refreshAll(); });

  const neNepReasons = useMemo(() => reasons.filter((r) => r.category === 'ne_nep'), [reasons]);
  const editableReasons = useMemo(() => reasons.filter((r) => r.category !== 'hoc_tap'), [reasons]);
  const ptsOf = (letter) =>
    reasons.find((r) => r.category === 'hoc_tap' && String(r.label).toLowerCase().startsWith(`giờ ${letter.toLowerCase()}`))?.points;

  const myAlertGroups = useMemo(() => {
    const map = new Map();
    alerts.forEach((a) => {
      if (!dashboard.some((c) => c.class_id === a.class_id)) return;
      if (!map.has(a.class_id)) map.set(a.class_id, { class_id: a.class_id, class_name: a.class_name, dates: [] });
      map.get(a.class_id).dates.push(a.alert_date);
    });
    return Array.from(map.values());
  }, [alerts, dashboard]);

  const missingDates = useMemo(() => {
    const s = new Set();
    alerts.forEach((a) => { if (dashboard.some((c) => c.class_id === a.class_id)) s.add(a.alert_date); });
    return s;
  }, [alerts, dashboard]);

  const completedRow = dayRows.find((r) => r.reason_code === 'da_kiem_tra');
  const groupedPeriods = useMemo(() => {
    const g = { sang: [], chieu: [] };
    periods.forEach((p) => g[p.session]?.push(p));
    return g;
  }, [periods]);

  function jumpToAlert(classId, dateIso) {
    setOpenId(classId);
    if (weekdays.some((d) => d.iso === dateIso)) {
      setSelectedDate(dateIso);
    } else {
      setMsg({ type: 'error', text: `${fmtIso(dateIso)} đã quá tuần hiện tại — liên hệ cô Tổng phụ trách để xử lý.` });
    }
  }

  async function ratePeriod(p, letter) {
    if (p.rating === letter || !openId) return;
    const before = periods;
    setPeriods((cur) => cur.map((x) => (x.session === p.session && x.period === p.period ? { ...x, rating: letter } : x)));
    const { error } = await supabase.rpc('saodo_rate_period', {
      p_class_id: openId, p_date: selectedDate, p_session: p.session, p_period: p.period, p_rating: letter,
    });
    if (error) {
      setPeriods(before);
      setMsg({ type: 'error', text: error.message });
    } else {
      refreshAll();
    }
  }

  async function submitReport() {
    if (!reporting || !openId) return;
    setBusy(true);
    const { error } = await supabase.rpc('saodo_report_deduction', {
      p_class_id: openId,
      p_reason_code: reporting.code,
      p_note: rNote.trim() || null,
      p_student_name: rStudent.trim() || null,
      p_occurred_date: selectedDate,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: `Đã ghi nhận lớp ${openClass?.class_name}: ${reporting.label} (${reporting.points} điểm).` });
    setReporting(null);
    refreshAll();
  }

  async function complete() {
    if (!openId) return;
    setBusy(true);
    const { error } = await supabase.rpc('saodo_checkin', { p_class_id: openId, p_note: null, p_occurred_date: selectedDate });
    setBusy(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: `Đã hoàn tất kiểm tra lớp ${openClass?.class_name} — ${dayText}.` });
      refreshAll();
    }
  }

  async function deleteRow(r) {
    if (!window.confirm(`Xoá báo cáo "${r.reason_label}" (${r.points} điểm)?`)) return;
    const { error } = await supabase.rpc('saodo_delete_deduction', { p_id: r.id });
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: 'Đã xoá báo cáo.' });
      refreshAll();
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const { error } = await supabase.rpc('saodo_edit_deduction', {
      p_id: editing.id,
      p_reason_code: editing.reason_code,
      p_note: editing.note || null,
      p_student_name: editing.student_name || null,
    });
    setBusy(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setEditing(null);
      setMsg({ type: 'ok', text: 'Đã lưu thay đổi.' });
      refreshAll();
    }
  }

  function canEditRow(r) {
    if (r.period_rating_id) return false; // đổi ở bảng tiết học
    return profile?.role === 'admin' || r.reported_by === profile?.id;
  }

  function statusOf(c) {
    if (c.day_completed) return <span className="pill ok">Đã hoàn tất</span>;
    if (c.day_reports > 0) return <span className="pill warn">Đang kiểm tra · {c.day_reports} mục</span>;
    if (selectedDay.isToday) return <span className="pill mute">Chưa kiểm tra</span>;
    return <span className="pill bad">Chưa báo cáo</span>;
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Đội Sao đỏ" nav={SAODO_NAV} activeHref="/saodo" onLogout={logout}>
      <style jsx>{`
        .alert-box { background: #fdeceb; border: 2px solid var(--red); border-radius: 14px; padding: 14px 16px; margin-bottom: 16px; }
        .alert-title { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 16px; color: var(--red-d); }
        .alert-cls { margin-top: 8px; font-weight: 700; font-size: 13.5px; }
        .alert-chip { border: 1.5px solid var(--red); background: #fff; color: var(--red-d); border-radius: 999px; padding: 4px 12px;
          font-weight: 700; font-size: 12.5px; cursor: pointer; }
        .alert-chip:hover { background: #ffe3e0; }

        .days { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
        .day { border: 1.5px solid var(--line); background: #fff; border-radius: 12px; padding: 8px 4px; cursor: pointer; text-align: center; line-height: 1.25; }
        .day b { display: block; font-size: 13px; }
        .day small { font-size: 11.5px; color: var(--muted); }
        .day.on { background: var(--red); border-color: var(--red); color: #fff; }
        .day.on small { color: #ffe1e2; }
        .day.miss:not(.on) { border-color: var(--red); background: #fff5f4; }
        .day:disabled { opacity: 0.4; cursor: not-allowed; }
        .day-note { margin-top: 10px; font-size: 13px; font-weight: 600; color: var(--muted); }
        .day-note.back { color: var(--warn); background: var(--warn-bg); border-radius: 10px; padding: 8px 12px; }

        .cls-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
        .cls { text-align: left; border: 1.5px solid var(--line); background: #fff; border-radius: 14px; padding: 12px 14px; cursor: pointer; }
        .cls.on { border-color: var(--red); box-shadow: inset 0 0 0 1px var(--red); }
        .cls-name { font-family: 'Baloo 2', sans-serif; font-size: 22px; font-weight: 700; line-height: 1.1; }
        .cls-meta { font-size: 12.5px; color: var(--muted); margin: 2px 0 8px; }

        .panel-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .panel-h h2 { font-size: 20px; }
        .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin: 14px 0; }
        .tab { border: none; background: none; padding: 9px 14px; font-weight: 700; font-size: 13.5px; color: var(--muted);
          cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px; }
        .tab.on { color: var(--red); border-bottom-color: var(--red); }

        .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); margin-bottom: 10px; }
        .sess { font-weight: 700; font-size: 13px; margin: 14px 0 6px; }
        .per { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; border-bottom: 1px solid #eef1f5; }
        .per-l { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .per-n { flex: none; width: 46px; text-align: center; background: #eceff4; border-radius: 8px; padding: 3px 0; font-size: 12px; font-weight: 700; color: var(--muted); }
        .per-s { font-weight: 600; font-size: 14px; }
        .per-t { font-size: 12px; color: var(--muted); }
        .seg { display: flex; flex: none; border: 1.5px solid #d5dbe4; border-radius: 10px; overflow: hidden; }
        .seg button { border: none; background: #fff; width: 42px; height: 38px; font-weight: 800; font-size: 14px; cursor: pointer; color: var(--muted); }
        .seg button + button { border-left: 1px solid #d5dbe4; }
        .seg button.a { background: var(--ok); color: #fff; }
        .seg button.b { background: #e0a020; color: #fff; }
        .seg button.c { background: var(--red); color: #fff; }

        .rg { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
        .rb { display: flex; justify-content: space-between; align-items: center; gap: 8px; text-align: left; padding: 12px 14px;
          border: 1.5px solid var(--line); background: #fff; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 13.5px; }
        .rb:hover { border-color: var(--red); background: #fff7f6; }
        .rb-p { color: var(--red); font-weight: 800; white-space: nowrap; }

        .log { display: flex; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid #eef1f5; }
        .log-t { font-weight: 700; font-size: 13.5px; }
        .log-m { font-size: 12px; color: var(--muted); }
        .log-p { font-weight: 800; }
        .log-p.neg { color: var(--red); }
        .log-p.zero { color: var(--ok); }
        .pts-big { font-family: 'Baloo 2', sans-serif; font-size: 30px; font-weight: 700; color: var(--red); text-align: center; margin: 4px 0 10px; }
      `}</style>

      <h1 className="pg-title">Kiểm tra lớp</h1>
      <p className="pg-sub">Các lớp bên dưới do cô Tổng phụ trách phân công cho bạn. Chọn ngày, chọn lớp rồi ghi nhận.</p>

      {notices.length > 0 && (
        <div className="card" style={{ borderColor: '#f0d28a', background: '#fffaf0' }}>
          <div className="card-h"><h3>📢 Thông báo dành cho Sao đỏ</h3></div>
          {notices.map((n) => (
            <div key={n.id} style={{ marginBottom: 12 }}>
              <strong>{n.title}</strong>{n.pinned ? ' 📌' : ''}
              <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0', fontSize: 13.5 }}>{n.body}</p>
              <div className="hint" style={{ margin: 0 }}>{new Date(n.created_at).toLocaleDateString('vi-VN')}</div>
            </div>
          ))}
        </div>
      )}

      {myAlertGroups.length > 0 && (
        <div className="alert-box" role="alert">
          <div className="alert-title">⚠ Có ngày bạn chưa hoàn tất kiểm tra</div>
          <div className="hint" style={{ margin: '2px 0 0' }}>Bấm vào ngày để mở đúng lớp và ngày đó, ghi nhận rồi bấm “Hoàn tất kiểm tra”.</div>
          {myAlertGroups.map((g) => (
            <div key={g.class_id}>
              <div className="alert-cls">Lớp {g.class_name}</div>
              <div className="chips" style={{ marginTop: 6 }}>
                {g.dates.map((dt) => (
                  <button key={dt} className="alert-chip" onClick={() => jumpToAlert(g.class_id, dt)}>{fmtIso(dt)}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-h"><h3>Ngày kiểm tra</h3></div>
        <div className="days">
          {weekdays.map((d) => (
            <button
              key={d.iso}
              disabled={d.isFuture}
              className={`day ${selectedDate === d.iso ? 'on' : ''} ${missingDates.has(d.iso) ? 'miss' : ''}`}
              onClick={() => setSelectedDate(d.iso)}
            >
              <b>{d.label}{d.isToday ? ' •' : ''}</b>
              <small>{d.shortLabel}{missingDates.has(d.iso) ? ' ⚠' : ''}</small>
            </button>
          ))}
        </div>
        {isBackfill
          ? <div className="day-note back">Đang ghi nhận BỔ SUNG cho {dayText} — không phải hôm nay.</div>
          : <div className="day-note">Hôm nay: {dayText}. Mọi ghi nhận được lưu vào ngày này.</div>}
      </div>

      <div className="card">
        <div className="card-h"><h3>Lớp cần kiểm tra</h3></div>
        {loadingBoard ? (
          <div className="empty">Đang tải…</div>
        ) : dashboard.length === 0 ? (
          <div className="empty">Bạn chưa được phân công lớp nào. Hãy báo cô Tổng phụ trách để được phân công.</div>
        ) : (
          <div className="cls-grid">
            {dashboard.map((c) => (
              <button key={c.class_id} className={`cls ${openId === c.class_id ? 'on' : ''}`} onClick={() => setOpenId(c.class_id)}>
                <div className="cls-name">{c.class_name}</div>
                <div className="cls-meta num">
                  {c.rank != null ? `Hạng ${c.rank}` : 'Chưa xếp hạng'}{c.total_score != null ? ` · ${c.total_score} điểm` : ''}
                </div>
                {statusOf(c)}
              </button>
            ))}
          </div>
        )}
      </div>

      {openClass && (
        <div className="card">
          <div className="panel-h">
            <div>
              <h2>Lớp {openClass.class_name}</h2>
              <div className="hint" style={{ margin: 0 }}>{dayText}</div>
            </div>
            {completedRow ? (
              <span className="pill ok">✓ Đã hoàn tất lúc {timeVN(completedRow.created_at)}</span>
            ) : (
              <button className="btn btn-ok" disabled={busy} onClick={complete}>✓ Hoàn tất kiểm tra</button>
            )}
          </div>
          {!completedRow && (
            <div className="hint" style={{ margin: '8px 0 0' }}>
              Ghi nhận xong (kể cả khi lớp không có vi phạm nào), hãy bấm “Hoàn tất kiểm tra” để không bị nhắc bỏ sót.
            </div>
          )}

          <div className="tabs" role="tablist">
            <button role="tab" className={`tab ${tab === 'tiet' ? 'on' : ''}`} onClick={() => setTab('tiet')}>Tiết học</button>
            <button role="tab" className={`tab ${tab === 'nenep' ? 'on' : ''}`} onClick={() => setTab('nenep')}>Nề nếp</button>
            <button role="tab" className={`tab ${tab === 'nhatky' ? 'on' : ''}`} onClick={() => setTab('nhatky')}>Nhật ký ({dayRows.filter((r) => r.category !== 'checkin').length})</button>
          </div>

          {tab === 'tiet' && (
            <div>
              <div className="legend">
                <span><b style={{ color: 'var(--ok)' }}>A</b> tốt · không trừ (mặc định)</span>
                <span><b style={{ color: '#c58410' }}>B</b> · {ptsOf('B') ?? '?'} điểm</span>
                <span><b style={{ color: 'var(--red)' }}>C</b> · {ptsOf('C') ?? '?'} điểm</span>
              </div>
              {periods.length === 0 ? (
                <div className="empty">
                  Chưa có thời khóa biểu cho ngày này. Hãy nhờ cô Tổng phụ trách nhập thời khóa biểu (mục “Thời khóa biểu”).
                </div>
              ) : (
                ['sang', 'chieu'].map((s) =>
                  groupedPeriods[s].length === 0 ? null : (
                    <div key={s}>
                      <div className="sess">{SESSION_LABEL[s]}</div>
                      {groupedPeriods[s].map((p) => (
                        <div className="per" key={`${p.session}-${p.period}`}>
                          <div className="per-l">
                            <span className="per-n">Tiết {p.period}</span>
                            <div>
                              <div className="per-s">{p.subject}</div>
                              {p.teacher ? <div className="per-t">{p.teacher}</div> : null}
                            </div>
                          </div>
                          {p.ratable ? (
                            <div className="seg" role="group" aria-label={`Xếp loại tiết ${p.period} ${p.subject}`}>
                              {['A', 'B', 'C'].map((l) => (
                                <button
                                  key={l}
                                  className={p.rating === l ? l.toLowerCase() : ''}
                                  aria-pressed={p.rating === l}
                                  onClick={() => ratePeriod(p, l)}
                                >
                                  {l}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="pill mute">Không xếp loại</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )
              )}
            </div>
          )}

          {tab === 'nenep' && (
            <div className="rg">
              {neNepReasons.map((r) => (
                <button
                  key={r.code}
                  className="rb"
                  disabled={busy}
                  onClick={() => { setReporting(r); setRStudent(''); setRNote(''); }}
                >
                  <span>{r.label}</span>
                  <span className="rb-p">{r.points} đ</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'nhatky' && (
            dayRows.length === 0 ? (
              <div className="empty">Chưa có ghi nhận nào trong ngày này.</div>
            ) : (
              <div>
                {dayRows.map((r) => (
                  <div className="log" key={r.id}>
                    <div>
                      <div className="log-t">{r.reason_label}</div>
                      <div className="log-m">
                        {timeVN(r.created_at)} · {r.reported_by_name || '—'}
                        {r.student_name ? ` · HS: ${r.student_name}` : ''}
                      </div>
                      {r.note ? <div className="log-m">{r.note}</div> : null}
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div className={`log-p num ${r.points < 0 ? 'neg' : 'zero'}`}>{r.points}</div>
                      {canEditRow(r) ? (
                        <div style={{ marginTop: 4 }}>
                          <button className="btn btn-sm" title="Sửa" onClick={() => setEditing({ id: r.id, reason_code: r.reason_code, note: r.note || '', student_name: r.student_name || '' })}>✎</button>{' '}
                          <button className="btn btn-sm btn-danger" title="Xoá" onClick={() => deleteRow(r)}>🗑</button>
                        </div>
                      ) : r.period_rating_id ? (
                        <div className="log-m">Đổi ở tab Tiết học</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {reporting && (
        <Modal title="Xác nhận ghi nhận" onClose={() => setReporting(null)}>
          <div className="hint" style={{ margin: 0 }}>Lớp {openClass?.class_name} · {isBackfill ? `bổ sung cho ${dayText}` : `hôm nay ${dayText}`}</div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>{reporting.label}</div>
          <div className="pts-big">{reporting.points} điểm</div>
          <label className="lbl" htmlFor="r-stu">Tên học sinh vi phạm (nếu là lỗi cá nhân)</label>
          <input id="r-stu" className="input" value={rStudent} onChange={(e) => setRStudent(e.target.value)} placeholder="Để trống nếu lỗi của cả lớp" />
          <label className="lbl" htmlFor="r-note">Ghi chú (không bắt buộc)</label>
          <input id="r-note" className="input" value={rNote} onChange={(e) => setRNote(e.target.value)} placeholder="VD: tiết mấy, hoàn cảnh cụ thể…" />
          <div className="modal-f">
            <button className="btn" onClick={() => setReporting(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={busy} onClick={submitReport}>{busy ? 'Đang gửi…' : 'Ghi nhận'}</button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title="Sửa ghi nhận" onClose={() => setEditing(null)}>
          <label className="lbl" htmlFor="e-r">Loại lỗi</label>
          <select id="e-r" className="input" value={editing.reason_code} onChange={(e) => setEditing({ ...editing, reason_code: e.target.value })}>
            {editableReasons.map((r) => <option key={r.code} value={r.code}>{r.label} ({r.points} đ)</option>)}
          </select>
          <label className="lbl" htmlFor="e-s">Tên học sinh</label>
          <input id="e-s" className="input" value={editing.student_name} onChange={(e) => setEditing({ ...editing, student_name: e.target.value })} />
          <label className="lbl" htmlFor="e-n">Ghi chú</label>
          <input id="e-n" className="input" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
          <div className="modal-f">
            <button className="btn" onClick={() => setEditing(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={busy} onClick={saveEdit}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
          </div>
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
