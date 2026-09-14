'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getRankTier, getInitials } from '../../../lib/rankTiers';
import { useStudent } from '../layout';

const PERIODS = [
  { key: 'week', label: 'Tuần này' },
  { key: 'hk1', label: 'Học kỳ 1' },
  { key: 'hk2', label: 'Học kỳ 2' },
  { key: 'year', label: 'Cả năm' },
];

function Avatar({ name, totalXp, size }) {
  const tier = getRankTier(totalXp);
  const core = size - 8;
  return (
    <div className={`avatar-frame ${tier.className}`} style={{ width: size, height: size }}>
      <div className="core" style={{ width: core, height: core, fontSize: Math.max(10, size * 0.32) }}>
        {getInitials(name)}
      </div>
      {tier.badge && <div className="rank-badge">{tier.badge}</div>}
    </div>
  );
}

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
              const size = rank === 1 ? 74 : 58;
              return (
                <div className={`pod-slot rank${rank}`} key={p.student_id}>
                  <Avatar name={p.full_name} totalXp={p.total_xp} size={size} />
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
                <Avatar name={p.full_name} totalXp={p.total_xp} size={38} />
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
          <div className="modal">
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <h3>Cách tính điểm kinh nghiệm (KN)</h3>
            <div className="rule">
              <div><div className="rule-title">Làm bài tập</div><div className="rule-desc">Cộng KN theo tỉ lệ điểm số, tối đa 30 KN/bài. Chỉ tính ở lần chấm điểm đầu tiên.</div></div>
            </div>
            <div className="rule">
              <div><div className="rule-title">Giữ chuỗi ngày học</div><div className="rule-desc">Có hoạt động được tính KN mỗi ngày sẽ giữ được chuỗi liên tục, hiện ở góc trên cùng.</div></div>
            </div>
            <div className="rule">
              <div><div className="rule-title">Hỏi bài</div><div className="rule-desc">Đăng câu hỏi được +2 KN/ngày. Câu trả lời được đánh dấu hữu ích được +5 KN, tối đa 3 lần/ngày.</div></div>
            </div>
            <div className="rule">
              <div><div className="rule-title">Khung avatar</div><div className="rule-desc">Dùng tổng KN tích luỹ từ trước tới nay nên không bao giờ mất, kể cả khi bảng xếp hạng theo kỳ được làm mới: Tân binh → Thủy thủ → Hoa tiêu → Thuyền trưởng → Đô đốc → Huyền thoại đại dương.</div></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
