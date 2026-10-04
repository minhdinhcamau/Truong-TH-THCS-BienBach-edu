'use client';
import Link from 'next/link';

// Khung giao diện KIỂU TRƯỜNG HỌC cho khu vực thời khóa biểu của quản trị viên
// (logo và tên trường, không dùng huy hiệu/đầu trang của Đội Thiếu niên Tiền phong).
// Nhận cùng thuộc tính với AppShell để các trang dùng chung được: profile, roleLabel, activeHref, onLogout, children.
// Thanh chuyển mục luôn gồm đúng 3 mục của thời khóa biểu; các mục khác (Cấp quyền TPT, Phân công chủ nhiệm) nằm ở trang quản trị.
const TABS = [
  { href: '/admin/tkb', label: 'Thời khóa biểu', hint: 'Nhập file, xem, giờ học' },
  { href: '/admin/tkb/soan', label: 'Soạn và xếp tự động', hint: 'Xếp thời khóa biểu' },
  { href: '/admin/tkb/day-bu', label: 'Nghỉ và dạy bù', hint: 'Giáo viên xin nghỉ' },
];

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).map((w) => w[0]).join('').toUpperCase();
}

export default function TkbShell({ profile, roleLabel, activeHref, onLogout, children }) {
  return (
    <div className="app school">
      <style jsx global>{`
        .app.school {
          --red: #225da3; --red-d: #12305a; --gold: #e8af2e; --ink: #17253a; --muted: #5c6f86;
          --line: #dde7f1; --bg: #f3f6fa; --card: #ffffff; --ok: #1a7f4e; --ok-bg: #e6f6ee;
          --warn: #8a5b0a; --warn-bg: #fff4dc; --bad: #b3261e; --bad-bg: #fdeceb;
          --accent: #225da3; --navy: #12305a; --sky: #e9f2fc;
          font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: var(--ink); background: var(--bg);
          min-height: 100vh; line-height: 1.5;
        }
        .app.school *, .app.school *::before, .app.school *::after { box-sizing: border-box; }
        .app.school h1, .app.school h2, .app.school h3 { font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; margin: 0; }
        .app.school button, .app.school input, .app.school select, .app.school textarea { font-family: inherit; }
        .app.school :focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }

        /* Đầu trang: logo trường */
        .app.school .sch-top { position: sticky; top: 0; z-index: 30; background: rgba(255,255,255,0.96); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); }
        .app.school .sch-top-in { max-width: 1120px; margin: 0 auto; padding: 10px 24px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .app.school .sch-brand { display: flex; align-items: center; gap: 12px; min-width: 0; text-decoration: none; color: inherit; }
        .app.school .sch-logo { width: 50px; height: 50px; object-fit: contain; flex: none; display: block; }
        .app.school .sch-name { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 18px; line-height: 1.15; color: var(--navy); }
        .app.school .sch-place { font-size: 12px; color: var(--muted); }
        .app.school .sch-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .app.school .sch-chip { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 4px 16px 4px 4px; }
        .app.school .sch-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--red); color: #fff; font-weight: 700; font-size: 13px; display: grid; place-items: center; }
        .app.school .sch-uname { font-weight: 700; font-size: 13.5px; line-height: 1.2; color: var(--navy); }
        .app.school .sch-urole { font-size: 11.5px; color: var(--muted); }
        .app.school .sch-pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--navy);
          font-weight: 700; font-size: 12.5px; text-decoration: none; white-space: nowrap; cursor: pointer; }
        .app.school .sch-pill:hover { border-color: var(--red); }
        .app.school .sch-pill.out:hover { border-color: #a3374a; color: #a3374a; }

        /* Dải tiêu đề và thanh chuyển mục (luôn thấy, không phải cuộn tìm) */
        .app.school .sch-band { background-color: var(--navy); color: #fff; position: relative;
          background-image: radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px); background-size: 22px 22px; }
        .app.school .sch-band::after { content: ''; position: absolute; left: 24px; bottom: 0; width: 96px; height: 4px; background: var(--gold); border-radius: 4px 4px 0 0; }
        .app.school .sch-band-in { max-width: 1120px; margin: 0 auto; padding: 18px 24px 22px; }
        .app.school .sch-kicker { font-size: 12.5px; color: #a9c4e6; letter-spacing: 0.02em; }
        .app.school .sch-kicker b { color: #fff; font-weight: 700; }
        .app.school .sch-tabs { display: flex; gap: 8px; margin-top: 12px; overflow-x: auto; padding-bottom: 2px; -webkit-overflow-scrolling: touch; }
        .app.school .sch-tab { display: block; flex: none; padding: 9px 18px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 13.5px;
          color: #d6e5f8; border: 1px solid rgba(255,255,255,0.28); background: rgba(255,255,255,0.06); white-space: nowrap; }
        .app.school .sch-tab:hover { background: rgba(255,255,255,0.14); color: #fff; }
        .app.school .sch-tab.on { background: #fff; color: var(--navy); border-color: #fff; }

        .app.school .main { max-width: 1120px; margin: 0 auto; padding: 24px 24px 90px; }
        .app.school .pg-title { font-size: 26px; color: var(--navy); }
        .app.school .pg-sub { color: var(--muted); font-size: 13.5px; margin: 4px 0 18px; max-width: 880px; }

        .app.school .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(18,48,90,0.04); }
        .app.school .card-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .app.school .card-h h3 { font-size: 17px; color: var(--navy); }
        .app.school .hint { color: var(--muted); font-size: 13px; margin: 0 0 12px; }

        .app.school .btn { border: 1px solid #cfd9e6; background: #fff; color: var(--ink); border-radius: 10px; padding: 8px 14px; font-weight: 600; font-size: 13px; cursor: pointer; }
        .app.school .btn:hover:not(:disabled) { background: #f5f8fc; }
        .app.school .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .app.school .btn-red { background: var(--red); border-color: var(--red); color: #fff; text-decoration: none; display: inline-block; }
        .app.school .btn-red:hover:not(:disabled) { background: var(--red-d); }
        .app.school .btn-ok { background: var(--ok); border-color: var(--ok); color: #fff; }
        .app.school .btn-danger { color: var(--bad); border-color: #f0c4c0; }
        .app.school .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 8px; }

        .app.school .pill { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
        .app.school .pill.ok { background: var(--ok-bg); color: var(--ok); }
        .app.school .pill.warn { background: var(--warn-bg); color: var(--warn); }
        .app.school .pill.bad { background: var(--bad-bg); color: var(--bad); }
        .app.school .pill.mute { background: #eceff4; color: var(--muted); }

        .app.school .tbl-wrap { overflow-x: auto; }
        .app.school .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
        .app.school .tbl th { text-align: left; padding: 9px 8px; border-bottom: 2px solid var(--line); color: var(--muted); font-weight: 700; white-space: nowrap; background: #f8fafd; }
        .app.school .tbl td { padding: 9px 8px; border-bottom: 1px solid #eef1f5; vertical-align: middle; }
        .app.school .num { font-variant-numeric: tabular-nums; }

        .app.school .input { width: 100%; padding: 9px 12px; border: 1px solid #cfd9e6; border-radius: 10px; font-size: 13.5px; background: #fff; color: var(--ink); }
        .app.school .input:focus { outline: 2px solid #b7d0ec; border-color: var(--red); }
        .app.school .lbl { display: block; font-size: 12.5px; font-weight: 700; margin: 12px 0 4px; }
        .app.school .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .app.school .grow { flex: 1; min-width: 160px; }
        .app.school .empty { color: var(--muted); font-size: 13.5px; padding: 18px 4px; text-align: center; }
        .app.school .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .app.school .chip { background: #eceff4; border-radius: 999px; padding: 3px 11px; font-size: 12px; font-weight: 600; }
        .app.school .center-loading { text-align: center; padding: 90px 0; color: var(--muted); }

        .app.school .backdrop { position: fixed; inset: 0; background: rgba(20,28,40,0.5); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .app.school .bb-modal { background: #fff; border-radius: 16px; padding: 20px; width: 100%; max-width: 520px; max-height: 88vh; overflow: auto; }
        .app.school .bb-modal.wide { max-width: 780px; }
        .app.school .modal-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 10px; }
        .app.school .modal-f { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }

        .app.school .bb-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 400; max-width: calc(100% - 32px); padding: 12px 20px; border-radius: 999px;
          text-align: center; font-weight: 700; font-size: 13.5px; color: #fff; box-shadow: 0 10px 26px -8px rgba(0,0,0,0.35); }
        .app.school .bb-toast.ok { background: var(--ok); }
        .app.school .bb-toast.error { background: var(--bad); }

        @media (max-width: 640px) {
          .app.school .sch-top-in { padding: 10px 14px; }
          .app.school .sch-band-in { padding: 16px 14px 20px; }
          .app.school .sch-band::after { left: 14px; }
          .app.school .main { padding: 18px 14px 80px; }
          .app.school .sch-uname, .app.school .sch-urole { display: none; }
          .app.school .sch-chip { padding-right: 4px; }
          .app.school .pg-title { font-size: 22px; }
        }
      `}</style>

      <header className="sch-top">
        <div className="sch-top-in">
          <Link href="/admin" className="sch-brand" aria-label="Về trang quản trị">
            <img src="/logo-truong.png" alt="Logo Trường TH - THCS Biển Bạch" className="sch-logo" width="50" height="50" />
            <div>
              <div className="sch-name">Trường TH - THCS Biển Bạch</div>
              <div className="sch-place">Xã Biển Bạch, tỉnh Cà Mau</div>
            </div>
          </Link>
          <div className="sch-right">
            <div className="sch-chip">
              <div className="sch-avatar">{initialsOf(profile?.full_name)}</div>
              <div>
                <div className="sch-uname">{profile?.full_name || 'Quản trị viên'}</div>
                <div className="sch-urole">{roleLabel}</div>
              </div>
            </div>
            <Link href="/admin" className="sch-pill">← Trang quản trị</Link>
            <button type="button" className="sch-pill out" onClick={onLogout}>Đăng xuất</button>
          </div>
        </div>
      </header>

      <div className="sch-band">
        <div className="sch-band-in">
          <div className="sch-kicker">Quản trị · <b>Quản lý thời khóa biểu</b></div>
          <nav className="sch-tabs" aria-label="Các mục thời khóa biểu">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className={`sch-tab ${activeHref === t.href ? 'on' : ''}`} aria-current={activeHref === t.href ? 'page' : undefined} title={t.hint}>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="main">{children}</main>
    </div>
  );
}
