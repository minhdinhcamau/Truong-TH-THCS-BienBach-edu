'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).map((w) => w[0]).join('').toUpperCase();
}

function StarMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="#a71d24" />
      <polygon
        fill="#f4b73d"
        points="20,6.5 23.6,15.6 33.4,16.2 25.9,22.5 28.3,32 20,26.8 11.7,32 14.1,22.5 6.6,16.2 16.4,15.6"
      />
    </svg>
  );
}

// Thông báo nhỏ ở đáy màn hình. msg = { type: 'ok' | 'error', text } hoặc null
export function Toast({ msg, onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => doneRef.current?.(), 5000);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return <div className={`bb-toast ${msg.type}`} role="status">{msg.text}</div>;
}

// Hộp thoại giữa màn hình
export function Modal({ title, onClose, wide, children }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className={`bb-modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>{title}</h3>
          <button className="btn btn-sm" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AppShell({ profile, roleLabel, nav = [], activeHref, onLogout, children }) {
  return (
    <div className="app">
      <style jsx global>{`
        .app {
          --red: #c4262e; --red-d: #8f1a20; --gold: #f4b73d; --ink: #1b2430; --muted: #627083;
          --line: #e2e7ee; --bg: #f2f4f7; --card: #ffffff; --ok: #1a8a58; --ok-bg: #e6f6ee;
          --warn: #9a6708; --warn-bg: #fff4dc; --bad: #b3261e; --bad-bg: #fdeceb;
          font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: var(--ink); background: var(--bg);
          min-height: 100vh; line-height: 1.5;
        }
        .app *, .app *::before, .app *::after { box-sizing: border-box; }
        .app h1, .app h2, .app h3 { font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; margin: 0; }
        .app button, .app input, .app select, .app textarea { font-family: inherit; }
        .app :focus-visible { outline: 3px solid #f4b73d; outline-offset: 2px; }

        .app .bb-masthead { background: var(--red); color: #fff; }
        .app .mast-in { max-width: 1080px; margin: 0 auto; padding: 14px 18px; display: flex; align-items: center;
          justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .app .bb-brand { display: flex; align-items: center; gap: 12px; }
        .app .brand-t { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 19px; line-height: 1.1; }
        .app .brand-s { font-size: 12px; opacity: 0.88; }
        .app .who { display: flex; align-items: center; gap: 10px; }
        .app .avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--gold); color: #5a3b00;
          font-weight: 800; font-size: 12.5px; display: grid; place-items: center; }
        .app .who-n { font-weight: 600; font-size: 13px; line-height: 1.2; }
        .app .who-r { font-size: 11px; opacity: 0.88; }
        .app .out-btn { border: 1px solid rgba(255,255,255,0.5); background: transparent; color: #fff; border-radius: 999px;
          padding: 7px 14px; font-weight: 600; font-size: 12.5px; cursor: pointer; }
        .app .out-btn:hover { background: rgba(255,255,255,0.12); }
        .app a.out-btn { text-decoration: none; display: inline-block; }

        .app .nav { background: #fff; border-bottom: 1px solid var(--line); }
        .app .nav-in { max-width: 1080px; margin: 0 auto; padding: 0 10px; display: flex; overflow-x: auto; }
        .app .nav a, .app .nav .soon { padding: 12px 14px; font-size: 13.5px; font-weight: 600; color: var(--muted);
          white-space: nowrap; border-bottom: 3px solid transparent; text-decoration: none; }
        .app .nav a:hover { color: var(--ink); }
        .app .nav a.on { color: var(--red); border-bottom-color: var(--red); }
        .app .nav .soon { opacity: 0.45; cursor: not-allowed; }

        .app .main { max-width: 1080px; margin: 0 auto; padding: 22px 18px 90px; }
        .app .pg-title { font-size: 23px; }
        .app .pg-sub { color: var(--muted); font-size: 13.5px; margin: 2px 0 18px; }

        .app .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px; margin-bottom: 16px; }
        .app .card-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .app .card-h h3 { font-size: 16.5px; }
        .app .hint { color: var(--muted); font-size: 13px; margin: 0 0 12px; }

        .app .btn { border: 1px solid #d5dbe4; background: #fff; color: var(--ink); border-radius: 10px; padding: 8px 14px;
          font-weight: 600; font-size: 13px; cursor: pointer; }
        .app .btn:hover:not(:disabled) { background: #f5f7fa; }
        .app .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .app .btn-red { background: var(--red); border-color: var(--red); color: #fff; }
        .app .btn-red:hover:not(:disabled) { background: var(--red-d); }
        .app .btn-ok { background: var(--ok); border-color: var(--ok); color: #fff; }
        .app .btn-ok:hover:not(:disabled) { background: #146e46; }
        .app .btn-danger { color: var(--bad); border-color: #f0c4c0; }
        .app .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 8px; }

        .app .pill { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
        .app .pill.ok { background: var(--ok-bg); color: var(--ok); }
        .app .pill.warn { background: var(--warn-bg); color: var(--warn); }
        .app .pill.bad { background: var(--bad-bg); color: var(--bad); }
        .app .pill.mute { background: #eceff4; color: var(--muted); }

        .app .tbl-wrap { overflow-x: auto; }
        .app .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
        .app .tbl th { text-align: left; padding: 8px; border-bottom: 2px solid var(--line); color: var(--muted);
          font-weight: 700; white-space: nowrap; }
        .app .tbl td { padding: 9px 8px; border-bottom: 1px solid #eef1f5; vertical-align: middle; }
        .app .num { font-variant-numeric: tabular-nums; }

        .app .input { width: 100%; padding: 9px 12px; border: 1px solid #d5dbe4; border-radius: 10px; font-size: 13.5px; background: #fff; color: var(--ink); }
        .app .input:focus { outline: 2px solid #f0b4b7; border-color: var(--red); }
        .app .lbl { display: block; font-size: 12.5px; font-weight: 700; margin: 12px 0 4px; }
        .app .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .app .grow { flex: 1; min-width: 160px; }
        .app .empty { color: var(--muted); font-size: 13.5px; padding: 18px 4px; text-align: center; }
        .app .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .app .chip { background: #eceff4; border-radius: 999px; padding: 3px 11px; font-size: 12px; font-weight: 600; }
        .app .center-loading { text-align: center; padding: 90px 0; color: var(--muted); }

        .app .backdrop { position: fixed; inset: 0; background: rgba(20,28,40,0.5); z-index: 300; display: flex;
          align-items: center; justify-content: center; padding: 16px; }
        .app .bb-modal { background: #fff; border-radius: 16px; padding: 20px; width: 100%; max-width: 520px; max-height: 88vh; overflow: auto; }
        .app .bb-modal.wide { max-width: 780px; }
        .app .modal-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 10px; }
        .app .modal-h h3 { font-size: 17px; }
        .app .modal-f { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }

        .app .bb-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 400;
          max-width: calc(100% - 32px); padding: 12px 20px; border-radius: 999px; text-align: center;
          font-weight: 700; font-size: 13.5px; color: #fff; box-shadow: 0 10px 26px -8px rgba(0,0,0,0.35); }
        .app .bb-toast.ok { background: var(--ok); }
        .app .bb-toast.error { background: var(--bad); }
      `}</style>

      <header className="bb-masthead">
        <div className="mast-in">
          <div className="bb-brand">
            <StarMark />
            <div>
              <div className="brand-t">Đội Thiếu niên Tiền phong</div>
              <div className="brand-s">Trường TH - THCS Biển Bạch</div>
            </div>
          </div>
          <div className="who">
            <div className="avatar">{initialsOf(profile?.full_name)}</div>
            <div>
              <div className="who-n">{profile?.full_name}</div>
              <div className="who-r">{roleLabel}</div>
            </div>
            {profile?.role === "admin" && <Link href="/admin" className="out-btn">Trang quản trị</Link>}
            <button className="out-btn" onClick={onLogout}>Đăng xuất</button>
          </div>
        </div>
      </header>

      {nav.length > 0 && (
        <nav className="nav" aria-label="Điều hướng">
          <div className="nav-in">
            {nav.map((n) =>
              n.soon ? (
                <span key={n.href} className="soon" title="Sắp có">{n.label}</span>
              ) : (
                <Link key={n.href} href={n.href} className={activeHref === n.href ? 'on' : ''}>{n.label}</Link>
              )
            )}
          </div>
        </nav>
      )}

      <main className="main">{children}</main>
    </div>
  );
}
