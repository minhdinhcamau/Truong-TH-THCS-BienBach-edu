'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AvatarFrame from '../../../components/AvatarFrame';
import RankRules from '../../../components/RankRules';
import { useStudent } from '../layout';

const PERIODS = [
  { key: 'week', label: 'Tuần này' },
  { key: 'hk1', label: 'Học kỳ 1' },
  { key: 'hk2', label: 'Học kỳ 2' },
  { key: 'year', label: 'Cả năm' },
];

export default function LeaderboardPage() {
  const { profile } = useStudent();
  const [period, setPeriod] = useState('week');
  const [rows, setRows] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let active = true;
    setRows(null);
    supabase.rpc('get_leaderboard', { p_period: period }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error(error);
        setRows([]);
        return;
      }
      setRows(data || []);
    });
    return () => { active = false; };
  }, [period]);

  return (
    <>
      <h2 className="section-title">Bảng xếp hạng</h2>
      <p className="section-sub">Kinh nghiệm (KN) kiếm được trong kỳ xếp hạng — thứ hạng làm mới khi sang kỳ mới, nhưng cấp bậc và khung avatar của em luôn được giữ lại.</p>

      <div className="lb-subtabs">
        {PERIODS.map((p) => (
          <button key={p.key} className={`lb-subtab ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {rows === null && <div className="center-loading">Đang tải bảng xếp hạng…</div>}

      {rows && rows.length === 0 && (
        <div className="empty-note" style={{ padding: '40px 0' }}>
          Chưa có dữ liệu cho kỳ này — có thể nhà trường chưa thiết lập mốc học kỳ, hoặc kỳ học chưa bắt đầu.
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="podium">
            {[1, 0, 2].filter((i) => rows[i]).map((i) => {
              const p = rows[i];
              const rank = i + 1;
              const size = rank === 1 ? 108 : 88;
              return (
                <div className={`pod-slot rank${rank}`} key={p.student_id}>
                  <AvatarFrame src={p.photo_url} name={p.full_name} xp={p.total_xp} size={size} />
                  <div className="pod-name" style={{ marginTop: 8 }}>{p.full_name}{p.student_id === profile.id ? ' (Em)' : ''}</div>
                  <div className="pod-class">Lớp {p.class_name}</div>
                  <div className="pod-base">
                    <div className="rk">{rank}</div>
                    <div className="kn">{Number(p.period_xp).toLocaleString('vi-VN')} KN</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lb-list">
            {rows.slice(3).map((p, idx) => (
              <div className={`lb-row ${p.student_id === profile.id ? 'me' : ''}`} key={p.student_id}>
                <div className="lb-rank">{idx + 4}</div>
                <AvatarFrame src={p.photo_url} name={p.full_name} xp={p.total_xp} size={52} />
                <div className="lb-name-wrap">
                  <div className="lb-name">{p.full_name}{p.student_id === profile.id ? ' (Em)' : ''}</div>
                  <div className="lb-class">Lớp {p.class_name}</div>
                </div>
                <div className="lb-streak">🔥 {p.current_streak}</div>
                <div className="lb-kn">{Number(p.period_xp).toLocaleString('vi-VN')} KN</div>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="info-link" onClick={() => setShowModal(true)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>
        Cách tính điểm kinh nghiệm & khung avatar
      </button>

      {showModal && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <RankRules />
          </div>
        </div>
      )}
    </>
  );
}
