'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRankingPing } from '@/lib/useRankingPing';
import { addDays, fmtDate, mondayOf, vnTodayIso } from '@/lib/dates';

// Bảng vinh danh thi đua các lớp theo tuần. Dùng chung cho /ranking (TPT, Sao đỏ), trang giáo viên và trang học sinh.
// Chỉ vinh danh 3 hạng. Lớp bằng điểm thì đồng hạng (3 lớp cùng điểm cao nhất => cả 3 lớp hạng nhất, lớp kế tiếp là hạng nhì).
// Máy tính: bục podium (nhì - nhất - ba). Điện thoại: xếp dọc, hạng nhất ở trên cùng.
//   myClassId : lớp của người xem, được đánh dấu "Lớp em"
//   onLoaded  : gọi lại với danh sách của tuần đang xem; mỗi dòng có `rank` liền nhau (1, 2, 3, 4...)

const LABEL = {
  1: ['Hạng nhất', 'Đồng hạng nhất'],
  2: ['Hạng nhì', 'Đồng hạng nhì'],
  3: ['Hạng ba', 'Đồng hạng ba'],
};

const METAL = {
  1: { a: '#fff3c0', b: '#e3ae34', c: '#946407', leafA: '#f6d067', leafB: '#b88512', ink: '#4a3200' },
  2: { a: '#f7f9fc', b: '#b4c0cf', c: '#66748a', leafA: '#cdd6e1', leafB: '#8593a6', ink: '#27364c' },
  3: { a: '#f8dcb9', b: '#cd8f55', c: '#7d4a1b', leafA: '#e0ae7b', leafB: '#9a602b', ink: '#46250a' },
};

