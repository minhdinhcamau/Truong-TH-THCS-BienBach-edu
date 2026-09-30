'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import AppealAlert from './tpt/AppealAlert';

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).map((w) => w[0]).join('').toUpperCase();
}

// Logo chinh thuc Doi Thieu nien Tien phong Ho Chi Minh (anh nguoi dung cung cap), nhung
// da thu nho + nen webp de nhe (~14KB) truoc khi nhung thang vao code - khong can luu file
// rieng, khong phu thuoc duong dan anh ngoai.
const LOGO_DATA_URI = 'data:image/webp;base64,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';

function StarMark() {
  return (
    <img
      src={LOGO_DATA_URI}
      alt="Huy hiệu Đội Thiếu niên Tiền phong Hồ Chí Minh"
      width="38"
      height="41"
      style={{ display: 'block', objectFit: 'contain' }}
    />
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
            {(profile?.is_tpt || profile?.role === "admin") && <AppealAlert />}
            {profile?.role === "teacher" && (
              <Link href="/teacher" className="out-btn">← Trang giáo viên</Link>
            )}
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
