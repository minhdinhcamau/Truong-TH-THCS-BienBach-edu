'use client';
import { useEffect, useMemo, useState } from 'react';
import { groupColor } from '@/components/Charts';

const n1 = (v) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const CONFETTI = ['#f2c94c', '#ff7a6b', '#7ad3b0', '#6db3ff', '#ffffff', '#c39bff'];

// Số chạy từ 0 lên giá trị thật
function useCountUp(target, ms = 1300, decimals = 0) {
  const [v, setV] = useState(() => (reducedMotion() ? Number(target) : 0));
  useEffect(() => {
    const to = Number(target) || 0;
    if (reducedMotion()) { setV(to); return undefined; }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(to * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return decimals ? v.toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : Math.round(v).toLocaleString('vi-VN');
}

function Count({ value, decimals = 0 }) {
  return <>{useCountUp(value, 1300, decimals)}</>;
}

const Rise = ({ d = 0, className = '', style, children }) => (
  <div className={`pm-rise ${className}`} style={{ '--d': `${d}ms`, ...style }}>{children}</div>
);

function Confetti() {
  const pieces = useMemo(() => {
    let s = 20260921;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    return Array.from({ length: 56 }, (_, i) => ({ left: r() * 100, delay: r() * 2, dur: 3 + r() * 2.4, size: 8 + r() * 9, color: CONFETTI[i % CONFETTI.length], round: r() > 0.6 }));
  }, []);
  return (
    <div className="pm-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 1.6, background: p.color, borderRadius: p.round ? '50%' : 2, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
    </div>
  );
}

function AnimBars({ items, emptyText }) {
  if (!items.length) return <div className="pm-empty">{emptyText}</div>;
  const max = Math.max(...items.map((i) => Math.abs(Number(i.value)) || 0), 1);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {items.map((it, i) => (
        <Rise key={`${it.label}-${i}`} d={i * 140}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'clamp(18px, 2.3vw, 28px)', fontWeight: 700 }}>
            <span>{it.label}</span><span style={{ color: '#f2c94c' }}>{it.sub || it.value}</span>
          </div>
          <div className="pm-track"><div className="pm-fill" style={{ width: `${Math.max(4, (Math.abs(Number(it.value)) / max) * 100)}%`, '--d': `${300 + i * 140}ms`, background: it.color || '#7ad3b0' }} /></div>
        </Rise>
      ))}
    </div>
  );
}

