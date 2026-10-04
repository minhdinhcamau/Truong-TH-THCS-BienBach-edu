'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { vnTodayIso } from '@/lib/dates';
import AppShell, { Toast } from '@/components/AppShell';
import TkbShell from '@/components/TkbShell';
import ClassTimetable from '@/components/Timetable';
import SchoolTimetableExport from '@/components/SchoolTimetableExport';
import { loadBellTimes } from '@/lib/tkbClient';
import { preflight, applyFix } from '@/lib/tkbPreflight';
import { verifyResult } from '@/lib/tkbVerify';
import {
  DAY_LABEL, mergeCfg, newId, gradeOf, buildConfigFromRows, analyzeLoad, applySuggestion,
  fillFromCurriculum, autoAssign, syncTeachers, solve,
} from '@/lib/tkbSolver';

const TABS = [
  ['gv', '1. Giáo viên & số tiết'],
  ['pc', '2. Chương trình & phân công'],
  ['qt', '3. Quy tắc xếp'],
  ['kq', '4. Xếp & kết quả'],
];
const STATUS = {
  over: ['Vượt mức tối đa', 'warn'],
  above: ['Trên định mức', 'warn'],
  under: ['Thiếu so với định mức', 'warn'],
  ok: ['Đủ định mức', 'ok'],
};
const num = (v, d = 0) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v));
// Bỏ cụm "kiêm nhiệm" khỏi các câu gợi ý do bộ phân tích tạo ra
const plainText = (t) => String(t || '')
  .replace(/\s*hoặc kiêm nhiệm \(chủ nhiệm, bồi dưỡng, câu lạc bộ\)/g, '')
  .replace(/ dạy kiêm/g, ' nhận thêm');

