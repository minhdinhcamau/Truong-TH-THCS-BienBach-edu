'use client';
import { useEffect, useRef } from 'react';

// Khung + kiểu dáng dùng chung cho các công cụ quản lý lớp (dùng được cả ở trang giáo viên lẫn trang học sinh).
export function CmRoot({ children }) {
  return (
    <div className="cm-root">
      <style jsx global>{`
        .cm-root { --cm-red: #c4262e; --cm-red-d: #8f1a20; --cm-ink: #14263d; --cm-muted: #5f6f83; --cm-line: #e1e8f0;
          --cm-bg: #f3f6fa; --cm-ok: #1a8a58; --cm-warn: #9a6708; --cm-bad: #b3261e; color: var(--cm-ink); line-height: 1.5; }
        .cm-root *, .cm-root *::before, .cm-root *::after { box-sizing: border-box; }
        .cm-root button, .cm-root input, .cm-root select, .cm-root textarea { font-family: inherit; }
        .cm-root :focus-visible { outline: 3px solid #f4b73d; outline-offset: 2px; }
        .cm-root .cm-card { background: #fff; border: 1px solid var(--cm-line); border-radius: 14px; padding: 16px 18px; margin-bottom: 14px; }
        .cm-root .cm-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 0 10px; }
        .cm-root .cm-h h3 { margin: 0; font-size: 16.5px; font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; }
        .cm-root .cm-hint { color: var(--cm-muted); font-size: 12.5px; margin: 0 0 10px; }
        .cm-root .cm-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .cm-root .cm-grow { flex: 1; min-width: 150px; }
        .cm-root .cm-btn { border: 1px solid #d5dbe4; background: #fff; color: var(--cm-ink); border-radius: 10px; padding: 8px 14px; font-weight: 600; font-size: 13px; cursor: pointer; }
        .cm-root .cm-btn:hover:not(:disabled) { background: #f5f7fa; }
        .cm-root .cm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cm-root .cm-btn-red { background: var(--cm-red); border-color: var(--cm-red); color: #fff; }
        .cm-root .cm-btn-red:hover:not(:disabled) { background: var(--cm-red-d); }
        .cm-root .cm-btn-ok { background: var(--cm-ok); border-color: var(--cm-ok); color: #fff; }
        .cm-root .cm-btn-danger { color: var(--cm-bad); border-color: #f0c4c0; }
        .cm-root .cm-btn-sm { padding: 4px 10px; font-size: 12px; border-radius: 8px; }
        .cm-root .cm-input { width: 100%; padding: 8px 11px; border: 1px solid #d5dbe4; border-radius: 10px; font-size: 13.5px; background: #fff; color: var(--cm-ink); }
        .cm-root .cm-lbl { display: block; font-size: 12.5px; font-weight: 700; margin: 10px 0 4px; }
        .cm-root .cm-pill { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
        .cm-root .cm-pill.ok { background: #e6f6ee; color: var(--cm-ok); }
        .cm-root .cm-pill.warn { background: #fff4dc; color: var(--cm-warn); }
        .cm-root .cm-pill.bad { background: #fdeceb; color: var(--cm-bad); }
        .cm-root .cm-pill.mute { background: #eceff4; color: var(--cm-muted); }
        .cm-root .cm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .cm-root .cm-chip { background: #eceff4; border-radius: 999px; padding: 3px 11px; font-size: 12px; font-weight: 600; }
        .cm-root .cm-tabs { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid var(--cm-line); margin-bottom: 14px; }
        .cm-root .cm-tab { border: none; background: none; padding: 10px 14px; font-weight: 700; font-size: 13.5px; color: var(--cm-muted); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px; white-space: nowrap; }
        .cm-root .cm-tab.on { color: var(--cm-red); border-bottom-color: var(--cm-red); }
        .cm-root .cm-wrap { overflow-x: auto; }
        .cm-root .cm-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
        .cm-root .cm-tbl th { text-align: left; padding: 8px; border-bottom: 2px solid var(--cm-line); color: var(--cm-muted); font-weight: 700; white-space: nowrap; }
        .cm-root .cm-tbl td { padding: 8px; border-bottom: 1px solid #eef1f5; vertical-align: middle; }
        .cm-root .cm-empty { color: var(--cm-muted); font-size: 13.5px; text-align: center; padding: 18px 4px; }
        .cm-root .cm-num { font-variant-numeric: tabular-nums; }
        .cm-root .cm-backdrop { position: fixed; inset: 0; background: rgba(20,28,40,0.5); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .cm-root .cm-modal { background: #fff; border-radius: 16px; padding: 20px; width: 100%; max-width: 560px; max-height: 88vh; overflow: auto; }
        .cm-root .cm-foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; flex-wrap: wrap; }
        .cm-root .cm-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 600; max-width: calc(100% - 32px);
          padding: 12px 20px; border-radius: 999px; text-align: center; font-weight: 700; font-size: 13.5px; color: #fff; box-shadow: 0 10px 26px -8px rgba(0,0,0,0.35); }
        .cm-root .cm-toast.ok { background: var(--cm-ok); }
        .cm-root .cm-toast.error { background: var(--cm-bad); }
      `}</style>
      {children}
    </div>
  );
}

export function CmToast({ msg, onDone }) {
  const ref = useRef(onDone);
  ref.current = onDone;
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => ref.current?.(), 5000);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return <div className={`cm-toast ${msg.type}`} role="status">{msg.text}</div>;
}

export function CmModal({ title, onClose, children }) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && ref.current?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div className="cm-modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="cm-h"><h3>{title}</h3><button className="cm-btn cm-btn-sm" onClick={onClose} aria-label="Đóng">✕</button></div>
        {children}
      </div>
    </div>
  );
}
