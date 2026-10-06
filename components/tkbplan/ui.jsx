'use client';
import { useEffect } from 'react';

// CSS riêng của trang soạn thời khóa biểu. Mọi lớp đều có tiền tố "pl-" để không ảnh hưởng nơi khác.
// Dùng biến màu của TkbShell (--accent, --navy, --line, --ok, --warn, --bad...) và có giá trị dự phòng.
export function PlanStyles() {
  return (
    <style jsx global>{`
      .pl-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
      .pl-top h1 { font-size: 26px; color: var(--navy, #12305a); }
      .pl-lead { color: var(--muted, #5c6f86); font-size: 13.5px; margin: 4px 0 0; max-width: 760px; }
      .pl-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

      .pl-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0 0 18px; }
      .pl-step { display: flex; gap: 10px; align-items: center; text-align: left; padding: 12px 14px; border: 1px solid var(--line, #dde7f1); background: #fff; border-radius: 14px; cursor: pointer; font: inherit; color: inherit; min-width: 0; }
      .pl-step:hover { border-color: #b7d0ec; }
      .pl-step.on { border-color: var(--accent, #225da3); box-shadow: 0 0 0 3px #dbe9f9; background: #f7fbff; }
      .pl-step-n { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 13px; background: #e9f2fc; color: var(--accent, #225da3); flex: none; }
      .pl-step.on .pl-step-n { background: var(--accent, #225da3); color: #fff; }
      .pl-step.done .pl-step-n { background: var(--ok, #1a7f4e); color: #fff; }
      .pl-step b { display: block; font-size: 13.5px; color: var(--navy, #12305a); line-height: 1.25; }
      .pl-step small { display: block; color: var(--muted, #5c6f86); font-size: 12px; line-height: 1.3; }
      .pl-step small.warn { color: var(--warn, #8a5b0a); font-weight: 700; }

      .pl-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
      .pl-stat { background: #fff; border: 1px solid var(--line, #dde7f1); border-radius: 14px; padding: 12px 14px; }
      .pl-stat-n { font-size: 24px; font-weight: 800; color: var(--navy, #12305a); line-height: 1.1; font-variant-numeric: tabular-nums; }
      .pl-stat-l { font-size: 12.5px; color: var(--muted, #5c6f86); margin-top: 2px; }
      .pl-stat.warn .pl-stat-n { color: var(--warn, #8a5b0a); }
      .pl-stat.bad .pl-stat-n { color: var(--bad, #b3261e); }
      .pl-stat.ok .pl-stat-n { color: var(--ok, #1a7f4e); }

      .pl-hero { text-align: center; padding: 38px 20px 34px; background: linear-gradient(180deg, #f4f9ff, #fff); border: 1px dashed #b7d0ec; border-radius: 18px; margin-bottom: 16px; }
      .pl-hero h2 { font-size: 21px; color: var(--navy, #12305a); }
      .pl-hero p { color: var(--muted, #5c6f86); max-width: 560px; margin: 8px auto 18px; font-size: 13.5px; }
      .pl-hero-ic { width: 56px; height: 56px; border-radius: 16px; background: #e9f2fc; color: var(--accent, #225da3); display: grid; place-items: center; margin: 0 auto 12px; font-size: 26px; }

      .pl-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
      .pl-search { flex: 1; min-width: 200px; max-width: 320px; }
      .pl-seg { display: inline-flex; background: #eef3f9; border-radius: 10px; padding: 3px; gap: 2px; flex-wrap: wrap; }
      .pl-seg button { border: 0; background: transparent; padding: 6px 12px; border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--muted, #5c6f86); cursor: pointer; white-space: nowrap; }
      .pl-seg button.on { background: #fff; color: var(--navy, #12305a); box-shadow: 0 1px 3px rgba(18, 48, 90, 0.15); }

      .pl-scroll { overflow-x: auto; border: 1px solid var(--line, #dde7f1); border-radius: 14px; background: #fff; }
      .pl-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 1060px; }
      .pl-tbl th { position: sticky; top: 0; background: #f3f7fc; color: #3d5573; font-weight: 800; text-align: left; padding: 9px 8px; border-bottom: 2px solid var(--line, #dde7f1); font-size: 12px; vertical-align: bottom; }
      .pl-tbl td { padding: 8px; border-bottom: 1px solid #eef1f5; vertical-align: top; }
      .pl-tbl tbody tr.pl-row { cursor: pointer; }
      .pl-tbl tbody tr.pl-row:hover td { background: #f7fbff; }
      .pl-tbl .c { text-align: center; }
      .pl-tbl .n { text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; }
      .pl-tbl tr.pl-grp td { background: #e9f2fc; color: var(--navy, #12305a); font-weight: 800; font-size: 12.5px; padding: 8px 10px; border-bottom: 1px solid #d3e3f6; }
      .pl-tbl tfoot td { background: #f3f7fc; font-weight: 800; border-top: 2px solid var(--line, #dde7f1); }
      .pl-name { font-weight: 800; color: var(--navy, #12305a); font-size: 13px; }
      .pl-sub { color: var(--muted, #5c6f86); font-size: 12px; }
      .pl-ln { line-height: 1.45; }
      .pl-ln + .pl-ln { margin-top: 1px; }
      .pl-ln.x { color: var(--muted, #5c6f86); }

      .pl-issues { border: 1px solid #f0d28a; background: #fffaf0; border-radius: 14px; padding: 14px 16px; margin-bottom: 14px; }
      .pl-issues-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
      .pl-issues ul { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 6px; max-height: 330px; overflow: auto; }
      .pl-issues li { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; line-height: 1.45; }
      .pl-dot { flex: none; width: 9px; height: 9px; border-radius: 50%; margin-top: 6px; background: var(--warn, #8a5b0a); }
      .pl-dot.error { background: var(--bad, #b3261e); }
      .pl-dot.info { background: var(--accent, #225da3); }
      .pl-link { border: 0; background: none; padding: 0; color: var(--accent, #225da3); font: inherit; font-weight: 800; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }

      .pl-modal { max-width: 980px !important; }
      .pl-modal .pl-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px 14px; }
      .pl-field label { display: block; font-size: 12px; font-weight: 800; color: #3d5573; margin: 0 0 4px; }
      .pl-sec { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line, #dde7f1); }
      .pl-sec h4 { margin: 0 0 8px; font-size: 14px; color: var(--navy, #12305a); font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; }
      .pl-sum { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
      .pl-sum span { background: #eef3f9; border-radius: 999px; padding: 3px 11px; font-size: 12px; font-weight: 700; color: #3d5573; }
      .pl-sum span.ok { background: var(--ok-bg, #e6f6ee); color: var(--ok, #1a7f4e); }
      .pl-sum span.warn { background: var(--warn-bg, #fff4dc); color: var(--warn, #8a5b0a); }
      .pl-sum span.bad { background: var(--bad-bg, #fdeceb); color: var(--bad, #b3261e); }
      .pl-mini { width: 100%; border-collapse: collapse; font-size: 13px; }
      .pl-mini th { text-align: left; font-size: 12px; color: #3d5573; padding: 6px 6px; border-bottom: 1px solid var(--line, #dde7f1); }
      .pl-mini td { padding: 5px 4px; border-bottom: 1px solid #f0f3f7; }
      .pl-quick { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
      .pl-quick .input { flex: 1; min-width: 240px; }

      .pl-matrix { border-collapse: separate; border-spacing: 3px; font-size: 12px; width: 100%; }
      .pl-matrix th { font-size: 11.5px; color: #3d5573; font-weight: 800; padding: 4px 2px; text-align: center; vertical-align: bottom; }
      .pl-matrix th.l, .pl-matrix td.l { text-align: left; padding-left: 4px; }
      .pl-matrix td { text-align: center; }
      .pl-cell { display: block; width: 100%; min-width: 40px; border: 0; border-radius: 8px; padding: 7px 2px; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums; background: #f1f5fa; color: #61758c; }
      .pl-cell.ok { background: var(--ok-bg, #e6f6ee); color: var(--ok, #1a7f4e); }
      .pl-cell.low { background: var(--bad-bg, #fdeceb); color: var(--bad, #b3261e); }
      .pl-cell.high { background: var(--warn-bg, #fff4dc); color: var(--warn, #8a5b0a); }
      .pl-cell.na { background: transparent; color: #b8c4d2; cursor: default; font-weight: 600; }
      .pl-cell:hover:not(.na) { outline: 2px solid #b7d0ec; }
      .pl-cell.sel { outline: 2px solid var(--accent, #225da3); }
      .pl-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted, #5c6f86); margin-top: 10px; }
      .pl-legend i { display: inline-block; width: 12px; height: 12px; border-radius: 4px; vertical-align: -2px; margin-right: 5px; }

      .pl-chipbtn { border: 1px solid var(--line, #dde7f1); background: #fff; border-radius: 999px; padding: 5px 12px; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; color: #3d5573; }
      .pl-chipbtn.on { background: var(--accent, #225da3); border-color: var(--accent, #225da3); color: #fff; }
      .pl-chipbtn:hover:not(.on) { border-color: #b7d0ec; }

      .pl-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 16px; align-items: start; }
      .pl-cols > .card { margin-bottom: 0; }
      .pl-switch { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line, #dde7f1); border-radius: 12px; cursor: pointer; background: #fff; margin-bottom: 8px; }
      .pl-switch:hover { border-color: #b7d0ec; }
      .pl-switch input { position: absolute; opacity: 0; pointer-events: none; }
      .pl-sw { flex: none; width: 38px; height: 22px; border-radius: 999px; background: #c9d4e2; position: relative; transition: background 0.15s; margin-top: 1px; }
      .pl-sw::after { content: ''; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); }
      .pl-switch input:checked + .pl-sw { background: var(--accent, #225da3); }
      .pl-switch input:checked + .pl-sw::after { transform: translateX(16px); }
      .pl-switch input:focus-visible + .pl-sw { outline: 3px solid var(--gold, #e8af2e); outline-offset: 2px; }
      .pl-sw-t { font-size: 13px; line-height: 1.4; }
      .pl-sw-t b { display: block; color: var(--navy, #12305a); }
      .pl-sw-t small { color: var(--muted, #5c6f86); font-size: 12px; }

      .pl-bar { position: sticky; bottom: 12px; z-index: 20; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; background: rgba(255, 255, 255, 0.97); border: 1px solid var(--line, #dde7f1); border-radius: 16px; padding: 10px 14px; box-shadow: 0 10px 30px -12px rgba(18, 48, 90, 0.35); margin-top: 18px; }
      .pl-bar-s { font-size: 13px; color: var(--muted, #5c6f86); }
      .pl-bar-s.dirty { color: var(--warn, #8a5b0a); font-weight: 700; }

      .pl-run { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; background: linear-gradient(135deg, #12305a, #225da3); color: #fff; border-radius: 18px; padding: 20px 22px; margin-bottom: 16px; }
      .pl-run h3 { color: #fff; font-size: 18px; }
      .pl-run p { margin: 4px 0 0; color: #cfe0f5; font-size: 13px; }
      .pl-run .btn { background: #fff; color: var(--navy, #12305a); border-color: #fff; font-size: 14px; padding: 11px 22px; border-radius: 12px; font-weight: 800; }
      .pl-run .btn.ghost { background: transparent; color: #fff; border-color: rgba(255, 255, 255, 0.55); margin-left: 8px; }
      .pl-prog { height: 8px; background: rgba(255, 255, 255, 0.25); border-radius: 6px; margin-top: 12px; overflow: hidden; grid-column: 1 / -1; }
      .pl-prog div { height: 100%; background: #ffd36b; transition: width 0.2s; }
      .pl-verdict { display: flex; gap: 14px; align-items: flex-start; border-radius: 14px; padding: 14px 16px; margin-bottom: 14px; border: 1px solid; }
      .pl-verdict.ok { background: #f4fbf7; border-color: #9fd5b8; }
      .pl-verdict.warn { background: #fffaf0; border-color: #f0d28a; }
      .pl-verdict.bad { background: #fff8f8; border-color: #e0a3a3; }
      .pl-verdict-ic { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 18px; }
      .pl-verdict.ok .pl-verdict-ic { background: var(--ok, #1a7f4e); }
      .pl-verdict.warn .pl-verdict-ic { background: #c98a14; }
      .pl-verdict.bad .pl-verdict-ic { background: var(--bad, #b3261e); }
      .pl-list { margin: 6px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.5; }
      .pl-list li { margin-bottom: 3px; }
      .pl-list .adv { color: var(--muted, #5c6f86); }

      .pl-details { border: 1px solid var(--line, #dde7f1); border-radius: 14px; background: #fff; margin-bottom: 14px; }
      .pl-details > summary { cursor: pointer; padding: 13px 16px; font-weight: 800; color: var(--navy, #12305a); list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 14.5px; }
      .pl-details > summary::-webkit-details-marker { display: none; }
      .pl-details > summary::after { content: '▾'; color: var(--muted, #5c6f86); transition: transform 0.15s; }
      .pl-details[open] > summary::after { transform: rotate(180deg); }
      .pl-details > .pl-body { padding: 0 16px 16px; }

      @media (max-width: 760px) {
        .pl-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .pl-run { grid-template-columns: 1fr; }
        .pl-top h1 { font-size: 22px; }
        .pl-search { max-width: none; }
      }
    `}</style>
  );
}

export function Modal({ title, sub, onClose, children, footer }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bb-modal pl-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h">
          <div><h3>{title}</h3>{sub && <div className="pl-sub">{sub}</div>}</div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        {children}
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ value, label, tone }) {
  return (
    <div className={`pl-stat ${tone || ''}`}>
      <div className="pl-stat-n">{value}</div>
      <div className="pl-stat-l">{label}</div>
    </div>
  );
}

export function Switch({ checked, onChange, title, children }) {
  return (
    <label className="pl-switch">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="pl-sw" aria-hidden="true" />
      <span className="pl-sw-t"><b>{title}</b>{children && <small>{children}</small>}</span>
    </label>
  );
}

export function Field({ label, id, children }) {
  return (
    <div className="pl-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="pl-seg" role="tablist">
      {options.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}
