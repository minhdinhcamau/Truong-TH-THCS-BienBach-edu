'use client';
// components/RankRules.jsx — Mục "Cách tính điểm kinh nghiệm (KN)" mới. Số liệu lấy từ lib/rank.js nên không bao giờ lệch.
// Dán vào chỗ đang hiện mục cũ: <RankRules />
import { RANKS, XP_RULES, calcAssignmentXp } from '../lib/rank';

const fmt = (n) => n.toLocaleString('vi-VN');
const sample = (pct, isReview) => calcAssignmentXp({ score: pct, maxScore: 100, isReview }).xp;

export default function RankRules() {
  const cols = [100, 90, 80, 70, 50, 30];
  const h3 = { margin: '16px 0 4px', fontSize: 15, fontWeight: 700 };
  const p = { margin: '0 0 6px', fontSize: 14, lineHeight: 1.5 };
  const cell = { padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid rgba(128,128,128,.25)', fontSize: 13 };
  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Cách tính điểm kinh nghiệm (KN)</h2>

      <h3 style={h3}>Làm bài tập</h3>
      <p style={p}>
        KN tính theo tỉ lệ điểm số và <b>càng làm đúng nhiều thì càng được nhiều KN</b>. Bài mới tối đa {XP_RULES.ASSIGN_NEW_MAX} KN, bài ôn tập
        tối đa {XP_RULES.ASSIGN_REVIEW_MAX} KN (ôn lại không được nhiều như học bài mới). Dưới {Math.round(XP_RULES.ASSIGN_MIN_RATIO * 100)}% điểm
        thì không có KN. Chỉ tính ở lần chấm điểm đầu tiên, tối đa {XP_RULES.ASSIGN_DAILY_CAP} KN/ngày từ bài tập.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 320 }}>
          <thead>
            <tr><th style={cell}>Đúng</th>{cols.map((c) => <th key={c} style={cell}>{c}%</th>)}</tr>
          </thead>
          <tbody>
            <tr><td style={cell}>Bài mới</td>{cols.map((c) => <td key={c} style={cell}>{sample(c, false)}</td>)}</tr>
            <tr><td style={cell}>Ôn tập</td>{cols.map((c) => <td key={c} style={cell}>{sample(c, true)}</td>)}</tr>
          </tbody>
        </table>
      </div>

      <h3 style={h3}>Giữ chuỗi ngày học</h3>
      <p style={p}>Có hoạt động được tính KN mỗi ngày sẽ giữ được chuỗi liên tục, hiện ở góc trên cùng.</p>

      <h3 style={h3}>Hỏi bài</h3>
      <p style={p}>
        Đăng câu hỏi được +{XP_RULES.QUESTION_XP} KN/ngày. Câu trả lời được đánh dấu hữu ích được +{XP_RULES.ANSWER_HELPFUL_XP} KN,
        tối đa {XP_RULES.ANSWER_HELPFUL_PER_DAY} lần/ngày.
      </p>

      <h3 style={h3}>Khung avatar</h3>
      <p style={p}>
        Dùng tổng KN tích luỹ từ trước tới nay nên không bao giờ mất, kể cả khi bảng xếp hạng theo kỳ được làm mới. Hạng càng cao càng cần nhiều KN,
        khung và hiệu ứng càng đẹp.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {RANKS.map((r) => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, border: '1px solid rgba(128,128,128,.25)', borderRadius: 10 }}>
            <img src={r.frame} alt="" width={56} height={56} style={{ flex: 'none' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name} <span style={{ fontWeight: 400, opacity: .7 }}>· từ {fmt(r.minXp)} KN</span></div>
              <div style={{ fontSize: 12.5, opacity: .75 }}>{r.effect}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
