'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { getRank } from '../../lib/rank';
import { resolveAvatar } from '../../lib/cosmetics';
import AvatarFrame from '../../components/AvatarFrame';
import NotificationBell from '../../components/NotificationBell';
import DutyNoticePopup from '../../components/DutyNoticePopup';
import './student.css';
import './ui.css';
import './rank-fx.css';

export const StudentContext = createContext(null);
export function useStudent() {
  return useContext(StudentContext);
}

// Các mục chuyển trang. "Học tập" là trang tổng hợp các môn (Ngữ văn, Tiếng Anh, Âm nhạc...).
// bottom: hiện ở thanh menu dưới cùng trên điện thoại; các mục còn lại nằm trong menu "Thêm".
// main  : hiện thẳng trên thanh menu ngang của máy tính; các mục còn lại gom vào ô "Khác" để thanh luôn gọn MỘT hàng.
const TABS = [
  {
    href: '/student',
    label: 'Học tập',
    bottom: true,
    main: true,
    match: (p) => p === '/student' || p.startsWith('/student/english') || p.startsWith('/student/music') || p.startsWith('/student/ngu-van'),
    icon: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  },
  {
    href: '/student/thi-dua',
    label: 'Thi đua lớp',
    short: 'Thi đua',
    bottom: true,
    main: true,
    match: (p) => p.startsWith('/student/thi-dua'),
    icon: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  },
  {
    href: '/student/thoi-khoa-bieu',
    label: 'Thời khóa biểu',
    short: 'Lịch học',
    bottom: true,
    main: true,
    match: (p) => p.startsWith('/student/thoi-khoa-bieu'),
    icon: <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M9 4v3M15 4v3M8 14h3M13 14h3M8 17h3" />,
  },
  {
    href: '/student/bang-tin',
    label: 'Bảng tin',
    bottom: true,
    main: true,
    match: (p) => p.startsWith('/student/bang-tin'),
    icon: <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5zM17 9h3v8a2 2 0 0 1-2 2M8 9h6M8 13h6" />,
  },
  {
    href: '/student/truc-nhat',
    label: 'Trực nhật',
    main: true,
    match: (p) => p.startsWith('/student/truc-nhat'),
    icon: <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />,
  },
  {
    href: '/student/leaderboard',
    label: 'Xếp hạng',
    main: true,
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
    href: '/student/khieu-nai',
    label: 'Khiếu nại',
    match: (p) => p.startsWith('/student/khieu-nai'),
    icon: <path d="M12 9v4M12 17h.01M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0z" />,
  },
  {
    href: '/student/bao-cao-vi-pham',
    label: 'Báo cáo vi phạm',
    match: (p) => p.startsWith('/student/bao-cao-vi-pham'),
    icon: <path d="M4 4h16v12H8l-4 4V4zM9 9h6M9 12h4" />,
  },
];

const COSMETIC_TAB = {
  href: '/student/tuy-chinh',
  label: 'Tùy chỉnh khung',
  match: (p) => p.startsWith('/student/tuy-chinh'),
  icon: <path d="M12 3l2.4 5 5.6.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.6-.8z" />,
};

const BCS_TAB = {
  href: '/student/ban-can-su',
  label: 'Ban cán sự',
  match: (p) => p.startsWith('/student/ban-can-su'),
  icon: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" />,
};

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const DOTS = <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3.4" />;
const GRID = <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />;

