'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import { parseWorkbookSheets } from '@/lib/tkb';
import { fmtDate, vnTodayIso } from '@/lib/dates';
import AppShell, { Toast } from '@/components/AppShell';
import ClassTimetable from '@/components/Timetable';

// Chọn lớp nhanh: danh sách thả xuống + nút lớp trước / lớp sau
function ClassPicker({ id, value, options, onChange }) {
  const idx = options.findIndex((o) => o.value === value);
  const go = (d) => {
    const n = options[idx + d];
    if (n) onChange(n.value);
  };
  return (
    <div className="row" style={{ gap: 6 }}>
      <button type="button" className="btn btn-sm" disabled={idx <= 0} onClick={() => go(-1)} aria-label="Lớp trước">‹</button>
      <select id={id} className="input" style={{ width: 130 }} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button type="button" className="btn btn-sm" disabled={idx < 0 || idx >= options.length - 1} onClick={() => go(1)} aria-label="Lớp sau">›</button>
    </div>
  );
}

export default function TptTimetablePage() {
  const { profile, ready, logout } = useGuard('tpt');
  const [msg, setMsg] = useState(null);

  // Nhập file
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { rows, classes, sessions, effectiveFrom }
  const [effectiveFrom, setEffectiveFrom] = useState(vnTodayIso());
  const [previewClass, setPreviewClass] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  // Đã lưu
  const [versions, setVersions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [viewVersion, setViewVersion] = useState('');
  const [viewClass, setViewClass] = useState('');
  const [viewRows, setViewRows] = useState([]);

  const loadVersions = useCallback(async () => {
    const { data, error } = await supabase.rpc('tpt_timetable_versions');
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setVersions(data || []);
    setViewVersion((cur) => cur || (data && data[0] ? data[0].effective_from : ''));
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data } = await supabase.from('classes').select('id, name').order('name');
      setClasses(data || []);
      if (data && data[0]) setViewClass(data[0].id);
      loadVersions();
    })();
  }, [ready, loadVersions]);

  useEffect(() => {
    if (!viewVersion || !viewClass) {
      setViewRows([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('class_timetable')
        .select('weekday, session, period, subject, teacher')
        .eq('class_id', viewClass)
        .eq('effective_from', viewVersion);
      setViewRows(data || []);
    })();
  }, [viewVersion, viewClass]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheets = wb.SheetNames.map((name) => ({
        name,
        aoa: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, blankrows: true }),
      }));
      const res = parseWorkbookSheets(sheets);
      if (!res.rows.length) {
        setParsed(null);
        setMsg({ type: 'error', text: 'Không đọc được thời khóa biểu. File cần có hàng tiêu đề “THỨ – TIẾT – tên lớp” như file mẫu.' });
        return;
      }
      setFileName(file.name);
      setParsed(res);
      setPreviewClass(res.classes[0] || '');
      if (res.effectiveFrom) setEffectiveFrom(res.effectiveFrom);
    } catch (err) {
      setParsed(null);
      setMsg({ type: 'error', text: `Không mở được file: ${err.message}` });
    }
  }

  async function save() {
    if (!parsed) return;
    if (!effectiveFrom) {
      setMsg({ type: 'error', text: 'Hãy chọn ngày bắt đầu áp dụng.' });
      return;
    }
    const existing = versions.find((v) => v.effective_from === effectiveFrom);
    if (existing && !window.confirm(`Đã có thời khóa biểu áp dụng từ ${fmtDate(effectiveFrom)}. Ghi đè bản đó?`)) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('tpt_import_timetable', {
      p_effective_from: effectiveFrom,
      p_rows: parsed.rows,
    });
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setResult(data);
    setMsg({ type: 'ok', text: `Đã lưu ${data.inserted} tiết học.` });
    setViewVersion(effectiveFrom);
    loadVersions();
  }

  async function removeVersion(v) {
    if (!window.confirm(`Xoá thời khóa biểu áp dụng từ ${fmtDate(v.effective_from)}?`)) return;
    const { error } = await supabase.rpc('tpt_delete_timetable', { p_effective_from: v.effective_from });
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    if (viewVersion === v.effective_from) setViewVersion('');
    setMsg({ type: 'ok', text: 'Đã xoá thời khóa biểu.' });
    loadVersions();
  }

  const previewRows = useMemo(
    () => (parsed ? parsed.rows.filter((r) => r.class_name === previewClass) : []),
    [parsed, previewClass]
  );

  const perClass = useMemo(() => {
    if (!parsed) return [];
    const m = new Map(parsed.classes.map((c) => [c, { name: c, sang: 0, chieu: 0 }]));
    parsed.rows.forEach((r) => { const x = m.get(r.class_name); if (x) x[r.session] += 1; });
    return Array.from(m.values());
  }, [parsed]);

  const previewOptions = useMemo(() => (parsed ? parsed.classes.map((c) => ({ value: c, label: c })) : []), [parsed]);
  const classOptions = useMemo(() => classes.map((c) => ({ value: c.id, label: c.name })), [classes]);
  const viewClassName = classes.find((c) => c.id === viewClass)?.name || '';

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/tkb" onLogout={logout}>
      <h1 className="pg-title">Thời khóa biểu toàn trường</h1>
      <p className="pg-sub">
        Nhập file Excel thời khóa biểu của trường. Hệ thống tự tách từng lớp, từng tiết và hiện thành thời khóa biểu riêng của mỗi lớp (có nút In và Lưu ảnh).
        Học sinh thấy thời khóa biểu lớp mình ở mục “Thời khóa biểu”; ban cán sự chọn đúng tiết và môn khi ghi nhận vi phạm hoặc điểm cộng; Sao đỏ được phân công lớp nào sẽ thấy đủ các tiết của lớp đó để đánh giá A/B/C (tiết không đánh là A).
      </p>

      <div className="card">
        <div className="card-h"><h3>Cập nhật từ file Excel</h3></div>
        <input type="file" accept=".xls,.xlsx" onChange={onFile} aria-label="Chọn file thời khóa biểu" />
        <p className="hint" style={{ marginTop: 8 }}>
          Đọc được file .xls và .xlsx theo mẫu hiện tại: mỗi sheet một buổi (sáng / chiều), hàng tiêu đề “THỨ – TIẾT – 6A1 – 6A2…”.
          Mỗi lần nhập là một bản có “ngày áp dụng”; khi có bản mới, các lớp tự dùng bản mới từ ngày đó.
        </p>

        {parsed && (
          <div style={{ marginTop: 14 }}>
            <div className="chips" style={{ marginBottom: 12 }}>
              <span className="chip">{fileName}</span>
              <span className="chip">{parsed.classes.length} lớp</span>
              <span className="chip">{parsed.rows.length} tiết học</span>
              <span className="chip">Buổi: {parsed.sessions.map((s) => (s === 'sang' ? 'sáng' : 'chiều')).join(' + ')}</span>
            </div>

            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div>
                <label className="lbl" htmlFor="eff" style={{ marginTop: 0 }}>Áp dụng từ ngày</label>
                <input id="eff" type="date" className="input" style={{ width: 170 }} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
              </div>
              <button className="btn btn-red" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu thời khóa biểu'}</button>
              <button className="btn" onClick={() => { setParsed(null); setResult(null); setFileName(''); }}>Bỏ file này</button>
            </div>
            {parsed.effectiveFrom && (
              <p className="hint" style={{ marginTop: 8 }}>Ngày áp dụng đọc từ file: {fmtDate(parsed.effectiveFrom)} — có thể chỉnh lại.</p>
            )}

            <div className="row" style={{ marginTop: 14 }}>
              <label className="lbl" htmlFor="pv" style={{ margin: 0 }}>Xem thử lớp</label>
              <ClassPicker id="pv" value={previewClass} options={previewOptions} onChange={setPreviewClass} />
              <span className="hint" style={{ margin: 0 }}>
                {perClass.find((c) => c.name === previewClass)?.sang || 0} tiết sáng · {perClass.find((c) => c.name === previewClass)?.chieu || 0} tiết chiều
              </span>
            </div>
            <div style={{ marginTop: 10 }}>
              <ClassTimetable rows={previewRows} className={previewClass} effectiveFrom={effectiveFrom} />
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 14 }}>
            <span className="pill ok">Đã lưu {result.inserted} tiết</span>
            {(result.unmatched || []).length > 0 && (
              <div className="card" style={{ marginTop: 10, background: 'var(--warn-bg)', borderColor: '#f0d28a' }}>
                <strong style={{ color: 'var(--warn)' }}>Có lớp trong file chưa khớp tên lớp trên hệ thống nên bị bỏ qua:</strong>
                <div className="chips" style={{ marginTop: 8 }}>
                  {result.unmatched.map((n) => <span key={n} className="chip">{n}</span>)}
                </div>
                <p className="hint" style={{ margin: '8px 0 0' }}>Hãy kiểm tra tên lớp (ví dụ “6A1”) trong bảng lớp rồi nhập lại file.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-h"><h3>Thời khóa biểu đã lưu</h3></div>
        {versions.length === 0 ? (
          <div className="empty">Chưa có thời khóa biểu nào. Nhập file ở trên để bắt đầu.</div>
        ) : (
          <>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Áp dụng từ</th><th>Số lớp</th><th>Số tiết</th><th></th></tr></thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.effective_from}>
                      <td><strong>{fmtDate(v.effective_from)}</strong></td>
                      <td className="num">{v.class_count}</td>
                      <td className="num">{v.row_count}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className={`btn btn-sm ${viewVersion === v.effective_from ? 'btn-red' : ''}`} onClick={() => setViewVersion(v.effective_from)}>Xem</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => removeVersion(v)}>Xoá</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>Hệ thống tự dùng bản có ngày áp dụng gần nhất không vượt quá ngày đang kiểm tra.</p>

            {viewVersion && (
              <>
                <div className="row" style={{ margin: '12px 0 10px' }}>
                  <label className="lbl" htmlFor="vc" style={{ margin: 0 }}>Lớp</label>
                  <ClassPicker id="vc" value={viewClass} options={classOptions} onChange={setViewClass} />
                  <span className="hint" style={{ margin: 0 }}>Bản áp dụng từ {fmtDate(viewVersion)}</span>
                </div>
                {viewRows.length === 0
                  ? <div className="empty">Lớp này chưa có tiết nào trong bản này.</div>
                  : <ClassTimetable rows={viewRows} className={viewClassName} effectiveFrom={viewVersion} />}
              </>
            )}
          </>
        )}
      </div>

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
