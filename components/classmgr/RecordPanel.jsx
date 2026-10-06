'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { addDays, fmtIso, mondayOf, timeVN, vnTodayIso } from '@/lib/dates';
import { roleText } from '@/lib/roles';
import StudentPicker from './StudentPicker';
import WatchDutyPanel from './WatchDutyPanel';

const KIND_LABEL = { violation: 'Vi phạm', singing: 'Không hát', plus: 'Điểm cộng', cadre_ok: 'Không vi phạm' };
const KIND_TONE = { violation: 'bad', singing: 'bad', plus: 'ok', cadre_ok: 'mute' };
const SESS = { sang: 'sáng', chieu: 'chiều' };
const wdOf = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const wdShort = (iso) => (wdOf(iso) === 0 ? 'CN' : `T${wdOf(iso) + 1}`);
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Ghi nhận trong lớp (ban cán sự / giáo viên chủ nhiệm).
// Luồng: 1) Chọn ngày (hôm nay hoặc ngày trước trong tuần) → môn học của ngày đó tự hiện ra, chọn tiết
//        2) Chọn học sinh  3) Chọn nội dung  4) Ghi chú → Ghi nhận.
// Chống trùng: 1 tiết chỉ ghi 1 lần (nói chuyện, bị nhắc nhở, điểm cộng), 1 ngày chỉ ghi 1 lần (thiếu sổ, khăn quàng...).
// Ban cán sự chỉ ghi được trong tuần hiện tại (database kiểm tra); giáo viên ghi được mọi ngày.
export default function RecordPanel({ classId, students, perms, role, roleGroup, profileId, toast }) {
  const today = vnTodayIso();
  const monday = mondayOf(today);
  const weekDays = useMemo(() => {
    const list = [];
    for (let d = monday; d <= today; d = addDays(d, 1)) list.push(d);
    return list;
  }, [monday, today]);

  const [types, setTypes] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [periodKey, setPeriodKey] = useState(''); // dạng "sang:2"
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState([]);
  const [cadre, setCadre] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [dedupe, setDedupe] = useState([]);
  const [watchGroup, setWatchGroup] = useState(null);

  useEffect(() => {
    supabase.from('class_record_types').select('*').order('sort_order').then(({ data }) => setTypes(data || []));
  }, []);

  const loadRecords = useCallback(async () => {
    const { data } = await supabase.rpc('class_list_records', { p_class_id: classId, p_from: monday, p_to: today });
    setRecords(data || []);
  }, [classId, monday, today]);

  const loadCadre = useCallback(async () => {
    if (!perms.cadre) return;
    const { data } = await supabase.rpc('class_cadre_status', { p_class_id: classId, p_date: today });
    setCadre(data || []);
  }, [classId, perms.cadre, today]);

  const loadPeriods = useCallback(async () => {
    const { data } = await supabase.rpc('class_day_periods', { p_class_id: classId, p_date: date });
    setPeriods(data || []);
  }, [classId, date]);

  const loadDedupe = useCallback(async () => {
    if (!perms.violation && !perms.singing) return;
    const { data } = await supabase.rpc('class_dedupe_status', { p_class_id: classId, p_date: date });
    setDedupe(data || []);
  }, [classId, date, perms.violation, perms.singing]);

  useEffect(() => { loadRecords(); loadCadre(); }, [loadRecords, loadCadre]);
  useEffect(() => { setPeriodKey(''); setPeriods([]); loadPeriods(); }, [loadPeriods]);
  useEffect(() => { loadDedupe(); }, [loadDedupe]);

  useEffect(() => {
    if (role !== 'to_truong' && role !== 'to_pho') return;
    supabase.rpc('class_my_watch_group', { p_class_id: classId }).then(({ data }) => setWatchGroup(data ?? roleGroup));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, role]);

  const allowed = useMemo(
    () => types.filter((t) => (t.perm === 'violation' && perms.violation) || (t.perm === 'singing' && perms.singing) || (t.perm === 'academic' && perms.academic)),
    [types, perms]
  );
  const groups = [
    { kind: 'violation', title: 'Vi phạm trong lớp', list: allowed.filter((t) => t.kind === 'violation') },
    { kind: 'singing', title: 'Không hát', list: allowed.filter((t) => t.kind === 'singing') },
    { kind: 'plus', title: 'Điểm cộng', list: allowed.filter((t) => t.kind === 'plus') },
  ].filter((g) => g.list.length > 0);

  const scoped = !perms.staff && (role === 'to_truong' || role === 'to_pho');
  const effectiveGroup = watchGroup || roleGroup;
  const isCross = scoped && effectiveGroup !== roleGroup;
  const candidates = students.filter((s) => !scoped || s.group_no === effectiveGroup || s.group_no === roleGroup);
  const picked = allowed.find((t) => t.code === typeCode);
  const isCustom = typeCode === 'khac';
  const selectedStudent = students.find((s) => s.student_id === studentId);
  const outOfScope = scoped && !!selectedStudent && !!picked && picked.kind !== 'plus' && selectedStudent.group_no !== effectiveGroup;

  const scope = picked?.dedupe_scope || 'none';
  const needPeriod = scope === 'period' && periods.length > 0;
  const noTimetable = scope === 'period' && periods.length === 0;
  const [pSess, pNo] = periodKey ? periodKey.split(':') : [null, null];
  const pickedPeriod = periodKey ? periods.find((p) => p.session === pSess && String(p.period) === pNo) : null;

  const existing = useMemo(() => {
    if (!studentId || !picked || scope === 'none') return null;
    return dedupe.find((d) => d.student_id === studentId && d.type_code === picked.code
      && (scope === 'day' || noTimetable || (needPeriod && d.period_session === pSess && String(d.period_no) === pNo))) || null;
  }, [dedupe, studentId, picked, scope, noTimetable, needPeriod, pSess, pNo]);

  const takenPeriod = (p) => !!studentId && !!picked && dedupe.some((d) => d.student_id === studentId && d.type_code === picked.code
    && d.period_session === p.session && d.period_no === p.period);

  const readyToSubmit = !!studentId && !!typeCode && (!isCustom || custom.trim()) && (!needPeriod || !!periodKey) && !existing && !outOfScope;
  const isPast = date !== today;

  async function submit() {
    if (!readyToSubmit) {
      toast({ type: 'error', text: existing ? 'Mục này đã có người ghi rồi.' : 'Hãy chọn học sinh, nội dung cần ghi nhận' + (needPeriod ? ' và tiết học.' : '.') });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('class_add_record', {
      p_class_id: classId, p_student_id: studentId, p_type_code: typeCode,
      p_custom_label: isCustom ? custom : null, p_note: note || null, p_date: date,
      p_session: needPeriod ? pSess : null, p_period: needPeriod ? Number(pNo) : null,
    });
    setBusy(false);
    if (error) {
      toast({ type: 'error', text: error.message });
      loadDedupe();
      loadRecords();
      return;
    }
    const who = selectedStudent?.full_name || '';
    toast({ type: 'ok', text: `Đã ghi nhận: ${who} — ${isCustom ? custom : picked?.label}${isPast ? ` (ngày ${dm(date)})` : ''}.` });
    // Giữ nguyên ngày và tiết để ghi tiếp cho bạn khác nhanh hơn
    setStudentId('');
    setNote('');
    setCustom('');
    setTypeCode('');
    loadRecords();
    loadCadre();
    loadDedupe();
  }

  async function remove(r) {
    if (!window.confirm(`Xoá ghi nhận "${r.label}" của ${r.student_name}?`)) return;
    const { error } = await supabase.rpc('class_delete_record', { p_id: r.id });
    if (error) toast({ type: 'error', text: error.message });
    else { loadRecords(); loadCadre(); loadDedupe(); }
  }

  async function cadreOk(s) {
    const { error } = await supabase.rpc('class_cadre_ok', { p_class_id: classId, p_student_id: s.student_id, p_date: today });
    if (error) toast({ type: 'error', text: error.message });
    else loadCadre();
  }

  function quickViolation(s) {
    setStudentId(s.student_id);
    setTypeCode(allowed.find((t) => t.kind === 'violation')?.code || '');
    document.getElementById('rp-new-record')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const canDelete = (r) => perms.staff || r.recorded_by === profileId;

  // Gom ghi nhận theo ngày (mới nhất trước)
  const recordsByDay = useMemo(() => {
    const map = {};
    records.forEach((r) => { (map[r.occurred_date] = map[r.occurred_date] || []).push(r); });
    return Object.keys(map).sort().reverse().map((d) => ({ day: d, list: map[d] }));
  }, [records]);

  return (
    <div className="rp-root">
      <WatchDutyPanel classId={classId} canManage={perms.staff || role === 'lop_truong'} toast={toast} />
      <style jsx>{`
        .rp-root { display: flex; flex-direction: column; gap: 14px; }
        .rp-step-h { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; margin: 0 0 10px; color: var(--cm-ink); }
        .rp-step-n { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--cm-accent, #2f6f5e); color: #fff; font-size: 12.5px; display: grid; place-items: center; }
        .rp-sep { height: 1px; background: var(--cm-line); margin: 16px 0; }

        .rp-days { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 8px; margin: 0 -2px; scrollbar-width: thin; }
        .rp-day { flex: none; min-width: 66px; padding: 8px 10px; border-radius: 14px; border: 1.5px solid var(--cm-line); background: #fff; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px; min-height: 52px; font: inherit; color: var(--cm-ink); }
        .rp-day b { font-size: 14px; }
        .rp-day span { font-size: 11.5px; color: var(--cm-muted); font-weight: 600; }
        .rp-day.on { border-color: var(--cm-accent, #2f6f5e); background: var(--cm-accent, #2f6f5e); color: #fff; }
        .rp-day.on span { color: rgba(255, 255, 255, 0.85); }
        .rp-banner { margin-top: 6px; background: #fff4e5; border: 1.5px solid #f0b866; border-radius: 12px; padding: 10px 12px; font-size: 13px; }

        .rp-sess { font-size: 12px; font-weight: 800; color: var(--cm-muted); margin: 10px 0 6px; }
        .rp-per-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .rp-per { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 12px; border: 1.5px solid var(--cm-line); background: #fff; cursor: pointer; text-align: left; min-height: 54px; font: inherit; color: var(--cm-ink); }
        .rp-per.on { border-color: var(--cm-accent, #2f6f5e); background: var(--cm-tint, #f3f9f6); box-shadow: 0 0 0 2px var(--cm-accent, #2f6f5e) inset; }
        .rp-per:disabled { opacity: 0.45; cursor: not-allowed; }
        .rp-per-n { flex: none; width: 28px; height: 28px; border-radius: 9px; background: var(--cm-tint, #eef5f2); display: grid; place-items: center; font-weight: 800; font-size: 13px; }
        .rp-per.on .rp-per-n { background: var(--cm-accent, #2f6f5e); color: #fff; }
        .rp-subj { font-size: 13.5px; font-weight: 800; line-height: 1.25; }
        .rp-once { font-size: 11.5px; color: var(--cm-muted); font-weight: 600; }

        .rp-type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .rp-type { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 11px 13px; border-radius: 12px; border: 1.5px solid var(--cm-line); background: #fff; cursor: pointer; min-height: 54px; text-align: left; font: inherit; color: var(--cm-ink); }
        .rp-type.on { border-color: var(--cm-accent, #2f6f5e); background: var(--cm-tint, #f3f9f6); box-shadow: 0 0 0 2px var(--cm-accent, #2f6f5e) inset; }
        .rp-type-lbl { font-size: 13px; font-weight: 700; line-height: 1.25; }
        .rp-type-pt { font-size: 13px; font-weight: 800; }
        .rp-type-pt.neg { color: var(--cm-bad); } .rp-type-pt.pos { color: var(--cm-ok); }

        .rp-summary { background: var(--cm-tint, #f3f9f6); border: 1.5px dashed var(--cm-accent, #2f6f5e); border-radius: 12px; padding: 12px 14px; font-size: 13.5px; }
        .rp-summary b { color: var(--cm-accent-d, #234f42); }
        .rp-dup { background: #fff4e5; border: 1.5px solid #f0b866; border-radius: 12px; padding: 12px 14px; font-size: 13.5px; margin-top: 14px; }
        .rp-submit { position: sticky; bottom: 10px; }
        .rp-submit button { width: 100%; padding: 15px; font-size: 15px; border-radius: 14px; box-shadow: 0 8px 20px -8px rgba(0,0,0,0.25); }

        .rec-day { font-size: 12.5px; font-weight: 800; color: var(--cm-muted); margin: 12px 0 6px; }
        .rec-list { display: grid; gap: 8px; }
        .rec-row { border: 1px solid var(--cm-line); border-radius: 12px; padding: 11px 13px; }
        .rec-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .rec-name { font-weight: 800; font-size: 14px; }
        .rec-meta { font-size: 11.5px; color: var(--cm-muted); margin-top: 2px; }
        .rec-pts { font-weight: 800; font-size: 16px; white-space: nowrap; }
        .rec-body { margin-top: 6px; font-size: 13.5px; }
        .rec-note { color: var(--cm-muted); font-size: 12.5px; margin-top: 2px; }
        .rec-foot { display: flex; justify-content: flex-end; margin-top: 8px; }

        .cd-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--cm-line); border-radius: 12px; padding: 10px 12px; flex-wrap: wrap; }
        .cd-name { font-weight: 800; font-size: 13.5px; }
        .cd-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      `}</style>

      {perms.cadre && (
        <div className="cm-card">
          <div className="cm-h"><h3>Kiểm tra ban cán sự hôm nay</h3></div>
          <p className="cm-hint">Ban cán sự cũng phải gương mẫu. Không vi phạm thì bấm xác nhận; có thì ghi vi phạm như bình thường.</p>
          {cadre.length === 0 ? (
            <div className="cm-empty">Chưa có ban cán sự nào được giao chức vụ.</div>
          ) : (
            <div className="rec-list">
              {cadre.map((s) => (
                <div key={s.student_id} className="cd-row">
                  <div>
                    <div className="cd-name">{s.full_name}</div>
                    <span className="cm-chip">{roleText(s.role, s.group_no)}</span>
                  </div>
                  <div className="cd-actions">
                    {s.violations > 0 ? <span className="cm-pill bad">{s.violations} vi phạm</span>
                      : s.confirmed_ok ? <span className="cm-pill ok">Không vi phạm ✓</span>
                      : <span className="cm-pill mute">Chưa kiểm tra</span>}
                    {!s.confirmed_ok && s.violations === 0 && <button className="cm-btn cm-btn-sm cm-btn-ok" onClick={() => cadreOk(s)}>Không vi phạm</button>}
                    {perms.violation && <button className="cm-btn cm-btn-sm cm-btn-danger" onClick={() => quickViolation(s)}>Ghi vi phạm</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {groups.length > 0 && (
        <div className="cm-card" id="rp-new-record">
          <div className="cm-h"><h3>Ghi nhận mới</h3></div>

          {/* BƯỚC 1: ngày + tiết (môn học tự hiện theo thời khóa biểu) */}
          <div className="rp-step-h"><span className="rp-step-n">1</span> Chọn ngày và tiết học</div>
          <div className="rp-days" role="group" aria-label="Chọn ngày">
            {weekDays.slice().reverse().map((d) => (
              <button key={d} type="button" className={`rp-day ${date === d ? 'on' : ''}`} aria-pressed={date === d} onClick={() => setDate(d)}>
                <b>{d === today ? 'Hôm nay' : wdShort(d)}</b>
                <span>{d === today ? `${wdShort(d)} · ${dm(d)}` : dm(d)}</span>
              </button>
            ))}
          </div>
          {perms.staff && (
            <div style={{ marginTop: 4 }}>
              <label className="cm-lbl" htmlFor="rc-date" style={{ marginTop: 0 }}>Ngày khác (giáo viên)</label>
              <input id="rc-date" type="date" className="cm-input" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
            </div>
          )}
          {!perms.staff && weekDays.length === 1 && <p className="cm-hint" style={{ marginTop: 2 }}>Ban cán sự ghi bù được các ngày trong tuần này. Đầu tuần mới chỉ có ngày hôm nay.</p>}
          {isPast && (
            <div className="rp-banner" role="status">Em đang ghi bù cho <b>{wdShort(date)}, {dm(date)}</b>, không phải hôm nay.</div>
          )}

          {periods.length === 0 ? (
            <p className="cm-hint" style={{ marginTop: 10 }}>Lớp chưa có thời khóa biểu cho ngày này. Các mục theo tiết sẽ tạm tính “1 lần mỗi ngày”.</p>
          ) : (
            ['sang', 'chieu'].map((s) => {
              const list = periods.filter((p) => p.session === s);
              if (list.length === 0) return null;
              return (
                <div key={s}>
                  <div className="rp-sess">Buổi {SESS[s]}</div>
                  <div className="rp-per-grid">
                    {list.map((p) => {
                      const key = `${p.session}:${p.period}`;
                      const taken = takenPeriod(p);
                      return (
                        <button key={key} type="button" disabled={taken} className={`rp-per ${periodKey === key ? 'on' : ''}`} aria-pressed={periodKey === key} onClick={() => setPeriodKey(periodKey === key ? '' : key)}>
                          <span className="rp-per-n">{p.period}</span>
                          <span>
                            <span className="rp-subj">{p.subject}</span>
                            {p.teacher ? <span className="rp-once" style={{ display: 'block' }}>{p.teacher}</span> : null}
                            {taken && <span className="rp-once" style={{ display: 'block', color: 'var(--cm-bad)' }}>Đã có người ghi</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          {periods.length > 0 && <p className="cm-hint" style={{ marginTop: 8 }}>Vi phạm theo tiết (nói chuyện, làm việc riêng, bị nhắc nhở) và điểm cộng cần chọn tiết. Lỗi tính theo ngày không cần chọn tiết.</p>}

          <div className="rp-sep" />

          {/* BƯỚC 2: học sinh */}
          <div className="rp-step-h">
            <span className="rp-step-n">2</span> Chọn học sinh
            {scoped ? ` (Tổ ${effectiveGroup}${isCross ? ' — tổ em đang giám sát tuần này' : ''}${roleGroup && roleGroup !== effectiveGroup ? `; điểm cộng ghi được cả Tổ ${roleGroup}` : ''})` : ''}
          </div>
          <StudentPicker students={candidates} value={studentId} onChange={setStudentId} scopeGroup={scoped && roleGroup === effectiveGroup ? effectiveGroup : null} />

          <div className="rp-sep" />

          {/* BƯỚC 3: nội dung */}
          <div className="rp-step-h"><span className="rp-step-n">3</span> Chọn nội dung</div>
          {groups.map((g) => (
            <div key={g.kind} style={{ marginBottom: 10 }}>
              <div className="cm-lbl" style={{ marginTop: 0 }}>{g.title}</div>
              <div className="rp-type-grid">
                {g.list.map((t) => (
                  <button key={t.code} type="button" className={`rp-type ${typeCode === t.code ? 'on' : ''}`} onClick={() => setTypeCode(t.code)} aria-pressed={typeCode === t.code}>
                    <span className="rp-type-lbl">{t.label}</span>
                    <span className={`rp-type-pt ${t.points < 0 ? 'neg' : 'pos'}`}>{t.points > 0 ? `+${t.points}` : t.points} điểm</span>
                    {t.dedupe_scope === 'period' && <span className="rp-once">1 lần / tiết</span>}
                    {t.dedupe_scope === 'day' && <span className="rp-once">1 lần / ngày</span>}
                  </button>
                ))}
                {g.kind === 'violation' && (
                  <button type="button" className={`rp-type ${isCustom ? 'on' : ''}`} onClick={() => setTypeCode('khac')} aria-pressed={isCustom}>
                    <span className="rp-type-lbl">Vi phạm khác…</span>
                    <span className="rp-type-pt neg">-1 điểm</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {isCustom && (
            <>
              <label className="cm-lbl" htmlFor="rc-custom">Tên loại vi phạm</label>
              <input id="rc-custom" className="cm-input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="VD: Ăn quà vặt trong giờ" />
            </>
          )}

          {needPeriod && !periodKey && (
            <div className="rp-dup" role="alert"><b>Mục này tính theo tiết.</b> Hãy chọn tiết học ở Bước 1 ({periods.length} tiết trong ngày).</div>
          )}

          <div className="rp-sep" />

          {/* BƯỚC 4: ghi chú */}
          <div className="rp-step-h"><span className="rp-step-n">4</span> Ghi chú</div>
          <label className="cm-lbl" htmlFor="rc-note" style={{ marginTop: 0 }}>Không bắt buộc</label>
          <input id="rc-note" className="cm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: đã nhắc 2 lần, phát biểu đúng câu 3…" />

          {outOfScope && (
            <div className="rp-dup" role="alert">
              <b>Bạn này không thuộc tổ em đang giám sát.</b> Tuần này em chỉ ghi vi phạm cho Tổ {effectiveGroup}. Riêng điểm cộng thì em ghi được cho cả tổ của mình.
            </div>
          )}

          {existing && (
            <div className="rp-dup" role="alert">
              <b>Đã có người ghi rồi.</b> {selectedStudent?.full_name} — {picked?.label}
              {existing.period_no ? ` (tiết ${existing.period_no} ${SESS[existing.period_session]})` : ''} do{' '}
              <b>{existing.recorded_by_name || '—'}</b> ({existing.recorded_role}) ghi lúc {timeVN(existing.created_at)}. Không cần ghi lại.
            </div>
          )}

          {readyToSubmit && (
            <div className="rp-summary" style={{ marginTop: 14 }}>
              Sẽ ghi: <b>{selectedStudent?.full_name}</b> — {isCustom ? custom : picked?.label}
              {needPeriod && pNo ? ` (tiết ${pNo} ${SESS[pSess]}${pickedPeriod?.subject ? ` · môn ${pickedPeriod.subject}` : ''})` : ''}
              {isPast ? ` · ngày ${dm(date)}` : ''}
              {' '}(<b>{isCustom ? -1 : picked?.points > 0 ? `+${picked.points}` : picked?.points} điểm</b>)
            </div>
          )}

          <div className="cm-foot rp-submit" style={{ marginTop: 14 }}>
            <button className="cm-btn cm-btn-main" disabled={busy || !readyToSubmit} onClick={submit}>{busy ? 'Đang ghi…' : '✓ Ghi nhận'}</button>
          </div>
        </div>
      )}

      <div className="cm-card">
        <div className="cm-h"><h3>Ghi nhận tuần này</h3><span className="cm-chip">{fmtIso(monday)} – {fmtIso(addDays(monday, 6))}</span></div>
        {records.length === 0 ? (
          <div className="cm-empty">Chưa có ghi nhận nào trong tuần.</div>
        ) : (
          recordsByDay.map((g) => (
            <div key={g.day}>
              <div className="rec-day">{g.day === today ? 'Hôm nay' : wdShort(g.day)} · {dm(g.day)} ({g.list.length})</div>
              <div className="rec-list">
                {g.list.map((r) => (
                  <div key={r.id} className="rec-row">
                    <div className="rec-top">
                      <div>
                        <div className="rec-name">{r.student_name}</div>
                        <div className="rec-meta">{timeVN(r.created_at)} · {r.recorded_by_name || '—'}</div>
                      </div>
                      <div className={`rec-pts cm-pill ${KIND_TONE[r.kind]}`} style={{ fontSize: 14 }}>{r.points > 0 ? `+${r.points}` : r.points}</div>
                    </div>
                    <div className="rec-body">
                      <span className={`cm-pill ${KIND_TONE[r.kind]}`}>{KIND_LABEL[r.kind]}</span> {r.label}
                      {r.period_no ? <span className="cm-chip" style={{ marginLeft: 6 }}>Tiết {r.period_no} {SESS[r.period_session]}{r.period_subject ? ` · ${r.period_subject}` : ''}</span> : null}
                      {r.note ? <div className="rec-note">{r.note}</div> : null}
                    </div>
                    {canDelete(r) && (
                      <div className="rec-foot">
                        <button className="cm-btn cm-btn-sm cm-btn-danger" onClick={() => remove(r)}>Xoá</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
