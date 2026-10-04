'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGuard } from '@/lib/useGuard';
import { useHomeroom } from '@/lib/useHomeroom';
import HomeroomShell from '@/components/HomeroomShell';
import DutyMapView from '@/components/DutyMapView';

// Giáo viên (và giáo viên chủ nhiệm) xem bản đồ trực nhật; lớp chủ nhiệm được tô nổi bật.
export default function TeacherDutyMapPage() {
  const router = useRouter();
  const { profile, ready, logout } = useGuard('any');
  const isStudent = !!profile && profile.role === 'student' && !profile.is_tpt;
  const staff = !!profile && (profile.role === 'admin' || !!profile.is_tpt);
  const homeroom = useHomeroom(ready && !isStudent);

  useEffect(() => { if (ready && isStudent) router.replace('/student/truc-nhat'); }, [ready, isStudent, router]);

  if (!ready || isStudent) return <div style={{ padding: 60, textAlign: 'center', color: '#5b6e66' }}>Đang tải…</div>;

  const showHomeroom = staff || homeroom.classes.length > 0;
  const roleLabel = staff ? (profile.role === 'admin' ? 'Quản trị viên' : 'Tổng phụ trách Đội') : 'Giáo viên';

  return (
    <HomeroomShell profile={profile} roleLabel={roleLabel} active="truc-nhat" showHomeroom={showHomeroom} onLogout={logout}>
      <DutyMapView accent="#2f6f5e" title="Trực nhật" />
    </HomeroomShell>
  );
}
