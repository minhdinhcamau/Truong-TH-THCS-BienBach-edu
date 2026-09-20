'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRankingPing } from '@/lib/useRankingPing';
import { fmtIso, timeVN } from '@/lib/dates';
import RankingBoard from '@/components/RankingBoard';
import { useStudent } from '../layout';

const CAT_LABEL = { ne_nep: 'Nề nếp', hoc_tap: 'Học tập' };

export default function ThiDuaPage() {
  const { profile } = useStudent();
  const classId = profile.class_id || null;
  const className = profile.classes?.name;
  const [feed, setFeed] = useState(null);
  const [summary, setSummary] = useState(null); // { mine, total }

  const loadFeed = useCallback(async () => {
    if (!classId) {
      setFeed([]);
      return;
    }
    const { data, error } = await supabase.rpc('student_class_feed', { p_days: 14 });
    setFeed(error ? [] : data || []);
  }, [classId]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useRankingPing(loadFeed);

  const groups = useMemo(() => {
    const m = new Map();
    (feed || []).forEach((r) => {
      if (!m.has(r.occurred_date)) m.set(r.occurred_date, []);
      m.get(r.occurred_date).push(r);
    });
    return Array.from(m.entries());
  }, [feed]);

  return (
    <>
      <style jsx>{`
        .me-card { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
          background: var(--ocean-dark); color: #fff; border-radius: var(--radius-lg); padding: 18px 22px; margin-bottom: 22px; }
        .me-l small { display: block; color: #bfdcf5; font-size: 12.5px; }
        .me-l b { font-family: 'Baloo 2', sans-serif; font-size: 26px; line-height: 1.15; }
        .me-r { display: flex; gap: 22px; }
        .me-r div { text-align: right; }
        .me-r small { display: block; color: #bfdcf5; font-size: 11.5px; }
        .me-r b { font-family: 'Baloo 2', sans-serif; font-size: 24px; }
        .box { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: 18px 20px; margin-top: 28px; }
        .box h3 { margin: 0 0 4px; font-size: 18px; }
        .day { margin-top: 16px; }
        .day-h { display: flex; justify-content: space-between; font-weight: 700; font-size: 13.5px; color: var(--ink-soft); padding-bottom: 6px; border-bottom: 1px solid var(--line); }
        .item { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
        .item:last-child { border-bottom: none; }
        .it-t { font-weight: 700; font-size: 14px; }
        .it-m { color: var(--ink-soft); font-size: 12px; margin-top: 2px; }
        .pts { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 18px; white-space: nowrap; }
        .pts.neg { color: #c4262e; }
        .pts.zero { color: var(--success); }
        .cat { display: inline-block; font-size: 10.5px; font-weight: 800; border-radius: 999px; padding: 1px 8px; margin-right: 6px; background: var(--ocean-tint); color: var(--ocean-dark); }
      `}</style>

      <h2 className="section-title">Thi đua lớp</h2>
      <p className="section-sub">Sao đỏ và cô Tổng phụ trách chấm điểm nề nếp, học tập mỗi ngày. Bảng xếp hạng tự cập nhật ngay khi có điểm mới.</p>

      {classId && summary?.mine && (
        <div className="me-card">
          <div className="me-l">
            <small>Lớp em</small>
            <b>Lớp {className || summary.mine.class_name} · hạng {summary.mine.rank}/{summary.total}</b>
          </div>
          <div className="me-r">
            <div><small>Nề nếp</small><b>{Number(summary.mine.ne_nep_score).toLocaleString('vi-VN')}</b></div>
            <div><small>Học tập</small><b>{Number(summary.mine.hoc_tap_score).toLocaleString('vi-VN')}</b></div>
            <div><small>Tổng</small><b>{Number(summary.mine.total_score).toLocaleString('vi-VN')}</b></div>
          </div>
        </div>
      )}

      <RankingBoard
        myClassId={classId}
        onLoaded={(list) => setSummary({ mine: list.find((r) => r.class_id === classId), total: list.length })}
      />

      <div className="box">
        <h3>Lớp em bị trừ điểm những mục nào</h3>
        <p className="section-sub" style={{ margin: '0 0 4px', fontSize: 13 }}>
          Các ghi nhận của Sao đỏ và cô Tổng phụ trách trong 14 ngày gần đây. Cùng nhau khắc phục để lớp mình lên hạng nhé!
        </p>

        {!classId ? (
          <div className="empty-note">Tài khoản này chưa thuộc lớp nào.</div>
        ) : feed === null ? (
          <div className="empty-note">Đang tải…</div>
        ) : groups.length === 0 ? (
          <div className="empty-note">Chưa có ghi nhận nào. Lớp mình đang làm rất tốt!</div>
        ) : (
          groups.map(([date, list]) => {
            const sum = list.reduce((s, r) => s + Number(r.points), 0);
            return (
              <div className="day" key={date}>
                <div className="day-h">
                  <span>{fmtIso(date)}</span>
                  <span>{sum < 0 ? `${sum} điểm` : 'Không bị trừ'}</span>
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
