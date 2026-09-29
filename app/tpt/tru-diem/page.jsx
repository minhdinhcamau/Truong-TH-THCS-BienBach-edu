'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useRankingPing } from '@/lib/useRankingPing';
import { TPT_NAV } from '@/lib/nav';
import { addDays, fmtIso, mondayOf, timeVN, vnTodayIso } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

// Trang /tpt/tru-diem - thiet ke lai toan bo:
//   1) "Hôm nay"        - moi lop, Sao do da tru diem gi, tu cap nhat, xoa ngay tai day.
//   2) "Cả tuần"        - luoi lop x thu (2-6), nhin 1 lan biet lop nao ngay nao con thieu.
//   3) "Ghi nhận trực tiếp" - chon lop + ngay, chon loi theo NHOM (tu dong khop voi trang
//      "Nội dung vi phạm" - them/sua/an muc o do se hien/an ngay o day), chon dung hoc sinh
//      tu danh sach lop thay vi go tay ten, nhat ky ngay do co Sua/Xoa.

const WEEKDAY_LABEL = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6' };
const PRESET_GROUPS = ['Sĩ số', 'Vệ sinh', 'Nề nếp', 'Đạo đức, tác phong', 'Khác'];
const GROUP_ICON = { 'Sĩ số': '🧑‍🎓', 'Vệ sinh': '🧹', 'Nề nếp': '📋', 'Đạo đức, tác phong': '🎯', 'Khác': '🔹', 'Học tập (xếp loại giờ)': '📖' };
const TODAY_POLL_MS = 30000;

function cellTone(v) {
  if (v.violations > 0) return v.violations >= 3 ? 'bad' : 'warn';
  if (v.checked_in) return 'ok';
  return 'mute';
}

