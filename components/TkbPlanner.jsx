'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { vnTodayIso } from '@/lib/dates';
import AppShell, { Toast } from '@/components/AppShell';
import TkbShell from '@/components/TkbShell';
import { loadBellTimes } from '@/lib/tkbClient';
import { preflight } from '@/lib/tkbPreflight';
import { verifyResult } from '@/lib/tkbVerify';
import { mergeCfg, gradeOf, buildConfigFromRows, analyzeLoad, syncTeachers, solve } from '@/lib/tkbSolver';
import { applyPccm, readPccmFile, mergeTeacherMeta, ensureSubjects } from '@/lib/pcmImport';
import { PlanStyles } from '@/components/tkbplan/ui';
import StepPccm from '@/components/tkbplan/StepPccm';
import StepClasses from '@/components/tkbplan/StepClasses';
import StepRules from '@/components/tkbplan/StepRules';
import StepResult from '@/components/tkbplan/StepResult';

const STEPS = [
  ['gv', 'Phân công chuyên môn'],
  ['lop', 'Lớp và chương trình'],
  ['qt', 'Quy tắc xếp'],
  ['kq', 'Xếp và kết quả'],
];

export default function TkbPlanner({ nav, activeHref, roleLabel, backHref, school }) {
  const Shell = school ? TkbShell : AppShell;
  const { profile, ready, logout } = useGuard('tpt');
  const [msg, setMsg] = useState(null);
  const [cfg, setCfg] = useState(mergeCfg());
  const [step, setStep] = useState('gv');
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [bells, setBells] = useState([]);
  const [classSel, setClassSel] = useState('');
  const [notes, setNotes] = useState([]);
  const [issues, setIssues] = useState([]);
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
  const [notify, setNotify] = useState(true);
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

  const edit = (fn) => { setCfg((c) => syncTeachers(ensureSubjects(fn(c)))); setDirty(true); };
  const analysis = useMemo(() => analyzeLoad(cfg), [cfg]);
  const pre = useMemo(() => preflight(cfg), [cfg]);
  const classes = useMemo(() => [...new Set([...cfg.assignments.map((a) => a.cls), ...cfg.locks.map((l) => l.cls)])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi')), [cfg.assignments, cfg.locks]);
  useEffect(() => { if (classes.length && !classes.includes(classSel)) setClassSel(classes[0]); }, [classes, classSel]);
  const grades = useMemo(() => [...new Set(classes.map(gradeOf).filter(Boolean))].sort(), [classes]);
  const subjectList = useMemo(() => {
    const m = new Map();
    cfg.assignments.forEach((a) => { m.set(a.subject.toLowerCase().replace(/[\s.]+/g, ''), a.subject); });
    Object.values(cfg.curriculum).forEach((o) => Object.keys(o).forEach((s) => { const k = s.toLowerCase().replace(/[\s.]+/g, ''); if (!m.has(k)) m.set(k, s); }));
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [cfg.assignments, cfg.curriculum]);

  async function onPickFile(file) {
    try {
      const known = [...new Set(cfg.locks.map((l) => l.cls))];
      const { parsed, sheet } = await readPccmFile(file, { knownClasses: known });
      if (!parsed) { setMsg({ type: 'error', text: 'Không thấy bảng phân công chuyên môn trong file. Cần file theo mẫu Phụ lục IX có cột “Họ và tên”, “Giảng dạy”.' }); return; }
      if ((cfg.assignments.length || cfg.teachers.length) && !window.confirm(`Nhập ${parsed.teachers.length} giáo viên và ${parsed.lines.length} dòng giảng dạy từ file “${file.name}”?\n\nDanh sách giáo viên và phân công đang soạn sẽ được thay thế. Ngày nghỉ, công bằng, nhóm đi cùng và quy tắc xếp được giữ.`)) return;
      const next = syncTeachers(ensureSubjects(applyPccm(cfg, parsed, { file: file.name })));
      setCfg(next);
      setDirty(true);
      setResult(null);
      setReport(null);
      setNotes([]);
      setIssues(parsed.issues);
      setStep('gv');
      const nErr = parsed.issues.filter((i) => i.level === 'error').length;
      setMsg({ type: nErr ? 'error' : 'ok', text: `Đã nhập ${parsed.teachers.length} giáo viên, ${parsed.lines.length} dòng giảng dạy (sheet “${sheet}”). Có ${parsed.issues.length} điểm cần kiểm tra${nErr ? `, trong đó ${nErr} lỗi` : ''}.` });
    } catch (e) {
      setMsg({ type: 'error', text: `Không đọc được file: ${e.message || e}` });
    }
  }

  async function importCurrent() {
    if ((cfg.assignments.length || cfg.teachers.length) && !window.confirm('Nạp lại từ thời khóa biểu hiện hành sẽ thay phần phân công đang soạn (hồ sơ giáo viên, định mức và cài đặt được giữ nếu trùng tên). Tiếp tục?')) return;
    const { data, error } = await supabase.rpc('tkb_current_rows');
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    if (!data || !data.length) { setMsg({ type: 'error', text: 'Chưa có thời khóa biểu nào để nạp. Hãy nhập file phân công chuyên môn hoặc file thời khóa biểu trước.' }); return; }
    const next = mergeTeacherMeta(syncTeachers(buildConfigFromRows(data, cfg)), cfg);
    setCfg(next);
    setDirty(true);
    setResult(null);
    setReport(null);
    setIssues([]);
    setMsg({ type: 'ok', text: `Đã nạp ${next.assignments.length} dòng phân công, ${next.teachers.length} giáo viên, ${next.locks.length} tiết cố định.` });
  }

  async function saveDraft() {
    const { error } = await supabase.rpc('tkb_plan_save', { p_config: cfg });
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    setDirty(false);
    setMsg({ type: 'ok', text: 'Đã lưu bản soạn.' });
  }

  async function run(newSeed) {
    if (!cfg.assignments.length) { setMsg({ type: 'error', text: 'Chưa có phân công. Hãy nhập file phân công chuyên môn ở bước 1.' }); return; }
    const s = newSeed ?? seed;
    setSeed(s);
    setRunning(true);
    setProgress(0);
    setResult(null);
    setReport(null);
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
    else if (rep.errors.length) setMsg({ type: 'error', text: `Đã xếp theo thiết lập nhưng phân tích thấy ${rep.errors.length} lỗi.` });
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

  if (!ready || !loaded) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  const idx = STEPS.findIndex(([k]) => k === step);
  const nProg = pre.errors.length;
  const stepInfo = {
    gv: [cfg.teachers.length ? `${cfg.teachers.length} giáo viên` : 'Chưa nhập', !!cfg.teachers.length, false],
    lop: [classes.length ? `${classes.length} lớp${nProg ? ` · ${nProg} cảnh báo` : ''}` : 'Chưa có lớp', classes.length > 0 && nProg === 0, nProg > 0],
    qt: [`${cfg.days.length} ngày · ${cfg.sang}+${cfg.chieu} tiết`, true, false],
    kq: [result ? 'Đã xếp' : 'Chưa xếp', !!result, false],
  };

  return (
    <Shell profile={profile} roleLabel={roleLabel} nav={nav} activeHref={activeHref} onLogout={logout}>
      <PlanStyles />
      <div className="pl-top">
        <div>
          <h1>Soạn thời khóa biểu tự động</h1>
          <p className="pl-lead">
            Nhập bảng phân công chuyên môn, kiểm tra lớp nào thiếu hoặc thừa tiết, chọn quy tắc rồi để hệ thống xếp. Kết quả chỉ vào thời khóa biểu thật khi bạn bấm “Lưu thành thời khóa biểu”.
            {backHref && !school && <> <Link href={backHref} style={{ color: 'var(--accent, #1d6fb8)' }}>← Về trang thời khóa biểu</Link></>}
          </p>
        </div>
        <div className="pl-actions">
          <button type="button" className="btn btn-red" disabled={!dirty} onClick={saveDraft}>{dirty ? 'Lưu bản soạn' : 'Đã lưu bản soạn'}</button>
        </div>
      </div>

      <nav className="pl-steps" aria-label="Các bước soạn">
        {STEPS.map(([k, label], i) => (
          <button key={k} type="button" className={`pl-step ${step === k ? 'on' : ''} ${stepInfo[k][1] && step !== k ? 'done' : ''}`} aria-current={step === k ? 'step' : undefined} onClick={() => setStep(k)}>
            <span className="pl-step-n">{stepInfo[k][1] && step !== k ? '✓' : i + 1}</span>
            <span><b>{label}</b><small className={stepInfo[k][2] ? 'warn' : ''}>{stepInfo[k][0]}</small></span>
          </button>
        ))}
      </nav>

      {step === 'gv' && (
        <StepPccm cfg={cfg} edit={edit} issues={issues} setIssues={setIssues} classes={classes} subjectNames={subjectList} analysis={analysis} onPickFile={onPickFile} onImportCurrent={importCurrent} setMsg={setMsg} />
      )}
      {step === 'lop' && (
        <StepClasses cfg={cfg} edit={edit} classes={classes} grades={grades} subjectList={subjectList} analysis={analysis} classSel={classSel} setClassSel={setClassSel} notes={notes} setNotes={setNotes} setMsg={setMsg} newSubject={newSubject} setNewSubject={setNewSubject} />
      )}
      {step === 'qt' && <StepRules cfg={cfg} edit={edit} bells={bells} />}
      {step === 'kq' && (
        <StepResult
          cfg={cfg} edit={edit} pre={pre} running={running} progress={progress} run={run} seed={seed} result={result} report={report} bells={bells}
          viewClass={viewClass} setViewClass={setViewClass} viewTeacher={viewTeacher} setViewTeacher={setViewTeacher}
          effectiveFrom={effectiveFrom} setEffectiveFrom={setEffectiveFrom} saving={saving} saveTimetable={saveTimetable} notify={notify} setNotify={setNotify}
        />
      )}

      <div className="pl-bar">
        <span className={`pl-bar-s ${dirty ? 'dirty' : ''}`}>{dirty ? 'Có thay đổi chưa lưu bản soạn' : 'Bản soạn đã được lưu'}</span>
        <span className="row">
          {dirty && <button type="button" className="btn" onClick={saveDraft}>Lưu bản soạn</button>}
          <button type="button" className="btn" disabled={idx <= 0} onClick={() => setStep(STEPS[idx - 1][0])}>← Bước trước</button>
          <button type="button" className="btn btn-red" disabled={idx >= STEPS.length - 1} onClick={() => setStep(STEPS[idx + 1][0])}>Bước tiếp →</button>
        </span>
      </div>

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </Shell>
  );
}
