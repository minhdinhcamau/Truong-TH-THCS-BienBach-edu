'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { addDays, fmtIso, mondayOf, timeVN, vnTodayIso } from '@/lib/dates';
import { roleText } from '@/lib/roles';

const KIND_LABEL = { violation: 'Vi phạm', singing: 'Không hát', plus: 'Điểm cộng', cadre_ok: 'Không vi phạm' };

// Ghi nhận trong lớp: mỗi chức vụ chỉ thấy những mục mình được phép ghi (theo perms).
export default function RecordPanel({ classId, students, perms, role, roleGroup, profileId, toast }) {
  const today = vnTodayIso();
  const monday = mondayOf(today);
  const [types, setTypes] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState([]);
  const [cadre, setCadre] = useState([]);

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

  useEffect(() => { loadRecords(); loadCadre(); }, [loadRecords, loadCadre]);

  const allowed = useMemo(
    () => types.filter((t) => (t.perm === 'violation' && perms.violation) || (t.perm === 'singing' && perms.singing) || (t.perm === 'academic' && perms.academic)),
    [types, perms]
  );
  const groups = [
    { kind: 'violation', title: 'Vi phạm trong lớp', list: allowed.filter((t) => t.kind === 'violation') },
    { kind: 'singing', title: 'Không hát (chào cờ, khi Sao đỏ kiểm tra)', list: allowed.filter((t) => t.kind === 'singing') },
    { kind: 'plus', title: 'Điểm cộng (xung phong, điểm 9, 10)', list: allowed.filter((t) => t.kind === 'plus') },
  ].filter((g) => g.list.length > 0);

  // Tổ trưởng / tổ phó chỉ ghi được thành viên trong tổ của mình
  const scoped = !perms.staff && (role === 'to_truong' || role === 'to_pho');
  const candidates = students.filter((s) => !scoped || s.group_no === roleGroup);
  const picked = allowed.find((t) => t.code === typeCode);
  const isCustom = typeCode === 'khac';

  async function submit() {
    if (!studentId || !typeCode) {
      toast({ type: 'error', text: 'Hãy chọn học sinh và mục cần ghi nhận.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('class_add_record', {
      p_class_id: classId, p_student_id: studentId, p_type_code: typeCode,
      p_custom_label: isCustom ? custom : null, p_note: note || null, p_date: date,
    });
    setBusy(false);
    if (error) {
      toast({ type: 'error', text: error.message });
      return;
    }
    const who = students.find((s) => s.student_id === studentId)?.full_name || '';
    toast({ type: 'ok', text: `Đã ghi nhận: ${who} — ${isCustom ? custom : picked?.label}.` });
    setNote('');
    setCustom('');
    setTypeCode('');
    loadRecords();
    loadCadre();
  }

  async function remove(r) {
    if (!window.confirm(`Xoá ghi nhận "${r.label}" của ${r.student_name}?`)) return;
    const { error } = await supabase.rpc('class_delete_record', { p_id: r.id });
    if (error) toast({ type: 'error', text: error.message });
    else { loadRecords(); loadCadre(); }
  }

  async function cadreOk(s) {
    const { error } = await supabase.rpc('class_cadre_ok', { p_class_id: classId, p_student_id: s.student_id, p_date: today });
    if (error) toast({ type: 'error', text: error.message });
    else loadCadre();
  }

  function quickViolation(s) {
    setStudentId(s.student_id);
    setTypeCode(allowed.find((t) => t.kind === 'violation')?.code || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const canDelete = (r) => perms.staff || r.recorded_by === profileId;

  return (
    <>
      {perms.cadre && (
        <div className="cm-card">
          <div className="cm-h"><h3>Kiểm tra ban cán sự hôm nay</h3></div>
          <p className="cm-hint">Ban cán sự cũng phải gương mẫu. Nếu bạn nào không vi phạm hôm nay, bấm “Không vi phạm”; nếu có, bấm “Ghi vi phạm”.</p>
          {cadre.length === 0 ? (
            <div className="cm-empty">Chưa có ban cán sự nào được giao chức vụ.</div>
          ) : (
            <div className="cm-wrap">
              <table className="cm-tbl">
                <tbody>
                  {cadre.map((s) => (
                    <tr key={s.student_id}>
                      <td><b>{s.full_name}</b> <span className="cm-chip">{roleText(s.role, s.group_no)}</span></td>
                      <td>
                        {s.violations > 0 ? <span className="cm-pill bad">{s.violations} vi phạm</span>
                          : s.confirmed_ok ? <span className="cm-pill ok">Không vi phạm ✓</span>
                          : <span className="cm-pill mute">Chưa kiểm tra</span>}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {!s.confirmed_ok && s.violations === 0 && <button className="cm-btn cm-btn-sm cm-btn-ok" onClick={() => cadreOk(s)}>Không vi phạm</button>}{' '}
                        {perms.violation && <button className="cm-btn cm-btn-sm cm-btn-danger" onClick={() => quickViolation(s)}>Ghi vi phạm</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {groups.length > 0 && (
        <div className="cm-card">
          <div className="cm-h"><h3>Ghi nhận mới</h3></div>
          <div className="cm-row" style={{ alignItems: 'flex-end' }}>
            <div className="cm-grow">
              <label className="cm-lbl" htmlFor="rc-stu" style={{ marginTop: 0 }}>Học sinh{scoped ? ` (tổ ${roleGroup})` : ''}</label>
              <select id="rc-stu" className="cm-input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">— Chọn học sinh —</option>
                {candidates.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name}{s.group_no ? ` · Tổ ${s.group_no}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="cm-lbl" htmlFor="rc-date" style={{ marginTop: 0 }}>Ngày</label>
              <input id="rc-date" type="date" className="cm-input" value={date} max={today} min={perms.staff ? undefined : monday} onChange={(e) => setDate(e.target.value || today)} />
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.kind}>
              <div className="cm-lbl">{g.title}</div>
              <div className="cm-chips">
                {g.list.map((t) => (
                  <button
                    key={t.code}
                    className={`cm-btn cm-btn-sm ${typeCode === t.code ? 'cm-btn-main' : ''}`}
                    onClick={() => setTypeCode(t.code)}
                    aria-pressed={typeCode === t.code}
                  >
                    {t.label} <b>{t.points > 0 ? `+${t.points}` : t.points}</b>
                  </button>
                ))}
                {g.kind === 'violation' && (
                  <button className={`cm-btn cm-btn-sm ${isCustom ? 'cm-btn-main' : ''}`} onClick={() => setTypeCode('khac')} aria-pressed={isCustom}>Vi phạm khác… <b>-1</b></button>
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
          <label className="cm-lbl" htmlFor="rc-note">Ghi chú (không bắt buộc)</label>
          <input id="rc-note" className="cm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: tiết Toán, đã nhắc 2 lần…" />
          <div className="cm-foot">
            <button className="cm-btn cm-btn-main" disabled={busy || !studentId || !typeCode} onClick={submit}>{busy ? 'Đang ghi…' : 'Ghi nhận'}</button>
          </div>
        </div>
      )}

      <div className="cm-card">
        <div className="cm-h"><h3>Ghi nhận tuần này ({fmtIso(monday)} – {fmtIso(addDays(monday, 6))})</h3></div>
        {records.length === 0 ? (
          <div className="cm-empty">Chưa có ghi nhận nào trong tuần.</div>
        ) : (
          <div className="cm-wrap">
            <table className="cm-tbl">
              <thead><tr><th>Ngày</th><th>Học sinh</th><th>Nội dung</th><th>Điểm</th><th>Người ghi</th><th></th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="cm-num">{fmtIso(r.occurred_date)}<div className="cm-hint" style={{ margin: 0 }}>{timeVN(r.created_at)}</div></td>
                    <td><b>{r.student_name}</b></td>
                    <td>
                      <span className={`cm-pill ${r.kind === 'plus' ? 'ok' : r.kind === 'cadre_ok' ? 'mute' : 'bad'}`}>{KIND_LABEL[r.kind]}</span> {r.label}
                      {r.note ? <div className="cm-hint" style={{ margin: 0 }}>{r.note}</div> : null}
                    </td>
                    <td className="cm-num" style={{ fontWeight: 800, color: r.points < 0 ? 'var(--cm-bad)' : r.points > 0 ? 'var(--cm-ok)' : 'inherit' }}>{r.points > 0 ? `+${r.points}` : r.points}</td>
                    <td>{r.recorded_by_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{canDelete(r) && <button className="cm-btn cm-btn-sm cm-btn-danger" onClick={() => remove(r)}>Xoá</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
