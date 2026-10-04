'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRankingPing } from '@/lib/useRankingPing';
import { addDays, fmtDate, fmtIso, mondayOf, timeVN, vnTodayIso } from '@/lib/dates';
import RankingBoard from '@/components/RankingBoard';
import { useStudent } from '../layout';

const CAT_LABEL = { ne_nep: 'Nề nếp', hoc_tap: 'Học tập' };
const PLACE = { 1: 'Hạng nhất', 2: 'Hạng nhì', 3: 'Hạng ba' };
const PLACE_TIED = { 1: 'Đồng hạng nhất', 2: 'Đồng hạng nhì', 3: 'Đồng hạng ba' };
const fmt = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export default function ThiDuaPage() {
  const { profile } = useStudent();
  const classId = profile.class_id || null;
  const className = profile.classes?.name;
  const [feed, setFeed] = useState(null);
  const [summary, setSummary] = useState(null); // { mine, tied }
  const today = vnTodayIso();
  const thisMonday = mondayOf(today);
  const [viewWeek, setViewWeek] = useState(thisMonday); // tuần đang xem mục bị trừ điểm

  const loadFeed = useCallback(async () => {
    if (!classId) {
      setFeed([]);
      return;
    }
    const { data, error } = await supabase.rpc('student_class_feed', { p_days: 60 });
    setFeed(error ? [] : data || []);
  }, [classId]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useRankingPing(loadFeed);

  // Các tuần xem được: dữ liệu lấy tối đa 60 ngày gần nhất, từ tuần hiện tại lùi về
  const weeks = useMemo(() => {
    const list = [];
    const earliest = mondayOf(addDays(today, -60));
    for (let w = thisMonday; w >= earliest; w = addDays(w, -7)) list.push(w);
    return list; // mới nhất trước
  }, [today, thisMonday]);

  // Tổng điểm trừ theo từng tuần, để biết tuần nào có bị trừ
  const weekSum = useMemo(() => {
    const m = new Map();
    (feed || []).forEach((r) => {
      const w = mondayOf(String(r.occurred_date));
      m.set(w, (m.get(w) || 0) + Number(r.points));
    });
    return m;
  }, [feed]);

  // Chỉ hiện các ghi nhận của tuần đang chọn (thứ Hai đến Chủ nhật)
  const groups = useMemo(() => {
    const m = new Map();
    (feed || [])
      .filter((r) => mondayOf(String(r.occurred_date)) === viewWeek)
      .forEach((r) => {
        if (!m.has(r.occurred_date)) m.set(r.occurred_date, []);
        m.get(r.occurred_date).push(r);
      });
    return Array.from(m.entries());
  }, [feed, viewWeek]);

  const weekTotal = weekSum.get(viewWeek) || 0;
  const isThisWeek = viewWeek === thisMonday;
  const canPrev = viewWeek > weeks[weeks.length - 1];
  const withDeduct = weeks.filter((w) => (weekSum.get(w) || 0) < 0);

  const mine = summary?.mine;
  const place = mine && mine.rank <= 3 ? (summary.tied ? PLACE_TIED : PLACE)[mine.rank] : null;

  return (
    <>
      <style jsx>{`
        .me-card { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;
          background: linear-gradient(135deg, #12306a 0%, #0b1d45 100%); color: #fff; border-radius: 20px; padding: 20px 24px; margin-bottom: 24px;
          border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 14px 30px -18px rgba(11,29,69,0.8); }
        .me-card::after { content: ''; position: absolute; right: -60px; top: -60px; width: 190px; height: 190px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%); pointer-events: none; }
        .me-l { position: relative; z-index: 1; min-width: 0; }
        .me-l small { display: block; color: #b9d3f2; font-size: 13px; margin-bottom: 2px; }
        .me-l b { display: block; font-family: 'Baloo 2', sans-serif; font-size: 28px; line-height: 1.15; }
        .badge { display: inline-block; margin-top: 8px; font-size: 13px; font-weight: 800; border-radius: 999px; padding: 4px 14px; }
        .badge.p1 { background: linear-gradient(180deg, #ffe793, #e0a82e); color: #4a3200; }
        .badge.p2 { background: linear-gradient(180deg, #eef3f8, #aab7c8); color: #27364c; }
        .badge.p3 { background: linear-gradient(180deg, #f2bb80, #b8743a); color: #3f2208; }
        .badge.p0 { background: rgba(255,255,255,0.14); color: #e4eefb; font-weight: 600; }
        .me-r { position: relative; z-index: 1; display: flex; gap: 10px; }
        .stat { min-width: 86px; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; padding: 9px 14px; text-align: center; }
        .stat.total { background: rgba(255,217,102,0.14); border-color: rgba(255,217,102,0.5); }
        .stat small { display: block; color: #b9d3f2; font-size: 12px; }
        .stat b { font-family: 'Baloo 2', sans-serif; font-size: 24px; line-height: 1.2; font-variant-numeric: tabular-nums; }
        .stat.total b { color: #ffd966; }
        @media (max-width: 560px) {
          .me-card { padding: 16px 16px; margin-bottom: 18px; border-radius: 18px; }
          .me-l b { font-size: 23px; }
          .me-r { width: 100%; gap: 8px; }
          .stat { flex: 1; min-width: 0; padding: 8px 6px; }
          .stat b { font-size: 21px; }
        }

        .box { background: var(--card); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 20px 22px; margin-top: 30px; }
        .box h3 { margin: 0 0 4px; font-size: 18px; }
        .wkbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin: 12px 0 4px; }
        .wk { display: inline-flex; align-items: center; border: 1px solid var(--line); background: #fff; border-radius: 12px; overflow: hidden; }
        .wk button { border: none; background: #fff; width: 42px; height: 42px; cursor: pointer; color: var(--ink); display: inline-flex; align-items: center; justify-content: center; }
        .wk button:disabled { opacity: 0.3; cursor: not-allowed; }
        .wk span { padding: 0 12px; font-size: 13px; font-weight: 700; white-space: nowrap; }
        .wk-sum { font-size: 12.5px; font-weight: 700; border-radius: 999px; padding: 6px 13px; color: #167a4e; background: #e6f6ee; }
        .wk-sum.bad { color: #b3261e; background: #fdeceb; }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .chips small { width: 100%; color: var(--ink-soft); font-size: 12px; }
        .chip { border: 1px solid #f1c4c0; background: #fff6f5; color: #b3261e; border-radius: 999px; font-size: 12.5px; font-weight: 700; padding: 6px 12px; cursor: pointer; min-height: 34px; }
        .chip.on { background: #b3261e; color: #fff; border-color: #b3261e; }
        .day { margin-top: 18px; }
        .day-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-weight: 700; font-size: 13.5px; color: var(--ink-soft); padding-bottom: 8px; border-bottom: 1px solid var(--line); }
        .day-sum { color: #b3261e; background: #fdeceb; border-radius: 999px; padding: 2px 11px; font-size: 12.5px; }
        .day-sum.ok { color: #167a4e; background: #e6f6ee; }
        .item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
        .item:last-child { border-bottom: none; }
        .it-t { font-weight: 700; font-size: 14.5px; }
        .it-m { color: var(--ink-soft); font-size: 12.5px; margin-top: 3px; line-height: 1.45; }
        .pts { flex: none; min-width: 46px; text-align: center; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 17px; border-radius: 10px; padding: 3px 8px; }
        .pts.neg { color: #b3261e; background: #fdeceb; }
        .pts.zero { color: #167a4e; background: #e6f6ee; }
        .cat { display: inline-block; font-size: 11px; font-weight: 700; border-radius: 999px; padding: 1px 9px; margin-right: 7px; background: var(--ocean-tint); color: var(--ocean-dark); vertical-align: 1px; }
        .good { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px 0 10px; color: var(--ink-soft); font-size: 14px; text-align: center; }
        .good svg { color: #1a8a58; }
        @media (max-width: 560px) { .box { padding: 16px 14px; border-radius: 18px; margin-top: 22px; } }
      `}</style>

      <h2 className="section-title">Thi đua lớp</h2>
      <p className="section-sub">Sao đỏ và cô Tổng phụ trách chấm điểm nề nếp, học tập mỗi ngày. Bảng vinh danh tự cập nhật ngay khi có điểm mới.</p>

      {classId && mine && (
        <div className="me-card">
          <div className="me-l">
            <small>Lớp của em</small>
            <b>Lớp {className || mine.class_name}</b>
            <span className={`badge ${place ? `p${mine.rank}` : 'p0'}`}>{place || 'Cố lên, cùng lọt top 3 nhé!'}</span>
          </div>
          <div className="me-r">
            <div className="stat"><small>Nề nếp</small><b>{fmt(mine.ne_nep_score)}</b></div>
            <div className="stat"><small>Học tập</small><b>{fmt(mine.hoc_tap_score)}</b></div>
            <div className="stat total"><small>Tổng</small><b>{fmt(mine.total_score)}</b></div>
          </div>
        </div>
      )}

      <RankingBoard
        myClassId={classId}
        onLoaded={(list) => {
          const m = list.find((r) => r.class_id === classId);
          setSummary({ mine: m, tied: m ? list.filter((r) => r.rank === m.rank).length > 1 : false });
        }}
      />

      <div className="box">
        <h3>Lớp {className || ''} bị trừ điểm những mục nào</h3>
        <p className="section-sub" style={{ margin: '0 0 4px', fontSize: 13 }}>
          Chỉ xem theo từng tuần (thứ Hai đến Chủ nhật). Chọn tuần có bị trừ điểm để xem chi tiết. Cùng nhau khắc phục để lớp mình lên hạng nhé!
        </p>

        {classId && feed !== null && (
          <>
            <div className="wkbar">
              <div className="wk">
                <button type="button" onClick={() => setViewWeek(addDays(viewWeek, -7))} disabled={!canPrev} aria-label="Tuần trước">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
                </button>
                <span>{isThisWeek ? 'Tuần này' : 'Tuần'} {fmtDate(viewWeek)} – {fmtDate(addDays(viewWeek, 6))}</span>
                <button type="button" onClick={() => setViewWeek(addDays(viewWeek, 7))} disabled={isThisWeek} aria-label="Tuần sau">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <span className={`wk-sum ${weekTotal < 0 ? 'bad' : ''}`}>{weekTotal < 0 ? `${isThisWeek ? 'Tuần này' : 'Tuần đó'} bị trừ ${weekTotal} điểm` : 'Không bị trừ điểm'}</span>
            </div>
            {withDeduct.length > 0 && (
              <div className="chips">
                <small>Các tuần có bị trừ điểm:</small>
                {withDeduct.map((w) => (
                  <button type="button" key={w} className={`chip ${w === viewWeek ? 'on' : ''}`} onClick={() => setViewWeek(w)}>
                    {fmtDate(w)} – {fmtDate(addDays(w, 6))} ({weekSum.get(w)})
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!classId ? (
          <div className="empty-note">Tài khoản này chưa thuộc lớp nào.</div>
        ) : feed === null ? (
          <div className="empty-note">Đang tải…</div>
        ) : groups.length === 0 ? (
          <div className="good">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M7.8 12.4l3 3 5.4-6" /></svg>
            {isThisWeek ? 'Tuần này lớp mình chưa bị trừ điểm. Hãy tiếp tục phát huy nhé!' : 'Tuần đó lớp không bị trừ điểm.'}
          </div>
        ) : (
          groups.map(([date, list]) => {
            const sum = list.reduce((s, r) => s + Number(r.points), 0);
            return (
              <div className="day" key={date}>
                <div className="day-h">
                  <span>{fmtIso(date)}</span>
                  <span className={`day-sum ${sum < 0 ? '' : 'ok'}`}>{sum < 0 ? `${sum} điểm` : 'Không bị trừ'}</span>
                </div>
                {list.map((r) => (
                  <div className="item" key={r.id}>
                    <div>
                      <div className="it-t"><span className="cat">{CAT_LABEL[r.category] || r.category}</span>{r.reason_label}</div>
                      <div className="it-m">
                        {timeVN(r.created_at)}{r.reporter_name ? ` · ${r.reporter_name}` : ''}{r.note ? ` · ${r.note}` : ''}
                      </div>
                    </div>
                    <div className={`pts ${Number(r.points) < 0 ? 'neg' : 'zero'}`}>{Number(r.points) < 0 ? r.points : '0'}</div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
