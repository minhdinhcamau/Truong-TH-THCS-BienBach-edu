'use client';
import { useStudent } from '../layout';
import ClassManager from '../../../components/classmgr/ClassManager';

// Trang dành cho học sinh có chức vụ trong ban cán sự (lớp trưởng, lớp phó, tổ trưởng, tổ phó).
export default function BanCanSuPage() {
  const { profile, classRole } = useStudent();
  return (
    <div style={{ '--cm-accent': '#225DA3', '--cm-accent-d': '#174a86' }}>
      <h2 className="section-title">Ban cán sự</h2>
      <p className="section-sub">Công cụ dành cho chức vụ của em trong lớp: ghi nhận, trực nhật, sơ đồ lớp…</p>
      {!classRole ? (
        <div className="empty-note" style={{ padding: '40px 0' }}>Em chưa được giao chức vụ ban cán sự. Hãy hỏi giáo viên chủ nhiệm nhé.</div>
      ) : (
        <ClassManager
          classId={classRole.class_id}
          className={classRole.class_name}
          isStaff={false}
          role={classRole.role}
          roleGroup={classRole.group_no}
          profileId={profile.id}
        />
      )}
    </div>
  );
}
