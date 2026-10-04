'use client';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { loadBellTimes } from '@/lib/tkbClient';
import { buildSchoolGrid, exportSchool } from '@/lib/tkbExport';

// Thẻ "Xuất thời khóa biểu tổng thể toàn trường" (1 bảng gồm tất cả các lớp): Word, Excel, ảnh PNG, có logo trường.
//   rows          : [{ class_name, weekday, session, period, subject, teacher }]. Bỏ trống thì có nút tải bản đang áp dụng.
//   bells         : giờ vào/ra từng tiết (không bắt buộc, bỏ trống thì tự tải)
//   effectiveFrom : ngày áp dụng, hiện trên đầu trang file
export default function SchoolTimetableExport({ rows, bells, effectiveFrom, title = 'Xuất thời khóa biểu tổng thể toàn trường' }) {
  const [loaded, setLoaded] = useState(null); // { rows, effectiveFrom } khi tự tải bản đang áp dụng
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const useRows = rows && rows.length ? rows : loaded?.rows || [];
  const useFrom = rows && rows.length ? effectiveFrom : loaded?.effectiveFrom || effectiveFrom;
  const grid = useMemo(() => buildSchoolGrid(useRows, bells || []), [useRows, bells]);

  async function loadCurrent() {
    setBusy('load');
    setMsg(null);
    const { data, error } = await supabase.rpc('tkb_current_rows');
    setBusy('');
    if (error) { setMsg({ type: 'error', text: error.message }); return; }
    if (!data || !data.length) { setMsg({ type: 'error', text: 'Chưa có thời khóa biểu nào đang áp dụng. Hãy nhập file Excel hoặc dùng công cụ soạn rồi lưu.' }); return; }
    setLoaded({ rows: data, effectiveFrom });
  }

  async function go(kind) {
    setBusy(kind);
    setMsg(null);
    try {
      const b = bells && bells.length ? bells : await loadBellTimes();
      await exportSchool(kind, useRows, b, { effectiveFrom: useFrom });
      setMsg({ type: 'ok', text: kind === 'docx' ? 'Đã tạo file Word (khổ A3 ngang).' : kind === 'xlsx' ? 'Đã tạo file Excel (in vừa 1 trang A3 ngang).' : 'Đã tạo ảnh thời khóa biểu.' });
    } catch (e) {
      setMsg({ type: 'error', text: `Không xuất được: ${e?.message || e}` });
    }
    setBusy('');
  }

  const ready = !grid.empty;
  return (
    <div className="card">
      <div className="card-h"><h3>{title}</h3></div>
      <p className="hint" style={{ marginTop: 0 }}>
        Một bảng duy nhất gồm tất cả các lớp, có logo trường, màu theo môn và giờ vào/ra từng tiết. Dùng để gửi cho giáo viên hoặc in dán bảng tin.
      </p>
      {!rows?.length && !loaded && (
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn" disabled={busy === 'load'} onClick={loadCurrent}>{busy === 'load' ? 'Đang tải…' : 'Tải thời khóa biểu đang áp dụng'}</button>
        </div>
      )}
      {ready && (
        <div className="chips" style={{ marginBottom: 10 }}>
          <span className="chip">{grid.classes.length} lớp</span>
          <span className="chip">{grid.days.length} ngày × {grid.sessions.map((s) => s.periods.length).join(' + ')} tiết</span>
          {useFrom && <span className="chip">Áp dụng từ {String(useFrom).split('-').reverse().join('/')}</span>}
        </div>
      )}
      <div className="row">
        <button className="btn btn-red" disabled={!ready || !!busy} onClick={() => go('docx')}>{busy === 'docx' ? 'Đang tạo…' : 'Tải file Word (.docx)'}</button>
        <button className="btn" disabled={!ready || !!busy} onClick={() => go('xlsx')}>{busy === 'xlsx' ? 'Đang tạo…' : 'Tải file Excel (.xlsx)'}</button>
        <button className="btn" disabled={!ready || !!busy} onClick={() => go('png')}>{busy === 'png' ? 'Đang vẽ…' : 'Tải ảnh (.png)'}</button>
      </div>
      {msg && <p className="hint" style={{ marginTop: 8, color: msg.type === 'error' ? 'var(--bad, #b3261e)' : undefined }}>{msg.text}</p>}
    </div>
  );
}
