'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { addDays, fmtDate, mondayOf, vnTodayIso, weekdaysForMonday } from '@/lib/dates';

const AREAS = [
  { key: 'trong_lop', title: 'Lao động trong lớp', icon: '🧹' },
  { key: 'ngoai_san', title: 'Lao động ngoài sân', icon: '🌳' },
];

function pickDay(days) {
  const today = days.find((d) => d.isToday);
  if (today) return today.iso;
  const past = days.filter((d) => !d.isFuture);
  return (past.length ? past[past.length - 1] : days[0]).iso;
}

// Kiểm tra lao động: các bạn được phân công trực (do trợ lý xếp hoặc tự chọn) tự hiện ra theo từng khu vực,
// ban cán sự chỉ bấm "Không trực" ở bạn nào vắng; các bạn còn lại mặc định là đã trực.
// Tổ trưởng, tổ phó chỉ thấy và ghi nhận các bạn trong tổ của mình. Người ghi sau thấy "Đã có người ghi trước".
export default function LaborPanel({ classId, students, perms, role, roleGroup, toast }) {
  const today = vnTodayIso();
  const thisMonday = mondayOf(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const monday = addDays(thisMonday, weekOffset * 7);
  const days = useMemo(() => weekdaysForMonday(monday), [monday]);
  const [date, setDate] = useState(() => pickDay(weekdaysForMonday(thisMonday)));
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [yard, setYard] = useState('');
  const [yardNote, setYardNote] = useState('');

  const scopedGroup = !perms.staff && (role === 'to_truong' || role === 'to_pho') ? roleGroup : null;
  const nameOf = useMemo(() => new Map(students.map((s) => [s.student_id, s])), [students]);

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
  }, [classId, date]);

  useEffect(() => { load(); }, [load]);

  const inScope = (groupNo) => !scopedGroup || groupNo === scopedGroup;

  // Danh sách từng khu vực: những người được phân công + những người đã bị ghi nhận (kể cả khi lịch trực đã đổi)
  const rowsOf = (area) => {
    const assigned = (data?.on_duty || []).filter((d) => (d.area || 'trong_lop') === area && inScope(d.group_no));
    const marks = (data?.members || []).filter((m) => m.area === area && inScope(m.group_no));
    const list = assigned.map((d) => ({
      student_id: d.student_id, full_name: d.full_name, group_no: d.group_no,
      mark: marks.find((m) => m.student_id === d.student_id) || null, assigned: true,
    }));
    marks.forEach((m) => {
      if (!list.some((x) => x.student_id === m.student_id)) {
        list.push({ student_id: m.student_id, full_name: m.full_name, group_no: m.group_no, mark: m, assigned: false });
      }
    });
    return list;
  };

  async function markAbsent(area, studentId) {
    setBusyId(`${area}:${studentId}`);
    const { error } = await supabase.rpc('class_labor_mark_member', {
      p_class_id: classId, p_date: date, p_area: area, p_student_id: studentId, p_status: 'khong_truc', p_note: null,
    });
    setBusyId('');
    if (error) toast({ type: 'error', text: error.message });
    else toast({ type: 'ok', text: `Đã ghi nhận: ${nameOf.get(studentId)?.full_name || 'bạn'} không trực.` });
    load(); // dù lỗi (có thể đã có người ghi trước) vẫn tải lại để thấy ngay
  }

  async function undo(m) {
    if (!window.confirm(`Bỏ ghi nhận “không trực” của ${m.full_name}?`)) return;
    const { error } = await supabase.rpc('class_labor_unmark_member', { p_id: m.id });
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
          Các bạn được phân công trực hôm nay tự hiện ở dưới. Chỉ bấm “Không trực” ở bạn nào vắng; các bạn còn lại mặc định là đã trực.
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
          {data?.can_set_yard && (
            <p className="cm-hint" style={{ marginTop: 6 }}>Sau khi lưu khu vực, lớp phó lao động bấm “Trợ lý đề xuất lịch” ở mục Trực nhật là các bạn được tự chia ra sân.</p>
          )}
        </div>
      </div>

      {AREAS.map((a) => {
        const list = rowsOf(a.key);
        const absent = list.filter((x) => x.mark).length;
        const noYard = a.key === 'ngoai_san' && !data?.yard_area;
        return (
          <div className="cm-card" key={a.key}>
            <div className="cm-h">
              <h3>{a.icon} {a.title}</h3>
              {list.length > 0
                ? <span className={`cm-pill ${absent ? 'bad' : 'ok'}`}>{absent ? `${absent}/${list.length} bạn không trực` : `${list.length} bạn trực đủ`}</span>
                : <span className="cm-pill mute">Chưa có lịch</span>}
            </div>
            {a.key === 'ngoai_san' && data?.yard_area ? <div className="cm-hint">Khu vực: {data.yard_area}</div> : null}

            {noYard && list.length === 0 ? (
              <div className="cm-empty">Lớp chưa được Tổng phụ trách phân khu vực ngoài sân tuần này.</div>
            ) : list.length === 0 ? (
              <div className="cm-empty">
                Hôm nay chưa có bạn nào được phân công{a.key === 'ngoai_san' ? ' ra sân' : ''}.
                {perms.duty ? ' Hãy xếp lịch ở mục Trực nhật.' : ' Lớp phó lao động sẽ xếp lịch ở mục Trực nhật.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {list.map((x) => (
                  <div
                    key={x.student_id}
                    className="cm-row"
                    style={{
                      justifyContent: 'space-between', flexWrap: 'nowrap', border: '1px solid var(--cm-line)', borderRadius: 12, padding: '10px 12px',
                      background: x.mark ? '#fff6f5' : '#fff',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {x.full_name} {x.group_no ? <span className="cm-chip" style={{ padding: '0 7px' }}>T{x.group_no}</span> : null}
                      </div>
                      {x.mark ? (
                        <div className="cm-hint" style={{ margin: 0, fontSize: 11.5 }}>
                          Ghi bởi {x.mark.by_name || '—'}{x.mark.by_role ? ` (${x.mark.by_role})` : ''}{x.mark.note ? ` · ${x.mark.note}` : ''}
                        </div>
                      ) : !x.assigned ? null : (
                        <div className="cm-hint" style={{ margin: 0, fontSize: 11.5 }}>Được phân công</div>
                      )}
                    </div>
                    {x.mark ? (
                      <div className="cm-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <span className="cm-pill bad">Không trực</span>
                        <button className="cm-btn cm-btn-sm" onClick={() => undo(x.mark)} aria-label={`Bỏ ghi nhận của ${x.full_name}`}>Bỏ</button>
                      </div>
                    ) : (
                      <button
                        className="cm-btn cm-btn-sm cm-btn-danger"
                        style={{ minHeight: 38, padding: '6px 14px' }}
                        disabled={busyId === `${a.key}:${x.student_id}`}
                        onClick={() => markAbsent(a.key, x.student_id)}
                      >
                        Không trực
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
