'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useRankingPing } from '@/lib/useRankingPing';
import { TPT_NAV } from '@/lib/nav';
import { fmtIso, timeVN, vnTodayIso } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

export default function TptDeductPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const today = vnTodayIso();
  const [classes, setClasses] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(today);
  const [reasonCode, setReasonCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([]);
  const [score, setScore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const [c, r] = await Promise.all([
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('discipline_reason_types').select('*').order('category').order('sort_order'),
      ]);
      setClasses(c.data || []);
      setReasons((r.data || []).filter((x) => x.category !== 'checkin'));
    })();
  }, [ready]);

  const loadClass = useCallback(async () => {
    if (!classId) {
      setRows([]);
      setScore(null);
      return;
    }
    const [d, lb] = await Promise.all([
      supabase.rpc('get_class_day', { p_class_id: classId, p_date: date }),
      supabase.rpc('get_class_leaderboard'),
    ]);
    if (d.error) setMsg({ type: 'error', text: d.error.message });
    else setRows(d.data || []);
    setScore((lb.data || []).find((x) => x.class_id === classId) || null);
  }, [classId, date]);

  useEffect(() => {
    if (ready) loadClass();
  }, [ready, loadClass]);

  useRankingPing(() => { if (ready) loadClass(); });

  const grouped = useMemo(() => ({
    ne_nep: reasons.filter((r) => r.category === 'ne_nep'),
    hoc_tap: reasons.filter((r) => r.category === 'hoc_tap'),
  }), [reasons]);
  const picked = reasons.find((r) => r.code === reasonCode);
  const className = classes.find((c) => c.id === classId)?.name;

  async function submit() {
    if (!classId || !picked) {
      setMsg({ type: 'error', text: 'Hãy chọn lớp và mục cần trừ điểm.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('saodo_report_deduction', {
      p_class_id: classId,
      p_reason_code: picked.code,
      p_note: note.trim() || null,
      p_student_name: studentName.trim() || null,
      p_occurred_date: date,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: `Đã ghi nhận lớp ${className}: ${picked.label} (${picked.points} điểm).` });
    setReasonCode('');
    setStudentName('');
    setNote('');
    loadClass();
  }

  async function removeRow(r) {
    if (!window.confirm(`Xoá "${r.reason_label}" (${r.points} điểm)?`)) return;
    const { error } = await supabase.rpc('saodo_delete_deduction', { p_id: r.id });
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: 'Đã xoá.' });
      loadClass();
    }
  }

  async function saveEdit() {
    setBusy(true);
    const { error } = await supabase.rpc('saodo_edit_deduction', {
      p_id: editing.id, p_reason_code: editing.reason_code,
      p_note: editing.note || null, p_student_name: editing.student_name || null,
    });
    setBusy(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setEditing(null);
      setMsg({ type: 'ok', text: 'Đã lưu thay đổi.' });
      loadClass();
    }
  }

  function reasonGrid(list) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
        {list.map((r) => (
          <button
            key={r.code}
            onClick={() => setReasonCode(r.code)}
            aria-pressed={reasonCode === r.code}
            style={{
              display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left', padding: '11px 13px', borderRadius: 12,
              cursor: 'pointer', fontWeight: 600, fontSize: 13.5,
              border: `1.5px solid ${reasonCode === r.code ? 'var(--red)' : 'var(--line)'}`,
              background: reasonCode === r.code ? '#fdeceb' : '#fff', color: 'var(--ink)',
            }}
          >
            <span>{r.label}</span>
            <span style={{ color: r.points < 0 ? 'var(--red)' : 'var(--ok)', fontWeight: 800, whiteSpace: 'nowrap' }}>{r.points} đ</span>
          </button>
        ))}
      </div>
    );
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/tru-diem" onLogout={logout}>
      <h1 className="pg-title">Trừ điểm lớp trực tiếp</h1>
      <p className="pg-sub">Dùng khi cô tự phát hiện vi phạm hoặc cần bổ sung cho các ngày trước. Học sinh lớp đó thấy ngay trong mục Thi đua lớp.</p>

      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div>
            <label className="lbl" htmlFor="t-cls" style={{ marginTop: 0 }}>Lớp</label>
            <select id="t-cls" className="input" style={{ width: 150 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="t-date" style={{ marginTop: 0 }}>Ngày xảy ra</label>
            <input id="t-date" type="date" className="input" style={{ width: 170 }} max={today} value={date}
              onChange={(e) => setDate(e.target.value || today)} />
          </div>
          {score && (
            <div className="chips">
              <span className="chip">Hạng tuần: <strong>{score.rank}</strong></span>
              <span className="chip">Tổng: <strong>{score.total_score}</strong></span>
              <span className="chip">NN {score.ne_nep_score} · HT {score.hoc_tap_score}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Chọn mục trừ điểm</h3></div>
        <div className="lbl" style={{ marginTop: 0 }}>Nề nếp</div>
        {reasonGrid(grouped.ne_nep)}
        <div className="lbl" style={{ marginTop: 16 }}>Học tập (xếp loại giờ)</div>
        {reasonGrid(grouped.hoc_tap)}

        <div className="row" style={{ marginTop: 14 }}>
          <div className="grow">
            <label className="lbl" htmlFor="t-stu" style={{ marginTop: 0 }}>Tên học sinh (nếu là lỗi cá nhân)</label>
            <input id="t-stu" className="input" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Để trống nếu lỗi của cả lớp" />
          </div>
          <div className="grow">
            <label className="lbl" htmlFor="t-note" style={{ marginTop: 0 }}>Ghi chú</label>
            <input id="t-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: quan sát lúc ra chơi…" />
          </div>
        </div>

        <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
          <span className="hint" style={{ margin: 0 }}>
            {picked ? <>Sẽ ghi <strong>{picked.points} điểm</strong> cho lớp <strong>{className || '…'}</strong> ngày {fmtIso(date)}.</> : 'Chưa chọn mục nào.'}
          </span>
          <button className="btn btn-red" disabled={busy || !classId || !picked} onClick={submit}>{busy ? 'Đang ghi…' : 'Ghi nhận trừ điểm'}</button>
        </div>
      </div>

      {classId && (
        <div className="card">
          <div className="card-h"><h3>Nhật ký lớp {className} — {fmtIso(date)}</h3></div>
          {rows.length === 0 ? (
            <div className="empty">Chưa có ghi nhận nào trong ngày này.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Giờ</th><th>Nội dung</th><th>Học sinh</th><th>Điểm</th><th>Người ghi</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="num">{timeVN(r.created_at)}</td>
                      <td>{r.reason_label}{r.note ? <div className="hint" style={{ margin: 0 }}>{r.note}</div> : null}</td>
                      <td>{r.student_name || '—'}</td>
                      <td className="num" style={{ fontWeight: 800, color: r.points < 0 ? 'var(--red)' : 'var(--ok)' }}>{r.points}</td>
                      <td>{r.reported_by_name || '—'}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {!r.period_rating_id && (
                          <button className="btn btn-sm" onClick={() => setEditing({ id: r.id, reason_code: r.reason_code, note: r.note || '', student_name: r.student_name || '' })}>Sửa</button>
                        )}{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => removeRow(r)}>Xoá</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal title="Sửa ghi nhận" onClose={() => setEditing(null)}>
          <label className="lbl" htmlFor="e-r" style={{ marginTop: 0 }}>Loại lỗi</label>
          <select id="e-r" className="input" value={editing.reason_code} onChange={(e) => setEditing({ ...editing, reason_code: e.target.value })}>
            {reasons.map((r) => <option key={r.code} value={r.code}>{r.label} ({r.points} đ)</option>)}
          </select>
          <label className="lbl" htmlFor="e-s">Tên học sinh</label>
          <input id="e-s" className="input" value={editing.student_name} onChange={(e) => setEditing({ ...editing, student_name: e.target.value })} />
          <label className="lbl" htmlFor="e-n">Ghi chú</label>
          <input id="e-n" className="input" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
          <div className="modal-f">
            <button className="btn" onClick={() => setEditing(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={busy} onClick={saveEdit}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
          </div>
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
