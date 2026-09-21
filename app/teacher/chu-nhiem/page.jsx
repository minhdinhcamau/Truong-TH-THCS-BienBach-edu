'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useHomeroom } from '@/lib/useHomeroom';
import { teacherNav } from '@/lib/nav';
import AppShell from '@/components/AppShell';
import ClassManager from '@/components/classmgr/ClassManager';

// Chủ nhiệm lớp: chỉ mở được khi tài khoản giáo viên được phân công chủ nhiệm (TPT / admin xem được mọi lớp).
export default function HomeroomPage() {
  const router = useRouter();
  const { profile, ready, logout } = useGuard('any');
  const isStudent = profile && profile.role === 'student' && !profile.is_tpt;
  const staff = !!profile && (profile.role === 'admin' || !!profile.is_tpt);
  const homeroom = useHomeroom(ready && !isStudent);
  const [allClasses, setAllClasses] = useState([]);
  const [classId, setClassId] = useState('');

  useEffect(() => { if (ready && isStudent) router.replace('/student/ban-can-su'); }, [ready, isStudent, router]);
  useEffect(() => {
    if (!ready || !staff) return;
    supabase.from('classes').select('id, name').order('name').then(({ data }) => setAllClasses((data || []).map((c) => ({ class_id: c.id, class_name: c.name }))));
  }, [ready, staff]);

  const classes = staff ? allClasses : homeroom.classes;
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].class_id); }, [classes, classId]);
  const current = classes.find((c) => c.class_id === classId);

  if (!ready || isStudent || (!staff && !homeroom.loaded)) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  const allowed = staff || homeroom.classes.length > 0;
  return (
    <AppShell profile={profile} roleLabel={staff ? (profile.role === 'admin' ? 'Quản trị viên' : 'Tổng phụ trách Đội') : 'Giáo viên chủ nhiệm'}
      nav={teacherNav(allowed)} activeHref="/teacher/chu-nhiem" onLogout={logout}>
      {!allowed ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="empty">
            Bạn chưa được phân công chủ nhiệm lớp nào nên chưa dùng được mục này. Hãy nhờ quản trị viên phân công trong mục “Phân công chủ nhiệm”.
            <div style={{ marginTop: 12 }}><Link href="/teacher" className="btn">← Về trang giáo viên</Link></div>
          </div>
        </div>
      ) : (
        <>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <h1 className="pg-title">Chủ nhiệm lớp {current?.class_name || ''}</h1>
              <p className="pg-sub" style={{ marginBottom: 0 }}>Giao chức vụ ban cán sự, thiết kế sơ đồ lớp, theo dõi ghi nhận và báo cáo tuần để sinh hoạt lớp.</p>
            </div>
            {classes.length > 1 && (
              <select className="input" style={{ width: 150 }} value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Chọn lớp">
                {classes.map((c) => <option key={c.class_id} value={c.class_id}>Lớp {c.class_name}</option>)}
              </select>
            )}
          </div>
          {classId && <ClassManager key={classId} classId={classId} className={current?.class_name} isStaff role={null} roleGroup={null} profileId={profile.id} />}
        </>
      )}
    </AppShell>
  );
}
