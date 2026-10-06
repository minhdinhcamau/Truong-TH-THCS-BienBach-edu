'use client';
import { useMemo, useState } from 'react';
import { subjKey, gradeOf, newId, DAY_LABEL, fillFromCurriculum, autoAssign } from '@/lib/tkbSolver';
import { STD_CURRICULUM, makeLocks, homeroomMap, DEFAULT_FIXED } from '@/lib/pcmImport';
import { Field } from './ui';

const nk = (s) => String(s || '').trim().toLowerCase();
const num = (v, d = 0) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v));
const isCoCo = (s) => /^(chaoco)/.test(String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z]+/g, ''));
const isSH = (s) => /^(sh|sinhhoat)/.test(String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z]+/g, ''));

function FixedCard({ cfg, edit, setMsg, classes }) {
  const first = (f) => cfg.locks.find((l) => f(l.subject));
  const cc = first(isCoCo);
  const sh = first(isSH);
  const [fx, setFx] = useState({
    chaoCo: cc ? { day: cc.day, session: cc.session, period: cc.period } : DEFAULT_FIXED.chaoCo,
    sinhHoat: sh ? { day: sh.day, session: sh.session, period: sh.period } : DEFAULT_FIXED.sinhHoat,
  });
  const hr = homeroomMap(cfg);
  const noHr = classes.filter((c) => !hr[c]);
  const set = (k, p) => setFx((f) => ({ ...f, [k]: { ...f[k], ...p } }));
  const block = (k, title) => (
    <div className="pl-grid2" style={{ alignItems: 'end', marginBottom: 8 }}>
      <Field label={title} id={`fx-${k}-d`}>
        <select id={`fx-${k}-d`} className="input" value={fx[k].day} onChange={(e) => set(k, { day: Number(e.target.value) })}>{cfg.days.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}</select>
      </Field>
      <div className="row">
        <select className="input" style={{ width: 110 }} value={fx[k].session} onChange={(e) => set(k, { session: e.target.value })} aria-label="Buổi"><option value="sang">Sáng</option><option value="chieu">Chiều</option></select>
        <select className="input" style={{ width: 100 }} value={fx[k].period} onChange={(e) => set(k, { period: Number(e.target.value) })} aria-label="Tiết">{[1, 2, 3, 4, 5, 6].map((p) => <option key={p} value={p}>Tiết {p}</option>)}</select>
      </div>
    </div>
  );
  return (
    <div className="card">
      <div className="card-h"><h3>Tiết cố định: Chào cờ và Sinh hoạt lớp</h3><span className="pill mute">{cfg.locks.length} tiết đang cố định</span></div>
      <p className="hint">Hai tiết này xếp trước, bộ xếp không dời. Sinh hoạt lớp do giáo viên chủ nhiệm (lấy từ cột kiêm nhiệm “CN …”).</p>
      {block('chaoCo', 'Chào cờ (cả trường)')}
      {block('sinhHoat', 'Sinh hoạt lớp')}
      <button type="button" className="btn btn-red" onClick={() => { edit((c) => ({ ...c, locks: makeLocks(c, fx) })); setMsg({ type: 'ok', text: `Đã tạo lại tiết cố định cho ${classes.length} lớp.` }); }}>Tạo lại tiết cố định cho mọi lớp</button>
      <div style={{ marginTop: 12 }}>
        <div className="lbl" style={{ marginTop: 0 }}>Giáo viên chủ nhiệm</div>
        <div className="chips">
          {classes.map((c) => <span key={c} className={`chip ${hr[c] ? '' : 'pl-nohr'}`} style={hr[c] ? undefined : { background: 'var(--warn-bg)', color: 'var(--warn)' }}>{c}: {hr[c] || 'chưa có'}</span>)}
        </div>
        {noHr.length > 0 && <p className="hint" style={{ marginTop: 8 }}>Lớp {noHr.join(', ')} chưa có chủ nhiệm. Mở giáo viên ở bước 1 và điền “Chủ nhiệm lớp”.</p>}
      </div>
    </div>
  );
}