export default function TptDeductPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const today = vnTodayIso();

  // Hôm nay (toàn trường)
  const [todayRows, setTodayRows] = useState([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayOpen, setTodayOpen] = useState(true);

  // Cả tuần (lưới lớp x thứ)
  const thisMonday = mondayOf(today);
  const [weekStart, setWeekStart] = useState(thisMonday);
  const [matrix, setMatrix] = useState([]);
  const [weekLoading, setWeekLoading] = useState(true);
  const formRef = useRef(null);

  // Ghi nhận trực tiếp
  const [classes, setClasses] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(today);
  const [neGroup, setNeGroup] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [studentId, setStudentId] = useState('');
  const [note, setNote] = useState('');
  const [roster, setRoster] = useState([]);
  const [rows, setRows] = useState([]);
  const [score, setScore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);

  const loadToday = useCallback(async () => {
    const { data, error } = await supabase.rpc('tpt_today_overview');
    if (error) setMsg({ type: 'error', text: error.message });
    else setTodayRows(data || []);
    setTodayLoading(false);
  }, []);

  const loadWeek = useCallback(async (ws) => {
    setWeekLoading(true);
    const { data, error } = await supabase.rpc('tpt_week_matrix', { p_week_start: ws });
    setWeekLoading(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else setMatrix(data || []);
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const [c, r] = await Promise.all([
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('discipline_reason_types').select('*').eq('is_active', true).order('category').order('sort_order'),
      ]);
      setClasses(c.data || []);
      setReasons(r.data || []);
      await Promise.all([loadToday(), loadWeek(thisMonday)]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (ready) loadWeek(weekStart);
  }, [ready, weekStart, loadWeek]);

  // Tự cập nhật mục "Hôm nay" định kỳ + khi có thay đổi điểm ở nơi khác
  useEffect(() => {
    if (!ready) return undefined;
    const t = setInterval(loadToday, TODAY_POLL_MS);
    return () => clearInterval(t);
  }, [ready, loadToday]);
  useRankingPing(() => {
    if (!ready) return;
    loadToday();
    loadWeek(weekStart);
  });

  const loadClass = useCallback(async () => {
    if (!classId) {
      setRows([]);
      setScore(null);
      setRoster([]);
      return;
    }
    const [d, lb, ros] = await Promise.all([
      supabase.rpc('get_class_day', { p_class_id: classId, p_date: date }),
      supabase.rpc('get_class_leaderboard'),
      supabase.rpc('class_roster_for_saodo', { p_class_id: classId }),
    ]);
    if (d.error) setMsg({ type: 'error', text: d.error.message });
    else setRows(d.data || []);
    setScore((lb.data || []).find((x) => x.class_id === classId) || null);
    if (!ros.error) setRoster(ros.data || []);
  }, [classId, date]);

  useEffect(() => {
    if (ready) loadClass();
  }, [ready, loadClass]);

  const neNepReasons = useMemo(() => reasons.filter((r) => r.category === 'ne_nep'), [reasons]);
  const neNepGroups = useMemo(() => {
    const s = new Set();
    neNepReasons.forEach((r) => s.add(r.group_label || 'Nề nếp'));
    const extra = Array.from(s).filter((g) => !PRESET_GROUPS.includes(g)).sort((a, b) => a.localeCompare(b, 'vi'));
    return [...PRESET_GROUPS.filter((g) => s.has(g)), ...extra];
  }, [neNepReasons]);
  const activeGroup = neNepGroups.includes(neGroup) ? neGroup : neNepGroups[0] || '';
  const reasonsInGroup = useMemo(
    () => neNepReasons.filter((r) => (r.group_label || 'Nề nếp') === activeGroup),
    [neNepReasons, activeGroup]
  );
  const picked = reasons.find((r) => r.code === reasonCode);
  const className = classes.find((c) => c.id === classId)?.name;

  const byClass = useMemo(() => {
    const m = new Map();
    todayRows.forEach((r) => {
      if (!m.has(r.class_id)) m.set(r.class_id, { class_name: r.class_name, items: [], lost: 0 });
      const g = m.get(r.class_id);
      g.items.push(r);
      g.lost += Number(r.points) < 0 ? -Number(r.points) : 0;
    });
    return Array.from(m.values()).sort((a, b) => b.lost - a.lost);
  }, [todayRows]);

  const weekByClass = useMemo(() => {
    const m = new Map();
    matrix.forEach((r) => {
      if (!m.has(r.class_id)) m.set(r.class_id, { class_name: r.class_name, days: {} });
      m.get(r.class_id).days[r.weekday] = r;
    });
    return Array.from(m.entries()).map(([id, v]) => ({ class_id: id, ...v })).sort((a, b) => a.class_name.localeCompare(b.class_name, 'vi', { numeric: true }));
  }, [matrix]);

  function jumpToCell(clsId, iso) {
    setClassId(clsId);
    setDate(iso);
    if (typeof formRef.current?.scrollIntoView === 'function') {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function submit() {
    if (!classId || !picked) {
      setMsg({ type: 'error', text: 'Hãy chọn lớp và mục cần trừ điểm.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('saodo_report_deduction', {
      p_class_id: classId,
      p_reason_code: picked.code,
      p_note: note.trim() || null,
      p_student_name: null,
      p_occurred_date: date,
      p_student_id: studentId || null,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: `Đã ghi nhận lớp ${className}: ${picked.label} (${picked.points} điểm).` });
    setReasonCode('');
    setStudentId('');
    setNote('');
    loadClass();
    loadToday();
    if (date >= weekStart && date < addDays(weekStart, 7)) loadWeek(weekStart);
  }

  async function removeRow(r) {
    if (!window.confirm(`Xoá "${r.reason_label}" (${r.points} điểm)?`)) return;
    const { error } = await supabase.rpc('saodo_delete_deduction', { p_id: r.id });
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: 'Đã xoá.' });
      loadClass();
      loadToday();
      loadWeek(weekStart);
    }
  }

  async function removeToday(r) {
    if (!window.confirm(`Xoá "${r.reason_label}" của lớp ${r.class_name} (${r.points} điểm)?`)) return;
    const { error } = await supabase.rpc('saodo_delete_deduction', { p_id: r.id });
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: 'Đã xoá.' });
      loadToday();
      loadWeek(weekStart);
      if (r.class_id === classId && date === today) loadClass();
    }
  }

  async function saveEdit() {
    setBusy(true);
    const { error } = await supabase.rpc('saodo_edit_deduction', {
      p_id: editing.id, p_reason_code: editing.reason_code,
      p_note: editing.note || null, p_student_name: null, p_student_id: editing.student_id || null,
    });
    setBusy(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setEditing(null);
      setMsg({ type: 'ok', text: 'Đã lưu thay đổi.' });
      loadClass();
      loadToday();
    }
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/tru-diem" onLogout={logout}>
      <style jsx>{`
        .today-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
        .today-card { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; background: #fff; }
        .today-card h4 { margin: 0 0 8px; font-size: 14.5px; display: flex; justify-content: space-between; align-items: center; }
        .ti { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f3f5f8; font-size: 12.5px; }
        .ti:last-child { border-bottom: none; }
        .ti-x { color: var(--muted); background: none; border: none; cursor: pointer; font-size: 14px; padding: 0 4px; }
        .ti-x:hover { color: var(--bad); }
        .mx-wrap { overflow-x: auto; }
        .mx { border-collapse: collapse; width: 100%; font-size: 12.5px; }
        .mx th { text-align: left; padding: 6px 8px; color: var(--muted); font-weight: 700; white-space: nowrap; }
        .mx td { padding: 4px; }
        .mx-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
          border-radius: 8px; padding: 7px 4px; min-width: 64px; cursor: pointer; border: 1.5px solid transparent; font-weight: 700; }
        .mx-cell:hover { border-color: var(--red); }
        .mx-cell.ok { background: var(--ok-bg); color: var(--ok); }
        .mx-cell.warn { background: var(--warn-bg); color: var(--warn); }
        .mx-cell.bad { background: var(--bad-bg); color: var(--bad); }
        .mx-cell.mute { background: #f3f5f8; color: #9aa5b3; }
        .mx-cell b { font-size: 14px; }
        .mx-cell small { font-size: 10px; font-weight: 600; }
        .grp-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .grp { border: 1.5px solid var(--line); background: #fff; border-radius: 999px; padding: 7px 13px; font-weight: 700;
          font-size: 12.5px; color: var(--muted); cursor: pointer; }
        .grp:hover { border-color: #d5dbe4; color: var(--ink); }
        .grp.on { background: var(--red); border-color: var(--red); color: #fff; }
      `}</style>

      <h1 className="pg-title">Trừ điểm lớp</h1>
      <p className="pg-sub">Theo dõi hoạt động trừ điểm của Sao đỏ toàn trường, xem cả tuần theo từng lớp, và tự ghi nhận hoặc chỉnh sửa khi cần.</p>

      {/* ---------------- HOM NAY ---------------- */}
      <div className="card">
        <div className="card-h">
          <h3>Hôm nay ({fmtIso(today)}) {byClass.length > 0 && <span className="chip" style={{ marginLeft: 8 }}>{todayRows.length} lượt · {byClass.reduce((s, c) => s + c.lost, 0)} điểm</span>}</h3>
          <button className="btn btn-sm" onClick={() => setTodayOpen((v) => !v)}>{todayOpen ? 'Thu gọn' : 'Mở rộng'}</button>
        </div>
        {todayOpen && (
          todayLoading ? (
            <div className="empty">Đang tải…</div>
          ) : byClass.length === 0 ? (
            <div className="empty">Hôm nay chưa lớp nào bị trừ điểm.</div>
          ) : (
            <div className="today-grid">
              {byClass.map((g) => (
                <div className="today-card" key={g.class_name}>
                  <h4>
                    <span>{g.class_name}</span>
                    <span className="pill bad">-{g.lost} điểm</span>
                  </h4>
                  {g.items.map((it) => (
                    <div className="ti" key={it.id}>
                      <div>
                        <div>{it.reason_label}{it.student_name ? ` · ${it.student_name}` : ''}</div>
                        <div className="hint" style={{ margin: 0 }}>{timeVN(it.created_at)} · {it.reported_by_name || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <b style={{ color: 'var(--red)' }}>{it.points}</b>
                        <button className="ti-x" title="Xoá" onClick={() => removeToday(it)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ---------------- CA TUAN ---------------- */}
      <div className="card">
        <div className="card-h">
          <h3>Cả tuần theo lớp</h3>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹ Tuần trước</button>
            <button className="btn btn-sm" disabled={weekStart === thisMonday} onClick={() => setWeekStart(thisMonday)}>Tuần này</button>
            <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>Tuần sau ›</button>
          </div>
        </div>
        {weekLoading ? (
          <div className="empty">Đang tải…</div>
        ) : weekByClass.length === 0 ? (
          <div className="empty">Chưa có lớp nào trong hệ thống.</div>
        ) : (
          <div className="mx-wrap">
            <table className="mx">
              <thead>
                <tr>
                  <th>Lớp</th>
                  {[1, 2, 3, 4, 5].map((wd) => <th key={wd}>{WEEKDAY_LABEL[wd]}</th>)}
                </tr>
              </thead>
              <tbody>
                {weekByClass.map((row) => (
                  <tr key={row.class_id}>
                    <td style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{row.class_name}</td>
                    {[1, 2, 3, 4, 5].map((wd) => {
                      const v = row.days[wd];
                      if (!v) return <td key={wd}></td>;
                      const tone = cellTone(v);
                      return (
                        <td key={wd}>
                          <div className={`mx-cell ${tone}`} onClick={() => jumpToCell(row.class_id, v.the_date)} title={`${row.class_name} · ${WEEKDAY_LABEL[wd]}`}>
                            <b>{v.violations > 0 ? v.violations : (v.checked_in ? '✓' : '·')}</b>
                            <small>{v.violations > 0 ? `-${v.lost}đ` : (v.checked_in ? 'đã KT' : 'chưa KT')}</small>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ marginTop: 10 }}>
          <span className="pill ok" style={{ marginRight: 6 }}>xanh</span> đã kiểm tra, không lỗi ·
          <span className="pill warn" style={{ margin: '0 6px' }}>vàng</span> ít lỗi ·
          <span className="pill bad" style={{ margin: '0 6px' }}>đỏ</span> nhiều lỗi ·
          <span className="pill mute" style={{ marginLeft: 6 }}>xám</span> chưa kiểm tra. Bấm vào ô để ghi nhận/xem ngày đó.
        </p>
      </div>

      {/* ---------------- GHI NHAN TRUC TIEP ---------------- */}
      <div className="card" ref={formRef}>
        <div className="card-h"><h3>Ghi nhận trực tiếp</h3></div>
        <p className="hint" style={{ marginTop: -6 }}>Dùng khi cô tự phát hiện vi phạm hoặc cần bổ sung cho các ngày trước.</p>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div>
            <label className="lbl" htmlFor="t-cls" style={{ marginTop: 0 }}>Lớp</label>
            <select id="t-cls" className="input" style={{ width: 150 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="t-date" style={{ marginTop: 0 }}>Ngày xảy ra</label>
            <input id="t-date" type="date" className="input" style={{ width: 170 }} max={today} value={date}
              onChange={(e) => setDate(e.target.value || today)} />
          </div>
          {score && (
            <div className="chips">
              <span className="chip">Hạng tuần: <strong>{score.rank}</strong></span>
              <span className="chip">Tổng: <strong>{score.total_score}</strong></span>
              <span className="chip">NN {score.ne_nep_score} · HT {score.hoc_tap_score}</span>
            </div>
          )}
        </div>

        {classId && (
          <>
            <div className="lbl" style={{ marginTop: 16 }}>Chọn mục trừ điểm</div>
            <div className="grp-row" role="tablist" aria-label="Chọn nhóm nội dung">
              {neNepGroups.map((g) => (
                <button key={g} role="tab" aria-selected={activeGroup === g} className={`grp ${activeGroup === g ? 'on' : ''}`} onClick={() => setNeGroup(g)}>
                  {GROUP_ICON[g] || '📁'} {g}
                </button>
              ))}
            </div>
            <div className="rg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {reasonsInGroup.map((r) => (
                <button
                  key={r.code}
                  onClick={() => setReasonCode(r.code)}
                  aria-pressed={reasonCode === r.code}
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left', padding: '11px 13px', borderRadius: 12,
                    cursor: 'pointer', fontWeight: 600, fontSize: 13.5,
                    border: `1.5px solid ${reasonCode === r.code ? 'var(--red)' : 'var(--line)'}`,
                    background: reasonCode === r.code ? '#fdeceb' : '#fff', color: 'var(--ink)',
                  }}
                >
                  <span>{r.label}</span>
                  <span style={{ color: r.points < 0 ? 'var(--red)' : 'var(--ok)', fontWeight: 800, whiteSpace: 'nowrap' }}>{r.points} đ</span>
                </button>
              ))}
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <div className="grow">
                <label className="lbl" htmlFor="t-stu" style={{ marginTop: 0 }}>Học sinh (nếu là lỗi cá nhân)</label>
                <select id="t-stu" className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  <option value="">Cả lớp (không chọn học sinh)</option>
                  {roster.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name}</option>)}
                </select>
              </div>
              <div className="grow">
                <label className="lbl" htmlFor="t-note" style={{ marginTop: 0 }}>Ghi chú</label>
                <input id="t-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: quan sát lúc ra chơi…" />
              </div>
            </div>

            <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
              <span className="hint" style={{ margin: 0 }}>
                {picked ? <>Sẽ ghi <strong>{picked.points} điểm</strong> cho lớp <strong>{className || '…'}</strong> ngày {fmtIso(date)}.</> : 'Chưa chọn mục nào.'}
              </span>
              <button className="btn btn-red" disabled={busy || !classId || !picked} onClick={submit}>{busy ? 'Đang ghi…' : 'Ghi nhận trừ điểm'}</button>
            </div>
          </>
        )}
      </div>

      {classId && (
        <div className="card">
          <div className="card-h"><h3>Nhật ký lớp {className} — {fmtIso(date)}</h3></div>
          {rows.length === 0 ? (
            <div className="empty">Chưa có ghi nhận nào trong ngày này.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Giờ</th><th>Nội dung</th><th>Học sinh</th><th>Điểm</th><th>Người ghi</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="num">{timeVN(r.created_at)}</td>
                      <td>{r.reason_label}{r.note ? <div className="hint" style={{ margin: 0 }}>{r.note}</div> : null}</td>
                      <td>{r.student_name || '—'}</td>
                      <td className="num" style={{ fontWeight: 800, color: r.points < 0 ? 'var(--red)' : 'var(--ok)' }}>{r.points}</td>
                      <td>{r.reported_by_name || '—'}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {!r.period_rating_id && r.reason_code !== 'da_kiem_tra' && (
                          <button className="btn btn-sm" onClick={() => setEditing({ id: r.id, reason_code: r.reason_code, note: r.note || '', student_id: r.student_id || '' })}>Sửa</button>
                        )}{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => removeRow(r)}>Xoá</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal title="Sửa ghi nhận" onClose={() => setEditing(null)}>
          <label className="lbl" htmlFor="e-r" style={{ marginTop: 0 }}>Loại lỗi</label>
          <select id="e-r" className="input" value={editing.reason_code} onChange={(e) => setEditing({ ...editing, reason_code: e.target.value })}>
            {reasons.filter((r) => r.category !== 'hoc_tap' || r.code === editing.reason_code).map((r) => (
              <option key={r.code} value={r.code}>{r.label} ({r.points} đ)</option>
            ))}
          </select>
          <label className="lbl" htmlFor="e-s">Học sinh</label>
          <select id="e-s" className="input" value={editing.student_id} onChange={(e) => setEditing({ ...editing, student_id: e.target.value })}>
            <option value="">Cả lớp (không chọn học sinh)</option>
            {roster.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name}</option>)}
          </select>
          <label className="lbl" htmlFor="e-n">Ghi chú</label>
          <input id="e-n" className="input" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
          <div className="modal-f">
            <button className="btn" onClick={() => setEditing(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={busy} onClick={saveEdit}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
          </div>
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
