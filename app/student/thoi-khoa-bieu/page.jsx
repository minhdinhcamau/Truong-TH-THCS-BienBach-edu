'use client';
// Thời khóa biểu riêng của lớp em: xem theo bảng (máy tính) hoặc theo ngày (điện thoại), có nút In và Lưu ảnh.
import { useEffect, useState } from 'react';
import { useStudent } from '../layout';
import { loadClassTimetable } from '@/lib/tkbClient';
import { fmtDate } from '@/lib/dates';
import ClassTimetable from '@/components/Timetable';

export default function StudentTimetablePage() {
  const ctx = useStudent();
  const classId = ctx?.profile?.class_id;
  const className = ctx?.profile?.classes?.name || '';
  const [state, setState] = useState({ loading: true, rows: [], effectiveFrom: null, upcoming: null });

  useEffect(() => {
    if (!classId) { setState({ loading: false, rows: [], effectiveFrom: null, upcoming: null }); return; }
    let alive = true;
    loadClassTimetable(classId).then((r) => { if (alive) setState({ loading: false, ...r }); });
    return () => { alive = false; };
  }, [classId]);

  return (
    <div>
      <h1 className="section-title">Thời khóa biểu lớp {className}</h1>
      <p className="section-sub">Bấm “Lưu ảnh” để tải về điện thoại, hoặc “In” để in ra giấy.</p>
      {state.loading ? (
        <div className="empty-note">Đang tải…</div>
      ) : state.rows.length === 0 ? (
        <div className="empty-note">Lớp em chưa có thời khóa biểu. Khi cô Tổng phụ trách cập nhật, thời khóa biểu sẽ hiện ở đây.</div>
      ) : (
        <>
          <ClassTimetable rows={state.rows} className={className} effectiveFrom={state.effectiveFrom} />
          {state.upcoming ? (
            <p className="section-sub" style={{ marginTop: 12 }}>Thời khóa biểu mới sẽ được áp dụng từ {fmtDate(state.upcoming)}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