export default function TkbPlanner({ nav, activeHref, roleLabel, backHref, school }) {
  const Shell = school ? TkbShell : AppShell;
  const { profile, ready, logout } = useGuard('tpt');
  const [msg, setMsg] = useState(null);
  const [cfg, setCfg] = useState(mergeCfg());
  const [tab, setTab] = useState('gv');
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [bells, setBells] = useState([]);
  const [classSel, setClassSel] = useState('');
  const [notes, setNotes] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [report, setReport] = useState(null);
  const [seed, setSeed] = useState(1);
  const [viewClass, setViewClass] = useState('');
  const [viewTeacher, setViewTeacher] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(vnTodayIso());
  const [saving, setSaving] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const aliveRef = useRef(true);

  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const [p, b] = await Promise.all([supabase.rpc('tkb_plan_get'), loadBellTimes()]);
      setBells(b);
      if (p.data && p.data.config && Object.keys(p.data.config).length) setCfg(mergeCfg(p.data.config));
      setLoaded(true);
    })();
  }, [ready]);

  const edit = (fn) => { setCfg((c) => syncTeachers(fn(c))); setDirty(true); };
  const analysis = useMemo(() => analyzeLoad(cfg), [cfg]);
  const pre = useMemo(() => preflight(cfg), [cfg]);
  const [notify, setNotify] = useState(true);
  const classes = useMemo(() => [...new Set([...cfg.assignments.map((a) => a.cls), ...cfg.locks.map((l) => l.cls)])].sort((a, b) => a.localeCompare(b, 'vi')), [cfg.assignments, cfg.locks]);
  useEffect(() => { if (classes.length && !classes.includes(classSel)) setClassSel(classes[0]); }, [classes, classSel]);
  const grades = useMemo(() => [...new Set(classes.map(gradeOf).filter(Boolean))].sort(), [classes]);
  const subjectList = useMemo(() => {
    const m = new Map();
    cfg.assignments.forEach((a) => { m.set(a.subject.toLowerCase().replace(/[\s.]+/g, ''), a.subject); });
    Object.values(cfg.curriculum).forEach((o) => Object.keys(o).forEach((s) => { const k = s.toLowerCase().replace(/[\s.]+/g, ''); if (!m.has(k)) m.set(k, s); }));
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [cfg.assignments, cfg.curriculum]);

  async function importCurrent() {
    if ((cfg.assignments.length || cfg.teachers.length) && !window.confirm('Nạp lại từ thời khóa biểu hiện hành sẽ thay phần phân công đang soạn (định mức và cài đặt giáo viên được giữ). Tiếp tục?')) return;
    const { data, error } = await supabase.rpc('tkb_current_rows');
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    if (!data || !data.length) { setMsg({ type: 'error', text: 'Chưa có thời khóa biểu nào để nạp. Hãy nhập file Excel ở trang Thời khóa biểu trước, hoặc tự thêm giáo viên và phân công.' }); return; }
    const next = syncTeachers(buildConfigFromRows(data, cfg));
    setCfg(next);
    setDirty(true);
    setResult(null);
    setReport(null);
    setMsg({ type: 'ok', text: `Đã nạp ${next.assignments.length} dòng phân công, ${next.teachers.length} giáo viên, ${next.locks.length} tiết cố định (Chào cờ, Sinh hoạt).` });
  }

  async function saveDraft() {
    const { error } = await supabase.rpc('tkb_plan_save', { p_config: cfg });
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setDirty(false);
    setMsg({ type: 'ok', text: 'Đã lưu bản soạn.' });
  }

  async function run(newSeed) {
    if (!cfg.assignments.length) { setMsg({ type: 'error', text: 'Chưa có phân công. Hãy nạp từ thời khóa biểu hiện hành hoặc thêm phân công ở bước 2.' }); return; }
    const s = newSeed ?? seed;
    setSeed(s);
    setRunning(true);
    setProgress(0);
    setResult(null);
    setReport(null);
    // Ngày nghỉ và công bằng chỉ dùng khi người soạn bật (mặc định tắt)
    const effCfg = cfg.options.useFairness ? cfg : { ...cfg, teachers: cfg.teachers.map((t) => ({ ...t, dayOff: typeof t.dayOff === 'number' ? t.dayOff : 'none' })), options: { ...cfg.options, wFair: 0, wCarpool: 0 } };
    const r = await solve(effCfg, { seed: s, onProgress: (p) => aliveRef.current && setProgress(p) });
    if (!aliveRef.current) return;
    setRunning(false);
    setResult(r);
    const rep = verifyResult(effCfg, r);
    setReport(rep);
    if (r.rows.length) {
      const cl = [...new Set(r.rows.map((x) => x.class_name))].sort((a, b) => a.localeCompare(b, 'vi'));
      setViewClass((c) => (cl.includes(c) ? c : cl[0]));
      setViewTeacher((t) => (r.stats.some((x) => x.name === t) ? t : r.stats[0]?.name || ''));
    }
    if (r.stopped) setMsg({ type: 'error', text: 'Đã dừng: có giáo viên không thể nghỉ trọn 1 ngày.' });
    else if (rep.errors.length) setMsg({ type: 'error', text: `Đã xếp theo thiết lập nhưng phân tích thấy ${rep.errors.length} lỗi. Xem khung “Phân tích kết quả xếp”.` });
    else if (rep.warnings.length) setMsg({ type: 'ok', text: `Đã xếp xong, không có lỗi. Có ${rep.warnings.length} điểm nên xem lại.` });
    else setMsg({ type: 'ok', text: 'Đã xếp xong, phân tích không thấy lỗi nào.' });
  }

  async function saveTimetable() {
    if (!result || !result.rows.length) return;
    if (!effectiveFrom) { setMsg({ type: 'error', text: 'Hãy chọn ngày bắt đầu áp dụng.' }); return; }
    const nErr = report ? report.errors.length : 0;
    if ((result.unplaced > 0 || nErr > 0) && !window.confirm(`Bảng này còn ${result.unplaced} tiết chưa xếp được và ${nErr} lỗi theo phân tích. Vẫn lưu thành thời khóa biểu?`)) return;
    if (!window.confirm(`Lưu thành thời khóa biểu áp dụng từ ${effectiveFrom}? Nếu đã có bản cùng ngày, bản đó sẽ bị thay thế.`)) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('tpt_import_timetable', { p_effective_from: effectiveFrom, p_rows: result.rows });
    setSaving(false);
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    let extra = '';
    if (notify) {
      const an = await supabase.rpc('tkb_announce_update', { p_effective_from: effectiveFrom, p_note: null });
      extra = an.error ? ` Chưa gửi được thông báo toàn trường: ${an.error.message}` : ` Đã gửi thông báo cho ${an.data} tài khoản.`;
    }
    setMsg({ type: 'ok', text: `Đã lưu ${data.inserted} tiết vào thời khóa biểu toàn trường.${extra}` });
  }

  const viewRows = useMemo(() => (result ? result.rows.filter((r) => r.class_name === viewClass).map(({ weekday, session, period, subject, teacher }) => ({ weekday, session, period, subject, teacher })) : []), [result, viewClass]);
  const teacherRows = useMemo(() => (result ? result.rows.filter((r) => r.teacher === viewTeacher).map(({ weekday, session, period, subject, class_name }) => ({ weekday, session, period, subject, class_name })) : []), [result, viewTeacher]);

  if (!ready || !loaded) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  const upd = (name, patch) => edit((c) => ({ ...c, teachers: c.teachers.map((t) => (t.name === name ? { ...t, ...patch } : t)) }));
  const lines = cfg.assignments.filter((a) => a.cls === classSel);
  const setLine = (id, patch) => edit((c) => ({ ...c, assignments: c.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const classLoad = lines.reduce((x, a) => x + Number(a.periods || 0), 0) + cfg.locks.filter((l) => l.cls === classSel).length;
  const nIssues = pre.errors.length;

  return (
    <Shell profile={profile} roleLabel={roleLabel} nav={nav} activeHref={activeHref} onLogout={logout}>
      <h1 className="pg-title">Soạn thời khóa biểu tự động</h1>
      <p className="pg-sub">
        Khai báo giáo viên dạy môn gì, số tiết, ngày nghỉ, rồi để hệ thống tự xếp. Đây là bộ xếp theo quy tắc tính toán (không phải trí tuệ nhân tạo ngôn ngữ) nên kết quả nhanh và giải thích được.
        Hệ thống luôn xếp đúng như thiết lập của bạn, sau đó phân tích bảng vừa xếp để chỉ ra lỗi. Kết quả chỉ vào thời khóa biểu thật khi bạn bấm “Lưu thành thời khóa biểu”. {backHref && !school && <Link href={backHref} style={{ color: 'var(--accent, #1d6fb8)' }}>← Về trang thời khóa biểu</Link>}
      </p>

      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={importCurrent}>Nạp từ thời khóa biểu hiện hành</button>
        <button className="btn btn-red" disabled={!dirty} onClick={saveDraft}>{dirty ? 'Lưu bản soạn' : 'Đã lưu bản soạn'}</button>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {TABS.map(([k, l]) => <button key={k} type="button" className={`btn btn-sm ${tab === k ? 'btn-red' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'gv' && (
        <>
          <div className="card">
            <div className="card-h"><h3>Tổng quan tải tiết</h3></div>
            <div className="chips">
              <span className="chip">{analysis.teachers.length} giáo viên</span>
              <span className="chip">{analysis.totalDemand} tiết/tuần cần dạy</span>
              <span className="chip">Định mức mặc định {cfg.defaultQuota} tiết, tối đa {cfg.defaultMax} tiết</span>
            </div>
            {analysis.teachers.length === 0 ? <div className="empty">Chưa có giáo viên. Bấm “Nạp từ thời khóa biểu hiện hành” hoặc thêm bên dưới.</div> : (
              <div className="tbl-wrap" style={{ marginTop: 10 }}>
                <table className="tbl">
                  <thead><tr><th>Giáo viên</th><th>Môn dạy được (cách nhau dấu phẩy)</th><th>Tiết/tuần</th><th>Định mức</th><th>Tối đa</th><th>Nghỉ 1 ngày</th><th>Tính công bằng</th><th>Tình trạng</th></tr></thead>
                  <tbody>
                    {analysis.teachers.map((t) => (
                      <tr key={t.name}>
                        <td><b>{t.name}</b></td>
                        <td><input className="input" style={{ minWidth: 190 }} defaultValue={t.subjects.join(', ')} key={`${t.name}-${t.subjects.join('|')}`} onBlur={(e) => upd(t.name, { subjects: e.target.value.split(/[,;]/).map((x) => x.trim()).filter(Boolean) })} aria-label={`Môn của ${t.name}`} /></td>
                        <td className="num"><b>{t.load}</b></td>
                        <td><input type="number" min="0" className="input" style={{ width: 70 }} value={cfg.teachers.find((x) => x.name === t.name)?.quota ?? ''} placeholder={String(cfg.defaultQuota)} onChange={(e) => upd(t.name, { quota: e.target.value === '' ? null : num(e.target.value) })} /></td>
                        <td><input type="number" min="0" className="input" style={{ width: 70 }} value={cfg.teachers.find((x) => x.name === t.name)?.max ?? ''} placeholder={String(cfg.defaultMax)} onChange={(e) => upd(t.name, { max: e.target.value === '' ? null : num(e.target.value) })} /></td>
                        <td>
                          <select className="input" style={{ width: 120 }} value={String(t.dayOff ?? 'auto')} onChange={(e) => upd(t.name, { dayOff: e.target.value === 'auto' || e.target.value === 'none' ? e.target.value : Number(e.target.value) })}>
                            <option value="auto">Tự xếp</option>
                            <option value="none">Không nghỉ</option>
                            {cfg.days.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={t.fair !== false} onChange={(e) => upd(t.name, { fair: e.target.checked })} aria-label="Tính công bằng" /></td>
                        <td><span className={`pill ${STATUS[t.status][1]}`}>{STATUS[t.status][0]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn btn-sm" onClick={() => { const n = window.prompt('Tên giáo viên mới (đúng như ghi trên thời khóa biểu):'); if (n && n.trim()) edit((c) => (c.teachers.some((t) => t.name.toLowerCase() === n.trim().toLowerCase()) ? c : { ...c, teachers: [...c.teachers, { name: n.trim(), subjects: [], quota: null, max: null, dayOff: 'auto', fair: true }] })); }}>＋ Thêm giáo viên</button>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Thiếu tiết, thừa tiết và gợi ý xử lý</h3></div>
            {analysis.suggestions.length === 0 ? <div className="empty">Tải tiết cân đối, chưa cần điều chỉnh.</div> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {analysis.suggestions.map((s, i) => (
                  <div key={i} className="row" style={{ alignItems: 'center' }}>
                    <span className={`pill ${s.type === 'move' ? 'ok' : 'warn'}`}>{s.type === 'move' ? 'Có thể áp dụng' : 'Cần quyết định'}</span>
                    <span className="grow">{plainText(s.text)}</span>
                    {s.type === 'move' && <button className="btn btn-sm" onClick={() => edit((c) => applySuggestion(c, s))}>Áp dụng</button>}
                  </div>
                ))}
              </div>
            )}
            <p className="hint" style={{ marginTop: 10 }}>Gợi ý chỉ chuyển tiết cho giáo viên đã khai báo dạy được môn đó và còn trong mức tối đa. Giáo viên thiếu tiết so với định mức được nhắc để bạn giao thêm tiết.</p>
          </div>

          <div className="card">
            <div className="card-h"><h3>Tiết theo môn</h3></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Môn</th><th>Số tiết/tuần</th><th>Chưa có giáo viên</th><th>Số GV dạy được</th><th>Còn nhận thêm được</th></tr></thead>
                <tbody>
                  {analysis.subjects.map((s) => (
                    <tr key={s.label}><td><b>{s.label}</b></td><td className="num">{s.demand}</td><td className="num">{s.none ? <b style={{ color: 'var(--warn)' }}>{s.none}</b> : 0}</td><td className="num">{s.teachers}</td><td className="num">{s.room}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'pc' && (
        <>
          <div className="card">
            <div className="card-h"><h3>Chương trình: số tiết mỗi tuần của từng môn theo khối</h3></div>
            {grades.length === 0 ? <div className="empty">Chưa có lớp nào. Hãy nạp từ thời khóa biểu hiện hành.</div> : (
              <>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>Môn</th>{grades.map((g) => <th key={g}>Khối {g}</th>)}</tr></thead>
                    <tbody>
                      {subjectList.map((s) => (
                        <tr key={s}>
                          <td><b>{s}</b></td>
                          {grades.map((g) => (
                            <td key={g}><input type="number" min="0" max="10" className="input" style={{ width: 70 }} value={cfg.curriculum[g]?.[s] ?? ''} onChange={(e) => edit((c) => { const cur = { ...(c.curriculum[g] || {}) }; if (e.target.value === '' || Number(e.target.value) <= 0) delete cur[s]; else cur[s] = Number(e.target.value); return { ...c, curriculum: { ...c.curriculum, [g]: cur } }; })} /></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <input className="input" style={{ width: 200 }} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Thêm môn mới" aria-label="Tên môn mới" />
                  <button className="btn btn-sm" onClick={() => { const s = newSubject.trim(); if (!s) return; edit((c) => { const cur = { ...c.curriculum }; grades.forEach((g) => { cur[g] = { ...(cur[g] || {}), [s]: cur[g]?.[s] ?? 1 }; }); return { ...c, curriculum: cur }; }); setNewSubject(''); }}>＋ Thêm môn</button>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn btn-red" onClick={() => { const r = fillFromCurriculum(cfg); edit(() => r.cfg); setNotes(r.notes); setMsg({ type: 'ok', text: r.added ? `Đã thêm ${r.added} dòng phân công còn thiếu theo chương trình (chưa có giáo viên).` : 'Phân công đã đủ theo chương trình.' }); }}>Cập nhật phân công theo chương trình</button>
                  <button className="btn" onClick={() => { const r = autoAssign(cfg); edit(() => r.cfg); setNotes(r.left.map((a) => `Chưa tìm được giáo viên cho ${a.periods} tiết ${a.subject} lớp ${a.cls}: không ai dạy được môn này còn trong mức tối đa. Xem gợi ý ở bước 1.`)); setMsg({ type: r.left.length ? 'error' : 'ok', text: `Đã tự chọn giáo viên cho ${r.done} dòng${r.left.length ? `, còn ${r.left.length} dòng chưa có người` : ''}.` }); }}>Tự chọn giáo viên cho tiết chưa có người dạy</button>
                </div>
                {notes.length > 0 && <div className="card" style={{ marginTop: 10, background: 'var(--warn-bg)', borderColor: '#f0d28a' }}>{notes.map((n, i) => <div key={i}>{n}</div>)}</div>}
              </>
            )}
          </div>

          <div className="card">
            <div className="card-h"><h3>Phân công theo lớp</h3></div>
            {classes.length === 0 ? <div className="empty">Chưa có lớp.</div> : (
              <>
                <div className="row" style={{ marginBottom: 10 }}>
                  <label className="lbl" htmlFor="pc-class" style={{ margin: 0 }}>Lớp</label>
                  <select id="pc-class" className="input" style={{ width: 120 }} value={classSel} onChange={(e) => setClassSel(e.target.value)}>{classes.map((c) => <option key={c}>{c}</option>)}</select>
                  <span className="hint" style={{ margin: 0 }}>Tổng {classLoad} tiết/tuần (đã gồm Chào cờ và Sinh hoạt cố định)</span>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>Môn</th><th>Giáo viên</th><th>Số tiết</th><th></th></tr></thead>
                    <tbody>
                      {lines.map((a) => (
                        <tr key={a.id}>
                          <td><input className="input" style={{ minWidth: 140 }} value={a.subject} onChange={(e) => setLine(a.id, { subject: e.target.value })} aria-label="Môn" /></td>
                          <td>
                            <select className="input" style={{ minWidth: 160 }} value={a.teacher || ''} onChange={(e) => setLine(a.id, { teacher: e.target.value })} aria-label="Giáo viên">
                              <option value="">— chưa có —</option>
                              {cfg.teachers.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                            </select>
                          </td>
                          <td><input type="number" min="1" max="10" className="input" style={{ width: 70 }} value={a.periods} onChange={(e) => setLine(a.id, { periods: num(e.target.value, 1) })} aria-label="Số tiết" /></td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => edit((c) => ({ ...c, assignments: c.assignments.filter((x) => x.id !== a.id) }))} aria-label="Xóa dòng">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => edit((c) => ({ ...c, assignments: [...c.assignments, { id: newId(), cls: classSel, subject: 'Môn mới', teacher: '', periods: 1 }] }))}>＋ Thêm dòng cho lớp {classSel}</button>
                <p className="hint" style={{ marginTop: 8 }}>Một môn có thể chia nhiều giáo viên (ví dụ KHTN: Lý, Hóa, Sinh). Tiết Chào cờ và Sinh hoạt lớp được giữ cố định như thời khóa biểu hiện hành ({cfg.locks.length} tiết).</p>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'qt' && (
        <>
          <div className="card">
            <div className="card-h"><h3>Khung giờ và định mức</h3></div>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div>
                <div className="lbl" style={{ marginTop: 0 }}>Các ngày học</div>
                <div className="chips">
                  {[2, 3, 4, 5, 6, 7].map((d) => (
                    <label key={d} className="chip" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={cfg.days.includes(d)} onChange={(e) => edit((c) => ({ ...c, days: e.target.checked ? [...c.days, d].sort() : c.days.filter((x) => x !== d) }))} /> {DAY_LABEL[d]}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="lbl" htmlFor="q-s" style={{ marginTop: 0 }}>Tiết buổi sáng</label><input id="q-s" type="number" min="1" max="6" className="input" style={{ width: 80 }} value={cfg.sang} onChange={(e) => edit((c) => ({ ...c, sang: num(e.target.value, 5) }))} /></div>
              <div><label className="lbl" htmlFor="q-c" style={{ marginTop: 0 }}>Tiết buổi chiều</label><input id="q-c" type="number" min="0" max="6" className="input" style={{ width: 80 }} value={cfg.chieu} onChange={(e) => edit((c) => ({ ...c, chieu: num(e.target.value, 4) }))} /></div>
              <div><label className="lbl" htmlFor="q-m" style={{ marginTop: 0 }}>Tối đa tiết/ngày/giáo viên</label><input id="q-m" type="number" min="1" max="9" className="input" style={{ width: 80 }} value={cfg.maxPerDay} onChange={(e) => edit((c) => ({ ...c, maxPerDay: num(e.target.value, 7) }))} /></div>
            </div>
            <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
              <div><label className="lbl" htmlFor="q-q" style={{ marginTop: 0 }}>Định mức mặc định (tiết/tuần)</label><input id="q-q" type="number" min="0" className="input" style={{ width: 90 }} value={cfg.defaultQuota} onChange={(e) => edit((c) => ({ ...c, defaultQuota: num(e.target.value, 19) }))} /></div>
              <div><label className="lbl" htmlFor="q-x" style={{ marginTop: 0 }}>Tối đa mặc định (tiết/tuần)</label><input id="q-x" type="number" min="0" className="input" style={{ width: 90 }} value={cfg.defaultMax} onChange={(e) => edit((c) => ({ ...c, defaultMax: num(e.target.value, 23) }))} /></div>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Số tiết buổi sáng và chiều nên khớp bảng “Giờ học các tiết” (hiện {bells.filter((b) => b.session === 'sang' && b.period > 0).length} tiết sáng, {bells.filter((b) => b.session === 'chieu' && b.period > 0).length} tiết chiều).</p>
          </div>

          <div className="card">
            <div className="card-h"><h3>Môn học buổi chiều</h3></div>
            <label className="chip" style={{ cursor: 'pointer', display: 'inline-flex', gap: 6 }}>
              <input type="checkbox" checked={cfg.morningOnly !== false} onChange={(e) => edit((c) => ({ ...c, morningOnly: e.target.checked }))} />
              Chỉ các môn dưới đây được học buổi chiều, mọi môn khác chỉ học buổi sáng
            </label>
            <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
              <div className="grow">
                <label className="lbl" htmlFor="q-pm" style={{ marginTop: 0 }}>Các môn học buổi chiều (cách nhau dấu phẩy)</label>
                <input id="q-pm" className="input" style={{ width: '100%', maxWidth: 520 }} key={(cfg.afternoonSubjects || []).join('|')} defaultValue={(cfg.afternoonSubjects || []).join(', ')} onBlur={(e) => edit((c) => ({ ...c, afternoonSubjects: e.target.value.split(/[,;]+/).map((x) => x.trim()).filter(Boolean) }))} />
              </div>
              <label className="chip" style={{ cursor: 'pointer', display: 'inline-flex', gap: 6 }}>
                <input type="checkbox" checked={cfg.afternoonStrict !== false} onChange={(e) => edit((c) => ({ ...c, afternoonStrict: e.target.checked }))} />
                Bắt buộc các môn này học buổi chiều
              </label>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Mặc định: Mỹ thuật, Âm nhạc, Thể dục, Giáo dục địa phương học buổi chiều; Toán, Văn, Anh, KHTN, Sử - Địa, GDCD, Công nghệ, Tin học, HĐTN... chỉ học buổi sáng. Hệ thống hiểu cả tên viết tắt (MT, Nhạc, GDTC, GDĐP).
              Nếu một lớp có quá nhiều tiết phải học buổi sáng so với số chỗ buổi sáng, phần phân tích sau khi xếp sẽ nói rõ lớp nào.
            </p>
          </div>

          <div className="card">
            <div className="card-h"><h3>Ngày nghỉ và công bằng</h3></div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input type="checkbox" checked={!!cfg.options.useFairness} onChange={(e) => edit((c) => ({ ...c, options: { ...c.options, useFairness: e.target.checked } }))} />
              <span><b>Dùng ngày nghỉ và công bằng giờ vào/ra</b> (chỉ bật khi trường thật sự cần; tắt thì giáo viên không bị xếp ngày nghỉ riêng, trừ thầy cô bạn chọn ngày nghỉ cụ thể)</span>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input type="checkbox" checked={!!cfg.options.requireExactQuota} onChange={(e) => edit((c) => ({ ...c, options: { ...c.options, requireExactQuota: e.target.checked } }))} />
              <span><b>Báo đỏ khi giáo viên lệch số tiết định mức</b> (chỉ nhắc, vẫn cho xếp)</span>
            </label>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div>
                <label className="lbl" htmlFor="q-no" style={{ marginTop: 0 }}>Nếu có giáo viên không thể nghỉ trọn 1 ngày</label>
                <select id="q-no" className="input" style={{ width: 260 }} value={cfg.options.onNoDayOff} onChange={(e) => edit((c) => ({ ...c, options: { ...c.options, onNoDayOff: e.target.value } }))}>
                  <option value="warn">Cảnh báo và vẫn xếp</option>
                  <option value="stop">Dừng, không xếp</option>
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="q-f" style={{ marginTop: 0 }}>Công bằng giờ vào / giờ ra</label>
                <select id="q-f" className="input" style={{ width: 200 }} value={cfg.options.wFair} onChange={(e) => edit((c) => ({ ...c, options: { ...c.options, wFair: Number(e.target.value) } }))}>
                  <option value={0}>Tắt</option><option value={6}>Vừa</option><option value={12}>Mạnh (khuyên dùng)</option><option value={24}>Rất mạnh</option>
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="q-e" style={{ marginTop: 0 }}>Độ kỹ khi xếp</label>
                <select id="q-e" className="input" style={{ width: 160 }} value={cfg.options.effort} onChange={(e) => edit((c) => ({ ...c, options: { ...c.options, effort: Number(e.target.value) } }))}>
                  <option value={0}>Nhanh</option><option value={1}>Vừa</option><option value={2}>Kỹ</option><option value={3}>Rất kỹ (chậm)</option>
                </select>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Ngày nghỉ được chia đều giữa các thứ, mỗi giáo viên nghỉ trọn 1 ngày nếu tải tiết cho phép. “Công bằng” là làm cho số buổi vào tiết 1, ra cuối buổi, vào muộn, ra sớm của các giáo viên xấp xỉ nhau, tránh người nào cũng dạy sớm về sớm còn người khác luôn vào muộn về muộn.
              Giáo viên không muốn tính (ví dụ dạy thỉnh giảng) bỏ tick ở cột “Tính công bằng” bước 1.
            </p>
          </div>

          <div className="card">
            <div className="card-h"><h3>Nhóm giáo viên dạy và ra về cùng nhau</h3></div>
            <p className="hint">Các giáo viên trong nhóm được xếp cùng ngày nghỉ và, ở những ngày cùng dạy, cùng giờ vào và giờ ra (xếp theo mức có thể, không bắt buộc cứng).</p>
            {cfg.carpool.map((g, gi) => (
              <div key={gi} className="card" style={{ marginTop: 8 }}>
                <div className="row" style={{ alignItems: 'center' }}>
                  <input className="input" style={{ width: 220 }} value={g.name} onChange={(e) => edit((c) => ({ ...c, carpool: c.carpool.map((x, i) => (i === gi ? { ...x, name: e.target.value } : x)) }))} aria-label="Tên nhóm" />
                  <span className="hint" style={{ margin: 0 }}>{g.teachers.length} người</span>
                  <button className="btn btn-sm btn-danger" onClick={() => edit((c) => ({ ...c, carpool: c.carpool.filter((_, i) => i !== gi) }))}>Xóa nhóm</button>
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  {cfg.teachers.map((t) => (
                    <label key={t.name} className="chip" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={g.teachers.includes(t.name)} onChange={(e) => edit((c) => ({ ...c, carpool: c.carpool.map((x, i) => (i === gi ? { ...x, teachers: e.target.checked ? [...x.teachers, t.name] : x.teachers.filter((n) => n !== t.name) } : x)) }))} /> {t.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => edit((c) => ({ ...c, carpool: [...c.carpool, { name: `Nhóm ${c.carpool.length + 1}`, teachers: [] }] }))}>＋ Thêm nhóm đi cùng</button>
          </div>
        </>
      )}

      {tab === 'kq' && (
        <>
          <div className="card" style={nIssues === 0 ? undefined : { borderColor: '#f0d28a', background: '#fffaf0' }}>
            <div className="card-h">
              <h3>Kiểm tra trước khi xếp</h3>
              <span className={`pill ${nIssues === 0 ? 'ok' : 'warn'}`}>{nIssues === 0 ? 'Không thấy vấn đề' : `${nIssues} vấn đề, vẫn cho xếp`}</span>
            </div>
            {nIssues > 0 && (
              <>
                <p className="hint" style={{ marginTop: 0 }}>Đây chỉ là cảnh báo, hệ thống không chặn. Bấm “Xếp tự động” sẽ xếp đúng như thiết lập hiện tại (dòng chưa có giáo viên thì bỏ qua), rồi phân tích kết quả để chỉ ra lỗi cụ thể.</p>
                <ul style={{ margin: '0 0 0 18px', color: '#8a5b0a' }}>{pre.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </>
            )}
            {pre.warnings.length > 0 && <ul style={{ margin: '8px 0 0 18px', color: 'var(--warn)' }}>{pre.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
            {pre.fixes.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong>Gợi ý bù tiết còn thiếu của giáo viên (Hoạt động trải nghiệm, Giáo dục địa phương)</strong>
                <p className="hint" style={{ margin: '2px 0 6px' }}>Chỉ là gợi ý, bạn bấm “Thêm” thì mới được thêm vào phân công.</p>
                {pre.fixes.slice(0, 12).map((f) => (
                  <div key={f.id} className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ flex: 1 }}>{f.text}</span>
                    <button className="btn btn-sm" onClick={() => edit((c) => applyFix(c, f))}>Thêm</button>
                  </div>
                ))}
                {pre.fixes.length > 12 && <p className="hint">Còn {pre.fixes.length - 12} gợi ý nữa, thêm bớt rồi gợi ý sẽ cập nhật.</p>}
              </div>
            )}
            {nIssues === 0 && pre.warnings.length === 0 && <p className="hint" style={{ margin: 0 }}>Mọi lớp đủ tiết theo chương trình, không trùng, không giáo viên nào vượt mức.</p>}
          </div>

          <div className="card">
            <div className="card-h"><h3>Xếp thời khóa biểu</h3></div>
            <div className="row" style={{ alignItems: 'center' }}>
              <button className="btn btn-red" disabled={running} onClick={() => run()}>{running ? `Đang xếp… ${Math.round(progress * 100)}%` : 'Xếp tự động'}</button>
              <button className="btn" disabled={running || !result} onClick={() => run(seed + 1)}>Xếp lại (phương án khác)</button>
              <span className="hint" style={{ margin: 0 }}>Phương án số {seed}. Xếp lại cho ra cách sắp xếp khác, bạn chọn cái ưng ý nhất.</span>
            </div>
            {running && <div style={{ height: 8, background: '#e6eef7', borderRadius: 6, marginTop: 10, overflow: 'hidden' }}><div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: '#4a90d9', transition: 'width .2s' }} /></div>}
          </div>

          {result && report && (
            <div className="card" style={report.errors.length ? { borderColor: '#e0a3a3', background: '#fff8f8' } : report.warnings.length ? { borderColor: '#f0d28a', background: '#fffaf0' } : { borderColor: '#9fd5b8', background: '#f4fbf7' }}>
              <div className="card-h">
                <h3>Phân tích kết quả xếp</h3>
                <span className={`pill ${report.errors.length ? 'bad' : report.warnings.length ? 'warn' : 'ok'}`}>
                  {report.errors.length ? `${report.errors.length} lỗi` : 'Không có lỗi'}{report.warnings.length ? ` · ${report.warnings.length} điểm nên xem` : ''}
                </span>
              </div>
              {report.infos.map((x, i) => <p key={i} className="hint" style={{ margin: '0 0 6px' }}>{x.text}</p>)}
              {report.errors.length > 0 && (
                <>
                  <strong style={{ color: '#a12a2a' }}>Lỗi (bảng xếp chưa đúng thiết lập)</strong>
                  <ul style={{ margin: '4px 0 10px 18px' }}>
                    {report.errors.map((e, i) => <li key={i} style={{ color: '#a12a2a' }}>{e.text}{e.advice && <span style={{ color: 'var(--muted)' }}> → {e.advice}</span>}</li>)}
                  </ul>
                </>
              )}
              {report.warnings.length > 0 && (
                <>
                  <strong style={{ color: 'var(--warn)' }}>Nên xem lại</strong>
                  <ul style={{ margin: '4px 0 0 18px' }}>
                    {report.warnings.map((w, i) => <li key={i} style={{ color: 'var(--warn)' }}>{w.text}{w.advice && <span style={{ color: 'var(--muted)' }}> → {w.advice}</span>}</li>)}
                  </ul>
                </>
              )}
              {report.errors.length === 0 && report.warnings.length === 0 && <p style={{ margin: 0, color: 'var(--ok)', fontWeight: 700 }}>Bảng đã xếp khớp với mọi thiết lập: không trùng lớp, không trùng giáo viên, đủ tiết, đúng buổi, không ai vượt mức.</p>}
            </div>
          )}

          {result && (
            <>
              {result.stats.length > 0 && (
                <div className="card">
                  <div className="card-h"><h3>Công bằng giữa các giáo viên</h3></div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead><tr><th>Giáo viên</th><th>Tiết</th><th>Ngày dạy</th><th>Ngày nghỉ</th><th>Vào tiết 1</th><th>Vào muộn (từ tiết 3)</th><th>Ra sớm (≤ tiết 3)</th><th>Ra cuối buổi/chiều</th><th>Tiết trống giữa buổi</th></tr></thead>
                      <tbody>
                        {result.stats.map((s) => (
                          <tr key={s.name}>
                            <td><b>{s.name}</b></td><td className="num">{s.periods}</td><td className="num">{s.days}</td>
                            <td>{s.offDays.length ? s.offDays.map((d) => DAY_LABEL[d]).join(', ') : <span className="pill warn">Không nghỉ</span>}</td>
                            <td className="num">{s.early}</td><td className="num">{s.late}</td><td className="num">{s.outEarly}</td><td className="num">{s.outLate}</td><td className="num">{s.gaps}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="hint" style={{ marginTop: 8 }}>Cột “Ngày nghỉ” cho thấy ngày nghỉ được chia đều. Các cột vào/ra càng gần nhau giữa các giáo viên thì càng công bằng.</p>
                </div>
              )}

              <div className="card">
                <div className="card-h"><h3>Xem thời khóa biểu vừa xếp</h3></div>
                <div className="row" style={{ marginBottom: 10 }}>
                  <label className="lbl" htmlFor="v-c" style={{ margin: 0 }}>Lớp</label>
                  <select id="v-c" className="input" style={{ width: 120 }} value={viewClass} onChange={(e) => setViewClass(e.target.value)}>{[...new Set(result.rows.map((r) => r.class_name))].sort((a, b) => a.localeCompare(b, 'vi')).map((c) => <option key={c}>{c}</option>)}</select>
                </div>
                <ClassTimetable rows={viewRows} className={viewClass} effectiveFrom={effectiveFrom} bells={bells} />
                <div className="row" style={{ margin: '16px 0 10px' }}>
                  <label className="lbl" htmlFor="v-t" style={{ margin: 0 }}>Giáo viên</label>
                  <select id="v-t" className="input" style={{ width: 200 }} value={viewTeacher} onChange={(e) => setViewTeacher(e.target.value)}>{result.stats.map((s) => <option key={s.name}>{s.name}</option>)}</select>
                </div>
                <ClassTimetable rows={teacherRows} className={viewTeacher} badge={viewTeacher} title="THỜI KHÓA BIỂU GIÁO VIÊN" effectiveFrom={effectiveFrom} bells={bells} />
              </div>

              <SchoolTimetableExport rows={result.rows} bells={bells} effectiveFrom={effectiveFrom} />

              <div className="card">
                <div className="card-h"><h3>Lưu thành thời khóa biểu toàn trường</h3></div>
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <div><label className="lbl" htmlFor="eff" style={{ marginTop: 0 }}>Áp dụng từ ngày</label><input id="eff" type="date" className="input" style={{ width: 170 }} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></div>
                  <button className="btn btn-red" disabled={saving} onClick={saveTimetable}>{saving ? 'Đang lưu…' : 'Lưu thành thời khóa biểu'}</button>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Thông báo cho toàn trường</label>
                </div>
                <p className="hint" style={{ marginTop: 8 }}>Học sinh và giáo viên thấy thời khóa biểu mới từ ngày áp dụng. Nếu admin đã thiết lập bản cùng ngày thì Tổng phụ trách phải chọn ngày khác (admin ghi đè Tổng phụ trách).</p>
              </div>
            </>
          )}
        </>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </Shell>
  );
}
