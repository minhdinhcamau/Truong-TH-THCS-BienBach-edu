'use client';
import { useMemo, useRef, useState } from 'react';
import { teacherTotals, teachingText, parseQuick, recalcTeacher, renameTeacher } from '@/lib/pcmImport';
import { newId, DAY_LABEL } from '@/lib/tkbSolver';
import { Modal, Stat, Seg, Field } from './ui';

const nk = (s) => String(s || '').trim().toLowerCase();
const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const numOrNull = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const plainText = (t) => String(t || '').replace(/\s*hoặc kiêm nhiệm \(chủ nhiệm, bồi dưỡng, câu lạc bộ\)/g, '').replace(/ dạy kiêm/g, ' nhận thêm');
const NO_GROUP = 'Chưa xếp tổ';

function ChenhPill({ v }) {
  if (v === null || v === undefined) return <span className="pill mute">Chưa có chuẩn</span>;
  if (v === 0) return <span className="pill ok">Đủ chuẩn</span>;
  return v < 0 ? <span className="pill warn">Thiếu {-v}</span> : <span className="pill bad">Thừa {v}</span>;
}

export function TeacherEditor({ name, cfg, edit, classes, subjectNames, groups, onClose, onRename, setMsg }) {
  const t = cfg.teachers.find((x) => nk(x.name) === nk(name));
  const [nm, setNm] = useState(name);
  const [qa, setQa] = useState('');
  if (!t) return null;
  const tot = teacherTotals(cfg).find((x) => nk(x.t.name) === nk(name));
  const lines = cfg.assignments.filter((a) => nk(a.teacher) === nk(name));
  const patch = (p) => edit((c) => recalcTeacher({ ...c, teachers: c.teachers.map((x) => (nk(x.name) === nk(name) ? { ...x, ...p } : x)) }, name));
  const setLine = (id, p) => edit((c) => ({ ...c, assignments: c.assignments.map((a) => (a.id === id ? { ...a, ...p } : a)) }));
  const clsOptions = (cur) => [...new Set([...classes, cur].filter(Boolean))];

  const commitName = () => {
    const v = nm.trim();
    if (!v || v === t.name) { setNm(t.name); return; }
    if (cfg.teachers.some((x) => nk(x.name) === nk(v))) { setMsg({ type: 'error', text: 'Đã có giáo viên trùng tên này.' }); setNm(t.name); return; }
    edit((c) => renameTeacher(c, t.name, v));
    onRename(v);
  };
  const addQuick = () => {
    const r = parseQuick(qa, t.name, classes);
    if (!r.lines.length) { setMsg({ type: 'error', text: r.problems[0] || 'Chưa nhận ra dòng nào. Viết dạng: Toán 6A1, 6A3 (8t)' }); return; }
    edit((c) => ({ ...c, assignments: [...c.assignments, ...r.lines] }));
    setQa('');
    setMsg({ type: 'ok', text: `Đã thêm ${r.lines.length} dòng giảng dạy.${r.problems.length ? ` Lưu ý: ${r.problems.join(' ')}` : ''}` });
  };
  const remove = () => {
    if (!window.confirm(`Xóa giáo viên ${t.name}? Các dòng phân công của thầy/cô sẽ trở thành “chưa có giáo viên”.`)) return;
    const k = nk(name);
    edit((c) => ({
      ...c,
      teachers: c.teachers.filter((x) => nk(x.name) !== k),
      assignments: c.assignments.map((a) => (nk(a.teacher) === k ? { ...a, teacher: '' } : a)),
      locks: c.locks.map((l) => (nk(l.teacher) === k ? { ...l, teacher: '' } : l)),
      carpool: c.carpool.map((g) => ({ ...g, teachers: g.teachers.filter((n) => nk(n) !== k) })),
    }));
    onClose();
  };
  const other = t.other || [];
  const setOther = (i, p) => patch({ other: other.map((o, j) => (j === i ? { ...o, ...p } : o)) });
  const cl = tot.chenh === null ? '' : tot.chenh === 0 ? 'ok' : tot.chenh < 0 ? 'warn' : 'bad';

  return (
    <Modal
      title={t.name}
      sub={[t.chucVu, t.to, t.monDay && `Môn dạy: ${t.monDay}`].filter(Boolean).join(' · ')}
      onClose={onClose}
      footer={<><button type="button" className="btn btn-danger" onClick={remove}>Xóa giáo viên</button><button type="button" className="btn btn-red" onClick={onClose}>Xong</button></>}
    >
      <div className="pl-sum">
        <span>Đứng lớp {tot.scheduled}</span>
        {tot.other > 0 && <span>SHDC/khác {tot.other}</span>}
        <span>Chuyên đề {tot.chuyenDe}</span>
        <span>Kiêm nhiệm {tot.kiemNhiem}</span>
        <span>Tổng {tot.tong}</span>
        <span>Chuẩn {tot.chuan ?? '—'}</span>
        {tot.chenh !== null && <span className={cl}>{tot.chenh === 0 ? 'Đủ chuẩn' : tot.chenh < 0 ? `Thiếu ${-tot.chenh} tiết` : `Thừa ${tot.chenh} tiết`}</span>}
      </div>

      <div className="pl-sec">
        <h4>Thông tin</h4>
        <div className="pl-grid2">
          <Field label="Họ và tên" id="te-n"><input id="te-n" className="input" value={nm} onChange={(e) => setNm(e.target.value)} onBlur={commitName} /></Field>
          <Field label="Chức vụ" id="te-c"><input id="te-c" className="input" value={t.chucVu || ''} onChange={(e) => patch({ chucVu: e.target.value })} placeholder="GV, TTCM, TPCM, HT, PHT" /></Field>
          <Field label="Tổ chuyên môn" id="te-t">
            <input id="te-t" className="input" list="te-groups" value={t.to || ''} onChange={(e) => patch({ to: e.target.value })} />
            <datalist id="te-groups">{groups.filter((g) => g !== NO_GROUP).map((g) => <option key={g} value={g} />)}</datalist>
          </Field>
          <Field label="Môn dạy, HĐGD" id="te-m"><input id="te-m" className="input" value={t.monDay || ''} onChange={(e) => patch({ monDay: e.target.value })} /></Field>
          <Field label="Năm sinh" id="te-s"><input id="te-s" type="number" className="input" value={t.namSinh ?? ''} onChange={(e) => patch({ namSinh: numOrNull(e.target.value) })} /></Field>
          <Field label="Năm vào ngành" id="te-v"><input id="te-v" type="number" className="input" value={t.namVaoNganh ?? ''} onChange={(e) => patch({ namVaoNganh: numOrNull(e.target.value) })} /></Field>
          <Field label="Trình độ chuyên môn" id="te-d"><input id="te-d" className="input" value={t.trinhDo || ''} onChange={(e) => patch({ trinhDo: e.target.value })} /></Field>
          <Field label="Chủ nhiệm lớp (cách nhau dấu phẩy)" id="te-h">
            <input id="te-h" className="input" key={(t.homeroom || []).join(',')} defaultValue={(t.homeroom || []).join(', ')} onBlur={(e) => patch({ homeroom: e.target.value.split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean) })} placeholder="Ví dụ 6A1" />
          </Field>
        </div>
        <div className="pl-field" style={{ marginTop: 10 }}>
          <label htmlFor="te-g">Ghi chú</label>
          <input id="te-g" className="input" value={t.ghiChu || ''} onChange={(e) => patch({ ghiChu: e.target.value })} />
        </div>
      </div>

      <div className="pl-sec">
        <h4>Giảng dạy (xếp vào thời khóa biểu)</h4>
        {lines.length === 0 ? <div className="empty" style={{ padding: 8 }}>Chưa có dòng giảng dạy.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pl-mini">
              <thead><tr><th>Môn</th><th>Phần</th><th>Lớp</th><th>Số tiết</th><th /></tr></thead>
              <tbody>
                {lines.map((a) => (
                  <tr key={a.id}>
                    <td><input className="input" list="te-subjects" style={{ minWidth: 130 }} value={a.subject} onChange={(e) => setLine(a.id, { subject: e.target.value })} aria-label="Môn" /></td>
                    <td><input className="input" style={{ width: 90 }} value={a.part || ''} onChange={(e) => setLine(a.id, { part: e.target.value })} placeholder="Lý, Hóa…" aria-label="Phần" /></td>
                    <td>
                      <select className="input" style={{ width: 90 }} value={a.cls} onChange={(e) => setLine(a.id, { cls: e.target.value })} aria-label="Lớp">
                        {clsOptions(a.cls).map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><input type="number" min="1" max="10" className="input" style={{ width: 70 }} value={a.periods} onChange={(e) => setLine(a.id, { periods: numOrNull(e.target.value) ?? 1 })} aria-label="Số tiết" /></td>
                    <td><button type="button" className="btn btn-sm btn-danger" onClick={() => edit((c) => ({ ...c, assignments: c.assignments.filter((x) => x.id !== a.id) }))} aria-label="Xóa dòng">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="te-subjects">{subjectNames.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        )}
        <div className="pl-quick">
          <input className="input" value={qa} onChange={(e) => setQa(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addQuick(); }} placeholder="Nhập nhanh như trong bảng: Toán 6A1, 6A3 (8t); KHTN(Lý) 7A1 (1t)" aria-label="Nhập nhanh giảng dạy" />
          <button type="button" className="btn" onClick={addQuick}>Thêm</button>
          <button type="button" className="btn" onClick={() => edit((c) => ({ ...c, assignments: [...c.assignments, { id: newId(), cls: classes[0] || '', subject: 'Môn mới', part: '', teacher: t.name, periods: 1 }] }))}>＋ Thêm dòng trống</button>
        </div>
        <p className="hint" style={{ margin: '6px 0 0' }}>Số trong ngoặc là tổng số tiết của cả nhóm lớp, hệ thống tự chia đều cho các lớp.</p>
      </div>

      <div className="pl-sec">
        <h4>Tiết chuẩn, chuyên đề, kiêm nhiệm (tính vào tổng, không xếp lưới)</h4>
        <div className="pl-grid2">
          <Field label="Tiết chuẩn" id="te-ch"><input id="te-ch" type="number" min="0" className="input" value={t.chuan ?? ''} onChange={(e) => patch({ chuan: numOrNull(e.target.value) })} /></Field>
          <div />
          <Field label="Chuyên đề học tập (nội dung)" id="te-cd"><input id="te-cd" className="input" value={t.chuyenDe?.text || ''} onChange={(e) => patch({ chuyenDe: { ...(t.chuyenDe || {}), text: e.target.value, periods: t.chuyenDe?.periods || 0 } })} placeholder="Ví dụ BDHSG môn Sinh học" /></Field>
          <Field label="Số tiết (2)" id="te-cdn"><input id="te-cdn" type="number" min="0" className="input" value={t.chuyenDe?.periods ?? 0} onChange={(e) => patch({ chuyenDe: { text: t.chuyenDe?.text || '', periods: numOrNull(e.target.value) ?? 0 } })} /></Field>
          <Field label="Kiêm nhiệm (nhiệm vụ)" id="te-kn"><input id="te-kn" className="input" value={t.kiemNhiem?.text || ''} onChange={(e) => patch({ kiemNhiem: { ...(t.kiemNhiem || {}), text: e.target.value, periods: t.kiemNhiem?.periods || 0 } })} placeholder="Ví dụ CN 6A1, TTCM" /></Field>
          <Field label="Số tiết (3)" id="te-knn"><input id="te-knn" type="number" min="0" className="input" value={t.kiemNhiem?.periods ?? 0} onChange={(e) => patch({ kiemNhiem: { text: t.kiemNhiem?.text || '', periods: numOrNull(e.target.value) ?? 0 } })} /></Field>
        </div>
        {other.map((o, i) => (
          <div key={i} className="row" style={{ marginTop: 8 }}>
            <input className="input grow" value={o.text} onChange={(e) => setOther(i, { text: e.target.value })} aria-label="Tiết khác (SHDC, AI...)" />
            <input type="number" min="0" className="input" style={{ width: 80 }} value={o.periods} onChange={(e) => setOther(i, { periods: numOrNull(e.target.value) ?? 0 })} aria-label="Số tiết" />
            <button type="button" className="btn btn-sm btn-danger" onClick={() => patch({ other: other.filter((_, j) => j !== i) })} aria-label="Xóa">✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => patch({ other: [...other, { text: 'SHDC', periods: 1 }] })}>＋ Tiết khác (SHDC, Trí tuệ nhân tạo…)</button>
      </div>

      <div className="pl-sec">
        <h4>Khi xếp thời khóa biểu</h4>
        <div className="pl-grid2">
          <Field label="Ngày nghỉ trong tuần" id="te-off">
            <select id="te-off" className="input" value={String(t.dayOff ?? 'auto')} onChange={(e) => patch({ dayOff: e.target.value === 'auto' || e.target.value === 'none' ? e.target.value : Number(e.target.value) })}>
              <option value="auto">Tự xếp</option>
              <option value="none">Không nghỉ</option>
              {cfg.days.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
            </select>
          </Field>
          <Field label="Tính công bằng giờ vào/ra" id="te-fair">
            <select id="te-fair" className="input" value={t.fair === false ? 'no' : 'yes'} onChange={(e) => patch({ fair: e.target.value === 'yes' })}>
              <option value="yes">Có</option><option value="no">Không (thỉnh giảng)</option>
            </select>
          </Field>
          <Field label="Định mức đứng lớp (tiết)" id="te-q"><input id="te-q" type="number" min="0" className="input" value={t.quota ?? ''} placeholder={String(cfg.defaultQuota)} onChange={(e) => edit((c) => ({ ...c, teachers: c.teachers.map((x) => (nk(x.name) === nk(name) ? { ...x, quota: numOrNull(e.target.value) } : x)) }))} /></Field>
          <Field label="Tối đa đứng lớp (tiết)" id="te-x"><input id="te-x" type="number" min="0" className="input" value={t.max ?? ''} placeholder={String(cfg.defaultMax)} onChange={(e) => edit((c) => ({ ...c, teachers: c.teachers.map((x) => (nk(x.name) === nk(name) ? { ...x, max: numOrNull(e.target.value) } : x)) }))} /></Field>
        </div>
        <p className="hint" style={{ margin: '6px 0 0' }}>Định mức đứng lớp tự tính bằng tiết chuẩn trừ chuyên đề, kiêm nhiệm và tiết khác; sửa tiết chuẩn thì định mức tự cập nhật.</p>
      </div>
    </Modal>
  );
}

export default function StepPccm({ cfg, edit, issues, setIssues, classes, subjectNames, analysis, onPickFile, onImportCurrent, setMsg }) {
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState('all');
  const [flt, setFlt] = useState('all');
  const [editing, setEditing] = useState(null);
  const [showIssues, setShowIssues] = useState(true);
  const fileRef = useRef(null);

  const rows = useMemo(() => teacherTotals(cfg), [cfg]);
  const byTeacher = useMemo(() => {
    const m = new Map();
    cfg.assignments.forEach((a) => { if (a.teacher) (m.get(nk(a.teacher)) || m.set(nk(a.teacher), []).get(nk(a.teacher))).push(a); });
    return m;
  }, [cfg.assignments]);
  const groups = useMemo(() => { const g = []; rows.forEach((r) => { const x = r.t.to || NO_GROUP; if (!g.includes(x)) g.push(x); }); return g; }, [rows]);
  const warnNames = useMemo(() => { const s = new Set(); issues.forEach((i) => String(i.teacher).split(',').forEach((n) => { if (n.trim()) s.add(nk(n)); })); return s; }, [issues]);

  const visible = rows.filter((r) => (grp === 'all' || (r.t.to || NO_GROUP) === grp)
    && (!q || plain(r.t.name).includes(plain(q)))
    && (flt === 'all' || (flt === 'lech' && r.chenh !== null && r.chenh !== 0) || (flt === 'warn' && warnNames.has(nk(r.t.name)))));
  const shownGroups = groups.filter((g) => visible.some((r) => (r.t.to || NO_GROUP) === g));
  const sum = (f) => visible.reduce((x, r) => x + (f(r) || 0), 0);
  const nLech = rows.filter((r) => r.chenh !== null && r.chenh !== 0).length;
  const nErr = issues.filter((i) => i.level === 'error').length;

  const addTeacher = () => {
    let name = 'Giáo viên mới';
    let i = 2;
    while (cfg.teachers.some((t) => nk(t.name) === nk(name))) { name = `Giáo viên mới ${i}`; i += 1; }
    edit((c) => recalcTeacher({
      ...c,
      teachers: [...c.teachers, { name, tt: '', to: grp !== 'all' && grp !== NO_GROUP ? grp : '', chucVu: 'GV', subjects: [], quota: null, max: null, dayOff: 'auto', fair: true, chuan: c.defaultQuota, chuyenDe: { text: '', periods: 0 }, kiemNhiem: { text: '', periods: 0 }, other: [], homeroom: [], ghiChu: '' }],
    }, name));
    setEditing(name);
  };

  if (!rows.length) {
    return (
      <div className="pl-hero">
        <div className="pl-hero-ic" aria-hidden="true">📋</div>
        <h2>Bắt đầu bằng bảng phân công chuyên môn</h2>
        <p>Chọn file Excel “Bảng phân công chuyên môn” theo mẫu Phụ lục IX. Hệ thống đọc giáo viên, môn dạy, lớp, số tiết, chuyên đề và kiêm nhiệm, rồi chỉ ra những chỗ nên kiểm tra lại.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-red" onClick={() => fileRef.current?.click()}>Chọn file phân công chuyên môn (.xlsx)</button>
          <button type="button" className="btn" onClick={onImportCurrent}>Nạp từ thời khóa biểu hiện hành</button>
          <button type="button" className="btn" onClick={addTeacher}>Tự thêm giáo viên</button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPickFile(f); }} />
      </div>
    );
  }

  return (
    <>
      <div className="pl-stats">
        <Stat value={rows.length} label="Giáo viên" />
        <Stat value={rows.reduce((x, r) => x + r.scheduled, 0)} label="Tiết đứng lớp mỗi tuần" />
        <Stat value={classes.length} label="Lớp" />
        <Stat value={nLech} label="Giáo viên lệch tiết chuẩn" tone={nLech ? 'warn' : 'ok'} />
        {issues.length > 0 && <Stat value={issues.length} label={`Điểm cần kiểm tra khi nhập${nErr ? ` (${nErr} lỗi)` : ''}`} tone={nErr ? 'bad' : 'warn'} />}
      </div>

      {issues.length > 0 && (
        <div className="pl-issues">
          <div className="pl-issues-h">
            <strong>Những chỗ nên kiểm tra sau khi nhập file</strong>
            <span className="row">
              <button type="button" className="btn btn-sm" onClick={() => setShowIssues((v) => !v)}>{showIssues ? 'Thu gọn' : 'Mở ra'}</button>
              <button type="button" className="btn btn-sm" onClick={() => setIssues([])}>Ẩn danh sách</button>
            </span>
          </div>
          {showIssues && (
            <ul>
              {issues.map((i, k) => (
                <li key={k}>
                  <span className={`pl-dot ${i.level}`} aria-hidden="true" />
                  <span>
                    {i.teacher && String(i.teacher).split(',').length === 1 && cfg.teachers.some((t) => nk(t.name) === nk(i.teacher))
                      ? <><button type="button" className="pl-link" onClick={() => setEditing(cfg.teachers.find((t) => nk(t.name) === nk(i.teacher)).name)}>{i.teacher}</button>: </>
                      : i.teacher ? <b>{i.teacher}: </b> : null}
                    {i.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="hint" style={{ margin: '10px 0 0' }}>Bấm tên giáo viên để sửa ngay. Các điểm này không chặn việc xếp thời khóa biểu; bước 2 sẽ cho thấy lớp nào còn thiếu hoặc thừa tiết so với chương trình.</p>
        </div>
      )}

      <div className="pl-toolbar">
        <input className="input pl-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm giáo viên…" aria-label="Tìm giáo viên" />
        <Seg value={grp} onChange={setGrp} options={[['all', 'Tất cả'], ...groups.map((g) => [g, g])]} />
        <Seg value={flt} onChange={setFlt} options={[['all', 'Mọi trạng thái'], ['lech', 'Lệch tiết chuẩn'], ['warn', 'Có cảnh báo']]} />
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Nhập lại từ Excel</button>
        <button type="button" className="btn" onClick={onImportCurrent}>Nạp từ TKB hiện hành</button>
        <button type="button" className="btn btn-red" onClick={addTeacher}>＋ Thêm giáo viên</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPickFile(f); }} />
      </div>

      <div className="pl-scroll" style={{ marginBottom: 14 }}>
        <table className="pl-tbl">
          <caption style={{ captionSide: 'top', textAlign: 'left', padding: '12px 12px 4px', fontWeight: 800, color: 'var(--navy,#12305a)' }}>
            {cfg.pccm?.title || 'Bảng phân công chuyên môn'}
            {cfg.pccm?.file && <span className="pl-sub" style={{ fontWeight: 500 }}> · từ file {cfg.pccm.file}</span>}
          </caption>
          <thead>
            <tr>
              <th style={{ width: 34 }}>TT</th><th style={{ minWidth: 150 }}>Họ và tên</th><th style={{ minWidth: 80 }}>Môn dạy</th>
              <th style={{ minWidth: 270 }}>Giảng dạy (lớp, số tiết)</th><th className="c" title="Số tiết giảng dạy">(1)</th>
              <th style={{ minWidth: 110 }}>Chuyên đề học tập</th><th className="c">(2)</th>
              <th style={{ minWidth: 100 }}>Kiêm nhiệm</th><th className="c">(3)</th>
              <th className="c">Tổng</th><th className="c">Chuẩn</th><th>Chênh lệch</th><th style={{ minWidth: 90 }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {shownGroups.map((g) => (
              <GroupRows key={g} g={g} rows={visible.filter((r) => (r.t.to || NO_GROUP) === g)} byTeacher={byTeacher} onOpen={setEditing} warnNames={warnNames} />
            ))}
            {visible.length === 0 && <tr><td colSpan={13}><div className="empty">Không có giáo viên phù hợp bộ lọc.</div></td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Cộng ({visible.length} giáo viên)</td>
              <td className="c">{sum((r) => r.giangDay)}</td><td /><td className="c">{sum((r) => r.chuyenDe)}</td><td /><td className="c">{sum((r) => r.kiemNhiem)}</td>
              <td className="c">{sum((r) => r.tong)}</td><td className="c">{sum((r) => r.chuan)}</td><td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="hint">Bấm vào một dòng để sửa thông tin, môn, lớp, số tiết, chuyên đề và kiêm nhiệm. “Giảng dạy (1)” gồm các tiết xếp vào thời khóa biểu và các tiết như SHDC; chuyên đề và kiêm nhiệm chỉ tính vào tổng so với tiết chuẩn.</p>

      <details className="pl-details">
        <summary>Gợi ý cân đối tiết giữa các giáo viên ({analysis.suggestions.length})</summary>
        <div className="pl-body">
          {analysis.suggestions.length === 0 ? <div className="empty">Tải tiết cân đối, chưa cần điều chỉnh.</div> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {analysis.suggestions.map((s, i) => (
                <div key={i} className="row">
                  <span className={`pill ${s.type === 'move' ? 'ok' : 'warn'}`}>{s.type === 'move' ? 'Có thể áp dụng' : 'Cần quyết định'}</span>
                  <span className="grow">{plainText(s.text)}</span>
                  {s.type === 'move' && <button type="button" className="btn btn-sm" onClick={() => edit((c) => ({ ...c, assignments: c.assignments.map((a) => (a.id === s.lineId ? { ...a, teacher: s.to } : a)) }))}>Áp dụng</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      {editing && (
        <TeacherEditor
          key={editing}
          name={editing} cfg={cfg} edit={edit} classes={classes} subjectNames={subjectNames} groups={groups}
          onClose={() => setEditing(null)} onRename={setEditing} setMsg={setMsg}
        />
      )}
    </>
  );
}

function GroupRows({ g, rows, byTeacher, onOpen, warnNames }) {
  return (
    <>
      <tr className="pl-grp"><td colSpan={13}>{g} · {rows.length} giáo viên · {rows.reduce((x, r) => x + r.tong, 0)} tiết</td></tr>
      {rows.map((r, i) => {
        const t = r.t;
        const parts = teachingText(byTeacher.get(nk(t.name)) || [], t.other);
        return (
          <tr key={t.name} className="pl-row" onClick={() => onOpen(t.name)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t.name); }}>
            <td className="c">{t.tt || i + 1}</td>
            <td>
              <div className="pl-name">{t.name}{warnNames.has(nk(t.name)) && <span title="Có điểm cần kiểm tra" style={{ color: 'var(--warn,#8a5b0a)' }}> ⚠</span>}</div>
              <div className="pl-sub">{[t.chucVu, t.namSinh && `sinh ${t.namSinh}`, t.trinhDo].filter(Boolean).join(' · ')}</div>
            </td>
            <td>{t.monDay}</td>
            <td>{parts.length ? parts.map((p, k) => <div key={k} className={`pl-ln ${/^(SHDC|Trí tuệ)/i.test(p) ? 'x' : ''}`}>{p}</div>) : <span className="pl-sub">Chưa có</span>}</td>
            <td className="n">{r.giangDay}</td>
            <td>{t.chuyenDe?.text}</td><td className="n">{r.chuyenDe || ''}</td>
            <td>{t.kiemNhiem?.text}</td><td className="n">{r.kiemNhiem || ''}</td>
            <td className="n">{r.tong}</td><td className="n">{r.chuan ?? ''}</td>
            <td><ChenhPill v={r.chenh} /></td>
            <td>{t.ghiChu}</td>
          </tr>
        );
      })}
    </>
  );
}
