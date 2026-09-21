'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRankingPing } from '@/lib/useRankingPing';
import { addDays, fmtDate, mondayOf, vnTodayIso } from '@/lib/dates';

// Bảng xếp hạng thi đua các lớp theo tuần. Dùng chung cho trang /ranking (TPT, Sao đỏ) và trang học sinh.
// Điểm bằng nhau => đồng hạng (1, 2, 2, 4 …). Tự cập nhật ngay khi Sao đỏ / TPT ghi điểm.
//   myClassId : lớp của người xem, được đánh dấu "Lớp em"
//   onLoaded  : gọi lại với danh sách xếp hạng của tuần đang xem (để trang cha hiện tóm tắt)

const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' };

function fmtScore(n) {
  return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function Star({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <polygon
        fill="#f4b73d"
        points="20,4 24.2,15 36,15.8 27,23.4 29.8,35 20,28.6 10.2,35 13,23.4 4,15.8 15.8,15"
      />
    </svg>
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
    const list = data || [];
    // Đánh dấu các lớp vừa đổi điểm để nháy nhẹ
    const changed = new Set();
    list.forEach((r) => {
      const before = prevRef.current.get(r.class_id);
      if (before !== undefined && before !== r.total_score) changed.add(r.class_id);
    });
    prevRef.current = new Map(list.map((r) => [r.class_id, r.total_score]));
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
  const top = rows ? rows.slice(0, 4) : [];
  const rest = rows ? rows.slice(4) : [];
  const hero = top[0];
  const others = top.slice(1);

  return (
    <section className="rb" aria-label="Bảng xếp hạng thi đua các lớp" style={{ '--red': accent, '--red-d': accentDark, '--me-bg': meBg }}>
      <style jsx>{`
        .rb { --red: #c4262e; --red-d: #8f1a20; --gold: #f0b429; --silver: #8b98a8; --bronze: #b9773c;
          --ink: #14263d; --muted: #5f6f83; --line: #e1e8f0; --tint: #f3f6fa; color: var(--ink); }
        .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .title { font-family: 'Baloo 2', sans-serif; font-size: 22px; font-weight: 700; margin: 0; line-height: 1.2; }
        .sub { color: var(--muted); font-size: 13.5px; margin: 2px 0 0; }
        .ctl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .wk { display: inline-flex; align-items: center; border: 1px solid var(--line); background: #fff; border-radius: 12px; overflow: hidden; }
        .wk button { border: none; background: #fff; width: 34px; height: 36px; font-size: 16px; cursor: pointer; color: var(--ink); }
        .wk button:disabled { opacity: 0.3; cursor: not-allowed; }
        .wk span { padding: 0 12px; font-size: 13px; font-weight: 700; white-space: nowrap; }
        .live { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #1a8a58; background: #e6f6ee; border-radius: 999px; padding: 5px 11px; }
        .live i { width: 7px; height: 7px; border-radius: 50%; background: #1a8a58; display: inline-block; }
        .past { font-size: 12px; font-weight: 700; color: var(--muted); background: #eceff4; border-radius: 999px; padding: 5px 11px; }

        .champ { position: relative; background: var(--red); color: #fff; border-radius: 20px; padding: 22px 24px; margin-bottom: 12px;
          display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap; overflow: hidden; }
        .champ.me { outline: 3px solid var(--gold); outline-offset: 2px; }
        .hero-l { display: flex; align-items: center; gap: 16px; min-width: 0; }
        .hero-rank { flex: none; width: 66px; height: 66px; border-radius: 50%; background: #fff; display: grid; place-items: center; position: relative; }
        .hero-rank b { font-family: 'Baloo 2', sans-serif; font-size: 34px; line-height: 1; color: var(--red); }
        .hero-rank .st { position: absolute; top: -9px; right: -9px; }
        .hero-tag { font-size: 12.5px; font-weight: 700; opacity: 0.9; }
        .hero-name { font-family: 'Baloo 2', sans-serif; font-size: 40px; font-weight: 700; line-height: 1.05; }
        .hero-r { display: flex; gap: 22px; align-items: flex-end; }
        .stat { text-align: right; }
        .stat small { display: block; font-size: 11.5px; opacity: 0.85; }
        .stat b { font-family: 'Baloo 2', sans-serif; font-size: 20px; }
        .stat.big b { font-size: 42px; line-height: 1; }

        .trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
        @media (max-width: 640px) { .trio { grid-template-columns: 1fr; } .hero-name { font-size: 32px; } .hero-r { width: 100%; justify-content: space-between; } }
        .cardx { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
        .cardx.me { outline: 2px solid var(--red); outline-offset: 1px; }
        .medal { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: #fff;
          font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 20px; background: #6f7f92; }
        .medal.gold { background: var(--gold); color: #5a3b00; }
        .medal.silver { background: var(--silver); }
        .medal.bronze { background: var(--bronze); }
        .cx-name { font-family: 'Baloo 2', sans-serif; font-size: 22px; font-weight: 700; line-height: 1.1; }
        .cx-sub { font-size: 12px; color: var(--muted); }
        .cx-score { margin-left: auto; text-align: right; }
        .cx-score b { font-family: 'Baloo 2', sans-serif; font-size: 24px; line-height: 1; }
        .cx-score small { display: block; font-size: 11px; color: var(--muted); }

        .tbl { background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
        .trow { display: grid; grid-template-columns: 44px 1fr 74px 74px 82px; align-items: center; gap: 8px; padding: 11px 16px; border-top: 1px solid var(--line); }
        .trow:first-child { border-top: none; }
        .thead { background: var(--tint); font-size: 12px; font-weight: 700; color: var(--muted); }
        .trow.me { background: var(--me-bg, #fdeceb); }
        .rk { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 18px; color: var(--muted); text-align: center; }
        .nm { font-weight: 700; font-size: 14.5px; }
        .n { text-align: right; font-variant-numeric: tabular-nums; font-size: 13.5px; }
        .n.tot { font-weight: 800; font-size: 15px; }
        .tag { display: inline-block; margin-left: 6px; background: var(--red); color: #fff; font-size: 10.5px; font-weight: 800; border-radius: 999px; padding: 1px 8px; vertical-align: middle; }
        @media (max-width: 560px) {
          .trow { grid-template-columns: 34px 1fr 64px; }
          .trow .hide-s { display: none; }
        }
        .note { color: var(--muted); font-size: 12.5px; margin: 12px 2px 0; line-height: 1.5; }
        .empty { color: var(--muted); text-align: center; padding: 34px 0; font-size: 14px; }
        .err { color: #b3261e; font-size: 13px; margin: 0 0 10px; }

        .flash { animation: rbFlash 2.4s ease-out; }
        @keyframes rbFlash {
          0% { box-shadow: 0 0 0 0 rgba(240,180,41,0.9); background-color: #fff3c4; }
          100% { box-shadow: 0 0 0 10px rgba(240,180,41,0); }
        }
        @media (prefers-reduced-motion: reduce) { .flash { animation: none; } }
      `}</style>

      <div className="head">
        <div>
          <h2 className="title">Xếp hạng thi đua các lớp</h2>
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

      {hero && (
        <div className={`champ ${flash.has(hero.class_id) ? 'flash' : ''} ${hero.class_id === myClassId ? 'me' : ''}`}>
          <div className="hero-l">
            <div className="hero-rank">
              <span className="st"><Star size={26} /></span>
              <b>{hero.rank}</b>
            </div>
            <div>
              <div className="hero-tag">Đứng đầu tuần{hero.class_id === myClassId ? ' · Lớp em' : ''}</div>
              <div className="hero-name">Lớp {hero.class_name}</div>
            </div>
          </div>
          <div className="hero-r">
            <div className="stat"><small>Nề nếp</small><b>{fmtScore(hero.ne_nep_score)}</b></div>
            <div className="stat"><small>Học tập</small><b>{fmtScore(hero.hoc_tap_score)}</b></div>
            <div className="stat big"><small>Tổng điểm</small><b>{fmtScore(hero.total_score)}</b></div>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="trio">
          {others.map((r) => (
            <div key={r.class_id} className={`cardx ${flash.has(r.class_id) ? 'flash' : ''} ${r.class_id === myClassId ? 'me' : ''}`}>
              <div className={`medal ${MEDAL[r.rank] || ''}`}>{r.rank}</div>
              <div>
                <div className="cx-name">Lớp {r.class_name}{r.class_id === myClassId ? <span className="tag">Lớp em</span> : null}</div>
                <div className="cx-sub">NN {fmtScore(r.ne_nep_score)} · HT {fmtScore(r.hoc_tap_score)}</div>
              </div>
              <div className="cx-score"><b>{fmtScore(r.total_score)}</b><small>điểm</small></div>
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="tbl" role="table" aria-label="Các lớp còn lại">
          <div className="trow thead" role="row">
            <span style={{ textAlign: 'center' }}>Hạng</span>
            <span>Lớp</span>
            <span className="n hide-s">Nề nếp</span>
            <span className="n hide-s">Học tập</span>
            <span className="n">Tổng</span>
          </div>
          {rest.map((r) => (
            <div key={r.class_id} role="row" className={`trow ${r.class_id === myClassId ? 'me' : ''} ${flash.has(r.class_id) ? 'flash' : ''}`}>
              <span className="rk">{r.rank}</span>
              <span className="nm">Lớp {r.class_name}{r.class_id === myClassId ? <span className="tag">Lớp em</span> : null}</span>
              <span className="n hide-s">{fmtScore(r.ne_nep_score)}</span>
              <span className="n hide-s">{fmtScore(r.hoc_tap_score)}</span>
              <span className="n tot">{fmtScore(r.total_score)}</span>
            </div>
          ))}
        </div>
      )}

      {rows && rows.length > 0 && (
        <p className="note">
          Điểm Tổng là trung bình của điểm Nề nếp và Học tập; mỗi lỗi bị Sao đỏ ghi nhận sẽ trừ điểm.
          Các lớp có điểm bằng nhau được xếp đồng hạng. Bảng làm mới theo từng tuần.
        </p>
      )}
    </section>
  );
}
