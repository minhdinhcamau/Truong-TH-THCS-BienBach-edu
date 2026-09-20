'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGuard } from '@/lib/useGuard';
import { ADMIN_NAV, SAODO_NAV, TPT_NAV } from '@/lib/nav';
import AppShell from '@/components/AppShell';
import RankingBoard from '@/components/RankingBoard';

// Bảng xếp hạng thi đua các lớp dành cho TPT, Sao đỏ và admin.
// Học sinh thường xem bảng này trong trang học sinh (/student/thi-dua).
export default function RankingPage() {
  const router = useRouter();
  const { profile, ready, logout } = useGuard('any');
  const isStaff = profile && (profile.role === 'admin' || profile.is_tpt || profile.is_saodo || profile.role === 'teacher');

  useEffect(() => {
    if (ready && profile && !isStaff) router.replace('/student/thi-dua');
  }, [ready, profile, isStaff, router]);

  if (!ready || !isStaff) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  const tpt = profile.role === 'admin' || profile.is_tpt;
  const nav = tpt ? TPT_NAV : profile.is_saodo ? SAODO_NAV : ADMIN_NAV;
  const roleLabel = tpt ? (profile.role === 'admin' ? 'Quản trị viên' : 'Tổng phụ trách Đội') : profile.is_saodo ? 'Đội Sao đỏ' : 'Giáo viên';

  return (
    <AppShell profile={profile} roleLabel={roleLabel} nav={tpt || profile.is_saodo ? nav : []} activeHref="/ranking" onLogout={logout}>
      <RankingBoard />
    </AppShell>
  );
}
