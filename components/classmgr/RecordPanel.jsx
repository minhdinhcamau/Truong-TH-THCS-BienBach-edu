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

// Ghi nhận trong lớp: mỗi chức vụ chỉ thấy những mục mình được phép ghi (theo perms).
// Thiết kế theo từng bước, tối ưu cho điện thoại: chọn học sinh (gom theo tổ) → chọn loại (và tiết nếu cần) → ghi nhận.
// Chống trùng: 1 tiết chỉ ghi 1 lần (nói chuyện, bị nhắc nhở), 1 ngày chỉ ghi 1 lần (thiếu sổ, khăn quàng...).
export default function RecordPanel({ classId, students, perms, role, roleGroup, profileId, toast }) {
  const today = vnTodayIso();
  const monday = mondayOf(today);
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
  const [periods, setPeriods] = useState([]); // thời khóa biểu của ngày đang chọn
  const [dedupe, setDedupe] = useState([]); // các ghi nhận chống trùng đã có trong ngày
  const [watchGroup, setWatchGroup] = useState(null); // tổ đang được phân công giám sát chéo tuần này (null = chưa xác định / không phải tổ trưởng-tổ phó)

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
  useEffect(() => { loadPeriods(); setPeriodKey(''); }, [loadPeriods]);
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
    { kind: 'violation', title: '🚫 Vi phạm trong lớp', list: allowed.filter((t) => t.kind === 'violation') },
    { kind: 'singing', title: '🎤 Không hát', list: allowed.filter((t) => t.kind === 'singing') },
    { kind: 'plus', title: '✨ Điểm cộng', list: allowed.filter((t) => t.kind === 'plus') },
  ].filter((g) => g.list.length > 0);

  // Tổ trưởng / tổ phó chỉ ghi được thành viên trong tổ của mình
  const scoped = !perms.staff && (role === 'to_truong' || role === 'to_pho');
  const effectiveGroup = watchGroup || roleGroup; // tổ trưởng/tổ phó ghi nhận cho tổ đang giám sát (có thể khác tổ của mình nếu đã xếp trực chéo)
  const isCross = scoped && effectiveGroup !== roleGroup;
  const candidates = students.filter((s) => !scoped || s.group_no === effectiveGroup);
  const picked = allowed.find((t) => t.code === typeCode);
  const isCustom = typeCode === 'khac';
  const selectedStudent = students.find((s) => s.student_id === studentId);

  const scope = picked?.dedupe_scope || 'none';
  const needPeriod = scope === 'period' && periods.length > 0;
  const noTimetable = scope === 'period' && periods.length === 0;
  const [pSess, pNo] = periodKey ? periodKey.split(':') : [null, null];

  // Đã có ai ghi đúng mục này cho bạn này (cùng tiết / cùng ngày) chưa?
  const existing = useMemo(() => {
    if (!studentId || !picked || scope === 'none') return null;
    return dedupe.find((d) => d.student_id === studentId && d.type_code === picked.code
      && (scope === 'day' || noTimetable || (needPeriod && d.period_session === pSess && String(d.period_no) === pNo))) || null;
  }, [dedupe, studentId, picked, scope, noTimetable, needPeriod, pSess, pNo]);

  const takenPeriod = (p) => !!studentId && !!picked && dedupe.some((d) => d.student_id === studentId && d.type_code === picked.code
    && d.period_session === p.session && d.period_no === p.period);

  const readyToSubmit = !!studentId && !!typeCode && (!isCustom || custom.trim()) && (!needPeriod || !!periodKey) && !existing;

  async function submit() {
    if (!readyToSubmit) {
      toast({ type: 'error', text: existing ? 'Mục này đã có người ghi rồi.' : 'Hãy chọn học sinh, mục cần ghi nhận' + (needPeriod ? ' và tiết học.' : '.') });
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
      loadDedupe(); // có thể vừa có người ghi trước -> cập nhật lại để báo đúng
      loadRecords();
      return;
    }
    const who = students.find((s) => s.student_id === studentId)?.full_name || '';
    toast({ type: 'ok', text: `Đã ghi nhận: ${who} — ${isCustom ? custom : picked?.label}.` });
    setStudentId('');
    setNote('');
    setCustom('');
    setTypeCode('');
    setPeriodKey('');
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
    setPeriodKey('');
    document.getElementById('rp-new-record')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const canDelete = (r) => perms.staff || r.recorded_by === profileId;

  return (
    <div className="rp-root">
      <WatchDutyPanel classId={classId} canManage={perms.staff || role === 'lop_truong'} toast={toast} />
      <style jsx>{`
        .rp-root { display: flex; flex-direction: column; gap: 14px; }
        .rp-step-h { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 13.5px; margin: 2px 0 10px; color: var(--cm-ink); }
        .rp-step-n { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--cm-accent, #2f6f5e); color: #fff; font-size: 12px; display: grid; place-items: center; }
        .rp-type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .rp-type { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 11px 13px; border-radius: 12px; border: 1.5px solid var(--cm-line); background: #fff; cursor: pointer; min-height: 54px; text-align: left; }
        .rp-type.on { border-color: var(--cm-accent, #2f6f5e); background: #f3f9f6; }
        .rp-type:disabled { opacity: 0.45; cursor: not-allowed; }
        .rp-type-lbl { font-size: 13px; font-weight: 700; line-height: 1.25; }
        .rp-type-pt { font-size: 13px; font-weight: 800; }
        .rp-type-pt.neg { color: var(--cm-bad); } .rp-type-pt.pos { color: var(--cm-ok); }
        .rp-once { font-size: 11.5px; color: var(--cm-muted); font-weight: 600; }
        .rp-summary { background: #f3f9f6; border: 1.5px dashed var(--cm-accent, #2f6f5e); border-radius: 12px; padding: 12px 14px; font-size: 13.5px; }
        .rp-summary b { color: var(--cm-accent-d, #234f42); }
        .rp-dup { background: #fff4e5; border: 1.5px solid #f0b866; border-radius: 12px; padding: 12px 14px; font-size: 13.5px; margin-top: 14px; }
        .rp-per-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
        .rp-submit { position: sticky; bottom: 10px; }
        .rp-submit button { width: 100%; padding: 15px; font-size: 15px; border-radius: 14px; box-shadow: 0 8px 20px -8px rgba(0,0,0,0.25); }

        .rec-list { display: grid; gap: 8px; }
        .rec-row { border: 1px solid var(--cm-line); border-radius: 12px; padding: 11px 13px; }
        .rec-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .rec-name { font-weight: 800; font-size: 14px; }
        .rec-meta { font-size: 11.5px; color: var(--cm-muted); margin-top: 2px; }
        .rec-pts { font-family: inherit; font-weight: 800; font-size: 16px; white-space: nowrap; }
        .rec-body { margin-top: 6px; font-size: 13.5px; }
        .rec-note { color: var(--cm-muted); font-size: 12.5px; margin-top: 2px; }
        .rec-foot { display: flex; justify-content: flex-end; margin-top: 8px; }

        .cd-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--cm-line); border-radius: 12px; padding: 10px 12px; }
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

          <div className="rp-step-h"><span className="rp-step-n">1</span> Chọn học sinh{scoped ? ` (Tổ ${effectiveGroup}${isCross ? ' — tổ em đang giám sát tuần này' : ''})` : ''}</div>
          <StudentPicker students={candidates} value={studentId} onChange={setStudentId} scopeGroup={scoped ? effectiveGroup : null} />

          <div className="rp-step-h" style={{ marginTop: 16 }}><span className="rp-step-n">2</span> Chọn nội dung</div>
          {groups.map((g) => (
            <div key={g.kind} style={{ marginBottom: 10 }}>
              <div className="cm-lbl" style={{ marginTop: 0 }}>{g.title}</div>
              <div className="rp-type-grid">
                {g.list.map((t) => (
                  <button key={t.code} type="button" className={`rp-type ${typeCode === t.code ? 'on' : ''}`} onClick={() => { setTypeCode(t.code); setPeriodKey(''); }} aria-pressed={typeCode === t.code}>
                    <span className="rp-type-lbl">{t.label}</span>
                    <span className={`rp-type-pt ${t.points < 0 ? 'neg' : 'pos'}`}>{t.points > 0 ? `+${t.points}` : t.points} điểm</span>
                    {t.dedupe_scope === 'period' && <span className="rp-once">1 lần / tiết</span>}
                    {t.dedupe_scope === 'day' && <span className="rp-once">1 lần / ngày</span>}
                  </button>
                ))}
                {g.kind === 'violation' && (
                  <button type="button" className={`rp-type ${isCustom ? 'on' : ''}`} onClick={() => { setTypeCode('khac'); setPeriodKey(''); }} aria-pressed={isCustom}>
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

          {needPeriod && (
            <>
              <div className="cm-lbl">Việc này xảy ra ở tiết nào? ({periods.length} tiết trong ngày)</div>
              <div className="rp-per-grid">
                {periods.map((p) => {
                  const key = `${p.session}:${p.period}`;
                  const taken = takenPeriod(p);
                  return (
                    <button key={key} type="button" disabled={taken} className={`rp-type ${periodKey === key ? 'on' : ''}`} onClick={() => setPeriodKey(key)} aria-pressed={periodKey === key}>
                      <span className="rp-type-lbl">Tiết {p.period} {SESS[p.session]}</span>
                      <span className="rp-once">{p.subject}{p.teacher ? ` · ${p.teacher}` : ''}</span>
                      {taken && <span className="rp-once" style={{ color: 'var(--cm-bad)' }}>Đã có người ghi</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {noTimetable && (
            <p className="cm-hint" style={{ marginTop: 10 }}>Lớp chưa có thời khóa biểu cho ngày này nên tạm tính “1 lần mỗi ngày”. Khi cô Tổng phụ trách cập nhật thời khóa biểu, em sẽ chọn được tiết.</p>
          )}

          <div className="rp-step-h" style={{ marginTop: 16 }}><span className="rp-step-n">3</span> Ghi chú & ngày</div>
          <label className="cm-lbl" htmlFor="rc-note" style={{ marginTop: 0 }}>Ghi chú (không bắt buộc)</label>
          <input id="rc-note" className="cm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: tiết Toán, đã nhắc 2 lần…" />
          {perms.staff && (
            <>
              <label className="cm-lbl" htmlFor="rc-date">Ngày</label>
              <input id="rc-date" type="date" className="cm-input" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
            </>
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
              {needPeriod && pNo ? ` (tiết ${pNo} ${SESS[pSess]})` : ''}
              {' '}(<b>{isCustom ? -1 : picked?.points > 0 ? `+${picked.points}` : picked?.points} điểm</b>)
            </div>
          )}

          <div className="cm-foot rp-submit">
            <button className="cm-btn cm-btn-main" disabled={busy || !readyToSubmit} onClick={submit}>{busy ? 'Đang ghi…' : '✓ Ghi nhận'}</button>
          </div>
        </div>
      )}

      <div className="cm-card">
        <div className="cm-h"><h3>Ghi nhận tuần này</h3><span className="cm-chip">{fmtIso(monday)} – {fmtIso(addDays(monday, 6))}</span></div>
        {records.length === 0 ? (
          <div className="cm-empty">Chưa có ghi nhận nào trong tuần.</div>
        ) : (
          <div className="rec-list">
            {records.map((r) => (
              <div key={r.id} className="rec-row">
                <div className="rec-top">
                  <div>
                    <div className="rec-name">{r.student_name}</div>
                    <div className="rec-meta">{fmtIso(r.occurred_date)} · {timeVN(r.created_at)} · {r.recorded_by_name || '—'}</div>
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
        )}
      </div>
    </div>
  );
}
