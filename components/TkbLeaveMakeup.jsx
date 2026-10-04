'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { addDays, fmtDate, vnTodayIso } from '@/lib/dates';
import AppShell, { Toast } from '@/components/AppShell';
import { loadBellTimes } from '@/lib/tkbClient';
import { DAY_NAME, SESS_NAME, findSlots, missedLessons, qualifiedTeachers, teacherNames, weekdayOf } from '@/lib/tkbMakeup';

const hhmm = (t) => String(t || '').slice(0, 5);

// Giáo viên xin nghỉ -> xếp dạy bù. Chỉ admin được ghi; Tổng phụ trách chỉ xem.
export default function TkbLeaveMakeup({ nav, activeHref, roleLabel, backHref }) {
  const { profile, ready, logout } = useGuard('tpt');
  const isAdmin = profile?.role === 'admin';
  const [msg, setMsg] = useState(null);
  const [ctx, setCtx] = useState({ rows: [], makeups: [], leaves: [] });
  const [bells, setBells] = useState([]);
  const [rule, setRule] = useState({ morningOnly: true, afternoonSubjects: [] });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form ghi nhận nghỉ
  const [lvTeacher, setLvTeacher] = useState('');
  const [lvDate, setLvDate] = useState(vnTodayIso());
  const [lvSession, setLvSession] = useState('');
  const [lvReason, setLvReason] = useState('');

  // Đang xếp bù cho tiết nào
  const [target, setTarget] = useState(null); // { kind, leaveId, classId, className, subject, orig }
  const [tTeacher, setTTeacher] = useState('');
  const [tSessions, setTSessions] = useState('both');
  const [tFrom, setTFrom] = useState(addDays(vnTodayIso(), 1));
  const [tDays, setTDays] = useState(14);
  const [tSat, setTSat] = useState(false);
  const [tNote, setTNote] = useState('');
  // Dạy bù không do nghỉ
  const [exClass, setExClass] = useState('');
  const [exSubject, setExSubject] = useState('');

  const reload = useCallback(async () => {
    const today = vnTodayIso();
    const [c, b, p] = await Promise.all([
      supabase.rpc('tkb_makeup_context', { p_from: addDays(today, -60), p_to: addDays(today, 120) }),
      loadBellTimes(),
      supabase.rpc('tkb_plan_get'),
    ]);
    if (c.error) { setMsg({ type: 'error', text: c.error.message }); setLoaded(true); return; }
    setCtx(c.data || { rows: [], makeups: [], leaves: [] });
    setBells(b);
    const cfg = p.data?.config;
    if (cfg) setRule({ morningOnly: cfg.morningOnly !== false, afternoonSubjects: cfg.afternoonSubjects || ['Mỹ thuật', 'Âm nhạc', 'Thể dục', 'Giáo dục địa phương'] });
    else setRule({ morningOnly: true, afternoonSubjects: ['Mỹ thuật', 'Âm nhạc', 'Thể dục', 'Giáo dục địa phương'] });
    setLoaded(true);
  }, []);
  useEffect(() => { if (ready) reload(); }, [ready, reload]);

  const names = useMemo(() => teacherNames(ctx.rows), [ctx.rows]);
  useEffect(() => { if (names.length && !names.includes(lvTeacher)) setLvTeacher(names[0]); }, [names, lvTeacher]);
  const classes = useMemo(() => {
    const m = new Map();
    ctx.rows.forEach((r) => m.set(r.class_id, r.class_name));
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [ctx.rows]);
  useEffect(() => { if (classes.length && !classes.some((c) => c.id === exClass)) setExClass(classes[0].id); }, [classes, exClass]);
  const classSubjects = useMemo(() => [...new Set(ctx.rows.filter((r) => r.class_id === exClass).map((r) => r.subject))].sort((a, b) => a.localeCompare(b, 'vi')), [ctx.rows, exClass]);
  useEffect(() => { if (classSubjects.length && !classSubjects.includes(exSubject)) setExSubject(classSubjects[0]); }, [classSubjects, exSubject]);

  const preview = useMemo(() => (lvTeacher && lvDate ? missedLessons(ctx.rows, lvTeacher, lvDate, lvSession || null) : []), [ctx.rows, lvTeacher, lvDate, lvSession]);

  async function createLeave() {
    setBusy(true);
    const { data, error } = await supabase.rpc('tkb_leave_create', { p_teacher: lvTeacher, p_date: lvDate, p_session: lvSession || null, p_reason: lvReason });
    setBusy(false);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setMsg({ type: 'ok', text: data.missed ? `Đã ghi nhận nghỉ. Có ${data.missed} tiết cần dạy bù ở bên dưới.` : 'Đã ghi nhận nghỉ (hôm đó giáo viên không có tiết học).' });
    setLvReason('');
    reload();
  }

  async function cancelLeave(id) {
    if (!window.confirm('Hủy ghi nhận nghỉ này?')) return;
    const { error } = await supabase.rpc('tkb_leave_cancel', { p_leave_id: id });
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setMsg({ type: 'ok', text: 'Đã hủy ghi nhận nghỉ.' });
    reload();
  }

  function pickLesson(leave, lesson) {
    setTarget({ kind: 'leave', leaveId: leave.id, classId: lesson.class_id, className: lesson.class_name, subject: lesson.subject, orig: leave.teacher_name, leaveDate: leave.leave_date });
    setTTeacher(leave.teacher_name);
    setTFrom(addDays(leave.leave_date > vnTodayIso() ? leave.leave_date : vnTodayIso(), 1));
    setTNote('');
  }
  function pickExtra() {
    const cls = classes.find((c) => c.id === exClass);
    if (!cls || !exSubject) return;
    const q = qualifiedTeachers(ctx.rows, exSubject);
    const own = ctx.rows.find((r) => r.class_id === exClass && r.subject === exSubject)?.teacher || q[0] || '';
    setTarget({ kind: 'extra', leaveId: null, classId: cls.id, className: cls.name, subject: exSubject, orig: own });
    setTTeacher(q.includes(own) ? own : q[0] || '');
    setTFrom(addDays(vnTodayIso(), 1));
    setTNote('');
  }

  const qualified = useMemo(() => (target ? qualifiedTeachers(ctx.rows, target.subject) : []), [ctx.rows, target]);
  const slots = useMemo(() => {
    if (!target || !tTeacher) return [];
    return findSlots({
      ctx, bells, classId: target.classId, subject: target.subject, teacher: tTeacher, fromIso: tFrom, days: Number(tDays) || 14,
      sessions: tSessions === 'both' ? ['sang', 'chieu'] : [tSessions], allowSat: tSat, rule,
    });
  }, [ctx, bells, target, tTeacher, tFrom, tDays, tSessions, tSat, rule]);

  async function save(slot) {
    const warn = slot.warn ? `\n\nLưu ý: ${slot.warn}` : '';
    if (!window.confirm(`Xếp dạy bù: lớp ${target.className}, môn ${target.subject}, ${DAY_NAME[slot.wd]} ${fmtDate(slot.iso)}, tiết ${slot.period} buổi ${SESS_NAME[slot.session]}, giáo viên ${tTeacher}.\n\nToàn trường sẽ nhận thông báo.${warn}`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('tkb_makeup_save', {
      p_leave_id: target.leaveId, p_kind: target.kind, p_class_id: target.classId, p_subject: target.subject, p_orig_teacher: target.orig,
      p_teacher: tTeacher, p_date: slot.iso, p_session: slot.session, p_period: slot.period, p_note: tNote,
    });
    setBusy(false);
    if (error) { setMsg({ type: 'error', text: error.message }); reload(); return; }
    setMsg({ type: 'ok', text: 'Đã xếp dạy bù và gửi thông báo toàn trường.' });
    setTarget(null);
    reload();
  }

  async function cancelMakeup(m) {
    if (!window.confirm(`Hủy lịch dạy bù lớp ${m.class_name} môn ${m.subject} ngày ${fmtDate(m.lesson_date)}? Toàn trường sẽ nhận thông báo hủy.`)) return;
    const { error } = await supabase.rpc('tkb_makeup_cancel', { p_id: m.id });
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setMsg({ type: 'ok', text: 'Đã hủy lịch dạy bù.' });
    reload();
  }

  // Với mỗi đợt nghỉ: các tiết bị lỡ, tiết nào đã có lịch bù
  const leaveCards = useMemo(() => ctx.leaves.map((l) => {
    const missed = missedLessons(ctx.rows, l.teacher_name, l.leave_date, l.session);
    const made = ctx.makeups.filter((m) => m.leave_id === l.id).map((m) => ({ ...m, used: false }));
    const items = missed.map((r) => {
      const hit = made.find((m) => !m.used && m.class_id === r.class_id && String(m.subject).toLowerCase() === String(r.subject).toLowerCase());
      if (hit) hit.used = true;
      return { ...r, makeup: hit || null };
    });
    return { ...l, items };
  }), [ctx]);

  if (!ready || !loaded) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel={roleLabel} nav={nav} activeHref={activeHref} onLogout={logout}>
      <h1 className="pg-title">Giáo viên nghỉ và dạy bù</h1>
      <p className="pg-sub">
        Ghi nhận giáo viên xin nghỉ, rồi xếp dạy bù vào buổi sáng hoặc chiều tùy bạn chọn. Chỉ giáo viên đã được phân công dạy đúng môn đó mới được xếp dạy bù. Hệ thống chỉ liệt kê chỗ thật sự trống (lớp trống, giáo viên rảnh); không có chỗ thì sẽ báo, không tự ý xếp. Mỗi lần xếp hoặc hủy, toàn trường nhận thông báo.{' '}
        {backHref && <Link href={backHref} style={{ color: 'var(--accent, #1d6fb8)' }}>← Về trang thời khóa biểu</Link>}
      </p>
      {!isAdmin && <div className="card" style={{ background: 'var(--warn-bg)', borderColor: '#f0d28a' }}>Bạn chỉ có quyền xem. Chỉ quản trị viên (admin) được ghi nhận nghỉ và xếp dạy bù.</div>}
      {ctx.rows.length === 0 && <div className="card" style={{ background: 'var(--warn-bg)', borderColor: '#f0d28a' }}>Chưa có thời khóa biểu hiện hành nên chưa thể xếp dạy bù. Hãy lưu thời khóa biểu trước.</div>}

      <div className="card">
        <div className="card-h"><h3>1. Ghi nhận giáo viên xin nghỉ</h3></div>
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
          <div><label className="lbl" htmlFor="lvt" style={{ marginTop: 0 }}>Giáo viên (theo tên trên thời khóa biểu)</label>
            <select id="lvt" className="input" style={{ width: 200 }} value={lvTeacher} onChange={(e) => setLvTeacher(e.target.value)}>{names.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <div><label className="lbl" htmlFor="lvd" style={{ marginTop: 0 }}>Ngày nghỉ</label>
            <input id="lvd" type="date" className="input" style={{ width: 160 }} value={lvDate} onChange={(e) => setLvDate(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="lvs" style={{ marginTop: 0 }}>Nghỉ</label>
            <select id="lvs" className="input" style={{ width: 130 }} value={lvSession} onChange={(e) => setLvSession(e.target.value)}><option value="">Cả ngày</option><option value="sang">Buổi sáng</option><option value="chieu">Buổi chiều</option></select></div>
          <div style={{ flex: 1, minWidth: 180 }}><label className="lbl" htmlFor="lvr" style={{ marginTop: 0 }}>Lý do</label>
            <input id="lvr" className="input" value={lvReason} onChange={(e) => setLvReason(e.target.value)} placeholder="Ví dụ: việc gia đình, họp huyện…" /></div>
          <button className="btn btn-red" disabled={!isAdmin || busy || !lvTeacher} onClick={createLeave}>Ghi nhận nghỉ</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {weekdayOf(lvDate) > 7 ? 'Ngày này là Chủ nhật.' : `${DAY_NAME[weekdayOf(lvDate)]}: ${preview.length ? `giáo viên có ${preview.length} tiết (${preview.map((r) => `${r.class_name} ${r.subject} tiết ${r.period} ${SESS_NAME[r.session]}`).join('; ')}).` : 'giáo viên không có tiết học.'}`}
        </p>
      </div>

      <div className="card">
        <div className="card-h"><h3>2. Các đợt nghỉ cần dạy bù</h3></div>
        {leaveCards.length === 0 ? <p className="hint">Chưa có đợt nghỉ nào.</p> : leaveCards.map((l) => (
          <div key={l.id} style={{ borderTop: '1px solid var(--line, #e3e8ef)', padding: '10px 0' }}>
            <div className="row" style={{ alignItems: 'center', gap: 8 }}>
              <b>{l.teacher_name}</b>
              <span>nghỉ {DAY_NAME[weekdayOf(l.leave_date)]} {fmtDate(l.leave_date)} ({l.session ? `buổi ${SESS_NAME[l.session]}` : 'cả ngày'})</span>
              {l.reason && <span className="hint" style={{ margin: 0 }}>· {l.reason}</span>}
              <span style={{ flex: 1 }} />
              {isAdmin && <button className="btn btn-sm" onClick={() => cancelLeave(l.id)}>Hủy ghi nhận</button>}
            </div>
            {l.items.length === 0 ? <p className="hint" style={{ margin: '6px 0 0' }}>Hôm đó giáo viên không có tiết học, không cần dạy bù.</p> : (
              <table className="tbl" style={{ marginTop: 6 }}>
                <thead><tr><th>Lớp</th><th>Môn</th><th>Tiết bị lỡ</th><th>Dạy bù</th><th /></tr></thead>
                <tbody>{l.items.map((r, i) => (
                  <tr key={i}>
                    <td>{r.class_name}</td><td>{r.subject}</td><td>Tiết {r.period} {SESS_NAME[r.session]}</td>
                    <td>{r.makeup ? <span className="pill ok">{DAY_NAME[weekdayOf(r.makeup.lesson_date)]} {fmtDate(r.makeup.lesson_date)}, tiết {r.makeup.period} {SESS_NAME[r.makeup.session]} · {r.makeup.teacher}</span> : <span className="pill warn">Chưa xếp bù</span>}</td>
                    <td>{!r.makeup && isAdmin && <button className="btn btn-sm btn-red" onClick={() => pickLesson(l, r)}>Xếp bù</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-h"><h3>3. Dạy bù hoặc dạy thêm không do nghỉ</h3></div>
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
          <div><label className="lbl" htmlFor="exc" style={{ marginTop: 0 }}>Lớp</label>
            <select id="exc" className="input" style={{ width: 120 }} value={exClass} onChange={(e) => setExClass(e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="lbl" htmlFor="exs" style={{ marginTop: 0 }}>Môn</label>
            <select id="exs" className="input" style={{ width: 180 }} value={exSubject} onChange={(e) => setExSubject(e.target.value)}>{classSubjects.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <button className="btn" disabled={!isAdmin || !exSubject} onClick={pickExtra}>Tìm chỗ trống</button>
        </div>
      </div>

      {target && (
        <div className="card" style={{ borderColor: 'var(--accent, #1d6fb8)' }}>
          <div className="card-h"><h3>Xếp dạy bù: lớp {target.className}, môn {target.subject}</h3><button className="btn btn-sm" onClick={() => setTarget(null)}>Đóng</button></div>
          <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
            <div><label className="lbl" htmlFor="tt" style={{ marginTop: 0 }}>Giáo viên dạy bù (đã từng dạy môn này)</label>
              <select id="tt" className="input" style={{ width: 200 }} value={tTeacher} onChange={(e) => setTTeacher(e.target.value)}>{qualified.map((n) => <option key={n} value={n}>{n}{n === target.orig ? ' (giáo viên gốc)' : ''}</option>)}</select></div>
            <div><label className="lbl" htmlFor="ts" style={{ marginTop: 0 }}>Buổi</label>
              <select id="ts" className="input" style={{ width: 130 }} value={tSessions} onChange={(e) => setTSessions(e.target.value)}><option value="both">Sáng hoặc chiều</option><option value="sang">Chỉ sáng</option><option value="chieu">Chỉ chiều</option></select></div>
            <div><label className="lbl" htmlFor="tf" style={{ marginTop: 0 }}>Tìm từ ngày</label>
              <input id="tf" type="date" className="input" style={{ width: 160 }} value={tFrom} onChange={(e) => setTFrom(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="td" style={{ marginTop: 0 }}>Trong (ngày)</label>
              <input id="td" type="number" min="1" max="60" className="input" style={{ width: 80 }} value={tDays} onChange={(e) => setTDays(e.target.value)} /></div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={tSat} onChange={(e) => setTSat(e.target.checked)} /> Cho phép thứ 7</label>
          </div>
          <div style={{ marginTop: 8 }}><label className="lbl" htmlFor="tn" style={{ marginTop: 0 }}>Ghi chú gửi kèm thông báo (không bắt buộc)</label>
            <input id="tn" className="input" value={tNote} onChange={(e) => setTNote(e.target.value)} placeholder="Ví dụ: học sinh mang theo vở" /></div>
          {slots.length === 0 ? (
            <div className="card" style={{ marginTop: 10, background: 'var(--warn-bg)', borderColor: '#f0d28a' }}>
              <b>Không có chỗ trống phù hợp.</b> Lớp {target.className} hoặc giáo viên {tTeacher} đã kín lịch trong khoảng này. Bạn hãy thử: đổi giáo viên dạy bù, chọn thêm buổi còn lại, tăng số ngày tìm, hoặc cho phép thứ 7. Hệ thống không tự ý xếp vào chỗ bị trùng.
            </div>
          ) : (
            <table className="tbl" style={{ marginTop: 10 }}>
              <thead><tr><th>Ngày</th><th>Buổi</th><th>Tiết</th><th>Giờ</th><th>Lưu ý</th><th /></tr></thead>
              <tbody>{slots.map((s) => (
                <tr key={`${s.iso}${s.session}${s.period}`}>
                  <td>{DAY_NAME[s.wd]} {fmtDate(s.iso)}</td><td>{SESS_NAME[s.session]}</td><td>{s.period}</td>
                  <td>{s.bell ? `${hhmm(s.bell.start_time)} – ${hhmm(s.bell.end_time)}` : ''}</td>
                  <td>{s.warn ? <span className="pill warn">{s.warn}</span> : <span className="pill ok">Phù hợp quy tắc</span>}</td>
                  <td><button className="btn btn-sm btn-red" disabled={busy || !isAdmin} onClick={() => save(s)}>Chọn chỗ này</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-h"><h3>Lịch dạy bù đã xếp</h3></div>
        {ctx.makeups.length === 0 ? <p className="hint">Chưa có lịch dạy bù nào.</p> : (
          <table className="tbl">
            <thead><tr><th>Ngày</th><th>Tiết</th><th>Lớp</th><th>Môn</th><th>Giáo viên</th><th>Loại</th><th /></tr></thead>
            <tbody>{ctx.makeups.map((m) => (
              <tr key={m.id}>
                <td>{DAY_NAME[weekdayOf(m.lesson_date)]} {fmtDate(m.lesson_date)}</td><td>Tiết {m.period} {SESS_NAME[m.session]}</td><td>{m.class_name}</td><td>{m.subject}</td>
                <td>{m.teacher}{m.orig_teacher && m.orig_teacher !== m.teacher ? ` (thay ${m.orig_teacher})` : ''}</td>
                <td>{m.kind === 'leave' ? 'Bù do nghỉ' : 'Dạy thêm'}</td>
                <td>{isAdmin && <button className="btn btn-sm" onClick={() => cancelMakeup(m)}>Hủy</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
