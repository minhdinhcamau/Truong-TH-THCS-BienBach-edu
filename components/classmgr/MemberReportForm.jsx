'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fmtIso, mondayOf, timeVN, vnTodayIso } from '@/lib/dates';

const MIN_LEN = 15;
const STATUS_LABEL = {
  pending: 'Đã gửi · chờ thầy/cô xem',
  seen: 'Thầy/cô đã xem',
  accepted: 'Thầy/cô đã xác nhận',
  dismissed: 'Thầy/cô đã xem xét',
};
const STATUS_TONE = { pending: 'mute', seen: 'mute', accepted: 'ok', dismissed: 'mute' };

// Học sinh báo cáo một bạn cùng lớp vi phạm: chọn bạn, nêu lý do cụ thể, gửi cho giáo viên chủ nhiệm.
export default function MemberReportForm({ classId, toast }) {
  const today = vnTodayIso();
  const monday = mondayOf(today);
  const [mates, setMates] = useState([]);
  const [types, setTypes] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]);

  const loadMine = useCallback(async () => {
    const { data } = await supabase.rpc('class_list_member_reports', { p_class_id: classId });
    setMine(data || []);
  }, [classId]);

  useEffect(() => {
    supabase.rpc('class_classmates', { p_class_id: classId }).then(({ data }) => setMates(data || []));
    // Danh mục lỗi chỉ để gợi ý; nếu tài khoản không đọc được thì bỏ qua, vẫn gửi được báo cáo
    supabase.from('class_record_types').select('code, label, kind').eq('kind', 'violation').order('sort_order')
      .then(({ data, error }) => { if (!error) setTypes(data || []); });
    loadMine();
  }, [classId, loadMine]);

  const byGroup = useMemo(() => {
    const m = new Map();
    mates.forEach((s) => {
      const k = s.group_no ? `Tổ ${s.group_no}` : 'Chưa xếp tổ';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [mates]);

  const len = reason.trim().length;
  const ready = !!studentId && len >= MIN_LEN;

  async function submit() {
    if (!ready) {
      toast({ type: 'error', text: `Hãy chọn bạn và trình bày cụ thể sự việc (ít nhất ${MIN_LEN} ký tự).` });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('class_submit_member_report', {
      p_class_id: classId, p_student_id: studentId, p_type_code: typeCode || null, p_reason: reason, p_date: date,
    });
    setBusy(false);
    if (error) {
      toast({ type: 'error', text: error.message });
      loadMine();
      return;
    }
    toast({ type: 'ok', text: 'Đã gửi báo cáo cho thầy/cô chủ nhiệm.' });
    setStudentId('');
    setTypeCode('');
    setReason('');
    setDate(today);
    loadMine();
  }

  return (
    <div className="mr-root">
      <style jsx>{`
        .mr-root { display: flex; flex-direction: column; gap: 14px; }
        .mr-ta { width: 100%; min-height: 110px; resize: vertical; font: inherit; }
        .mr-count { font-size: 12px; color: var(--cm-muted); text-align: right; margin-top: 4px; }
        .mr-count.bad { color: var(--cm-bad); }
        .mr-list { display: grid; gap: 8px; }
        .mr-row { border: 1px solid var(--cm-line); border-radius: 12px; padding: 11px 13px; }
        .mr-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
        .mr-name { font-weight: 800; font-size: 14px; }
        .mr-meta { font-size: 11.5px; color: var(--cm-muted); margin-top: 2px; }
        .mr-body { margin-top: 6px; font-size: 13.5px; white-space: pre-wrap; }
        .mr-reply { margin-top: 6px; font-size: 12.5px; background: #f3f9f6; border-radius: 10px; padding: 8px 10px; }
      `}</style>

      <div className="cm-card">
        <div className="cm-h"><h3>Báo cáo bạn vi phạm</h3></div>
        <p className="cm-hint">
          Em thấy bạn nào vi phạm thì gửi báo cáo cho thầy/cô chủ nhiệm. Hãy nói đúng sự thật và nêu cụ thể: ai, làm gì, ở đâu, lúc nào.
        </p>

        <label className="cm-lbl" htmlFor="mr-stu">Bạn bị báo cáo</label>
        <select id="mr-stu" className="cm-input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">— Chọn bạn trong lớp —</option>
          {byGroup.map(([g, list]) => (
            <optgroup key={g} label={g}>
              {list.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name}</option>)}
            </optgroup>
          ))}
        </select>

        {types.length > 0 && (
          <>
            <label className="cm-lbl" htmlFor="mr-type">Loại vi phạm (nếu rõ)</label>
            <select id="mr-type" className="cm-input" value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
              <option value="">Khác / chưa rõ — em sẽ nêu trong lý do</option>
              {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </>
        )}

        <label className="cm-lbl" htmlFor="mr-date">Việc xảy ra ngày</label>
        <input id="mr-date" type="date" className="cm-input" value={date} min={monday} max={today} onChange={(e) => setDate(e.target.value || today)} />

        <label className="cm-lbl" htmlFor="mr-reason">Trình bày cụ thể</label>
        <textarea id="mr-reason" className="cm-input mr-ta" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)}
          placeholder="VD: Tiết 3 sáng nay (môn Toán), bạn nói chuyện lớn với bạn bên cạnh, cô đã nhắc 2 lần nhưng bạn vẫn tiếp tục." />
        <div className={`mr-count ${len > 0 && len < MIN_LEN ? 'bad' : ''}`}>{len}/1000 · tối thiểu {MIN_LEN} ký tự</div>

        <div className="cm-foot" style={{ marginTop: 12 }}>
          <button className="cm-btn cm-btn-main" disabled={busy || !ready} onClick={submit}>{busy ? 'Đang gửi…' : 'Gửi cho thầy/cô chủ nhiệm'}</button>
        </div>
      </div>

      <div className="cm-card">
        <div className="cm-h"><h3>Báo cáo em đã gửi</h3></div>
        {mine.length === 0 ? (
          <div className="cm-empty">Em chưa gửi báo cáo nào.</div>
        ) : (
          <div className="mr-list">
            {mine.map((r) => (
              <div key={r.id} className="mr-row">
                <div className="mr-top">
                  <div>
                    <div className="mr-name">{r.student_name}{r.type_label ? ` — ${r.type_label}` : ''}</div>
                    <div className="mr-meta">Việc ngày {fmtIso(r.occurred_date)} · gửi lúc {timeVN(r.created_at)}</div>
                  </div>
                  <span className={`cm-pill ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>
                <div className="mr-body">{r.reason}</div>
                {r.gvcn_note ? <div className="mr-reply">Thầy/cô nhắn: {r.gvcn_note}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
