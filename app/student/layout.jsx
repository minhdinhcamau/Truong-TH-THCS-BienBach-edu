'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { getRankTier, getInitials } from '../../lib/rankTiers';
import NotificationBell from '../../components/NotificationBell';
import './student.css';
import './ui.css';

export const StudentContext = createContext(null);
export function useStudent() {
  return useContext(StudentContext);
}

// Thanh chuyển mục. "Học tập" là trang tổng hợp các môn (Ngữ văn, Tiếng Anh, Âm nhạc...)
const TABS = [
  {
    href: '/student',
    label: 'Học tập',
    match: (p) => p === '/student' || p.startsWith('/student/english') || p.startsWith('/student/music') || p.startsWith('/student/ngu-van'),
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
    href: '/student/khieu-nai',
    label: 'Khiếu nại',
    match: (p) => p.startsWith('/student/khieu-nai'),
    icon: <path d="M12 9v4M12 17h.01M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0z" />,
  },
  {
    href: '/student/bang-tin',
    label: 'Bảng tin',
    match: (p) => p.startsWith('/student/bang-tin'),
    icon: <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5zM17 9h3v8a2 2 0 0 1-2 2M8 9h6M8 13h6" />,
  },
  {
    href: '/student/bao-cao-vi-pham',
    label: 'Báo cáo vi phạm',
    match: (p) => p.startsWith('/student/bao-cao-vi-pham'),
    icon: <path d="M4 4h16v12H8l-4 4V4zM9 9h6M9 12h4" />,
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
    return <div className="student-shell sx-shell"><div className="sx-loading">Đang tải…</div></div>;
  }
  if (!state.profile) {
    return null;
  }

  const { profile, stats, classRole } = state;
  const tabs = classRole && profile.role !== 'admin' ? [...TABS, BCS_TAB] : TABS;
  // Quản trị viên bấm "Xem trang Học sinh" từ trang admin -> hiện nút quay về thay vì các tính năng của học sinh
  const isAdminViewing = profile.role === 'admin';
  const tier = getRankTier(stats.total_xp);
  const initials = getInitials(profile.full_name);

  return (
    <StudentContext.Provider value={{ profile, stats, classRole, refresh: loadAll }}>
      <div className="student-shell sx-shell">
        <header className="sx-top">
          <div className="sx-top-in">
            <div className="sx-brand">
              <img src="/logo-truong.png" alt="Logo Trường TH - THCS Biển Bạch" className="sx-logo" width="62" height="62" />
              <div>
                <div className="sx-school">Trường TH - THCS Biển Bạch</div>
                <div className="sx-place">Xã Biển Bạch, tỉnh Cà Mau</div>
              </div>
            </div>

            <div className="sx-actions">
              {!isAdminViewing && (
                <div className="sx-chip">
                  <div className={`avatar-frame ${tier.className}`} style={{ width: 46, height: 46 }}>
                    <div className="core" style={{ width: 38, height: 38, fontSize: 14 }}>
                      {profile.photo_url ? <img src={profile.photo_url} alt="" /> : initials}
                    </div>
                    {tier.badge && <div className="rank-badge">{tier.badge}</div>}
                  </div>
                  <div>
                    <div className="sx-name">{profile.full_name} · Lớp {profile.classes?.name || '—'}</div>
                    <div className="sx-sub">
                      <span>{tier.name}</span>
                      <span className="sx-tag">{stats.current_streak} ngày liên tiếp</span>
                      <span className="sx-tag">{stats.total_xp.toLocaleString('vi-VN')} KN</span>
                    </div>
                  </div>
                </div>
              )}
              {isAdminViewing && (
                <Link href="/admin" className="sx-pill back">← Quay về trang quản trị</Link>
              )}
              {!isAdminViewing && profile.is_saodo && (
                <Link href="/saodo" className="sx-pill">Sao đỏ</Link>
              )}
              {!isAdminViewing && <NotificationBell studentId={profile.id} />}
              {!isAdminViewing && (
                <Link href="/student/doi-mat-khau" title="Đổi mật khẩu" className="sx-pill">Đổi mật khẩu</Link>
              )}
              <button className="sx-pill solid" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        </header>

        <div className="sx-wrap student-wrap">
          <nav className="sx-tabs" aria-label="Chuyển mục">
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} className={`sx-tab ${t.match(pathname) ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {t.icon}
                </svg>
                {t.label}
              </Link>
            ))}
          </nav>

          {children}

          <footer className="sx-footer">Không gian học tập · Trường TH-THCS Biển Bạch</footer>
        </div>
      </div>
    </StudentContext.Provider>
  );
}