const num = (v) => Number(v);
const fmtScore = (n) => num(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

function withDenseRank(list) {
  const sorted = [...list].sort(
    (a, b) => num(b.total_score) - num(a.total_score) || String(a.class_name).localeCompare(String(b.class_name), 'vi', { numeric: true })
  );
  let rank = 0;
  let prev = null;
  return sorted.map((r) => {
    const s = num(r.total_score).toFixed(2);
    if (s !== prev) { rank += 1; prev = s; }
    return { ...r, rank };
  });
}

// Huy hiệu tròn kim loại có vòng nguyệt quế, số hạng ở giữa
function Medal({ k, size = 84 }) {
  const m = METAL[k];
  const leaves = [];
  for (let t = 0; t < 7; t += 1) {
    const a = 118 + t * 20;
    [a, 180 - a].forEach((ang, side) => {
      const rad = (ang * Math.PI) / 180;
      const x = 50 + 39 * Math.cos(rad);
      const y = 50 - 39 * Math.sin(rad);
      leaves.push(
        <ellipse
          key={`${t}-${side}`}
          cx={x}
          cy={y}
          rx={3.1}
          ry={7.4}
          transform={`rotate(${-ang} ${x} ${y})`}
          fill={`url(#rbl${k})`}
        />
      );
    });
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="rb-medal">
      <defs>
        <linearGradient id={`rbm${k}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.a} />
          <stop offset="0.55" stopColor={m.b} />
          <stop offset="1" stopColor={m.c} />
        </linearGradient>
        <linearGradient id={`rbl${k}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.leafA} />
          <stop offset="1" stopColor={m.leafB} />
        </linearGradient>
      </defs>
      {leaves}
      <circle cx="50" cy="50" r="28" fill={`url(#rbm${k})`} stroke={m.c} strokeWidth="1.6" />
      <circle cx="50" cy="50" r="22.5" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.1" />
      <text x="50" y="60.5" textAnchor="middle" fontSize="30" fontWeight="800" fontFamily="'Baloo 2', sans-serif" fill={m.ink}>{k}</text>
    </svg>
  );
}

function Chevron({ dir }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'l' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

function Tier({ k, items, myClassId, flash }) {
  const tied = items.length > 1;
  const total = items[0].total_score;
  const one = items.length === 1;
  return (
    <article className={`tier t${k}`}>
      <div className="card">
        <div className="t-head">
          <div className="t-medal"><Medal k={k} size={k === 1 ? 92 : 76} /></div>
          <div className="t-lab">
            <span className="t-ribbon">{LABEL[k][tied ? 1 : 0]}</span>
            {tied && <span className="t-cnt">{items.length} lớp bằng điểm</span>}
          </div>
          <div className="t-score"><b>{fmtScore(total)}</b><small>điểm</small></div>
        </div>
        <div className={`t-tiles ${one ? 'solo' : ''}`}>
          {items.map((r) => (
            <div key={r.class_id} className={`tile ${r.class_id === myClassId ? 'me' : ''} ${flash.has(r.class_id) ? 'flash' : ''}`}>
              <div className="tile-k">Lớp</div>
              <div className="tile-n">{r.class_name}</div>
              <div className="tile-s">Nề nếp {fmtScore(r.ne_nep_score)} · Học tập {fmtScore(r.hoc_tap_score)}</div>
              {r.class_id === myClassId ? <span className="tag">Lớp em</span> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="plinth" aria-hidden="true"><span>{k}</span></div>
    </article>
  );
}

export default function RankingBoard({ myClassId, onLoaded, accent = '#c4262e', accentDark = '#8f1a20', meBg = '#fdeceb' }) {
  const thisMonday = mondayOf(vnTodayIso());
  const [weekStart, setWeekStart] = useState(thisMonday);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [flash, setFlash] = useState(() => new Set());
  const prevRef = useRef(new Map());
  const weekRef = useRef(weekStart);
  weekRef.current = weekStart;
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const load = useCallback(async (ws) => {
    const { data, error: err } = await supabase.rpc('get_class_leaderboard', { p_week_start: ws });
    if (ws !== weekRef.current) return;
    if (err) {
      setError(err.message);
      setRows((cur) => cur || []);
      return;
    }
    setError('');
    const list = withDenseRank(data || []);
    const changed = new Set();
    list.forEach((r) => {
      const before = prevRef.current.get(r.class_id);
      if (before !== undefined && before !== num(r.total_score)) changed.add(r.class_id);
    });
    prevRef.current = new Map(list.map((r) => [r.class_id, num(r.total_score)]));
    setRows(list);
    setUpdatedAt(new Date());
    onLoadedRef.current?.(list, ws);
    if (changed.size) {
      setFlash(changed);
      setTimeout(() => setFlash(new Set()), 2600);
    }
  }, []);

  useEffect(() => {
    prevRef.current = new Map();
    setRows(null);
    load(weekStart);
  }, [weekStart, load]);

  useRankingPing(() => load(weekRef.current));

  const isCurrent = weekStart === thisMonday;
  const tiers = rows ? [1, 2, 3].map((k) => ({ k, items: rows.filter((r) => r.rank === k) })).filter((t) => t.items.length > 0) : [];
  const rest = rows ? rows.filter((r) => r.rank > 3) : [];
  const allTied = !!rows && rows.length > 1 && rest.length === 0 && tiers.length === 1;

  return (
    <section className="rb" aria-label="Bảng vinh danh thi đua các lớp" style={{ '--acc': accent, '--acc-d': accentDark, '--me-bg': meBg }}>
      <style jsx global>{`
        .rb { --gold: #e3ae34; --ink: #14263d; --muted: #5f6f83; --line: #e1e8f0; --tint: #f3f6fa; color: var(--ink); }
        .rb .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .rb .title { font-family: 'Baloo 2', sans-serif; font-size: 24px; font-weight: 700; margin: 0; line-height: 1.2; }
        .rb .sub { color: var(--muted); font-size: 13.5px; margin: 2px 0 0; }
        .rb .ctl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .rb .wk { display: inline-flex; align-items: center; border: 1px solid var(--line); background: #fff; border-radius: 12px; overflow: hidden; }
        .rb .wk button { border: none; background: #fff; width: 42px; height: 42px; cursor: pointer; color: var(--ink); display: inline-flex; align-items: center; justify-content: center; }
        .rb .wk button:hover:not(:disabled) { background: var(--tint); }
        .rb .wk button:disabled { opacity: 0.3; cursor: not-allowed; }
        .rb .wk span { padding: 0 12px; font-size: 13px; font-weight: 700; white-space: nowrap; }
        .rb .live { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; color: #167a4e; background: #e6f6ee; border-radius: 999px; padding: 7px 13px; }
        .rb .live i { width: 8px; height: 8px; border-radius: 50%; background: #1a8a58; display: inline-block; animation: rbPulse 2s ease-in-out infinite; }
        @keyframes rbPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(26,138,88,0.5); } 50% { box-shadow: 0 0 0 6px rgba(26,138,88,0); } }
        .rb .past { font-size: 12.5px; font-weight: 700; color: var(--muted); background: #eceff4; border-radius: 999px; padding: 7px 13px; }

        /* Bục vinh danh */
        .rb .stage { display: flex; align-items: flex-end; gap: 14px; }
        .rb .tier { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .rb .tier.t1 { flex: 1.5; order: 2; }
        .rb .tier.t2 { order: 1; }
        .rb .tier.t3 { order: 3; }
        .rb .card { position: relative; overflow: hidden; padding: 20px 16px 18px; border-radius: 20px 20px 0 0; }
        .rb .t-head { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; margin-bottom: 16px; }
        .rb .t-medal { line-height: 0; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.22)); }
        .rb .t-lab { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .rb .t-ribbon { display: inline-block; font-family: 'Baloo 2', sans-serif; font-weight: 800; letter-spacing: 0.04em; font-size: 15px; padding: 4px 16px; border-radius: 999px; }
        .rb .t-cnt { font-size: 12.5px; font-weight: 600; }
        .rb .t-score { line-height: 1; }
        .rb .t-score b { display: block; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 40px; font-variant-numeric: tabular-nums; }
        .rb .t-score small { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; }

        .rb .t-tiles { position: relative; z-index: 1; display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)); }
        .rb .tile { position: relative; border-radius: 14px; padding: 12px 8px 11px; text-align: center; }
        .rb .tile-k { font-size: 12px; font-weight: 600; opacity: 0.75; }
        .rb .tile-n { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 30px; line-height: 1.05; word-break: break-word; }
        .rb .tile-s { font-size: 11.5px; margin-top: 4px; opacity: 0.85; line-height: 1.35; }
        .rb .tag { display: inline-block; margin-top: 6px; background: var(--acc); color: #fff; font-size: 11px; font-weight: 800; border-radius: 999px; padding: 2px 10px; }
        .rb .t-tiles.solo .tile { padding: 14px 10px 13px; }
        .rb .t-tiles.solo .tile-n { font-size: 44px; }

        .rb .plinth { display: flex; align-items: center; justify-content: center; border-radius: 0 0 14px 14px; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 40px; line-height: 1; }
        .rb .t1 .plinth { height: 70px; }
        .rb .t2 .plinth { height: 46px; font-size: 30px; }
        .rb .t3 .plinth { height: 30px; font-size: 22px; }

        /* Hạng nhất: xanh navy, viền vàng */
        .rb .t1 .card { background: radial-gradient(120% 90% at 50% 0%, #2d4584 0%, #162750 55%, #0c1733 100%); border: 2px solid var(--gold); border-bottom: none; color: #fff; padding-top: 26px; }
        .rb .t1 .card::before { content: ''; position: absolute; inset: 7px; border-radius: 14px 14px 0 0; border: 1px solid rgba(227,174,52,0.35); border-bottom: none; pointer-events: none; }
        .rb .t1 .card::after { content: ''; position: absolute; top: 0; bottom: 0; width: 34%; left: -45%; pointer-events: none;
          background: linear-gradient(100deg, transparent, rgba(255,240,180,0.2), transparent); transform: skewX(-18deg); animation: rbShine 6s ease-in-out infinite; }
        @keyframes rbShine { 0%, 55% { left: -45%; } 100% { left: 125%; } }
        .rb .t1 .t-ribbon { background: linear-gradient(180deg, #ffe793, #e0a82e); color: #4a3200; font-size: 16px; box-shadow: 0 2px 0 #946407; }
        .rb .t1 .t-cnt { color: #ffe9a8; }
        .rb .t1 .t-score b { color: #ffd966; font-size: 52px; text-shadow: 0 2px 16px rgba(255,200,60,0.4); }
        .rb .t1 .t-score small { color: #ffe9a8; }
        .rb .t1 .tile { background: rgba(255,255,255,0.09); border: 1px solid rgba(227,174,52,0.55); }
        .rb .t1 .tile-n { color: #fff; }
        .rb .t1 .t-tiles.solo .tile-n { color: #ffe9a8; font-size: 54px; }
        .rb .t1 .tile.me { outline: 3px solid #ffd966; outline-offset: 2px; }
        .rb .t1 .plinth { background: linear-gradient(180deg, #e8b83e, #a87408); color: rgba(74,50,0,0.55); border: 2px solid var(--gold); border-top: none; }

        /* Hạng nhì: bạc */
        .rb .t2 .card { background: linear-gradient(165deg, #fbfcfe, #dfe6ef); border: 2px solid #b4c0cf; border-bottom: none; }
        .rb .t2 .t-ribbon { background: linear-gradient(180deg, #eef3f8, #aab7c8); color: #27364c; box-shadow: 0 2px 0 #7e8c9f; }
        .rb .t2 .t-cnt { color: #55657a; }
        .rb .t2 .t-score b { color: #34465f; }
        .rb .t2 .t-score small { color: #66768b; }
        .rb .t2 .tile { background: #fff; border: 1px solid #ccd5e0; }
        .rb .t2 .tile-n { color: #2f3f57; }
        .rb .t2 .tile.me { outline: 3px solid var(--acc); outline-offset: 1px; }
        .rb .t2 .plinth { background: linear-gradient(180deg, #cfd8e3, #97a5b8); color: rgba(39,54,76,0.5); border: 2px solid #b4c0cf; border-top: none; }

        /* Hạng ba: đồng */
        .rb .t3 .card { background: linear-gradient(165deg, #fffaf4, #f2dcc5); border: 2px solid #cf9a63; border-bottom: none; }
        .rb .t3 .t-ribbon { background: linear-gradient(180deg, #f2bb80, #b8743a); color: #3f2208; box-shadow: 0 2px 0 #85501f; }
        .rb .t3 .t-cnt { color: #8a5a2c; }
        .rb .t3 .t-score b { color: #744519; }
        .rb .t3 .t-score small { color: #98683a; }
        .rb .t3 .tile { background: #fffdf9; border: 1px solid #e4c5a3; }
        .rb .t3 .tile-n { color: #6b4018; }
        .rb .t3 .tile.me { outline: 3px solid var(--acc); outline-offset: 1px; }
        .rb .t3 .plinth { background: linear-gradient(180deg, #e0a972, #a8692f); color: rgba(70,37,10,0.5); border: 2px solid #cf9a63; border-top: none; }

        /* Các lớp tiếp theo */
        .rb .rest-h { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 26px 2px 8px; }
        .rb .rest-h h3 { margin: 0; font-family: 'Baloo 2', sans-serif; font-size: 17px; }
        .rb .rest-h span { font-size: 12.5px; color: var(--muted); }
        .rb .tbl { background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
        .rb .trow { display: grid; grid-template-columns: 1fr 84px 84px 90px; align-items: center; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--line); }
        .rb .trow:first-child { border-top: none; }
        .rb .thead { background: var(--tint); font-size: 12.5px; font-weight: 700; color: var(--muted); }
        .rb .trow.me { background: var(--me-bg, #fdeceb); }
        .rb .nm { font-weight: 700; font-size: 14.5px; }
        .rb .n { text-align: right; font-variant-numeric: tabular-nums; font-size: 13.5px; }
        .rb .n.tot { font-weight: 800; font-size: 15px; }
        .rb .trow .tag { margin: 0 0 0 8px; padding: 1px 8px; }

        .rb .hint { color: var(--muted); font-size: 13px; text-align: center; margin: 12px 0 0; }
        .rb .note { color: var(--muted); font-size: 12.5px; margin: 16px 2px 0; line-height: 1.55; }
        .rb .empty { color: var(--muted); text-align: center; padding: 34px 0; font-size: 14px; }
        .rb .err { color: #b3261e; font-size: 13px; margin: 0 0 10px; }
        .rb .skel { height: 220px; border-radius: 20px; background: linear-gradient(100deg, #eef2f7 30%, #f8fafc 50%, #eef2f7 70%); background-size: 200% 100%; animation: rbSk 1.4s linear infinite; }
        @keyframes rbSk { to { background-position: -200% 0; } }

        .rb .flash { animation: rbFlash 2.4s ease-out; }
        @keyframes rbFlash { 0% { box-shadow: 0 0 0 0 rgba(240,180,41,0.9); } 100% { box-shadow: 0 0 0 12px rgba(240,180,41,0); } }
        @media (prefers-reduced-motion: reduce) {
          .rb .flash, .rb .live i, .rb .skel { animation: none; }
          .rb .t1 .card::after { display: none; }
        }

        /* Điện thoại và máy tính bảng nhỏ: xếp dọc, hạng nhất trên cùng */
        @media (max-width: 819px) {
          .rb .stage { flex-direction: column; align-items: stretch; gap: 12px; }
          .rb .tier.t1, .rb .tier.t2, .rb .tier.t3 { order: 0; flex: none; }
          .rb .card { border-radius: 18px; padding: 14px 12px 14px; }
          .rb .t1 .card, .rb .t2 .card, .rb .t3 .card { border-bottom-style: solid; border-bottom-width: 2px; }
          .rb .t1 .card { border-color: var(--gold); }
          .rb .t2 .card { border-color: #b4c0cf; }
          .rb .t3 .card { border-color: #cf9a63; }
          .rb .t1 .card::before { border-radius: 12px; border-bottom: 1px solid rgba(227,174,52,0.35); }
          .rb .plinth { display: none; }
          .rb .t-head { flex-direction: row; text-align: left; gap: 12px; margin-bottom: 12px; }
          .rb .t-lab { align-items: flex-start; }
          .rb .t-score { margin-left: auto; text-align: right; }
          .rb .t-score b, .rb .t1 .t-score b { font-size: 36px; }
          .rb .t-ribbon, .rb .t1 .t-ribbon { font-size: 14px; padding: 4px 12px; }
          .rb .t-tiles { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .rb .t-tiles.solo { grid-template-columns: 1fr; }
          .rb .tile-n { font-size: 27px; }
          .rb .t-tiles.solo .tile-n, .rb .t1 .t-tiles.solo .tile-n { font-size: 40px; }
        }
        @media (max-width: 560px) {
          .rb .title { font-size: 21px; }
          .rb .t-medal svg { width: 64px; height: 64px; }
          .rb .t1 .t-medal svg { width: 74px; height: 74px; }
          .rb .trow { grid-template-columns: 1fr 70px; padding: 12px 14px; }
          .rb .trow .hide-s { display: none; }
        }
      `}</style>

      <div className="head">
        <div>
          <h2 className="title">Vinh danh thi đua các lớp</h2>
          <p className="sub">Tuần {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}</p>
        </div>
        <div className="ctl">
          <div className="wk">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Tuần trước"><Chevron dir="l" /></button>
            <span>{isCurrent ? 'Tuần này' : 'Tuần đã qua'}</span>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={isCurrent} aria-label="Tuần sau"><Chevron dir="r" /></button>
          </div>
          {isCurrent ? (
            <span className="live" title={updatedAt ? `Cập nhật lúc ${updatedAt.toLocaleTimeString('vi-VN')}` : ''}>
              <i /> Trực tiếp
            </span>
          ) : (
            <span className="past">Đã chốt</span>
          )}
        </div>
      </div>

      {error && <p className="err">Không tải được bảng xếp hạng: {error}</p>}
      {rows === null && !error && <div className="skel" aria-label="Đang tải bảng xếp hạng" />}
      {rows && rows.length === 0 && !error && <div className="empty">Chưa có lớp nào trong hệ thống.</div>}

      {rows && rows.length > 0 && (
        <div className="stage">
          {tiers.map((t) => <Tier key={t.k} k={t.k} items={t.items} myClassId={myClassId} flash={flash} />)}
        </div>
      )}

      {allTied && <p className="hint">Tất cả các lớp đang bằng điểm nhau nên cùng đứng hạng nhất. Bảng sẽ thay đổi khi có lớp bị trừ điểm.</p>}

      {rest.length > 0 && (
        <>
          <div className="rest-h">
            <h3>Các lớp tiếp theo</h3>
            <span>{rest.length} lớp</span>
          </div>
          <div className="tbl" role="table" aria-label="Các lớp tiếp theo">
            <div className="trow thead" role="row">
              <span>Lớp</span>
              <span className="n hide-s">Nề nếp</span>
              <span className="n hide-s">Học tập</span>
              <span className="n">Tổng</span>
            </div>
            {rest.map((r) => (
              <div key={r.class_id} role="row" className={`trow ${r.class_id === myClassId ? 'me' : ''} ${flash.has(r.class_id) ? 'flash' : ''}`}>
                <span className="nm">Lớp {r.class_name}{r.class_id === myClassId ? <span className="tag">Lớp em</span> : null}</span>
                <span className="n hide-s">{fmtScore(r.ne_nep_score)}</span>
                <span className="n hide-s">{fmtScore(r.hoc_tap_score)}</span>
                <span className="n tot">{fmtScore(r.total_score)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {rows && rows.length > 0 && (
        <p className="note">
          Điểm Tổng là trung bình của điểm Nề nếp và Học tập; mỗi lỗi bị Sao đỏ ghi nhận sẽ trừ điểm.
          Các lớp có điểm bằng nhau được xếp đồng hạng. Chỉ vinh danh ba hạng đầu. Bảng làm mới theo từng tuần.
        </p>
      )}
    </section>
  );
}
