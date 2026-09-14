'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { getRankTier, getInitials } from '../../lib/rankTiers';
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
];

export default function StudentLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState({ loading: true, profile: null, stats: null });

  async function loadAll() {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, student_code, photo_url, class_id, classes!profiles_class_id_fkey(name)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      alert('Không tải được hồ sơ học sinh.');
      setState({ loading: false, profile: null, stats: null });
      return;
    }

    const { data: stats } = await supabase
      .from('student_stats')
      .select('total_xp, current_streak, longest_streak')
      .eq('student_id', user.id)
      .maybeSingle();

    setState({
      loading: false,
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

  const { profile, stats } = state;
  const tier = getRankTier(stats.total_xp);
  const initials = getInitials(profile.full_name);

  return (
    <StudentContext.Provider value={{ profile, stats, refresh: loadAll }}>
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
              <button className="logout-btn" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        </div>

        <div className="student-wrap">
          <div className="tabbar">
            {TABS.map((t) => (
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
