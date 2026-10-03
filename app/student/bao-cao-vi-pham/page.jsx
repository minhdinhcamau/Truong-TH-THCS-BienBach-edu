'use client';
import { useState } from 'react';
import { useStudent } from '../layout';
import { CmRoot, CmToast } from '../../../components/classmgr/Ui';
import MemberReportForm from '../../../components/classmgr/MemberReportForm';

// Trang dành cho mọi học sinh: báo cáo bạn cùng lớp vi phạm, gửi cho giáo viên chủ nhiệm.
export default function BaoCaoViPhamPage() {
  const { profile } = useStudent();
  const [msg, setMsg] = useState(null);

  return (
    <div style={{ '--cm-accent': '#225DA3', '--cm-accent-d': '#174a86' }}>
      <h2 className="section-title">Báo cáo vi phạm</h2>
      <p className="section-sub">Em thấy bạn trong lớp vi phạm? Gửi báo cáo cụ thể cho thầy/cô chủ nhiệm.</p>
      {!profile?.class_id ? (
        <div className="empty-note" style={{ padding: '40px 0' }}>Tài khoản của em chưa được xếp vào lớp nào. Hãy hỏi thầy/cô để được xếp lớp.</div>
      ) : (
        <CmRoot>
          <MemberReportForm classId={profile.class_id} toast={setMsg} />
          <CmToast msg={msg} onDone={() => setMsg(null)} />
        </CmRoot>
      )}
    </div>
  );
}