export default function StepClasses({ cfg, edit, classes, grades, subjectList, analysis, classSel, setClassSel, notes, setNotes, setMsg, newSubject, setNewSubject }) {
  const subjects = useMemo(() => {
    const m = new Map();
    Object.values(cfg.curriculum).forEach((o) => Object.keys(o).forEach((s) => m.set(subjKey(s), s)));
    const std = Object.keys(STD_CURRICULUM);
    return [...m.values()].sort((a, b) => { const x = std.indexOf(a); const y = std.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || a.localeCompare(b, 'vi'); });
  }, [cfg.curriculum]);
  const haveOf = useMemo(() => {
    const m = new Map();
    cfg.assignments.forEach((a) => { const k = `${a.cls}|${subjKey(a.subject)}`; m.set(k, (m.get(k) || 0) + Number(a.periods || 0)); });
    return (cls, s) => m.get(`${cls}|${subjKey(s)}`) || 0;
  }, [cfg.assignments]);
  const cap = cfg.days.length * (Number(cfg.sang) + Number(cfg.chieu));
  const lines = cfg.assignments.filter((a) => a.cls === classSel);
  const classLoad = lines.reduce((x, a) => x + Number(a.periods || 0), 0) + cfg.locks.filter((l) => l.cls === classSel).length;
  const setLine = (id, p) => edit((c) => ({ ...c, assignments: c.assignments.map((a) => (a.id === id ? { ...a, ...p } : a)) }));
  const teacherNames = [...cfg.teachers].map((t) => t.name).sort((a, b) => a.localeCompare(b, 'vi'));
  const missing = cfg.assignments.filter((a) => !a.teacher && a.periods > 0).length;

  const pick = (cls) => { setClassSel(cls); setTimeout(() => document.getElementById('pl-class-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); };

  if (!classes.length) return <div className="pl-hero"><h2>Chưa có lớp nào</h2><p>Hãy nhập bảng phân công chuyên môn ở bước 1 để có danh sách lớp và phân công.</p></div>;

  return (
    <>
      <div className="card">
        <div className="card-h">
          <h3>Độ phủ chương trình theo lớp</h3>
          <span className="row">
            <button type="button" className="btn btn-sm" onClick={() => { const r = fillFromCurriculum(cfg); edit(() => r.cfg); setNotes(r.notes); setMsg({ type: 'ok', text: r.added ? `Đã thêm ${r.added} dòng còn thiếu theo chương trình (chưa có giáo viên).` : 'Phân công đã đủ theo chương trình.' }); }}>Thêm dòng còn thiếu theo chương trình</button>
            <button type="button" className="btn btn-sm btn-red" disabled={!missing} onClick={() => { const r = autoAssign(cfg); edit(() => r.cfg); setNotes(r.left.map((a) => `Chưa tìm được giáo viên cho ${a.periods} tiết ${a.subject} lớp ${a.cls}: không ai dạy được môn này còn trong mức tối đa.`)); setMsg({ type: r.left.length ? 'error' : 'ok', text: `Đã tự chọn giáo viên cho ${r.done} dòng${r.left.length ? `, còn ${r.left.length} dòng chưa có người` : ''}.` }); }}>Tự chọn giáo viên cho {missing} dòng chưa có người</button>
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="pl-matrix">
            <thead>
              <tr><th className="l">Lớp</th>{subjects.map((s) => <th key={s}>{s}</th>)}<th>Tổng/tuần</th></tr>
            </thead>
            <tbody>
              {classes.map((cls) => {
                const need = cfg.curriculum[gradeOf(cls)] || {};
                const total = lines.length >= 0 ? cfg.assignments.filter((a) => a.cls === cls).reduce((x, a) => x + Number(a.periods || 0), 0) + cfg.locks.filter((l) => l.cls === cls).length : 0;
                return (
                  <tr key={cls}>
                    <td className="l"><b>{cls}</b></td>
                    {subjects.map((s) => {
                      const nd = need[s];
                      const h = haveOf(cls, s);
                      const cl = nd === undefined ? (h ? 'high' : 'na') : h === nd ? 'ok' : h < nd ? 'low' : 'high';
                      return (
                        <td key={s}>
                          <button type="button" className={`pl-cell ${cl} ${classSel === cls ? 'sel' : ''}`} disabled={cl === 'na'} onClick={() => pick(cls)} title={`${cls} · ${s}: ${h}${nd === undefined ? '' : `/${nd}`} tiết`}>
                            {cl === 'na' ? '–' : h === nd ? h : `${h}/${nd ?? '?'}`}
                          </button>
                        </td>
                      );
                    })}
                    <td><span className={`pl-cell ${total > cap ? 'low' : ''}`} style={{ cursor: 'default' }}>{total}/{cap}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pl-legend">
          <span><i style={{ background: 'var(--ok-bg)' }} />Đủ theo chương trình</span>
          <span><i style={{ background: 'var(--bad-bg)' }} />Thiếu tiết (có/cần)</span>
          <span><i style={{ background: 'var(--warn-bg)' }} />Thừa tiết</span>
          <span>Bấm vào ô để sửa phân công của lớp đó ngay bên dưới.</span>
        </div>
        {notes.length > 0 && <div className="card" style={{ marginTop: 10, background: 'var(--warn-bg)', borderColor: '#f0d28a' }}>{notes.map((n, i) => <div key={i}>{n}</div>)}</div>}
      </div>

      <div className="card" id="pl-class-detail">
        <div className="card-h">
          <h3>Phân công lớp {classSel}</h3>
          <span className="pill mute">{classLoad}/{cap} chỗ trong tuần (gồm tiết cố định)</span>
        </div>
        <div className="chips" style={{ marginBottom: 12 }}>
          {classes.map((c) => <button key={c} type="button" className={`pl-chipbtn ${c === classSel ? 'on' : ''}`} onClick={() => setClassSel(c)}>{c}</button>)}
        </div>
        <div className="pl-scroll"><table className="pl-mini" style={{ minWidth: 560 }}>
          <thead><tr><th>Môn</th><th>Phần</th><th>Giáo viên</th><th>Số tiết</th><th /></tr></thead>
          <tbody>
            {lines.map((a) => (
              <tr key={a.id}>
                <td><input className="input" list="pl-subjects" style={{ minWidth: 130 }} value={a.subject} onChange={(e) => setLine(a.id, { subject: e.target.value })} aria-label="Môn" /></td>
                <td><input className="input" style={{ width: 90 }} value={a.part || ''} onChange={(e) => setLine(a.id, { part: e.target.value })} aria-label="Phần" /></td>
                <td>
                  <select className="input" style={{ minWidth: 190 }} value={a.teacher || ''} onChange={(e) => setLine(a.id, { teacher: e.target.value })} aria-label="Giáo viên">
                    <option value="">— chưa có —</option>
                    {teacherNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td><input type="number" min="1" max="10" className="input" style={{ width: 70 }} value={a.periods} onChange={(e) => setLine(a.id, { periods: num(e.target.value, 1) })} aria-label="Số tiết" /></td>
                <td><button type="button" className="btn btn-sm btn-danger" onClick={() => edit((c) => ({ ...c, assignments: c.assignments.filter((x) => x.id !== a.id) }))} aria-label="Xóa dòng">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <datalist id="pl-subjects">{subjectList.map((s) => <option key={s} value={s} />)}</datalist>
        <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => edit((c) => ({ ...c, assignments: [...c.assignments, { id: newId(), cls: classSel, subject: 'Môn mới', part: '', teacher: '', periods: 1 }] }))}>＋ Thêm dòng cho lớp {classSel}</button>
        <p className="hint" style={{ marginTop: 8 }}>Một môn có thể chia nhiều giáo viên (ví dụ KHTN: Lý, Hóa, Sinh). Ô “Phần” chỉ để ghi chú.</p>
      </div>

      <FixedCard cfg={cfg} edit={edit} setMsg={setMsg} classes={classes} />

      <details className="pl-details">
        <summary>Chương trình: số tiết mỗi tuần của từng môn theo khối</summary>
        <div className="pl-body">
          <div className="pl-scroll"><table className="pl-mini" style={{ minWidth: 420 }}>
            <thead><tr><th>Môn</th>{grades.map((g) => <th key={g}>Khối {g}</th>)}</tr></thead>
            <tbody>
              {subjectList.map((s) => (
                <tr key={s}>
                  <td><b>{s}</b></td>
                  {grades.map((g) => (
                    <td key={g}><input type="number" min="0" max="10" className="input" style={{ width: 70 }} value={cfg.curriculum[g]?.[s] ?? ''} onChange={(e) => edit((c) => { const cur = { ...(c.curriculum[g] || {}) }; if (e.target.value === '' || Number(e.target.value) <= 0) delete cur[s]; else cur[s] = Number(e.target.value); return { ...c, curriculum: { ...c.curriculum, [g]: cur } }; })} aria-label={`${s} khối ${g}`} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input" style={{ width: 200 }} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Thêm môn mới" aria-label="Tên môn mới" />
            <button type="button" className="btn btn-sm" onClick={() => { const s = newSubject.trim(); if (!s) return; edit((c) => { const cur = { ...c.curriculum }; grades.forEach((g) => { cur[g] = { ...(cur[g] || {}), [s]: cur[g]?.[s] ?? 1 }; }); return { ...c, curriculum: cur }; }); setNewSubject(''); }}>＋ Thêm môn</button>
          </div>
        </div>
      </details>

      <details className="pl-details">
        <summary>Tiết theo môn và số giáo viên đủ khả năng</summary>
        <div className="pl-body pl-scroll" style={{ margin: '0 16px 16px' }}>
          <table className="pl-mini" style={{ minWidth: 520 }}>
            <thead><tr><th>Môn</th><th>Số tiết/tuần</th><th>Chưa có giáo viên</th><th>Số GV dạy được</th><th>Còn nhận thêm được</th></tr></thead>
            <tbody>
              {analysis.subjects.map((s) => (
                <tr key={s.label}><td><b>{s.label}</b></td><td>{s.demand}</td><td>{s.none ? <b style={{ color: 'var(--warn)' }}>{s.none}</b> : 0}</td><td>{s.teachers}</td><td>{s.room}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
