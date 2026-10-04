'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { parseWorkbookSheets } from '@/lib/tkb';
import { fmtDate, vnTodayIso } from '@/lib/dates';
import AppShell, { Toast } from '@/components/AppShell';
import ClassTimetable from '@/components/Timetable';
import { loadBellTimes, loadTeacherTimetable } from '@/lib/tkbClient';

const SESS_LABEL = { sang: 'Buổi sáng', chieu: 'Buổi chiều' };
const hhmm = (t) => String(t || '').slice(0, 5);

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

// Quản lý thời khóa biểu toàn trường: dùng chung cho trang Tổng phụ trách (/tpt/tkb) và trang admin (/admin/tkb).
export default function TkbManager({ nav, activeHref, roleLabel }) {
  const { profile, ready, logout } = useGuard('tpt');
  const [msg, setMsg] = useState(null);
  const isAdmin = profile?.role === 'admin';
  const [bellSource, setBellSource] = useState('tpt'); // 'admin' = giờ học do admin thiết lập

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

  // Giờ học các tiết
  const [bells, setBells] = useState([]); // dùng để hiện giờ trên thời khóa biểu
  const [bellDraft, setBellDraft] = useState([]);
  const [bellBusy, setBellBusy] = useState(false);

  // Thời khóa biểu giáo viên
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('');
  const [teacherView, setTeacherView] = useState({ rows: [], error: null, effectiveFrom: null });
  const [teacherNames, setTeacherNames] = useState([]);
  const [aliasText, setAliasText] = useState('');
  const [unmatched, setUnmatched] = useState([]);

  const reloadBells = useCallback(async () => {
    const b = await loadBellTimes();
    const src = await supabase.rpc('tkb_bell_source');
    setBellSource(src.data === 'admin' ? 'admin' : 'tpt');
    setBells(b);
    setBellDraft(b.map((x) => ({ session: x.session, period: x.period, label: x.label || '', start: hhmm(x.start_time), end: hhmm(x.end_time) })));
  }, []);

  const loadTeacherData = useCallback(async () => {
    const [t, u] = await Promise.all([supabase.rpc('tkb_list_teachers'), supabase.rpc('tkb_unmatched_teachers')]);
    setTeachers(t.data || []);
    setUnmatched(u.data || []);
    setTeacherId((cur) => cur || (t.data && t.data[0] ? t.data[0].id : ''));
  }, []);

  useEffect(() => {
    if (!teacherId) return;
    (async () => {
      const [v, n] = await Promise.all([loadTeacherTimetable(teacherId), supabase.rpc('teacher_tkb_names', { p_profile_id: teacherId })]);
      setTeacherView(v);
      const names = n.data || [];
      setTeacherNames(names);
      setAliasText(names.some((x) => x.manual) ? names.map((x) => x.name).join(', ') : '');
    })();
  }, [teacherId]);

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
      reloadBells();
      loadTeacherData();
    })();
  }, [ready, loadVersions, reloadBells, loadTeacherData]);

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
    if (existing && existing.source === 'admin' && !isAdmin) {
      setMsg({ type: 'error', text: 'Bản này do quản trị viên (admin) thiết lập, Tổng phụ trách không ghi đè được. Hãy chọn ngày áp dụng khác.' });
      return;
    }
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
    if (v.source === 'admin' && !isAdmin) {
      setMsg({ type: 'error', text: 'Bản này do admin thiết lập, chỉ admin mới xoá được.' });
      return;
    }
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

  function setBellField(i, field, value) {
    setBellDraft((d) => d.map((r, k) => (k === i ? { ...r, [field]: value } : r)));
  }
  function addBellRow(session) {
    setBellDraft((d) => {
      const nums = d.filter((r) => r.session === session).map((r) => Number(r.period));
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      return [...d, { session, period: next, label: '', start: '', end: '' }];
    });
  }
  function removeBellRow(i) {
    setBellDraft((d) => d.filter((_, k) => k !== i));
  }
  async function saveBells() {
    if (bellSource === 'admin' && !isAdmin) {
      setMsg({ type: 'error', text: 'Giờ học do admin thiết lập, Tổng phụ trách không sửa được.' });
      return;
    }
    if (bellDraft.some((r) => !r.start || !r.end)) {
      setMsg({ type: 'error', text: 'Mỗi tiết cần có giờ vào và giờ ra.' });
      return;
    }
    setBellBusy(true);
    const { error } = await supabase.rpc('tpt_save_bell_times', {
      p_rows: bellDraft.map((r) => ({ session: r.session, period: Number(r.period), label: r.label || null, start_time: r.start, end_time: r.end })),
    });
    setBellBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: 'Đã lưu giờ học. Học sinh và giáo viên thấy giờ mới ngay.' });
    reloadBells();
  }

  async function saveAlias() {
    const { error } = await supabase.rpc('teacher_set_tkb_alias', { p_aliases: aliasText, p_profile_id: teacherId });
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: aliasText.trim() ? 'Đã lưu tên trên thời khóa biểu.' : 'Đã bỏ khai báo, hệ thống tự khớp theo họ tên.' });
    const [v, n, u] = await Promise.all([
      loadTeacherTimetable(teacherId),
      supabase.rpc('teacher_tkb_names', { p_profile_id: teacherId }),
      supabase.rpc('tkb_unmatched_teachers'),
    ]);
    setTeacherView(v);
    setTeacherNames(n.data || []);
    setUnmatched(u.data || []);
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
  const teacherName = teachers.find((t) => t.id === teacherId)?.full_name || '';

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel={roleLabel} nav={nav} activeHref={activeHref} onLogout={logout}>
      <h1 className="pg-title">Thời khóa biểu toàn trường</h1>
      <p className="pg-sub">
        Nhập file Excel thời khóa biểu của trường. Hệ thống tự tách từng lớp, từng tiết và hiện thành thời khóa biểu riêng của mỗi lớp (có nút In và Lưu ảnh).
        Học sinh thấy thời khóa biểu lớp mình ở mục “Thời khóa biểu”; mỗi giáo viên thấy thời khóa biểu riêng của mình (khớp theo tên ghi trong file); ban cán sự chọn đúng tiết và môn khi ghi nhận vi phạm hoặc điểm cộng; Sao đỏ được phân công lớp nào sẽ thấy đủ các tiết của lớp đó để đánh giá A/B/C (tiết không đánh là A).
      </p>

      <div className="card" style={{ borderColor: '#9cc3ec' }}>
        <div className="card-h"><h3>Soạn thời khóa biểu tự động</h3></div>
        <p className="hint" style={{ marginTop: 0 }}>Khai báo giáo viên dạy môn gì, số tiết mỗi người, ngày nghỉ, nhóm giáo viên đi về cùng nhau; hệ thống tự xếp công bằng, báo thiếu/thừa tiết và gợi ý chuyển tiết. Không cần file Excel.</p>
        <Link href={`${activeHref}/soan`} className="btn btn-red">Mở công cụ soạn và xếp tự động</Link>
      </div>

      <div className="card">
        <div className="card-h"><h3>Cập nhật từ file Excel</h3></div>
        <input type="file" accept=".xls,.xlsx" onChange={onFile} aria-label="Chọn file thời khóa biểu" />
        <p className="hint" style={{ marginTop: 8 }}>
          Đọc được file .xls và .xlsx theo mẫu hiện tại: mỗi sheet một buổi (sáng / chiều), hàng tiêu đề “THỨ – TIẾT – 6A1 – 6A2…”.
          Mỗi lần nhập là một bản có “ngày áp dụng”; khi có bản mới, các lớp tự dùng bản mới từ ngày đó.
          Ô “Hội họp” (ví dụ họp chiều thứ 6) tự bị bỏ qua, không hiện trên thời khóa biểu học sinh. Các sheet lạ trong file (không có hàng “THỨ – TIẾT”) cũng được bỏ qua.
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
              <ClassTimetable rows={previewRows} className={previewClass} effectiveFrom={effectiveFrom} bells={bells} />
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
                <thead><tr><th>Áp dụng từ</th><th>Số lớp</th><th>Số tiết</th><th>Người nhập</th><th></th></tr></thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.effective_from}>
                      <td><strong>{fmtDate(v.effective_from)}</strong></td>
                      <td className="num">{v.class_count}</td>
                      <td className="num">{v.row_count}</td>
                      <td>{v.source === 'admin' ? <span className="pill ok">Admin</span> : <span className="pill">Tổng phụ trách</span>}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className={`btn btn-sm ${viewVersion === v.effective_from ? 'btn-red' : ''}`} onClick={() => setViewVersion(v.effective_from)}>Xem</button>{' '}
                        <button className="btn btn-sm btn-danger" disabled={v.source === 'admin' && !isAdmin} onClick={() => removeVersion(v)}>Xoá</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>Hệ thống tự dùng bản có ngày áp dụng gần nhất không vượt quá ngày đang kiểm tra. Quản trị viên (admin) có quyền cao nhất: khi admin lưu một bản thì ghi đè bản của Tổng phụ trách từ ngày đó trở đi, và Tổng phụ trách không sửa hay xoá được bản do admin nhập.</p>

            {viewVersion && (
              <>
                <div className="row" style={{ margin: '12px 0 10px' }}>
                  <label className="lbl" htmlFor="vc" style={{ margin: 0 }}>Lớp</label>
                  <ClassPicker id="vc" value={viewClass} options={classOptions} onChange={setViewClass} />
                  <span className="hint" style={{ margin: 0 }}>Bản áp dụng từ {fmtDate(viewVersion)}</span>
                </div>
                {viewRows.length === 0
                  ? <div className="empty">Lớp này chưa có tiết nào trong bản này.</div>
                  : <ClassTimetable rows={viewRows} className={viewClassName} effectiveFrom={viewVersion} bells={bells} />}
              </>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-h"><h3>Giờ học các tiết</h3></div>
        <p className="hint">Giờ vào, giờ ra của từng tiết (kể cả sinh hoạt đầu giờ, là tiết 0). Hiện trên thời khóa biểu của học sinh và giáo viên, khi in và khi lưu ảnh.</p>
        {bellSource === 'admin' && (
          <p style={{ margin: '0 0 10px' }}>
            <span className="pill ok">Giờ học do admin thiết lập</span>{' '}
            <span className="hint" style={{ margin: 0 }}>{isAdmin ? 'Bạn là admin nên sửa được.' : 'Tổng phụ trách chỉ xem, không sửa được.'}</span>
          </p>
        )}
        {['sang', 'chieu'].map((sk) => (
          <div key={sk} style={{ marginBottom: 14 }}>
            <div className="lbl" style={{ marginTop: 0 }}>{SESS_LABEL[sk]}</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Tiết</th><th>Tên (nếu có)</th><th>Giờ vào</th><th>Giờ ra</th><th></th></tr></thead>
                <tbody>
                  {bellDraft.map((r, i) => (r.session !== sk ? null : (
                    <tr key={`${r.session}-${r.period}-${i}`}>
                      <td><b>{Number(r.period) === 0 ? 'SH' : r.period}</b></td>
                      <td><input className="input" style={{ minWidth: 150 }} disabled={bellSource === 'admin' && !isAdmin} value={r.label} onChange={(e) => setBellField(i, 'label', e.target.value)} placeholder={Number(r.period) === 0 ? 'Sinh hoạt đầu giờ' : ''} aria-label="Tên tiết" /></td>
                      <td><input type="time" className="input" style={{ width: 130 }} disabled={bellSource === 'admin' && !isAdmin} value={r.start} onChange={(e) => setBellField(i, 'start', e.target.value)} aria-label="Giờ vào" /></td>
                      <td><input type="time" className="input" style={{ width: 130 }} disabled={bellSource === 'admin' && !isAdmin} value={r.end} onChange={(e) => setBellField(i, 'end', e.target.value)} aria-label="Giờ ra" /></td>
                      <td><button type="button" className="btn btn-sm btn-danger" disabled={bellSource === 'admin' && !isAdmin} onClick={() => removeBellRow(i)} aria-label="Xóa tiết này">✕</button></td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} disabled={bellSource === 'admin' && !isAdmin} onClick={() => addBellRow(sk)}>＋ Thêm tiết {SESS_LABEL[sk].toLowerCase()}</button>
          </div>
        ))}
        <button className="btn btn-red" disabled={bellBusy || bellDraft.length === 0 || (bellSource === 'admin' && !isAdmin)} onClick={saveBells}>{bellBusy ? 'Đang lưu…' : 'Lưu giờ học'}</button>
      </div>

      <div className="card">
        <div className="card-h"><h3>Thời khóa biểu của giáo viên</h3></div>
        <p className="hint">
          Mỗi giáo viên tự thấy thời khóa biểu riêng khi đăng nhập. Hệ thống khớp theo tên ghi trong thời khóa biểu: tên trong file (ví dụ “Đỉnh”) khớp với tài khoản có họ tên kết thúc bằng tên đó (ví dụ “Phan Nguyễn Minh Đỉnh”).
          Nếu hai thầy cô trùng tên hoặc khớp chưa đúng, khai báo “tên trên thời khóa biểu” bên dưới. Tên do admin khai báo sẽ ghi đè, Tổng phụ trách không đổi được.
        </p>
        {unmatched.length > 0 && (
          <div className="card" style={{ background: 'var(--warn-bg)', borderColor: '#f0d28a', marginBottom: 12 }}>
            <strong style={{ color: 'var(--warn)' }}>Tên trong thời khóa biểu chưa khớp tài khoản giáo viên nào:</strong>
            <div className="chips" style={{ marginTop: 8 }}>
              {unmatched.map((u) => <span key={u.name} className="chip">{u.name} · {u.periods} tiết</span>)}
            </div>
            <p className="hint" style={{ margin: '8px 0 0' }}>Thầy cô này chưa có tài khoản, hoặc tên trong tài khoản khác tên trong file. Chọn đúng giáo viên ở dưới rồi khai báo tên.</p>
          </div>
        )}
        {teachers.length === 0 ? (
          <div className="empty">Chưa có tài khoản giáo viên.</div>
        ) : (
          <>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div>
                <label className="lbl" htmlFor="tk-teacher" style={{ marginTop: 0 }}>Giáo viên</label>
                <select id="tk-teacher" className="input" style={{ width: 280 }} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}{t.is_tpt ? ' (Tổng phụ trách)' : ''}</option>)}
                </select>
              </div>
              <div className="grow">
                <label className="lbl" htmlFor="tk-alias" style={{ marginTop: 0 }}>Tên trên thời khóa biểu (cách nhau bằng dấu phẩy; để trống = tự khớp)</label>
                <input id="tk-alias" className="input" value={aliasText} onChange={(e) => setAliasText(e.target.value)} placeholder="Ví dụ: Việt Anh" />
              </div>
              <button className="btn" onClick={saveAlias}>Lưu tên</button>
            </div>
            <div className="chips" style={{ margin: '10px 0' }}>
              {teacherNames.length === 0
                ? <span className="pill warn">Chưa khớp tên nào trong thời khóa biểu</span>
                : teacherNames.map((n) => <span key={n.name} className="chip">{n.manual ? 'Đã khai báo' : 'Tự khớp'}: {n.name}</span>)}
            </div>
            {teacherView.error
              ? <div className="empty">{teacherView.error}</div>
              : teacherView.rows.length === 0
                ? <div className="empty">Chưa tìm thấy tiết nào của giáo viên này trong thời khóa biểu hiện hành.</div>
                : <ClassTimetable rows={teacherView.rows} className={teacherName} badge={teacherName} title="THỜI KHÓA BIỂU GIÁO VIÊN" effectiveFrom={teacherView.effectiveFrom} bells={bells} />}
          </>
        )}
      </div>

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
