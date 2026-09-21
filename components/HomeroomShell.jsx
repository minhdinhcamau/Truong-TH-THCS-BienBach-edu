'use client';
import Link from 'next/link';

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).map((w) => w[0]).join('').toUpperCase();
}

// Khung giao diện RIÊNG của khu vực giáo viên chủ nhiệm (màu xanh lá của khối giáo viên,
// không dùng giao diện Đội TNTP của Tổng phụ trách).
export default function HomeroomShell({ profile, roleLabel, active, showHomeroom, onLogout, children }) {
  return (
    <div className="hr-root">
      <style jsx global>{`
        .hr-root {
          --hr-green: #2f6f5e; --hr-green-d: #234f42; --hr-deep: #17382f; --hr-tint: #e8f2ee; --hr-line: #dce6e1; --hr-ink: #16231f; --hr-muted: #5b6e66;
          --cm-accent: #2f6f5e; --cm-accent-d: #234f42;
          font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: var(--hr-ink); background: #f2f6f4; min-height: 100vh; line-height: 1.5;
        }
        .hr-root *, .hr-root *::before, .hr-root *::after { box-sizing: border-box; }
        .hr-root h1, .hr-root h2, .hr-root h3 { font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; margin: 0; }
        .hr-root :focus-visible { outline: 3px solid #f2c94c; outline-offset: 2px; }
        .hr-top { background: #fff; border-bottom: 1px solid var(--hr-line); position: sticky; top: 0; z-index: 20; }
        .hr-top-in { max-width: 1180px; margin: 0 auto; padding: 10px 20px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .hr-back { color: var(--hr-green); font-weight: 700; font-size: 13.5px; text-decoration: none; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--hr-line); background: #fff; white-space: nowrap; }
        .hr-back:hover { background: var(--hr-tint); }
        .hr-nav { display: inline-flex; background: #eef3f1; border-radius: 999px; padding: 3px; gap: 2px; }
        .hr-nav a { padding: 7px 16px; border-radius: 999px; font-weight: 700; font-size: 13.5px; color: var(--hr-muted); text-decoration: none; white-space: nowrap; }
        .hr-nav a.on { background: var(--hr-green); color: #fff; }
        .hr-nav a:not(.on):hover { color: var(--hr-ink); }
        .hr-who { margin-left: auto; display: flex; align-items: center; gap: 10px; }
        .hr-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--hr-green); color: #fff; font-weight: 800; font-size: 12.5px; display: grid; place-items: center; }
        .hr-who-n { font-weight: 700; font-size: 13px; line-height: 1.2; }
        .hr-who-r { font-size: 11.5px; color: var(--hr-muted); }
        .hr-out { border: 1px solid var(--hr-line); background: #fff; color: var(--hr-ink); border-radius: 999px; padding: 7px 14px; font-weight: 600; font-size: 12.5px; cursor: pointer; }
        .hr-out:hover { background: var(--hr-tint); }
        .hr-main { max-width: 1180px; margin: 0 auto; padding: 22px 20px 90px; }
        .hr-title { font-size: 24px; }
        .hr-sub { color: var(--hr-muted); font-size: 13.5px; margin: 2px 0 18px; }
        .hr-card { background: #fff; border: 1px solid var(--hr-line); border-radius: 16px; padding: 18px 20px; margin-bottom: 16px; }
        .hr-empty { color: var(--hr-muted); text-align: center; padding: 26px 8px; font-size: 14px; }

        /* Trang bìa lớp: kẻ dòng như trang vở / sổ chủ nhiệm */
        .hr-hero { position: relative; background-color: var(--hr-deep);
          background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 30px);
          color: #fff; border-radius: 20px; padding: 24px 28px; margin-bottom: 18px; display: flex; justify-content: space-between; gap: 22px; flex-wrap: wrap; align-items: flex-end; overflow: hidden; }
        .hr-hero::before { content: ''; position: absolute; left: 22px; top: 0; bottom: 0; width: 2px; background: rgba(240, 120, 110, 0.55); }
        .hr-hero-l { padding-left: 18px; min-width: 0; }
        .hr-hero-l small { color: #b9d6cb; font-size: 13px; }
        .hr-hero h1 { font-size: 46px; line-height: 1.05; color: #fff; }
        .hr-hero-l p { margin: 6px 0 0; color: #d7e9e1; font-size: 14px; }
        .hr-stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .hr-stat { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.16); border-radius: 14px; padding: 10px 16px; min-width: 104px; }
        .hr-stat small { display: block; color: #b9d6cb; font-size: 11.5px; }
        .hr-stat b { font-family: 'Baloo 2', sans-serif; font-size: 26px; line-height: 1.15; }
        .hr-pick { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; padding: 7px 10px; font-size: 13.5px; font-weight: 600; }
        .hr-pick option { color: #16231f; }
        @media (max-width: 640px) { .hr-hero h1 { font-size: 36px; } .hr-who-n, .hr-who-r { display: none; } }
      `}</style>

      <header className="hr-top">
        <div className="hr-top-in">
          <Link href="/teacher" className="hr-back">← Trang giáo viên</Link>
          <nav className="hr-nav" aria-label="Điều hướng giáo viên">
            <Link href="/teacher/thi-dua" className={active === 'thi-dua' ? 'on' : ''}>Thi đua lớp</Link>
            {showHomeroom && <Link href="/teacher/chu-nhiem" className={active === 'chu-nhiem' ? 'on' : ''}>Chủ nhiệm lớp</Link>}
          </nav>
          <div className="hr-who">
            <div className="hr-avatar">{initialsOf(profile?.full_name)}</div>
            <div>
              <div className="hr-who-n">{profile?.full_name}</div>
              <div className="hr-who-r">{roleLabel}</div>
            </div>
            <button className="hr-out" onClick={onLogout}>Đăng xuất</button>
          </div>
        </div>
      </header>
      <main className="hr-main">{children}</main>
    </div>
  );
}