function AnimColumns({ items, height = 210 }) {
  if (!items.length) return <div className="pm-empty">Chưa có dữ liệu.</div>;
  const max = Math.max(...items.map((i) => Math.abs(Number(i.value)) || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(10px, 2vw, 26px)', height: height + 70 }}>
      {items.map((it, i) => (
        <div key={`${it.label}-${i}`} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <Rise d={500 + i * 130} style={{ fontWeight: 800, fontSize: 'clamp(18px, 2.3vw, 28px)' }}>{n1(it.value)}</Rise>
          <div className="pm-col" style={{ height: (Math.abs(Number(it.value)) / max) * height + 4, '--d': `${200 + i * 130}ms`, background: it.color || '#7ad3b0' }} />
          <div style={{ marginTop: 8, fontSize: 'clamp(14px, 1.7vw, 20px)', color: '#b9d6cb', fontWeight: 600 }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

function AnimLine({ points }) {
  if (!points.length) return <div className="pm-empty">Chưa có dữ liệu.</div>;
  const W = 900, H = 300, pad = { l: 40, r: 30, t: 40, b: 46 };
  const vals = points.map((p) => Number(p.value));
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const x = (i) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(p.value)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Điểm thi đua các tuần">
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="rgba(255,255,255,0.25)" />
      <path d={path} pathLength="1" fill="none" stroke="#f2c94c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="pm-draw" />
      {points.map((p, i) => (
        <g key={i} className="pm-dot" style={{ '--d': `${400 + i * 200}ms` }}>
          <circle cx={x(i)} cy={y(Number(p.value))} r="9" fill="#0f2a23" stroke="#f2c94c" strokeWidth="4" />
          <text x={x(i)} y={y(Number(p.value)) - 18} textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff">{n1(p.value)}</text>
          <text x={x(i)} y={H - 14} textAnchor="middle" fontSize="19" fill="#b9d6cb">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function Trend({ d }) {
  if (d === null) return <span className="pm-badge">Tuần đầu có dữ liệu</span>;
  if (d > 0) return <span className="pm-badge up">▲ Tăng {d} hạng</span>;
  if (d < 0) return <span className="pm-badge down">▼ Giảm {-d} hạng</span>;
  return <span className="pm-badge">■ Giữ nguyên hạng</span>;
}

const MEDALS = ['🥇', '🥈', '🥉'];

// Trình chiếu sinh hoạt lớp toàn màn hình: mũi tên / phím cách / vuốt để chuyển trang, F = toàn màn hình, Esc = thoát.
export default function PresentationMode({ v, advice, className, weekLabel, onClose }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState('next');
  const [names, setNames] = useState(false);

  const typeSummary = useMemo(() => {
    const m = new Map();
    v.repeat.forEach((r) => (r.types || []).forEach((t) => m.set(t.label, (m.get(t.label) || 0) + t.n)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, value: n, sub: `${n} lần` }));
  }, [v.repeat]);

  const slides = useMemo(() => {
    const c = v.c;
    return [
      { key: 'cover', title: `Sinh hoạt lớp ${className || ''}`, body: (
        <div style={{ textAlign: 'center' }}>
          <Rise d={0} style={{ fontSize: 'clamp(18px, 2.4vw, 30px)', color: '#b9d6cb' }}>Tuần {weekLabel}</Rise>
          <Rise d={150} className="pm-glow" style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 'clamp(90px, 16vw, 210px)', lineHeight: 1, fontWeight: 700, color: '#f2c94c' }}>
            <Count value={c.rank || 0} /><span style={{ fontSize: '0.3em', color: '#b9d6cb' }}>/{c.of ?? '—'}</span>
          </Rise>
          <Rise d={350} style={{ fontSize: 'clamp(20px, 2.6vw, 34px)' }}>Xếp hạng thi đua tuần này <Trend d={v.rankDelta} /></Rise>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(14px, 3vw, 40px)', marginTop: 34, flexWrap: 'wrap' }}>
            {[['Điểm thi đua', <Count key="a" value={c.total || 0} decimals={1} />], ['Lượt vi phạm', <Count key="b" value={v.tot.violations || 0} />], ['Điểm cộng', <>+<Count value={v.tot.plus_points || 0} /></>]].map(([lab, val], k) => (
              <Rise key={lab} d={550 + k * 160} className="pm-card"><small>{lab}</small><b>{val}</b></Rise>
            ))}
          </div>
        </div>) },
      { key: 'trend', title: 'Thi đua của lớp qua các tuần', body: (<div style={{ maxWidth: 1000, margin: '0 auto' }}><AnimLine points={v.hist} /></div>) },
      { key: 'saodo', title: 'Sao đỏ đã ghi nhận những gì?', body: (
        <div style={{ display: 'grid', gap: 34 }}>
          <AnimBars items={v.reasons} emptyText="Tuần này Sao đỏ chưa trừ điểm lớp — cả lớp làm rất tốt! 🎉" />
          {v.days.length > 0 && <AnimColumns items={v.days} height={120} />}
        </div>) },
      { key: 'praise', title: '🏅 Tuyên dương', confetti: v.top.length > 0, body: v.top.length === 0 ? <div className="pm-empty">Chưa có điểm cộng trong tuần. Tuần sau cùng phát biểu xây dựng bài nhé!</div> : (
        <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
          {v.top.map((s, k) => (
            <Rise key={s.student_id} d={k * 220} className="pm-pop-row">
              <span className="pm-medal">{MEDALS[k] || '⭐'}</span>
              <span style={{ flex: 1, fontSize: k === 0 ? 'clamp(28px, 4vw, 52px)' : 'clamp(22px, 3vw, 38px)', fontWeight: 800 }}>{s.name}</span>
              <span className="pm-score">+<Count value={s.net} decimals={0} /> điểm</span>
            </Rise>
          ))}
        </div>) },
      { key: 'improve', title: '🌱 Có tiến bộ — cùng vỗ tay nào!', body: v.impr.length === 0 ? <div className="pm-empty">Tuần sau cả lớp cùng cố gắng để có nhiều bạn tiến bộ nhé!</div> : (
        <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
          {v.impr.map((s, k) => (
            <Rise key={s.student_id} d={k * 200} className="pm-pop-row">
              <span className="pm-arrow">▲</span>
              <span style={{ flex: 1, fontSize: 'clamp(24px, 3.2vw, 42px)', fontWeight: 800 }}>{s.name}
                <small style={{ display: 'block', fontSize: '0.4em', color: '#b9d6cb', fontWeight: 600 }}>Vi phạm {s.prev_violations} → {s.violations} lần</small></span>
              <span className="pm-score">+{n1(s.delta)} điểm</span>
            </Rise>
          ))}
        </div>) },
      { key: 'warn', title: 'Cùng nhau cố gắng hơn', body: v.repeat.length === 0 ? <div className="pm-empty">Không có bạn nào vi phạm từ 2 lần. Tuyệt vời! 👏</div> : (
        <div style={{ display: 'grid', gap: 26, maxWidth: 980, margin: '0 auto' }}>
          <Rise d={0} style={{ fontSize: 'clamp(22px, 3vw, 38px)' }}>Có <b style={{ color: '#ff9b8f', fontSize: '1.4em' }}><Count value={v.repeat.length} /></b> bạn vi phạm từ 2 lần trong tuần.</Rise>
          <AnimBars items={typeSummary} emptyText="" />
          {names && (
            <div style={{ display: 'grid', gap: 10 }}>
              {v.repeat.map((r, k) => <Rise key={r.student_id} d={k * 120} className="pm-name-row"><b>{r.name}</b><span>{r.cnt} lần</span></Rise>)}
            </div>)}
        </div>) },
      { key: 'fix', title: 'Cách khắc phục cho cả lớp', body: advice.tips.length === 0 ? <div className="pm-empty">Duy trì những điều đang làm tốt nhé!</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16 }}>
          {advice.tips.map((t, k) => (
            <Rise key={t.title} d={k * 160} className="pm-tip"><div style={{ fontSize: 'clamp(20px, 2.4vw, 30px)', fontWeight: 800 }}>{t.icon} {t.title}</div><div style={{ marginTop: 8, fontSize: 'clamp(15px, 1.8vw, 22px)', color: '#d7e9e1' }}>{t.text}</div></Rise>
          ))}
        </div>) },
      { key: 'groups', title: 'Thi đua giữa các tổ', body: v.groups.length === 0 ? <div className="pm-empty">Lớp chưa chia tổ.</div> : (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}><AnimColumns items={v.groups.map((g) => ({ ...g, color: groupColor(Number(String(g.label).replace(/\D/g, ''))) }))} height={230} /></div>) },
      { key: 'end', title: 'Mục tiêu tuần tới', confetti: true, body: (
        <div style={{ textAlign: 'center', maxWidth: 900, margin: '0 auto' }}>
          <Rise d={0} className="pm-glow" style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 'clamp(40px, 7vw, 92px)', lineHeight: 1.1, fontWeight: 700, color: '#f2c94c' }}>Cùng cố gắng nhé cả lớp!</Rise>
          <div style={{ display: 'grid', gap: 14, marginTop: 30 }}>
            {advice.tips.slice(0, 3).map((t, k) => <Rise key={t.title} d={300 + k * 200} className="pm-tip" style={{ textAlign: 'left', fontSize: 'clamp(18px, 2.2vw, 28px)' }}>{t.icon} {t.title}</Rise>)}
          </div>
        </div>) },
    ];
  }, [v, advice, className, weekLabel, names, typeSummary]);

  const go = (n) => { setDir(n > i ? 'next' : 'prev'); setI(Math.min(slides.length - 1, Math.max(0, n))); };

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(i - 1);
      else if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  useEffect(() => () => { if (document.fullscreenElement) document.exitFullscreen?.(); }, []);

  const s = slides[i];
  let touchX = null;
  return (
    <div
      className="pm-stage" role="dialog" aria-label="Trình chiếu sinh hoạt lớp"
      onTouchStart={(e) => { touchX = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1)); touchX = null; }}
    >
      <style jsx global>{`
        .pm-stage { position: fixed; inset: 0; z-index: 700; display: flex; flex-direction: column; overflow: hidden; color: #f3faf6; font-family: 'Be Vietnam Pro', system-ui, sans-serif;
          background: radial-gradient(1100px 620px at 12% -10%, #2f7d66 0%, transparent 62%), radial-gradient(900px 560px at 105% 112%, #1f6a54 0%, transparent 58%), #0e2922; }
        .pm-stage *, .pm-stage *::before, .pm-stage *::after { box-sizing: border-box; }
        .pm-progress { height: 5px; background: rgba(255,255,255,0.12); }
        .pm-progress i { display: block; height: 100%; background: #f2c94c; transition: width 0.5s cubic-bezier(.2,.8,.2,1); }
        .pm-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px clamp(20px, 5vw, 64px) 0; flex-wrap: wrap; }
        .pm-title { font-family: 'Baloo 2', sans-serif; font-size: clamp(28px, 4.6vw, 58px); font-weight: 700; margin: 0; line-height: 1.1; }
        .pm-week { color: #b9d6cb; font-size: clamp(14px, 1.6vw, 20px); white-space: nowrap; }
        .pm-body { flex: 1; overflow: auto; padding: clamp(18px, 4vh, 44px) clamp(20px, 6vw, 84px); display: flex; flex-direction: column; justify-content: center; }
        .pm-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px clamp(16px, 4vw, 48px) 16px; flex-wrap: wrap; }
        .pm-dots { display: flex; gap: 8px; }
        .pm-dots button { width: 12px; height: 12px; border-radius: 50%; border: none; padding: 0; background: rgba(255,255,255,0.28); cursor: pointer; transition: transform 0.25s, background 0.25s; }
        .pm-dots button.on { background: #f2c94c; transform: scale(1.4); }
        .pm-btn { border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.08); color: #fff; border-radius: 999px; padding: 9px 18px; font-weight: 700; font-size: 14px; cursor: pointer; }
        .pm-btn:hover:not(:disabled) { background: rgba(255,255,255,0.18); }
        .pm-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .pm-btn.main { background: #f2c94c; color: #3b2b00; border-color: #f2c94c; }
        .pm-empty { text-align: center; font-size: clamp(24px, 3.4vw, 44px); color: #d7e9e1; padding: 40px 0; font-weight: 600; }
        .pm-card { background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18); border-radius: 22px; padding: 16px 30px; min-width: 190px; }
        .pm-card small { display: block; color: #b9d6cb; font-size: clamp(13px, 1.5vw, 18px); }
        .pm-card b { font-family: 'Baloo 2', sans-serif; font-size: clamp(32px, 4.6vw, 62px); line-height: 1.1; }
        .pm-badge { display: inline-block; margin-left: 10px; padding: 4px 16px; border-radius: 999px; background: rgba(255,255,255,0.14); font-weight: 800; font-size: 0.85em; }
        .pm-badge.up { background: #1a8a58; } .pm-badge.down { background: #b3261e; }
        .pm-track { background: rgba(255,255,255,0.13); border-radius: 999px; height: clamp(16px, 2.2vw, 26px); overflow: hidden; margin-top: 8px; }
        .pm-fill { height: 100%; border-radius: 999px; transform-origin: left center; }
        .pm-col { border-radius: 12px 12px 0 0; margin-top: 8px; transform-origin: bottom center; }
        .pm-pop-row { display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18); border-radius: 24px; padding: 14px 26px; }
        .pm-medal { font-size: clamp(36px, 5vw, 64px); }
        .pm-score { font-family: 'Baloo 2', sans-serif; font-size: clamp(26px, 3.6vw, 46px); font-weight: 700; color: #f2c94c; white-space: nowrap; }
        .pm-arrow { font-size: clamp(30px, 4vw, 52px); color: #7ad3b0; }
        .pm-name-row { display: flex; justify-content: space-between; background: rgba(255,255,255,0.09); border-radius: 16px; padding: 10px 22px; font-size: clamp(20px, 2.6vw, 34px); }
        .pm-tip { background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.16); border-radius: 22px; padding: 18px 24px; }
        .pm-confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
        .pm-confetti span { position: absolute; top: -6vh; display: block; opacity: 0; }
        @media (prefers-reduced-motion: no-preference) {
          .pm-slide-next { animation: pmInNext 0.6s cubic-bezier(.2,.8,.2,1) both; }
          .pm-slide-prev { animation: pmInPrev 0.6s cubic-bezier(.2,.8,.2,1) both; }
          .pm-rise { animation: pmRise 0.7s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--d, 0ms); }
          .pm-pop-row.pm-rise { animation-name: pmPop; }
          .pm-fill { animation: pmGrowX 1.1s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--d, 0ms); }
          .pm-col { animation: pmGrowY 1s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--d, 0ms); }
          .pm-draw { stroke-dasharray: 1; animation: pmDraw 1.6s ease-out both; }
          .pm-dot { animation: pmRise 0.6s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--d, 0ms); }
          .pm-glow { animation: pmRise 0.7s cubic-bezier(.2,.8,.2,1) both, pmGlow 2.8s ease-in-out 1s infinite; animation-delay: var(--d, 0ms), 1s; }
          .pm-arrow { display: inline-block; animation: pmBounce 1.4s ease-in-out infinite; }
          .pm-confetti span { animation-name: pmFall; animation-iteration-count: infinite; animation-timing-function: linear; }
        }
        @keyframes pmInNext { from { opacity: 0; transform: translateX(70px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes pmInPrev { from { opacity: 0; transform: translateX(-70px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes pmRise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
        @keyframes pmPop { 0% { opacity: 0; transform: scale(0.85) translateY(20px); } 65% { opacity: 1; transform: scale(1.03); } 100% { opacity: 1; transform: none; } }
        @keyframes pmGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes pmGrowY { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes pmDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes pmGlow { 0%, 100% { text-shadow: 0 0 0 rgba(242,201,76,0); } 50% { text-shadow: 0 0 34px rgba(242,201,76,0.55); } }
        @keyframes pmBounce { 0%, 100% { transform: translateY(2px); } 50% { transform: translateY(-8px); } }
        @keyframes pmFall { 0% { transform: translateY(-6vh) rotate(0deg); opacity: 0; } 8% { opacity: 1; } 100% { transform: translateY(112vh) rotate(720deg); opacity: 1; } }
      `}</style>

      <div className="pm-progress"><i style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></div>
      {s.confetti && <Confetti key={`c-${s.key}`} />}
      <div className="pm-head">
        <h2 className="pm-title" key={`t-${s.key}`}><span className={dir === 'next' ? 'pm-slide-next' : 'pm-slide-prev'} style={{ display: 'inline-block' }}>{s.title}</span></h2>
        <div className="pm-week">Tuần {weekLabel} · {i + 1}/{slides.length}</div>
      </div>
      <div className="pm-body" onClick={(e) => { if (e.target === e.currentTarget) go(i + 1); }}>
        <div key={s.key} className={dir === 'next' ? 'pm-slide-next' : 'pm-slide-prev'} style={{ position: 'relative', zIndex: 2 }}>{s.body}</div>
      </div>
      <div className="pm-foot">
        <div className="pm-dots" role="tablist" aria-label="Chọn trang">
          {slides.map((sl, k) => <button key={sl.key} className={k === i ? 'on' : ''} onClick={() => go(k)} aria-label={`Trang ${k + 1}: ${sl.title}`} />)}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {s.key === 'warn' && v.repeat.length > 0 && <button className="pm-btn" onClick={() => setNames((x) => !x)}>{names ? '🙈 Ẩn tên' : '👁 Hiện tên'}</button>}
          <button className="pm-btn" onClick={() => (document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.())}>⛶ Toàn màn hình (F)</button>
          <button className="pm-btn" onClick={onClose}>Thoát (Esc)</button>
          <button className="pm-btn" disabled={i === 0} onClick={() => go(i - 1)}>‹ Trước</button>
          <button className="pm-btn main" disabled={i === slides.length - 1} onClick={() => go(i + 1)}>Tiếp ›</button>
        </div>
      </div>
    </div>
  );
}
