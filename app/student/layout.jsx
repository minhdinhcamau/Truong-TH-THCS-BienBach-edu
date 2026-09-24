'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { getRankTier, getInitials } from '../../lib/rankTiers';
import NotificationBell from '../../components/NotificationBell';
import './student.css';

export const StudentContext = createContext(null);
export function useStudent() {
  return useContext(StudentContext);
}

const TABS = [
  {
    href: '/student',
    label: 'Học tập',
    match: (p) => p === '/student',
    icon: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  },
  {
    href: '/student/leaderboard',
    label: 'Xếp hạng',
    match: (p) => p.startsWith('/student/leaderboard'),
    icon: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a2 2 0 0 0 2 4M17 6h3a2 2 0 0 1-2 4" />,
  },
  {
    href: '/student/ask',
    label: 'Hỏi bài',
    match: (p) => p.startsWith('/student/ask'),
    icon: <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    href: '/student/thi-dua',
    label: 'Thi đua lớp',
    match: (p) => p.startsWith('/student/thi-dua'),
    icon: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  },
  {
    href: '/student/bang-tin',
    label: 'Bảng tin',
    match: (p) => p.startsWith('/student/bang-tin'),
    icon: <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5zM17 9h3v8a2 2 0 0 1-2 2M8 9h6M8 13h6" />,
  },
];

const BCS_TAB = {
  href: '/student/ban-can-su',
  label: 'Ban cán sự',
  match: (p) => p.startsWith('/student/ban-can-su'),
  icon: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" />,
};

export default function StudentLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState({ loading: true, profile: null, stats: null, classRole: null });

  async function loadAll() {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, student_code, photo_url, class_id, is_saodo, classes!profiles_class_id_fkey(name)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      alert('Không tải được hồ sơ học sinh.');
      setState({ loading: false, profile: null, stats: null, classRole: null });
      return;
    }

    const { data: stats } = await supabase
      .from('student_stats')
      .select('total_xp, current_streak, longest_streak')
      .eq('student_id', user.id)
      .maybeSingle();

    // Chức vụ ban cán sự (nếu có) -> hiện thêm tab "Ban cán sự"
    const { data: roleRows } = await supabase.rpc('my_class_role');

    setState({
      loading: false,
      classRole: roleRows && roleRows[0] ? roleRows[0] : null,
      profile,
      stats: stats || { total_xp: 0, current_streak: 0, longest_streak: 0 },
    });
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (state.loading) {
    return <div className="student-shell"><div className="center-loading">Đang tải…</div></div>;
  }
  if (!state.profile) {
    return null;
  }

  const { profile, stats, classRole } = state;
  const tabs = classRole && profile.role !== 'admin' ? [...TABS, BCS_TAB] : TABS;
  // Tai khoan dang xem trang nay la QUAN TRI VIEN (admin bam nut "Xem trang
  // Hoc sinh" tu trang admin, khong phai hoc sinh that) -> hien nut quay ve
  // thay vi bat cac tinh nang chi danh cho hoc sinh.
  const isAdminViewing = profile.role === 'admin';
  const tier = getRankTier(stats.total_xp);
  const initials = getInitials(profile.full_name);

  return (
    <StudentContext.Provider value={{ profile, stats, classRole, refresh: loadAll }}>
      <div className="student-shell">
        <div className="hero">
          <div className="masthead">
            <div className="brand">
              <div className="emblem">BB</div>
              <div className="brand-text">
                <div className="school">Trường TH - THCS Biển Bạch</div>
                <div className="loc">Xã Biển Bạch, tỉnh Cà Mau</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!isAdminViewing && (
                <div className="student-chip">
                  <div className={`avatar-frame ${tier.className}`} style={{ width: 46, height: 46 }}>
                    <div className="core" style={{ width: 38, height: 38, fontSize: 14 }}>
                      {profile.photo_url ? <img src={profile.photo_url} alt="" /> : initials}
                    </div>
                    {tier.badge && <div className="rank-badge">{tier.badge}</div>}
                  </div>
                  <div className="student-info">
                    <div className="name-row">
                      {profile.full_name} · Lớp {profile.classes?.name || '—'}
                    </div>
                    <div className="sub-row">
                      <span>{tier.name}</span>
                      <span className="streak-pill">🔥 {stats.current_streak} ngày</span>
                      <span className="xp-pill">⭐ {stats.total_xp.toLocaleString('vi-VN')} KN</span>
                    </div>
                  </div>
                </div>
              )}
              {isAdminViewing && (
                <Link
                  href="/admin"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: '1px solid #cfe2f7',
                    background: '#fff',
                    color: '#1b3a63',
                    fontWeight: 600,
                    fontSize: 12.5,
                    whiteSpace: 'nowrap',
                    textDecoration: 'none',
                  }}
                >
                  ← Quay về trang quản trị
                </Link>
              )}
              {!isAdminViewing && profile.is_saodo && (
                <Link
                  href="/saodo"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.5)',
                    background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 700, fontSize: 12.5,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  ⭐ Sao đỏ
                </Link>
              )}
              {!isAdminViewing && <NotificationBell studentId={profile.id} />}
              {!isAdminViewing && (
                <Link
                  href="/student/doi-mat-khau"
                  title="Đổi mật khẩu"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.5)',
                    background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600, fontSize: 12.5,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  🔑 Đổi mật khẩu
                </Link>
              )}
              <button className="logout-btn" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        </div>

        <div className="student-wrap">
          <div className="tabbar">
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} className={`tab-btn ${t.match(pathname) ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {t.icon}
                </svg>
                {t.label}
              </Link>
            ))}
          </div>

          {children}

          <footer className="student-footer">Không gian học tập · Trường TH-THCS Biển Bạch</footer>
        </div>
      </div>
    </StudentContext.Provider>
  );
}
