'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { addDays, fmtDate, fmtIso, mondayOf, vnTodayIso } from '@/lib/dates';

const PERIODS = [
  { key: 'week', label: 'Tuần này' },
  { key: 'last', label: 'Tuần trước' },
  { key: 'month', label: '30 ngày gần đây' },
];
const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'violation', label: 'Vi phạm' },
  { key: 'singing', label: 'Không hát' },
  { key: 'labor', label: 'Trực nhật, lao động' },
];
const LABOR_STATUS = {
  chua_tot: 'Chưa tốt',
  khong_truc: 'Không trực',
  chua_du: 'Làm chưa đủ',
  khong: 'Không lao động',
};
const TYPE_LABEL = { violation: 'Vi phạm', singing: 'Không hát', labor_member: 'Lao động', duty_group: 'Tổ trực nhật', labor_day: 'Cả lớp' };

const isLabor = (t) => t === 'labor_member' || t === 'duty_group' || t === 'labor_day';

function rangeOf(key) {
  const today = vnTodayIso();
  const monday = mondayOf(today);
  if (key === 'last') return [addDays(monday, -7), addDays(monday, -1)];
  if (key === 'month') return [addDays(today, -29), today];
  return [monday, today];
}

function pillClass(r) {
  if (r.entry_type === 'violation') return 'bad';
  if (r.entry_type === 'singing') return 'warn';
  return r.status === 'khong_truc' || r.status === 'khong' ? 'bad' : 'warn';
}

function Entry({ r }) {
  const detail = r.entry_type === 'violation' || r.entry_type === 'singing'
    ? `${r.label}${r.points ? ` (${Number(r.points) > 0 ? '+' : ''}${Number(r.points)} điểm)` : ''}`
    : `${r.label}${r.status ? ` — ${LABOR_STATUS[r.status] || r.status}` : ''}`;
  return (
    <tr>
      <td className="cm-num" style={{ whiteSpace: 'nowrap' }}>{fmtIso(r.event_date)}</td>
      <td><span className={`cm-pill ${pillClass(r)}`}>{TYPE_LABEL[r.entry_type] || r.entry_type}</span></td>
      <td>
        {detail}
        {r.note ? <div className="cm-hint" style={{ margin: 0 }}>{r.note}</div> : null}
      </td>
      <td>{r.by_name || '—'}{r.by_role ? <div className="cm-hint" style={{ margin: 0, fontSize: 11 }}>{r.by_role}</div> : null}</td>
    </tr>
  );
}

function EntryTable({ rows }) {
  return (
    <div className="cm-wrap">
      <table className="cm-tbl">
        <thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th>Người ghi</th></tr></thead>
        <tbody>{rows.map((r, i) => <Entry key={`${r.event_date}-${r.created_at}-${i}`} r={r} />)}</tbody>
      </table>
    </div>
  );
}

// Nhật ký theo tổ cho giáo viên: từng tổ có những bạn nào vi phạm, không hát, trực nhật / lao động chưa tốt.
export default function GroupJournal({ classId, toast }) {
  const [period, setPeriod] = useState('week');
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, to] = rangeOf(period);

  const load = useCallback(async () => {
    setLoading(true);
    const [f, t] = rangeOf(period);
    const { data, error } = await supabase.rpc('class_group_journal', { p_class_id: classId, p_from: f, p_to: t });
    setLoading(false);
    if (error) {
      toast({ type: 'error', text: error.message });
      setRows([]);
      return;
    }
    setRows(data || []);
  }, [classId, period]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => rows.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'labor') return isLabor(r.entry_type);
    return r.entry_type === filter;
  }), [rows, filter]);

  const classRows = shown.filter((r) => r.entry_type === 'labor_day');

  const groups = useMemo(() => {
    const m = new Map();
    shown.filter((r) => r.entry_type !== 'labor_day').forEach((r) => {
      const k = r.group_no || 0;
      if (!m.has(k)) m.set(k, { no: k, groupRows: [], students: new Map(), count: { violation: 0, singing: 0, labor: 0 } });
      const g = m.get(k);
      if (r.entry_type === 'violation') g.count.violation += 1;
      else if (r.entry_type === 'singing') g.count.singing += 1;
      else g.count.labor += 1;
      if (r.entry_type === 'duty_group') g.groupRows.push(r);
      else {
        if (!g.students.has(r.student_id)) g.students.set(r.student_id, { id: r.student_id, name: r.student_name, rows: [] });
        g.students.get(r.student_id).rows.push(r);
      }
    });
    return Array.from(m.values())
      .sort((a, b) => (a.no === 0) - (b.no === 0) || a.no - b.no)
      .map((g) => ({ ...g, students: Array.from(g.students.values()).sort((a, b) => b.rows.length - a.rows.length) }));
  }, [shown]);

  return (
    <>
      <div className="cm-card">
        <div className="cm-h">
          <h3>Nhật ký theo tổ — {fmtDate(from)} đến {fmtDate(to)}</h3>
        </div>
        <div className="cm-row" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="cm-lbl" style={{ marginTop: 0 }}>Thời gian</div>
            <div className="cm-chips">
              {PERIODS.map((p) => (
                <button key={p.key} className={`cm-btn cm-btn-sm ${period === p.key ? 'cm-btn-main' : ''}`} aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="cm-lbl" style={{ marginTop: 0 }}>Hiển thị</div>
            <div className="cm-chips">
              {FILTERS.map((f) => (
                <button key={f.key} className={`cm-btn cm-btn-sm ${filter === f.key ? 'cm-btn-main' : ''}`} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>
        <p className="cm-hint" style={{ marginTop: 8 }}>
          Mỗi tổ liệt kê những bạn có ghi nhận, bạn nào nhiều nhất đứng trên cùng. Bạn nào không có tên là không bị ghi nhận trong khoảng thời gian này.
        </p>
      </div>

      {loading ? (
        <div className="cm-card"><div className="cm-empty">Đang tải…</div></div>
      ) : shown.length === 0 ? (
        <div className="cm-card"><div className="cm-empty">Không có ghi nhận nào trong khoảng thời gian này.</div></div>
      ) : (
        <>
          {groups.map((g) => (
            <div className="cm-card" key={g.no}>
              <div className="cm-h">
                <h3>{g.no ? `Tổ ${g.no}` : 'Chưa xếp tổ'}</h3>
                <div className="cm-chips">
                  <span className="cm-pill bad">Vi phạm: {g.count.violation}</span>
                  <span className="cm-pill warn">Không hát: {g.count.singing}</span>
                  <span className="cm-pill warn">Trực nhật, lao động: {g.count.labor}</span>
                </div>
              </div>

              {g.groupRows.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="cm-lbl" style={{ marginTop: 0 }}>Cả tổ trực nhật chưa tốt</div>
                  <EntryTable rows={g.groupRows} />
                </div>
              )}

              {g.students.map((s) => (
                <div key={s.id} style={{ borderTop: '1px solid var(--cm-line)', paddingTop: 8, marginTop: 8 }}>
                  <div style={{ fontWeight: 800 }}>
                    {s.name} <span className="cm-chip" style={{ padding: '0 8px' }}>{s.rows.length} lần</span>
                  </div>
                  <EntryTable rows={s.rows} />
                </div>
              ))}
            </div>
          ))}

          {classRows.length > 0 && (
            <div className="cm-card">
              <div className="cm-h"><h3>Cả lớp lao động chưa đủ</h3></div>
              <EntryTable rows={classRows} />
            </div>
          )}
        </>
      )}
    </>
  );
}
