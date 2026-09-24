'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { addDays, fmtDate, fmtIso, mondayOf, vnTodayIso } from '@/lib/dates';
import { MODES, missingReasons, planDuty } from '@/lib/dutyPlanner';

const WEEKDAYS = [2, 3, 4, 5, 6, 7];
const STATUS = { tot: ['Trực tốt', 'ok'], chua_tot: ['Chưa tốt', 'warn'], khong_truc: ['Không trực', 'bad'] };
const SOURCE = { manual: 'Tự chọn', ai_group: 'Trợ lý: theo điểm tổ', ai_violators: 'Trợ lý: người vi phạm', rotation: 'Trợ lý: xoay vòng tổ' };

// Lịch trực nhật của lớp. Lớp phó lao động / lớp trưởng / GVCN xếp lịch; tổ trưởng, tổ phó ghi nhận tổ trực.
export default function DutyPanel({ classId, students, perms, role, roleGroup, toast }) {
  const today = vnTodayIso();
  const thisMonday = mondayOf(today);
  const [weekStart, setWeekStart] = useState(thisMonday);
  const [saved, setSaved] = useState([]);
  const [logs, setLogs] = useState([]);
  const [mode, setMode] = useState('group_low');
  const [wds, setWds] = useState([2, 3, 4, 5, 6]);
  const [perDay, setPerDay] = useState(4);
  const [plan, setPlan] = useState(null); // null = chưa soạn
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState({}); // date -> { g, sid }

  const days = useMemo(
    () => wds.slice().sort((a, b) => a - b).map((wd) => ({ date: addDays(weekStart, wd - 2), weekday: wd, label: `Thứ ${wd}` })),
    [wds, weekStart]
  );

  const load = useCallback(async () => {
    const to = addDays(weekStart, 6);
    const [d, l] = await Promise.all([
      supabase.rpc('class_get_duty', { p_class_id: classId, p_from: weekStart, p_to: to }),
      supabase.rpc('class_get_duty_logs', { p_class_id: classId, p_from: weekStart, p_to: to }),
    ]);
    setSaved(d.data || []);
    setLogs(l.data || []);
  }, [classId, weekStart]);

  useEffect(() => { setPlan(null); load(); }, [load]);

  const missing = plan ? missingReasons(plan) : [];
  const groupNos = useMemo(() => Array.from(new Set(students.map((s) => s.group_no).filter(Boolean))).sort((a, b) => a - b), [students]);

  async function propose() {
    setBusy(true);
    const { data, error } = await supabase.rpc('class_planner_data', { p_class_id: classId, p_week_start: weekStart });
    setBusy(false);
    if (error) {
      toast({ type: 'error', text: error.message });
      return;
    }
    const res = planDuty({ mode, members: data.members, days, perDay: Number(perDay) || 4, lastWeekDuty: data.last_week_duty });
    setPlan(res.rows);
    setWarnings(res.warnings);
  }

  function startManual() {
    setPlan(saved.map((r) => ({
      date: r.duty_date, label: `Thứ ${new Date(`${r.duty_date}T00:00:00Z`).getUTCDay() + 1}`, student_id: r.student_id,
      name: r.full_name, group_no: r.group_no, source: r.source, reason: r.reason || '',
    })));
    setWarnings([]);
  }

  function addPerson(day) {
    const st = add[day.date] || {};
    const s = students.find((x) => x.student_id === st.sid);
    if (!s) return;
    if (plan.some((r) => r.date === day.date && r.student_id === s.student_id)) {
      toast({ type: 'error', text: `${s.full_name} đã có trong ${day.label}.` });
      return;
    }
    setPlan([...plan, { date: day.date, label: day.label, student_id: s.student_id, name: s.full_name, group_no: s.group_no || null, source: 'manual', reason: '' }]);
    setAdd({ ...add, [day.date]: { ...st, sid: '' } });
  }

  const setReason = (i, v) => setPlan(plan.map((r, k) => (k === i ? { ...r, reason: v } : r)));
  const removeRow = (i) => setPlan(plan.filter((_, k) => k !== i));

  async function save() {
    setBusy(true);
    const { data, error } = await supabase.rpc('class_save_duty', {
      p_class_id: classId, p_week_start: weekStart,
      p_rows: plan.map((r) => ({ date: r.date, student_id: r.student_id, group_no: r.group_no, source: r.source, reason: r.reason })),
    });
    setBusy(false);
    if (error) {
      toast({ type: 'error', text: error.message });
      return;
    }
    toast({ type: 'ok', text: `Đã lưu lịch trực (${data} lượt).` });
    setPlan(null);
    load();
  }

  async function log(date, g, status) {
    const { error } = await supabase.rpc('class_log_duty', { p_class_id: classId, p_date: date, p_group_no: g, p_status: status, p_note: null });
    if (error) toast({ type: 'error', text: error.message });
    else load();
  }

  // Lịch đã lưu, gom theo ngày
  const savedDays = useMemo(() => {
    const m = new Map();
    saved.forEach((r) => { if (!m.has(r.duty_date)) m.set(r.duty_date, []); m.get(r.duty_date).push(r); });
    return Array.from(m.entries());
  }, [saved]);
  const logOf = (date, g) => logs.find((l) => l.duty_date === date && l.group_no === g);
  const scopedGroup = !perms.staff && (role === 'to_truong' || role === 'to_pho') ? roleGroup : null;

  return (
    <>
      <div className="cm-card">
        <div className="cm-h">
          <h3>Lịch trực nhật — tuần {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}</h3>
          <div className="cm-row" style={{ gap: 6 }}>
            <button className={`cm-btn cm-btn-sm ${weekStart === thisMonday ? 'cm-btn-main' : ''}`} onClick={() => setWeekStart(thisMonday)}>Tuần này</button>
            <button className={`cm-btn cm-btn-sm ${weekStart === addDays(thisMonday, 7) ? 'cm-btn-main' : ''}`} onClick={() => setWeekStart(addDays(thisMonday, 7))}>Tuần sau</button>
          </div>
        </div>
        {savedDays.length === 0 ? (
          <div className="cm-empty">Chưa có lịch trực cho tuần này.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            {savedDays.map(([date, list]) => {
              const gs = Array.from(new Set(list.map((r) => r.group_no).filter(Boolean))).sort((a, b) => a - b);
              return (
                <div key={date} style={{ border: '1px solid var(--cm-line)', borderRadius: 12, padding: 10, background: date === today ? '#fff8f7' : '#fff' }}>
                  <div style={{ fontWeight: 800 }}>{fmtIso(date)}{date === today ? ' •' : ''}</div>
                  {list.map((r) => (
                    <div key={r.id} style={{ fontSize: 13, padding: '2px 0' }} title={r.reason || ''}>
                      {r.full_name} {r.group_no ? <span className="cm-chip" style={{ padding: '0 7px' }}>T{r.group_no}</span> : null}
                      {r.reason ? <div className="cm-hint" style={{ margin: 0, fontSize: 11.5 }}>{r.reason}</div> : null}
                    </div>
                  ))}
                  {perms.dutyLog && date <= today && gs.filter((g) => !scopedGroup || g === scopedGroup).map((g) => {
                    const lg = logOf(date, g);
                    return (
                      <div key={g} style={{ marginTop: 8, borderTop: '1px dashed var(--cm-line)', paddingTop: 6 }}>
                        <div className="cm-hint" style={{ margin: '0 0 4px' }}>Ghi nhận Tổ {g}: {lg ? <span className={`cm-pill ${STATUS[lg.status][1]}`}>{STATUS[lg.status][0]}</span> : 'chưa ghi'}</div>
                        <div className="cm-chips">
                          {Object.entries(STATUS).map(([k, [label]]) => (
                            <button key={k} className={`cm-btn cm-btn-sm ${lg?.status === k ? 'cm-btn-main' : ''}`} onClick={() => log(date, g, k)}>{label}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {perms.duty && (
        <div className="cm-card">
          <div className="cm-h"><h3>Xếp lịch trực nhật</h3></div>
          <div className="cm-lbl" style={{ marginTop: 0 }}>Cách xếp</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {MODES.map((m) => (
              <label key={m.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, cursor: 'pointer' }}>
                <input type="radio" name="duty-mode" checked={mode === m.key} onChange={() => { setMode(m.key); setPlan(null); }} style={{ marginTop: 4 }} />
                {m.label}
              </label>
            ))}
          </div>

          <div className="cm-row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
            <div>
              <div className="cm-lbl" style={{ marginTop: 0 }}>Các ngày trực</div>
              <div className="cm-chips">
                {WEEKDAYS.map((wd) => (
                  <button key={wd} className={`cm-btn cm-btn-sm ${wds.includes(wd) ? 'cm-btn-main' : ''}`} aria-pressed={wds.includes(wd)}
                    onClick={() => { setWds(wds.includes(wd) ? wds.filter((x) => x !== wd) : [...wds, wd]); setPlan(null); }}>
                    Thứ {wd}
                  </button>
                ))}
              </div>
            </div>
            {mode !== 'manual' && (
              <div>
                <label className="cm-lbl" htmlFor="dp-per" style={{ marginTop: 0 }}>Số bạn / ngày</label>
                <input id="dp-per" type="number" min={1} max={15} className="cm-input" style={{ width: 90 }} value={perDay} onChange={(e) => setPerDay(e.target.value)} />
              </div>
            )}
            {mode === 'manual'
              ? <button className="cm-btn cm-btn-main" onClick={startManual}>Bắt đầu chọn</button>
              : <button className="cm-btn cm-btn-main" disabled={busy} onClick={propose}>{busy ? 'Đang tính…' : '✨ Trợ lý đề xuất lịch'}</button>}
          </div>
          <p className="cm-hint" style={{ marginTop: 8 }}>
            Trợ lý dựa vào điểm và vi phạm của lớp (mục Ghi nhận) để đề xuất kèm lý do; bạn xem, chỉnh rồi mới lưu. Bạn nào trực từ 2 lần trong tuần bắt buộc phải có lý do.
          </p>

          {plan && (
            <div style={{ marginTop: 10 }}>
              {warnings.map((w) => <div key={w} className="cm-pill warn" style={{ display: 'block', margin: '4px 0', whiteSpace: 'normal' }}>⚠ {w}</div>)}
              {days.map((day) => {
                const rows = plan.map((r, i) => ({ r, i })).filter((x) => x.r.date === day.date);
                const st = add[day.date] || {};
                const pool = students.filter((s) => !st.g || s.group_no === Number(st.g));
                return (
                  <div key={day.date} style={{ border: '1px solid var(--cm-line)', borderRadius: 12, padding: 12, marginTop: 10 }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>{fmtIso(day.date)} · {rows.length} bạn</div>
                    {rows.length === 0 && <div className="cm-hint">Chưa có ai.</div>}
                    {rows.map(({ r, i }) => {
                      const need = missing.some((m) => m.student_id === r.student_id) && !String(r.reason).trim();
                      return (
                        <div key={i} className="cm-row" style={{ marginBottom: 6, alignItems: 'flex-start' }}>
                          <div style={{ width: 170, fontWeight: 700, fontSize: 13.5 }}>
                            {r.name} {r.group_no ? <span className="cm-chip" style={{ padding: '0 7px' }}>T{r.group_no}</span> : null}
                            <div className="cm-hint" style={{ margin: 0, fontSize: 11 }}>{SOURCE[r.source]}</div>
                          </div>
                          <input
                            className="cm-input cm-grow"
                            style={need ? { borderColor: 'var(--cm-bad)', background: '#fff6f5' } : undefined}
                            value={r.reason}
                            onChange={(e) => setReason(i, e.target.value)}
                            placeholder="Lý do sắp xếp (bắt buộc nếu trực từ 2 lần)"
                            aria-label={`Lý do của ${r.name}`}
                          />
                          <button className="cm-btn cm-btn-sm cm-btn-danger" onClick={() => removeRow(i)} aria-label={`Bỏ ${r.name}`}>✕</button>
                        </div>
                      );
                    })}
                    <div className="cm-row" style={{ marginTop: 6 }}>
                      <select className="cm-input" style={{ width: 110 }} value={st.g || ''} onChange={(e) => setAdd({ ...add, [day.date]: { g: e.target.value, sid: '' } })} aria-label="Lọc theo tổ">
                        <option value="">Mọi tổ</option>
                        {groupNos.map((g) => <option key={g} value={g}>Tổ {g}</option>)}
                      </select>
                      <select className="cm-input cm-grow" value={st.sid || ''} onChange={(e) => setAdd({ ...add, [day.date]: { ...st, sid: e.target.value } })} aria-label="Chọn thành viên">
                        <option value="">— Thêm bạn vào {day.label} —</option>
                        {pool.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name}{s.group_no ? ` · Tổ ${s.group_no}` : ''}</option>)}
                      </select>
                      <button className="cm-btn cm-btn-sm" disabled={!st.sid} onClick={() => addPerson(day)}>＋ Thêm</button>
                    </div>
                  </div>
                );
              })}
              {missing.length > 0 && (
                <div className="cm-pill bad" style={{ display: 'block', marginTop: 10, whiteSpace: 'normal' }}>
                  Cần điền lý do cho các bạn trực từ 2 lần: {missing.map((m) => `${m.name} (${m.count} lần)`).join(', ')}.
                </div>
              )}
              <div className="cm-foot">
                <button className="cm-btn" onClick={() => setPlan(null)}>Bỏ bản nháp</button>
                <button className="cm-btn cm-btn-main" disabled={busy || missing.length > 0 || plan.length === 0} onClick={save}>{busy ? 'Đang lưu…' : `Lưu lịch trực (${plan.length} lượt)`}</button>
              </div>
            </div>
          )}
        </div>
      )}

    </>
  );
}
