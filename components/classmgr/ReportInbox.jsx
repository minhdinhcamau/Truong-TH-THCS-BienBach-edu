'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fmtIso, timeVN } from '@/lib/dates';

const STATUS_LABEL = { pending: 'Chưa xem', seen: 'Đã xem', accepted: 'Đã xác nhận', dismissed: 'Không xử lý' };
const STATUS_TONE = { pending: 'bad', seen: 'mute', accepted: 'ok', dismissed: 'mute' };

// Giáo viên chủ nhiệm (và TPT/admin): xem và xử lý báo cáo vi phạm do học sinh gửi.
export default function ReportInbox({ classId, toast, onChanged }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('pending'); // pending | all
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('class_list_member_reports', { p_class_id: classId });
    if (error) toast({ type: 'error', text: error.message });
    else setRows(data || []);
  }, [classId, toast]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (filter === 'pending' ? rows.filter((r) => r.status === 'pending') : rows), [rows, filter]);
  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  async function resolve(r, status) {
    setBusyId(r.id);
    const { error } = await supabase.rpc('class_resolve_member_report', { p_id: r.id, p_status: status, p_note: notes[r.id] || null });
    setBusyId('');
    if (error) {
      toast({ type: 'error', text: error.message });
      return;
    }
    toast({ type: 'ok', text: 'Đã cập nhật báo cáo và thông báo cho bạn gửi.' });
    await load();
    if (onChanged) onChanged();
  }

  return (
    <div className="ri-root">
      <style jsx>{`
        .ri-root { display: flex; flex-direction: column; gap: 14px; }
        .ri-filter { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .ri-list { display: grid; gap: 10px; }
        .ri-row { border: 1px solid var(--cm-line); border-radius: 12px; padding: 12px 14px; }
        .ri-row.pending { border-color: #f0c4c0; background: #fffafa; }
        .ri-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
        .ri-name { font-weight: 800; font-size: 14.5px; }
        .ri-meta { font-size: 12px; color: var(--cm-muted); margin-top: 2px; }
        .ri-body { margin-top: 8px; font-size: 13.5px; white-space: pre-wrap; }
        .ri-act { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
        .ri-note { margin-top: 10px; }
      `}</style>

      <div className="cm-card">
        <div className="cm-h">
          <h3>Báo cáo từ học sinh</h3>
          {pendingCount > 0 ? <span className="cm-pill bad">{pendingCount} chưa xem</span> : <span className="cm-pill ok">Đã xem hết</span>}
        </div>
        <p className="cm-hint">Học sinh trong lớp gửi báo cáo bạn vi phạm kèm lý do. Thầy/cô xem rồi chọn xử lý; bạn gửi sẽ nhận thông báo kết quả. Để ghi điểm vi phạm chính thức, dùng mục “Ghi nhận”.</p>

        <div className="ri-filter">
          <button className={`cm-btn cm-btn-sm ${filter === 'pending' ? 'cm-btn-main' : ''}`} onClick={() => setFilter('pending')}>Chưa xem ({pendingCount})</button>
          <button className={`cm-btn cm-btn-sm ${filter === 'all' ? 'cm-btn-main' : ''}`} onClick={() => setFilter('all')}>Tất cả ({rows.length})</button>
        </div>

        {shown.length === 0 ? (
          <div className="cm-empty">{filter === 'pending' ? 'Không có báo cáo nào đang chờ.' : 'Chưa có báo cáo nào.'}</div>
        ) : (
          <div className="ri-list">
            {shown.map((r) => (
              <div key={r.id} className={`ri-row ${r.status}`}>
                <div className="ri-top">
                  <div>
                    <div className="ri-name">{r.student_name}{r.type_label ? ` — ${r.type_label}` : ''}</div>
                    <div className="ri-meta">Việc ngày {fmtIso(r.occurred_date)} · {r.reporter_name} gửi lúc {timeVN(r.created_at)}</div>
                  </div>
                  <span className={`cm-pill ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>
                <div className="ri-body">{r.reason}</div>
                {r.gvcn_note ? <div className="ri-meta" style={{ marginTop: 6 }}>Ghi chú của thầy/cô: {r.gvcn_note}</div> : null}

                <div className="ri-note">
                  <input className="cm-input" placeholder="Nhắn lại cho bạn gửi (không bắt buộc)" value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                </div>
                <div className="ri-act">
                  {r.status === 'pending' && <button className="cm-btn cm-btn-sm" disabled={busyId === r.id} onClick={() => resolve(r, 'seen')}>Đã xem</button>}
                  <button className="cm-btn cm-btn-sm cm-btn-ok" disabled={busyId === r.id} onClick={() => resolve(r, 'accepted')}>Xác nhận đúng</button>
                  <button className="cm-btn cm-btn-sm cm-btn-danger" disabled={busyId === r.id} onClick={() => resolve(r, 'dismissed')}>Không xử lý</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
