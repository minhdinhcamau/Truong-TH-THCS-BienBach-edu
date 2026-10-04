'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRankingPing } from '@/lib/useRankingPing';
import { addDays, fmtDate, mondayOf, vnTodayIso } from '@/lib/dates';

// Bảng vinh danh thi đua các lớp theo tuần. Dùng chung cho /ranking (TPT, Sao đỏ), trang giáo viên và trang học sinh.
// CHỈ vinh danh 3 hạng (1, 2, 3). Các lớp bằng điểm được xếp ĐỒNG HẠNG (2 lớp cùng 100 điểm: cả hai hạng 1).
// Xếp hạng liền nhau: sau hạng 1 (dù bao nhiêu lớp đồng hạng) là hạng 2, rồi hạng 3. Các lớp còn lại chỉ liệt kê điểm, không có số hạng.
//   myClassId : lớp của người xem, được đánh dấu "Lớp em"
//   onLoaded  : gọi lại với danh sách của tuần đang xem; mỗi dòng có `rank` là hạng liền nhau (1, 2, 3, 4...; từ 4 trở đi không hiển thị)

const LABEL = {
  1: ['HẠNG NHẤT', 'ĐỒNG HẠNG NHẤT'],
  2: ['HẠNG NHÌ', 'ĐỒNG HẠNG NHÌ'],
  3: ['HẠNG BA', 'ĐỒNG HẠNG BA'],
};

