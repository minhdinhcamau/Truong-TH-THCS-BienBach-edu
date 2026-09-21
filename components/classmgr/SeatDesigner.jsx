'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { groupColor } from '@/components/Charts';

const key = (r, c) => `${r}-${c}`;

// Lớp trưởng / GVCN: thiết kế sơ đồ chỗ ngồi (thêm / bớt ghế), xếp học sinh vào ghế, rồi lưu vào tổ.
// Tổ được chia theo cột ghế: các cột liền nhau thuộc cùng một tổ.
export default function SeatDesigner({ classId, students, reload, toast }) {
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(8);
  const [groupCount, setGroupCount] = useState(4);
  const [cells, setCells] = useState({}); // key -> { on, student_id }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('class_get_layout', { p_class_id: classId });
    if (error) {
      toast({ type: 'error', text: error.message });
      setLoading(false);
      return;
    }
    setRows(data.rows);
    setCols(data.cols);
    setGroupCount(data.group_count);
    const next = {};
    if (data.saved) data.seats.forEach((s) => { next[key(s.row, s.col)] = { on: true, student_id: s.student_id || '' }; });
    else for (let r = 1; r <= data.rows; r += 1) for (let c = 1; c <= data.cols; c += 1) next[key(r, c)] = { on: true, student_id: '' };
    setCells(next);
    setLoading(false);
  }, [classId, toast]);

  useEffect(() => { load(); }, [load]);

  const groupOf = (c) => Math.min(groupCount, Math.max(1, Math.ceil((c * groupCount) / cols)));
  const seatedIds = useMemo(() => new Set(Object.values(cells).filter((x) => x.on && x.student_id).map((x) => x.student_id)), [cells]);
  const unseated = students.filter((s) => !seatedIds.has(s.student_id));
  const seatCount = Object.values(cells).filter((x) => x.on).length;
  const nameOf = (id) => students.find((s) => s.student_id === id)?.full_name || '';

  function resize(nr, nc) {
    const r = Math.min(12, Math.max(1, nr));
    const c = Math.min(14, Math.max(1, nc));
    setCells((prev) => {
      const next = {};
      for (let i = 1; i <= r; i += 1) for (let j = 1; j <= c; j += 1) next[key(i, j)] = prev[key(i, j)] || { on: true, student_id: '' };
      return next;
    });
    setRows(r);
    setCols(c);
  }

  function setCell(k, patch) {
    setCells((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));
  }

  function autoFill() {
    const queue = [...unseated];
    setCells((prev) => {
      const next = { ...prev };
      for (let r = 1; r <= rows; r += 1) {
        for (let c = 1; c <= cols; c += 1) {
          const k = key(r, c);
          if (next[k]?.on && !next[k].student_id && queue.length) next[k] = { ...next[k], student_id: queue.shift().student_id };
        }
      }
      return next;
    });
    if (queue.length) toast({ type: 'error', text: `Còn ${queue.length} bạn chưa có ghế — hãy thêm ghế (tăng số hàng/cột hoặc bật lại ghế).` });
  }

  function clearAll() {
    if (!window.confirm('Bỏ hết học sinh khỏi ghế (giữ nguyên sơ đồ ghế)?')) return;
    setCells((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, student_id: '' }])));
  }

  async function save() {
    const seats = [];
    for (let r = 1; r <= rows; r += 1) {
      for (let c = 1; c <= cols; c += 1) {
        const x = cells[key(r, c)];
        if (x?.on) seats.push({ row: r, col: c, group_no: groupOf(c), student_id: x.student_id || null });
      }
    }
    setSaving(true);
    const { error } = await supabase.rpc('class_save_layout', {
      p_class_id: classId, p_rows: rows, p_cols: cols, p_group_count: groupCount, p_seats: seats,
    });
    setSaving(false);
    if (error) toast({ type: 'error', text: error.message });
    else {
      toast({ type: 'ok', text: 'Đã lưu sơ đồ lớp và chia tổ.' });
      reload();
    }
  }

  if (loading) return <div className="cm-card"><div className="cm-empty">Đang tải sơ đồ…</div></div>;

  return (
    <>
      <div className="cm-card">
        <div className="cm-h"><h3>Thiết kế sơ đồ lớp</h3><span className="cm-chip">{seatCount} ghế · {seatedIds.size}/{students.length} bạn đã có chỗ</span></div>
        <p className="cm-hint">Đặt số hàng, số cột và số tổ cho giống lớp học thật. Bấm dấu × ở góc ghế để bỏ ghế, bấm ＋ để thêm lại. Các cột liền nhau thuộc cùng một tổ (cùng màu), tính từ cửa ra vào. Xếp xong bấm “Lưu vào tổ”.</p>
        <div className="cm-row">
          <label className="cm-row" style={{ gap: 6 }}>Hàng
            <input className="cm-input" style={{ width: 70 }} type="number" min={1} max={12} value={rows} onChange={(e) => resize(Number(e.target.value), cols)} />
          </label>
          <label className="cm-row" style={{ gap: 6 }}>Cột
            <input className="cm-input" style={{ width: 70 }} type="number" min={1} max={14} value={cols} onChange={(e) => resize(rows, Number(e.target.value))} />
          </label>
          <label className="cm-row" style={{ gap: 6 }}>Số tổ
            <input className="cm-input" style={{ width: 70 }} type="number" min={1} max={8} value={groupCount} onChange={(e) => setGroupCount(Math.min(8, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
          <button className="cm-btn" onClick={autoFill} disabled={unseated.length === 0}>⚡ Tự xếp {unseated.length} bạn còn lại</button>
          <button className="cm-btn cm-btn-danger" onClick={clearAll}>Bỏ hết học sinh</button>
          <button className="cm-btn cm-btn-main" onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu vào tổ'}</button>
        </div>
      </div>

      <div className="cm-card">
        <p className="cm-hint" style={{ marginBottom: 10 }}>
          Sơ đồ nhìn từ trên xuống: <b>Tổ 1 sát cửa ra vào</b> (bên trái), <b>Tổ {groupCount}</b> ở phía đối diện bàn giáo viên (bên phải).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10, minHeight: 180 }}>
            <div style={{ background: '#eef3f1', border: '2px dashed #9db7ad', borderRadius: 10, padding: '10px 4px', textAlign: 'center', fontSize: 11.5, fontWeight: 800, color: '#2f6f5e', lineHeight: 1.3 }}>
              <div style={{ fontSize: 22 }} aria-hidden="true">🧑‍🏫</div>Bàn giáo viên
            </div>
            <div style={{ background: '#fff4dc', border: '2px solid #d9b45a', borderRadius: 10, padding: '10px 4px', textAlign: 'center', fontSize: 11.5, fontWeight: 800, color: '#7a4d00', lineHeight: 1.3 }}>
              <div style={{ fontSize: 22 }} aria-hidden="true">🚪</div>Cửa ra vào
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ textAlign: 'center', background: '#14263d', color: '#fff', borderRadius: 10, padding: '8px 0', fontWeight: 700, marginBottom: 12 }}>Bảng</div>
            <div className="cm-wrap">
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(112px, 1fr))`, gap: 8, minWidth: cols * 118 }}>
            {Array.from({ length: cols }, (_, i) => (
              <div key={`h${i}`} style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#fff', background: groupColor(groupOf(i + 1)), borderRadius: 8, padding: '3px 0' }}>
                Tổ {groupOf(i + 1)}{i === 0 ? ' · gần cửa' : ''}{i === cols - 1 && groupCount > 1 ? ' · đối diện bàn GV' : ''}
              </div>
            ))}
            {Array.from({ length: rows }, (_, ri) =>
              Array.from({ length: cols }, (_, ci) => {
                const r = ri + 1;
                const c = ci + 1;
                const k = key(r, c);
                const cell = cells[k] || { on: true, student_id: '' };
                const color = groupColor(groupOf(c));
                if (!cell.on) {
                  return (
                    <button key={k} className="cm-btn" style={{ borderStyle: 'dashed', color: '#8a97a8', minHeight: 58 }} onClick={() => setCell(k, { on: true })} aria-label={`Thêm ghế hàng ${r} cột ${c}`}>＋ ghế</button>
                  );
                }
                return (
                  <div key={k} style={{ position: 'relative', border: `2px solid ${color}`, borderRadius: 10, padding: '18px 6px 6px', background: cell.student_id ? '#fff' : '#f7f9fc' }}>
                    <button
                      className="cm-btn cm-btn-sm"
                      style={{ position: 'absolute', top: 2, right: 2, padding: '0 6px', lineHeight: 1.4 }}
                      onClick={() => setCell(k, { on: false, student_id: '' })}
                      aria-label={`Bỏ ghế hàng ${r} cột ${c}`}
                    >×</button>
                    <select
                      className="cm-input"
                      style={{ padding: '4px 4px', fontSize: 12 }}
                      value={cell.student_id}
                      onChange={(e) => setCell(k, { student_id: e.target.value })}
                      aria-label={`Học sinh ngồi hàng ${r} cột ${c}`}
                    >
                      <option value="">— trống —</option>
                      {cell.student_id && <option value={cell.student_id}>{nameOf(cell.student_id)}</option>}
                      {unseated.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name}</option>)}
                    </select>
                  </div>
                );
              })
            )}
          </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
