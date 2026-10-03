'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { addDays, fmtDate, mondayOf, vnTodayIso, weekdaysForMonday } from '@/lib/dates';

const AREAS = [
  { key: 'trong_lop', title: 'Lao động trong lớp', icon: '🧹' },
  { key: 'ngoai_san', title: 'Lao động ngoài sân', icon: '🌳' },
];
const DAY_STATUS = {
  co: ['Có lao động', 'ok'],
  chua_du: ['Làm chưa đủ', 'warn'],
  khong: ['Không lao động', 'bad'],
};
const MEMBER_STATUS = {
  chua_tot: ['Trực chưa tốt', 'warn'],
  khong_truc: ['Không trực', 'bad'],
};

function pickDay(days) {
  const today = days.find((d) => d.isToday);
  if (today) return today.iso;
  const past = days.filter((d) => !d.isFuture);
  return (past.length ? past[past.length - 1] : days[0]).iso;
}

// Kiểm tra lao động: cả lớp (trong lớp, ngoài sân) và từng em trực chưa tốt / không trực.
// Lớp trưởng, lớp phó lao động, giáo viên ghi nhận cả lớp; mọi ban cán sự ghi nhận từng em
// (tổ trưởng, tổ phó chỉ ghi nhận các bạn trong tổ của mình).
export default function LaborPanel({ classId, students, perms, role, roleGroup, toast }) {
  const today = vnTodayIso();
  const thisMonday = mondayOf(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const monday = addDays(thisMonday, weekOffset * 7);
  const days = useMemo(() => weekdaysForMonday(monday), [monday]);
  const [date, setDate] = useState(() => pickDay(weekdaysForMonday(thisMonday)));
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dayNote, setDayNote] = useState({});
  const [mark, setMark] = useState({});
  const [yard, setYard] = useState('');
  const [yardNote, setYardNote] = useState('');

  const scopedGroup = !perms.staff && (role === 'to_truong' || role === 'to_pho') ? roleGroup : null;
  const pool = useMemo(
    () => students.filter((s) => !scopedGroup || s.group_no === scopedGroup),
    [students, scopedGroup]
  );

  useEffect(() => {
    if (!days.some((d) => d.iso === date)) setDate(pickDay(days));
  }, [days, date]);

  const load = useCallback(async () => {
    const { data: res, error } = await supabase.rpc('class_labor_get', { p_class_id: classId, p_date: date });
    if (error) {
      toast({ type: 'error', text: error.message });
      return;
    }
    setData(res);
    setYard(res?.yard_area || '');
    setYardNote(res?.yard_note || '');
    const notes = {};
    (res?.days || []).forEach((d) => { notes[d.area] = d.note || ''; });
    setDayNote(notes);
  }, [classId, date]);

  useEffect(() => { load(); }, [load]);

  const dayOf = (area) => (data?.days || []).find((d) => d.area === area);
  const membersOf = (area) => (data?.members || []).filter((m) => m.area === area);
  const onDuty = (data?.on_duty || []).filter((d) => !scopedGroup || d.group_no === scopedGroup);

  async function setDay(area, status) {
    setBusy(true);
    const { error } = await supabase.rpc('class_labor_set_day', {
      p_class_id: classId, p_date: date, p_area: area, p_status: status, p_note: dayNote[area] || null,
    });
    setBusy(false);
    if (error) toast({ type: 'error', text: error.message });
    else { toast({ type: 'ok', text: 'Đã ghi nhận.' }); load(); }
  }

  async function addMember(area) {
    const m = mark[area] || {};
    if (!m.sid) return;
    setBusy(true);
    const { error } = await supabase.rpc('class_labor_mark_member', {
      p_class_id: classId, p_date: date, p_area: area, p_student_id: m.sid,
      p_status: m.status || 'chua_tot', p_note: m.note || null,
    });
    setBusy(false);
    if (error) {
      toast({ type: 'error', text: error.message });
      load(); // có thể đã có người ghi trước: tải lại để thấy ngay
      return;
    }
    toast({ type: 'ok', text: 'Đã ghi nhận.' });
    setMark({ ...mark, [area]: { status: m.status || 'chua_tot', sid: '', note: '' } });
    load();
  }

  async function removeMember(id) {
    const { error } = await supabase.rpc('class_labor_unmark_member', { p_id: id });
    if (error) toast({ type: 'error', text: error.message });
    else load();
  }

  async function saveYard() {
    setBusy(true);
    const { error } = await supabase.rpc('class_set_yard_area', {
      p_class_id: classId, p_week_start: data.week_start, p_area_name: yard, p_note: yardNote || null,
    });
    setBusy(false);
    if (error) toast({ type: 'error', text: error.message });
    else { toast({ type: 'ok', text: 'Đã lưu khu vực ngoài sân.' }); load(); }
  }

  return (
    <>
      <div className="cm-card">
        <div className="cm-h">
          <h3>Kiểm tra lao động</h3>
          {perms.staff && (
            <div className="cm-row" style={{ gap: 6 }}>
              <button className={`cm-btn cm-btn-sm ${weekOffset === 0 ? 'cm-btn-main' : ''}`} onClick={() => setWeekOffset(0)}>Tuần này</button>
              <button className={`cm-btn cm-btn-sm ${weekOffset === -1 ? 'cm-btn-main' : ''}`} onClick={() => setWeekOffset(-1)}>Tuần trước</button>
            </div>
          )}
        </div>
        <div className="cm-chips" role="group" aria-label="Chọn ngày">
          {days.map((d) => (
            <button
              key={d.iso}
              className={`cm-btn cm-btn-sm ${date === d.iso ? 'cm-btn-main' : ''}`}
              aria-pressed={date === d.iso}
              disabled={d.isFuture}
              onClick={() => setDate(d.iso)}
            >
              {d.label} {d.shortLabel}
            </button>
          ))}
        </div>
        <p className="cm-hint" style={{ marginTop: 8 }}>
          Chỉ có Thứ 2 đến Thứ 6. Chỉ ghi những bạn trực chưa tốt hoặc không trực; các bạn còn lại mặc định là trực tốt.
        </p>

        <div style={{ borderTop: '1px dashed var(--cm-line)', paddingTop: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>
            Khu vực ngoài sân tuần {data?.week_start ? fmtDate(data.week_start) : ''}:{' '}
            {data?.yard_area ? <span className="cm-chip">{data.yard_area}</span> : <span className="cm-pill mute">Chưa được phân công</span>}
          </div>
          {data?.yard_note ? <div className="cm-hint" style={{ margin: '4px 0 0' }}>{data.yard_note}</div> : null}
          {data?.can_set_yard && (
            <div className="cm-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
              <div className="cm-grow">
                <label className="cm-lbl" htmlFor="yard-name" style={{ marginTop: 0 }}>Tổng phụ trách phân công khu vực</label>
                <input id="yard-name" className="cm-input" value={yard} onChange={(e) => setYard(e.target.value)} placeholder="Ví dụ: Sân trường phía sau dãy A" />
              </div>
              <div className="cm-grow">
                <label className="cm-lbl" htmlFor="yard-note" style={{ marginTop: 0 }}>Ghi chú (không bắt buộc)</label>
                <input id="yard-note" className="cm-input" value={yardNote} onChange={(e) => setYardNote(e.target.value)} />
              </div>
              <button className="cm-btn cm-btn-main" disabled={busy} onClick={saveYard}>Lưu khu vực</button>
            </div>
          )}
        </div>
      </div>

      {AREAS.map((a) => {
        const dd = dayOf(a.key);
        const marked = membersOf(a.key);
        const m = mark[a.key] || { status: 'chua_tot', sid: '', note: '' };
        const free = pool.filter((s) => !marked.some((x) => x.student_id === s.student_id));
        const quick = onDuty.filter((p) => !marked.some((x) => x.student_id === p.student_id));
        return (
          <div className="cm-card" key={a.key}>
            <div className="cm-h">
              <h3>{a.icon} {a.title}</h3>
              {dd
                ? <span className={`cm-pill ${DAY_STATUS[dd.status][1]}`}>{DAY_STATUS[dd.status][0]}</span>
                : <span className="cm-pill mute">Chưa ghi</span>}
            </div>
            {a.key === 'ngoai_san' && data?.yard_area ? <div className="cm-hint">Khu vực: {data.yard_area}</div> : null}

            {perms.duty ? (
              <>
                <div className="cm-lbl" style={{ marginTop: 0 }}>Cả lớp hôm nay</div>
                <div className="cm-chips">
                  {Object.entries(DAY_STATUS).map(([k, [label]]) => (
                    <button key={k} disabled={busy} className={`cm-btn cm-btn-sm ${dd?.status === k ? 'cm-btn-main' : ''}`} onClick={() => setDay(a.key, k)}>{label}</button>
                  ))}
                </div>
                <input
                  className="cm-input"
                  style={{ marginTop: 8 }}
                  value={dayNote[a.key] || ''}
                  onChange={(e) => setDayNote({ ...dayNote, [a.key]: e.target.value })}
                  placeholder="Ghi chú cho cả lớp (nhập trước khi bấm trạng thái)"
                  aria-label={`Ghi chú ${a.title}`}
                />
              </>
            ) : (
              dd?.note ? <div className="cm-hint">Ghi chú: {dd.note}</div> : null
            )}
            {dd?.by_name ? <div className="cm-hint" style={{ marginTop: 6 }}>Ghi bởi {dd.by_name}</div> : null}

            <div className="cm-lbl">Bạn không trực hoặc trực chưa tốt</div>
            {quick.length > 0 && (
              <div className="cm-hint" style={{ margin: '0 0 6px' }}>
                Người được phân công trực hôm nay (bấm để chọn):{' '}
                <span className="cm-chips" style={{ display: 'inline-flex' }}>
                  {quick.map((p) => (
                    <button key={p.student_id} className="cm-btn cm-btn-sm" onClick={() => setMark({ ...mark, [a.key]: { ...m, sid: p.student_id } })}>{p.full_name}</button>
                  ))}
                </span>
              </div>
            )}
            <div className="cm-row">
              <select className="cm-input cm-grow" value={m.sid} onChange={(e) => setMark({ ...mark, [a.key]: { ...m, sid: e.target.value } })} aria-label="Chọn bạn">
                <option value="">— Chọn bạn —</option>
                {free.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name}{s.group_no ? ` · Tổ ${s.group_no}` : ''}</option>)}
              </select>
              <select className="cm-input" style={{ width: 160 }} value={m.status} onChange={(e) => setMark({ ...mark, [a.key]: { ...m, status: e.target.value } })} aria-label="Tình trạng">
                {Object.entries(MEMBER_STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div className="cm-row" style={{ marginTop: 8 }}>
              <input className="cm-input cm-grow" value={m.note} onChange={(e) => setMark({ ...mark, [a.key]: { ...m, note: e.target.value } })} placeholder="Ghi chú (ví dụ: bỏ về sớm, không quét)" aria-label="Ghi chú" />
              <button className="cm-btn cm-btn-main" disabled={busy || !m.sid} onClick={() => addMember(a.key)}>＋ Ghi nhận</button>
            </div>

            {marked.length === 0 ? (
              <div className="cm-empty">Chưa có bạn nào bị ghi nhận.</div>
            ) : (
              <div className="cm-wrap" style={{ marginTop: 10 }}>
                <table className="cm-tbl">
                  <thead><tr><th>Bạn</th><th>Tình trạng</th><th>Ghi chú</th><th>Người ghi</th><th /></tr></thead>
                  <tbody>
                    {marked.map((x) => (
                      <tr key={x.id}>
                        <td><b>{x.full_name}</b> {x.group_no ? <span className="cm-chip" style={{ padding: '0 7px' }}>T{x.group_no}</span> : null}</td>
                        <td><span className={`cm-pill ${MEMBER_STATUS[x.status][1]}`}>{MEMBER_STATUS[x.status][0]}</span></td>
                        <td>{x.note || '—'}</td>
                        <td>{x.by_name || '—'}{x.by_role ? <div className="cm-hint" style={{ margin: 0, fontSize: 11 }}>{x.by_role}</div> : null}</td>
                        <td><button className="cm-btn cm-btn-sm cm-btn-danger" onClick={() => removeMember(x.id)} aria-label={`Xóa ghi nhận của ${x.full_name}`}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
