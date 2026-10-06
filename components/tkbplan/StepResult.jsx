'use client';
import { useMemo, useState } from 'react';
import ClassTimetable from '@/components/Timetable';
import SchoolTimetableExport from '@/components/SchoolTimetableExport';
import { applyFix } from '@/lib/tkbPreflight';
import { DAY_LABEL } from '@/lib/tkbSolver';
import { Seg } from './ui';

export default function StepResult({
  cfg, edit, pre, running, progress, run, seed, result, report, bells,
  viewClass, setViewClass, viewTeacher, setViewTeacher, effectiveFrom, setEffectiveFrom, saving, saveTimetable, notify, setNotify,
}) {
  const [tab, setTab] = useState('check');
  const nIssues = pre.errors.length;
  const classesDone = useMemo(() => (result ? [...new Set(result.rows.map((r) => r.class_name))].sort((a, b) => a.localeCompare(b, 'vi')) : []), [result]);
  const viewRows = useMemo(() => (result ? result.rows.filter((r) => r.class_name === viewClass).map(({ weekday, session, period, subject, teacher }) => ({ weekday, session, period, subject, teacher })) : []), [result, viewClass]);
  const teacherRows = useMemo(() => (result ? result.rows.filter((r) => r.teacher === viewTeacher).map(({ weekday, session, period, subject, class_name }) => ({ weekday, session, period, subject, class_name })) : []), [result, viewTeacher]);
  const tone = report ? (report.errors.length ? 'bad' : report.warnings.length ? 'warn' : 'ok') : 'ok';
  const tabs = [['check', 'Kiểm tra trước khi xếp'], ...(result ? [['report', 'Phân tích kết quả'], ['fair', 'Công bằng'], ['view', 'Xem thời khóa biểu'], ['save', 'Xuất và lưu']] : [])];
  const cur = tabs.some(([k]) => k === tab) ? tab : 'check';

  return (
    <>
      <div className="pl-run">
        <div>
          <h3>Xếp thời khóa biểu tự động</h3>
          <p>{running ? `Đang xếp… ${Math.round(progress * 100)}%` : result ? `Phương án số ${seed}: ${result.rows.length} tiết đã xếp${result.unplaced ? `, còn ${result.unplaced} tiết chưa xếp được` : ''}. Xếp lại để có phương án khác.` : 'Hệ thống xếp đúng như thiết lập, rồi phân tích bảng vừa xếp để chỉ ra lỗi. Chưa lưu gì vào thời khóa biểu thật.'}</p>
        </div>
        <div>
          <button type="button" className="btn" disabled={running} onClick={() => { run(); setTab(result ? tab : 'report'); }}>{running ? 'Đang xếp…' : 'Xếp tự động'}</button>
          <button type="button" className="btn ghost" disabled={running || !result} onClick={() => run(seed + 1)}>Xếp lại</button>
        </div>
        {running && <div className="pl-prog"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
      </div>

      {result && report && (
        <div className={`pl-verdict ${tone}`}>
          <div className="pl-verdict-ic" aria-hidden="true">{tone === 'ok' ? '✓' : '!'}</div>
          <div>
            <b>{report.errors.length ? `Bảng vừa xếp có ${report.errors.length} lỗi` : 'Bảng vừa xếp không có lỗi'}{report.warnings.length ? ` và ${report.warnings.length} điểm nên xem lại` : ''}</b>
            <div className="pl-sub">{result.rows.length} tiết đã xếp cho {classesDone.length} lớp. Mở các mục bên dưới để xem chi tiết, xem từng lớp, xuất file và lưu.</div>
          </div>
        </div>
      )}

      <div className="pl-toolbar"><Seg value={cur} onChange={setTab} options={tabs} /></div>

      {cur === 'check' && (
        <div className="card" style={nIssues ? { borderColor: '#f0d28a', background: '#fffaf0' } : undefined}>
          <div className="card-h">
            <h3>Kiểm tra trước khi xếp</h3>
            <span className={`pill ${nIssues === 0 ? 'ok' : 'warn'}`}>{nIssues === 0 ? 'Không thấy vấn đề' : `${nIssues} vấn đề, vẫn cho xếp`}</span>
          </div>
          {nIssues > 0 && <p className="hint" style={{ marginTop: 0 }}>Đây chỉ là cảnh báo, hệ thống không chặn. Dòng chưa có giáo viên sẽ bị bỏ qua khi xếp.</p>}
          {nIssues > 0 && <ul className="pl-list" style={{ color: '#8a5b0a' }}>{pre.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {pre.warnings.length > 0 && <ul className="pl-list" style={{ color: 'var(--warn)' }}>{pre.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          {pre.fixes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Gợi ý bù tiết còn thiếu của giáo viên</strong>
              <p className="hint" style={{ margin: '2px 0 6px' }}>Chỉ là gợi ý, bấm “Thêm” thì mới vào phân công.</p>
              {pre.fixes.slice(0, 12).map((f) => (
                <div key={f.id} className="row" style={{ marginBottom: 4 }}>
                  <span className="grow">{f.text}</span>
                  <button type="button" className="btn btn-sm" onClick={() => edit((c) => applyFix(c, f))}>Thêm</button>
                </div>
              ))}
              {pre.fixes.length > 12 && <p className="hint">Còn {pre.fixes.length - 12} gợi ý nữa.</p>}
            </div>
          )}
          {nIssues === 0 && pre.warnings.length === 0 && <p className="hint" style={{ margin: 0 }}>Mọi lớp đủ tiết theo chương trình, không trùng, không giáo viên nào vượt mức.</p>}
        </div>
      )}

      {cur === 'report' && report && (
        <div className="card">
          <div className="card-h"><h3>Phân tích kết quả xếp</h3></div>
          {report.infos.map((x, i) => <p key={i} className="hint" style={{ margin: '0 0 6px' }}>{x.text}</p>)}
          {report.errors.length > 0 && (
            <>
              <strong style={{ color: '#a12a2a' }}>Lỗi (bảng xếp chưa đúng thiết lập)</strong>
              <ul className="pl-list">{report.errors.map((e, i) => <li key={i} style={{ color: '#a12a2a' }}>{e.text}{e.advice && <span className="adv"> → {e.advice}</span>}</li>)}</ul>
            </>
          )}
          {report.warnings.length > 0 && (
            <>
              <strong style={{ color: 'var(--warn)' }}>Nên xem lại</strong>
              <ul className="pl-list">{report.warnings.map((w, i) => <li key={i} style={{ color: 'var(--warn)' }}>{w.text}{w.advice && <span className="adv"> → {w.advice}</span>}</li>)}</ul>
            </>
          )}
          {report.errors.length === 0 && report.warnings.length === 0 && <p style={{ margin: 0, color: 'var(--ok)', fontWeight: 700 }}>Bảng khớp mọi thiết lập: không trùng lớp, không trùng giáo viên, đủ tiết, đúng buổi, không ai vượt mức.</p>}
        </div>
      )}

      {cur === 'fair' && result && (
        <div className="card">
          <div className="card-h"><h3>Công bằng giữa các giáo viên</h3></div>
          <div className="pl-scroll">
            <table className="pl-mini" style={{ minWidth: 760 }}>
              <thead><tr><th>Giáo viên</th><th>Tiết</th><th>Ngày dạy</th><th>Ngày nghỉ</th><th>Vào tiết 1</th><th>Vào muộn (từ tiết 3)</th><th>Ra sớm (≤ tiết 3)</th><th>Ra cuối buổi</th><th>Tiết trống giữa buổi</th></tr></thead>
              <tbody>
                {result.stats.map((s) => (
                  <tr key={s.name}>
                    <td><b>{s.name}</b></td><td>{s.periods}</td><td>{s.days}</td>
                    <td>{s.offDays.length ? s.offDays.map((d) => DAY_LABEL[d]).join(', ') : <span className="pill warn">Không nghỉ</span>}</td>
                    <td>{s.early}</td><td>{s.late}</td><td>{s.outEarly}</td><td>{s.outLate}</td><td>{s.gaps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Các cột vào/ra càng gần nhau giữa các giáo viên thì càng công bằng.</p>
        </div>
      )}

      {cur === 'view' && result && (
        <div className="card">
          <div className="card-h"><h3>Thời khóa biểu vừa xếp</h3></div>
          <div className="chips" style={{ marginBottom: 12 }}>
            {classesDone.map((c) => <button key={c} type="button" className={`pl-chipbtn ${c === viewClass ? 'on' : ''}`} onClick={() => setViewClass(c)}>{c}</button>)}
          </div>
          <ClassTimetable rows={viewRows} className={viewClass} effectiveFrom={effectiveFrom} bells={bells} />
          <div className="row" style={{ margin: '18px 0 10px' }}>
            <label className="lbl" htmlFor="v-t" style={{ margin: 0 }}>Xem theo giáo viên</label>
            <select id="v-t" className="input" style={{ width: 240 }} value={viewTeacher} onChange={(e) => setViewTeacher(e.target.value)}>{result.stats.map((s) => <option key={s.name}>{s.name}</option>)}</select>
          </div>
          <ClassTimetable rows={teacherRows} className={viewTeacher} badge={viewTeacher} title="THỜI KHÓA BIỂU GIÁO VIÊN" effectiveFrom={effectiveFrom} bells={bells} />
        </div>
      )}

      {cur === 'save' && result && (
        <>
          <SchoolTimetableExport rows={result.rows} bells={bells} effectiveFrom={effectiveFrom} />
          <div className="card">
            <div className="card-h"><h3>Lưu thành thời khóa biểu toàn trường</h3></div>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div><label className="lbl" htmlFor="eff" style={{ marginTop: 0 }}>Áp dụng từ ngày</label><input id="eff" type="date" className="input" style={{ width: 170 }} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></div>
              <button type="button" className="btn btn-red" disabled={saving} onClick={saveTimetable}>{saving ? 'Đang lưu…' : 'Lưu thành thời khóa biểu'}</button>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Thông báo cho toàn trường</label>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Học sinh và giáo viên thấy thời khóa biểu mới từ ngày áp dụng. Nếu admin đã thiết lập bản cùng ngày thì Tổng phụ trách phải chọn ngày khác (admin ghi đè Tổng phụ trách).</p>
          </div>
        </>
      )}
    </>
  );
}