const num = (v) => Number(v);
const fmtScore = (n) => num(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// Hạng liền nhau theo điểm tổng: điểm bằng nhau => cùng hạng, lớp kế tiếp là hạng kế tiếp.
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

function Crown({ size = 52 }) {
  return (
    <svg width={size} height={Math.round(size * 0.82)} viewBox="0 0 64 52" aria-hidden="true">
      <defs>
        <linearGradient id="rbCrown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe88f" />
          <stop offset="1" stopColor="#e2a41d" />
        </linearGradient>
      </defs>
      <path d="M6 44 L2 14 L18 26 L32 6 L46 26 L62 14 L58 44 Z" fill="url(#rbCrown)" stroke="#a8730b" strokeWidth="2" strokeLinejoin="round" />
      <rect x="6" y="44" width="52" height="6" rx="2" fill="#c98a12" />
      <circle cx="32" cy="7" r="3.6" fill="#fff6cc" />
      <circle cx="3" cy="14" r="3" fill="#fff6cc" />
      <circle cx="61" cy="14" r="3" fill="#fff6cc" />
      <circle cx="32" cy="35" r="3.2" fill="#c1272d" />
      <circle cx="19" cy="38" r="2.2" fill="#2b6fd6" />
      <circle cx="45" cy="38" r="2.2" fill="#2b6fd6" />
    </svg>
  );
}

function Medal({ n, from, to, ring, size = 46 }) {
  const id = `rbMedal${n}`;
  return (
    <svg width={size} height={Math.round(size * 1.14)} viewBox="0 0 56 64" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path d="M14 0 L28 24 L22 28 L8 4 Z" fill={ring} opacity="0.8" />
      <path d="M42 0 L28 24 L34 28 L48 4 Z" fill={ring} />
      <circle cx="28" cy="40" r="20" fill={`url(#${id})`} stroke={ring} strokeWidth="3" />
      <text x="28" y="48" textAnchor="middle" fontSize="22" fontWeight="800" fontFamily="'Baloo 2', sans-serif" fill="#fff">{n}</text>
    </svg>
  );
}

function Tier({ k, items, myClassId, flash }) {
  const tied = items.length > 1;
  const total = items[0].total_score;
  const cols = Math.min(items.length, 4);
  return (
    <div className={`tier t${k}`}>
      <div className="t-head">
        <div className="t-icon">
          {k === 1 ? <Crown /> : k === 2 ? <Medal n={2} from="#cfd8e3" to="#8d9aab" ring="#6f7d90" /> : <Medal n={3} from="#e6a566" to="#a9692f" ring="#8a5222" />}
        </div>
        <div className="t-lab">
          <span className="t-ribbon">{LABEL[k][tied ? 1 : 0]}</span>
          {tied && <span className="t-cnt">{items.length} lớp bằng điểm</span>}
        </div>
        <div className="t-score"><b>{fmtScore(total)}</b><small>điểm</small></div>
      </div>
      <div className={`t-tiles c${cols}`}>
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
    if (ws !== weekRef.current) return; // đã chuyển sang tuần khác
    if (err) {
      setError(err.message);
      setRows((cur) => cur || []);
      return;
    }
    setError('');
    const list = withDenseRank(data || []);
    // Đánh dấu các lớp vừa đổi điểm để nháy nhẹ
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
  const top = tiers.find((t) => t.k === 1);
  const lower = tiers.filter((t) => t.k !== 1);
  const allTied = !!rows && rows.length > 1 && rest.length === 0 && tiers.length === 1;

  return (
    <section className="rb" aria-label="Bảng vinh danh thi đua các lớp" style={{ '--acc': accent, '--acc-d': accentDark, '--me-bg': meBg }}>
      <style jsx>{`
        .rb { --gold: #e9b93a; --ink: #14263d; --muted: #5f6f83; --line: #e1e8f0; --tint: #f3f6fa; color: var(--ink); }
        .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .title { font-family: 'Baloo 2', sans-serif; font-size: 22px; font-weight: 700; margin: 0; line-height: 1.2; }
        .sub { color: var(--muted); font-size: 13.5px; margin: 2px 0 0; }
        .ctl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .wk { display: inline-flex; align-items: center; border: 1px solid var(--line); background: #fff; border-radius: 12px; overflow: hidden; }
        .wk button { border: none; background: #fff; width: 40px; height: 40px; font-size: 18px; cursor: pointer; color: var(--ink); }
        .wk button:disabled { opacity: 0.3; cursor: not-allowed; }
        .wk span { padding: 0 12px; font-size: 13px; font-weight: 700; white-space: nowrap; }
        .live { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #1a8a58; background: #e6f6ee; border-radius: 999px; padding: 6px 12px; }
        .live i { width: 7px; height: 7px; border-radius: 50%; background: #1a8a58; display: inline-block; }
        .past { font-size: 12px; font-weight: 700; color: var(--muted); background: #eceff4; border-radius: 999px; padding: 6px 12px; }

        .tiers { display: grid; gap: 14px; }
        .lower { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
        .lower.one { grid-template-columns: 1fr; }

        .tier { position: relative; border-radius: 22px; padding: 18px 18px 18px; overflow: hidden; }
        .t-head { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .t-icon { flex: none; line-height: 0; }
        .t-lab { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; min-width: 0; }
        .t-ribbon { display: inline-block; font-family: 'Baloo 2', sans-serif; font-weight: 800; letter-spacing: 0.08em; font-size: 14px; padding: 4px 14px; border-radius: 999px; }
        .t-cnt { font-size: 12.5px; font-weight: 600; }
        .t-score { margin-left: auto; text-align: right; line-height: 1; }
        .t-score b { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 40px; display: block; }
        .t-score small { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }

        .t-tiles { position: relative; z-index: 1; display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(116px, 1fr)); }
        .t-tiles.c1 { grid-template-columns: 1fr; }
        .tile { position: relative; border-radius: 16px; padding: 12px 12px 12px; text-align: center; }
        .tile-k { font-size: 11.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.8; }
        .tile-n { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 32px; line-height: 1.05; word-break: break-word; }
        .tile-s { font-size: 11.5px; margin-top: 4px; opacity: 0.85; line-height: 1.35; }
        .tag { display: inline-block; margin-top: 6px; background: var(--acc); color: #fff; font-size: 10.5px; font-weight: 800; border-radius: 999px; padding: 2px 9px; }

        /* HẠNG NHẤT — xanh navy, viền vàng, vương miện */
        .t1 { background: radial-gradient(120% 90% at 50% 0%, #2c4280 0%, #14234a 55%, #0b1530 100%); border: 2px solid var(--gold);
          box-shadow: 0 0 0 4px rgba(233,185,58,0.18), 0 18px 40px -16px rgba(11,21,48,0.7); color: #fff; padding: 22px 20px; }
        .t1::before { content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image: radial-gradient(circle at 12% 22%, rgba(255,236,160,0.9) 0 1.5px, transparent 2px),
            radial-gradient(circle at 86% 18%, rgba(255,236,160,0.8) 0 1.5px, transparent 2px),
            radial-gradient(circle at 70% 78%, rgba(255,236,160,0.7) 0 1.5px, transparent 2px),
            radial-gradient(circle at 24% 84%, rgba(255,236,160,0.7) 0 1.5px, transparent 2px),
            radial-gradient(circle at 50% 8%, rgba(255,236,160,0.6) 0 1px, transparent 2px); }
        .t1::after { content: ''; position: absolute; top: 0; bottom: 0; width: 38%; left: -45%; pointer-events: none;
          background: linear-gradient(100deg, transparent, rgba(255,240,180,0.22), transparent); transform: skewX(-18deg); animation: rbShine 5.5s ease-in-out infinite; }
        @keyframes rbShine { 0%, 55% { left: -45%; } 100% { left: 125%; } }
        .t1 .t-ribbon { background: linear-gradient(180deg, #ffe48a, #e2a41d); color: #4a3000; font-size: 15px; box-shadow: 0 2px 0 #a8730b; }
        .t1 .t-cnt { color: #ffe9a8; }
        .t1 .t-score b { color: #ffd966; font-size: 50px; text-shadow: 0 2px 14px rgba(255,200,60,0.45); }
        .t1 .t-score small { color: #ffe9a8; }
        .t1 .tile { background: rgba(255,255,255,0.08); border: 1px solid rgba(233,185,58,0.55); backdrop-filter: blur(2px); }
        .t1 .tile-n { color: #fff; }
        .t1 .t-tiles.c1 .tile { padding: 16px 14px; }
        .t1 .t-tiles.c1 .tile-n { font-size: 54px; color: #ffe9a8; }
        .t1 .tile.me { outline: 3px solid #ffd966; outline-offset: 2px; }

        /* HẠNG NHÌ — bạc */
        .t2 { background: linear-gradient(160deg, #f9fbfd, #dde5ee); border: 2px solid #aeb9c7; box-shadow: 0 10px 24px -16px rgba(60,80,110,0.6); }
        .t2 .t-ribbon { background: linear-gradient(180deg, #e8eef5, #a9b6c6); color: #26354a; box-shadow: 0 2px 0 #7f8da0; }
        .t2 .t-cnt { color: #55657a; }
        .t2 .t-score b { color: #3b4d66; }
        .t2 .t-score small { color: #66768b; }
        .t2 .tile { background: #fff; border: 1px solid #c9d3df; }
        .t2 .tile-n { color: #2f3f57; }
        .t2 .t-tiles.c1 .tile-n { font-size: 40px; }
        .t2 .tile.me { outline: 3px solid var(--acc); outline-offset: 1px; }

        /* HẠNG BA — đồng */
        .t3 { background: linear-gradient(160deg, #fff8f0, #f3dcc4); border: 2px solid #cf9a63; box-shadow: 0 10px 24px -16px rgba(120,70,20,0.55); }
        .t3 .t-ribbon { background: linear-gradient(180deg, #f0b676, #b8743a); color: #3f2208; box-shadow: 0 2px 0 #8a5222; }
        .t3 .t-cnt { color: #8a5a2c; }
        .t3 .t-score b { color: #7a4a1e; }
        .t3 .t-score small { color: #98683a; }
        .t3 .tile { background: #fffdf9; border: 1px solid #e4c3a0; }
        .t3 .tile-n { color: #6b4018; }
        .t3 .t-tiles.c1 .tile-n { font-size: 40px; }
        .t3 .tile.me { outline: 3px solid var(--acc); outline-offset: 1px; }

        .rest-h { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 22px 2px 8px; }
        .rest-h h3 { margin: 0; font-family: 'Baloo 2', sans-serif; font-size: 17px; }
        .rest-h span { font-size: 12.5px; color: var(--muted); }
        .tbl { background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
        .trow { display: grid; grid-template-columns: 1fr 74px 74px 82px; align-items: center; gap: 8px; padding: 11px 16px; border-top: 1px solid var(--line); }
        .trow:first-child { border-top: none; }
        .thead { background: var(--tint); font-size: 12px; font-weight: 700; color: var(--muted); }
        .trow.me { background: var(--me-bg, #fdeceb); }
        .nm { font-weight: 700; font-size: 14.5px; }
        .n { text-align: right; font-variant-numeric: tabular-nums; font-size: 13.5px; }
        .n.tot { font-weight: 800; font-size: 15px; }
        .trow .tag { margin: 0 0 0 6px; padding: 1px 8px; }

        .hint { color: var(--muted); font-size: 13px; text-align: center; margin: 10px 0 0; }
        .note { color: var(--muted); font-size: 12.5px; margin: 14px 2px 0; line-height: 1.5; }
        .empty { color: var(--muted); text-align: center; padding: 34px 0; font-size: 14px; }
        .err { color: #b3261e; font-size: 13px; margin: 0 0 10px; }

        .flash { animation: rbFlash 2.4s ease-out; }
        @keyframes rbFlash {
          0% { box-shadow: 0 0 0 0 rgba(240,180,41,0.9); }
          100% { box-shadow: 0 0 0 12px rgba(240,180,41,0); }
        }
        @media (prefers-reduced-motion: reduce) { .flash, .t1::after { animation: none; } .t1::after { display: none; } }

        @media (max-width: 720px) { .lower { grid-template-columns: 1fr; } }
        @media (max-width: 560px) {
          .title { font-size: 20px; }
          .tier { border-radius: 18px; padding: 14px 12px; }
          .t1 { padding: 16px 12px 14px; }
          .t-head { gap: 10px; margin-bottom: 12px; }
          .t-score b { font-size: 32px; }
          .t1 .t-score b { font-size: 40px; }
          .t-ribbon { font-size: 12.5px; padding: 4px 11px; }
          .t1 .t-ribbon { font-size: 13px; }
          .t-tiles { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .t-tiles.c1 { grid-template-columns: 1fr; }
          .tile-n { font-size: 27px; }
          .t1 .t-tiles.c1 .tile-n { font-size: 44px; }
          .t2 .t-tiles.c1 .tile-n, .t3 .t-tiles.c1 .tile-n { font-size: 34px; }
          .trow { grid-template-columns: 1fr 64px; padding: 12px 14px; }
          .trow .hide-s { display: none; }
        }
      `}</style>

      <div className="head">
        <div>
          <h2 className="title">Vinh danh thi đua các lớp</h2>
          <p className="sub">Tuần {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}</p>
        </div>
        <div className="ctl">
          <div className="wk">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Tuần trước">‹</button>
            <span>{isCurrent ? 'Tuần này' : 'Tuần đã qua'}</span>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={isCurrent} aria-label="Tuần sau">›</button>
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
      {rows === null && !error && <div className="empty">Đang tải bảng xếp hạng…</div>}
      {rows && rows.length === 0 && !error && <div className="empty">Chưa có lớp nào trong hệ thống.</div>}

      {rows && rows.length > 0 && (
        <div className="tiers">
          {top && <Tier k={1} items={top.items} myClassId={myClassId} flash={flash} />}
          {lower.length > 0 && (
            <div className={`lower ${lower.length === 1 ? 'one' : ''}`}>
              {lower.map((t) => <Tier key={t.k} k={t.k} items={t.items} myClassId={myClassId} flash={flash} />)}
            </div>
          )}
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