export default function StudentLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState({ loading: true, profile: null, stats: null, classRole: null, cosPref: null });
  const [moreOpen, setMoreOpen] = useState(false);
  const [deskMoreOpen, setDeskMoreOpen] = useState(false); // ô "Khác" trên thanh menu máy tính
  const deskMoreRef = useRef(null);

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

    // Chức vụ ban cán sự (nếu có) -> hiện thêm mục "Ban cán sự"
    const { data: roleRows } = await supabase.rpc('my_class_role');

    const { data: cosPref } = await supabase.from('student_cosmetics').select('avatar_frame, chat_frame').eq('student_id', user.id).maybeSingle();

    setState({
      loading: false,
      cosPref: cosPref || null,
      classRole: roleRows && roleRows[0] ? roleRows[0] : null,
      profile,
      stats: stats || { total_xp: 0, current_streak: 0, longest_streak: 0 },
    });
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đổi trang thì đóng các menu
  useEffect(() => { setMoreOpen(false); setDeskMoreOpen(false); }, [pathname]);

  // Ô "Khác" (máy tính): bấm ra ngoài hoặc nhấn Esc thì đóng
  useEffect(() => {
    if (!deskMoreOpen) return undefined;
    const onDown = (e) => {
      if (deskMoreRef.current && !deskMoreRef.current.contains(e.target)) setDeskMoreOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setDeskMoreOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [deskMoreOpen]);

  // Mở menu thì khóa cuộn nền; bấm Esc để đóng
  useEffect(() => {
    if (!moreOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const k = (e) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', k);
    };
  }, [moreOpen]);

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

  const { profile, stats, classRole, cosPref } = state;
  const baseTabs = profile.role === 'admin' ? TABS : [...TABS, COSMETIC_TAB];
  const tabs = classRole && profile.role !== 'admin' ? [...baseTabs, BCS_TAB] : baseTabs;
  const bottomTabs = tabs.filter((t) => t.bottom);
  const moreTabs = tabs.filter((t) => !t.bottom);
  const moreActive = moreTabs.some((t) => t.match(pathname));
  // Thanh menu máy tính: mục chính hiện thẳng, mục còn lại gom vào ô "Khác"
  const deskMain = tabs.filter((t) => t.main);
  const deskExtra = tabs.filter((t) => !t.main);
  const deskExtraActive = deskExtra.some((t) => t.match(pathname));
  // Quản trị viên bấm "Xem trang Học sinh" từ trang admin -> hiện nút quay về thay vì các tính năng của học sinh
  const isAdminViewing = profile.role === 'admin';
  // Hạng theo tổng KN tích luỹ (lib/rank.js)
  const rankName = getRank(stats.total_xp).rank.name;

  // Khung avatar theo hạng. Margin âm để khung lớn hơn không làm thanh đầu trang cao thêm.
  const rankLevel = getRank(stats.total_xp).rank.level;
  const avatar = (size) => (
    <AvatarFrame
      src={profile.photo_url}
      name={profile.full_name}
      xp={stats.total_xp}
      frame={resolveAvatar(rankLevel, cosPref?.avatar_frame)}
      size={size}
    />
  );

  return (
    <StudentContext.Provider value={{ profile, stats, classRole, cosPref, refresh: loadAll }}>
      <div className="student-shell sx-shell" data-theme={rankLevel >= 6 ? 'star' : undefined}>
        <header className="sx-top">
          <div className="sx-top-in">
            <Link href="/student" className="sx-brand" aria-label="Về trang chủ">
              <img src="/logo-truong.png" alt="Logo Trường TH - THCS Biển Bạch" className="sx-logo" width="56" height="56" />
              <div className="sx-brand-t">
                <div className="sx-school">Trường TH - THCS Biển Bạch</div>
                <div className="sx-place">Xã Biển Bạch, tỉnh Cà Mau</div>
              </div>
            </Link>

            {/* Một chuông duy nhất (tránh kêu 2 lần); phần còn lại ẩn/hiện theo cỡ màn hình */}
            <div className="sx-actions">
              {!isAdminViewing && (
                <div className="sx-chip sx-desk-only" data-vip={rankLevel >= 6 ? 1 : 0}>
                  {avatar(60)}
                  <div>
                    <div className="sx-name">{profile.full_name} · Lớp {profile.classes?.name || '—'}</div>
                    <div className="sx-sub">
                      <span>{rankName}</span>
                      <span className="sx-tag">{stats.current_streak} ngày liên tiếp</span>
                      <span className="sx-tag">{stats.total_xp.toLocaleString('vi-VN')} KN</span>
                    </div>
                  </div>
                </div>
              )}
              {isAdminViewing && <Link href="/admin" className="sx-pill back">← Quay về trang quản trị</Link>}
              {!isAdminViewing && profile.is_saodo && <Link href="/saodo" className="sx-pill sx-desk-only">Sao đỏ</Link>}
              {!isAdminViewing && <NotificationBell studentId={profile.id} />}
              {!isAdminViewing && <Link href="/student/doi-mat-khau" title="Đổi mật khẩu" className="sx-pill sx-desk-only">Đổi mật khẩu</Link>}
              <button className="sx-pill solid sx-desk-only" onClick={handleLogout}>Đăng xuất</button>
              {/* Điện thoại: ảnh đại diện, bấm mở menu Thêm */}
              <button className="sx-avatar-btn sx-mob-only" onClick={() => setMoreOpen(true)} aria-label="Mở menu tài khoản">
                {avatar(50)}
              </button>
            </div>
          </div>
        </header>

        <div className="sx-wrap student-wrap">
          {/* Máy tính: thanh chuyển mục ngang, luôn MỘT hàng; mục ít dùng nằm trong ô "Khác" */}
          <nav className="sx-tabs" aria-label="Chuyển mục">
            {deskMain.map((t) => (
              <Link key={t.href} href={t.href} className={`sx-tab ${t.match(pathname) ? 'active' : ''}`} aria-current={t.match(pathname) ? 'page' : undefined}>
                <Icon d={t.icon} />
                {t.label}
              </Link>
            ))}
            {deskExtra.length > 0 && (
              <div className="sx-more" ref={deskMoreRef}>
                <button
                  type="button"
                  className={`sx-tab sx-more-btn ${deskExtraActive ? 'active' : ''}`}
                  onClick={() => setDeskMoreOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={deskMoreOpen}
                >
                  <Icon d={GRID} />
                  Khác
                  <svg className="sx-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {deskMoreOpen && (
                  <div className="sx-menu" role="menu">
                    {deskExtra.map((t) => (
                      <Link key={t.href} href={t.href} role="menuitem" className={t.match(pathname) ? 'active' : ''}>
                        <Icon d={t.icon} />
                        {t.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {children}

          <footer className="sx-footer">Không gian học tập · Trường TH-THCS Biển Bạch</footer>
        </div>

        {/* Điện thoại: thanh menu dưới cùng */}
        <nav className="sx-bottom" aria-label="Menu chính">
          {bottomTabs.map((t) => (
            <Link key={t.href} href={t.href} className={`sx-bt ${t.match(pathname) ? 'active' : ''}`} aria-current={t.match(pathname) ? 'page' : undefined}>
              <span className="sx-bt-ic"><Icon d={t.icon} /></span>
              <span className="sx-bt-lb">{t.short || t.label}</span>
            </Link>
          ))}
          <button type="button" className={`sx-bt ${moreActive || moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
            <span className="sx-bt-ic"><Icon d={DOTS} /></span>
            <span className="sx-bt-lb">Thêm</span>
          </button>
        </nav>

        {/* Menu "Thêm" */}
        {moreOpen && (
          <div className="sx-sheet-bg" onClick={() => setMoreOpen(false)}>
            <div className="sx-sheet" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
              <div className="sx-sheet-grip" aria-hidden="true" />
              {!isAdminViewing && (
                <div className="sx-sheet-me">
                  {avatar(76)}
                  <div className="sx-sheet-me-t">
                    <b>{profile.full_name}</b>
                    <span>Lớp {profile.classes?.name || '—'} · {rankName}</span>
                    <span>{stats.total_xp.toLocaleString('vi-VN')} KN · {stats.current_streak} ngày liên tiếp</span>
                  </div>
                  <button className="sx-sheet-x" onClick={() => setMoreOpen(false)} aria-label="Đóng">✕</button>
                </div>
              )}
              <div className="sx-sheet-grid">
                {moreTabs.map((t) => (
                  <Link key={t.href} href={t.href} className={`sx-tile ${t.match(pathname) ? 'active' : ''}`}>
                    <span className="sx-tile-ic"><Icon d={t.icon} /></span>
                    <span>{t.label}</span>
                  </Link>
                ))}
                {!isAdminViewing && profile.is_saodo && (
                  <Link href="/saodo" className="sx-tile">
                    <span className="sx-tile-ic"><Icon d={<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />} /></span>
                    <span>Sao đỏ</span>
                  </Link>
                )}
                {!isAdminViewing && (
                  <Link href="/student/doi-mat-khau" className="sx-tile">
                    <span className="sx-tile-ic"><Icon d={<path d="M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9H5z" />} /></span>
                    <span>Đổi mật khẩu</span>
                  </Link>
                )}
                {isAdminViewing && (
                  <Link href="/admin" className="sx-tile">
                    <span className="sx-tile-ic"><Icon d={<path d="M15 6l-6 6 6 6" />} /></span>
                    <span>Về trang quản trị</span>
                  </Link>
                )}
              </div>
              <button className="sx-sheet-out" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        )}

        {/* Hộp thông báo "Lớp bạn trực nhật tuần N" khi Tổng phụ trách đã công bố */}
        {!isAdminViewing && <DutyNoticePopup href="/student/truc-nhat" />}
      </div>
    </StudentContext.Provider>
  );
}
