// lib/rank.js — Cấu hình hạng (rank), khung avatar và cách tính KN. MỘT NƠI DUY NHẤT để chỉnh số.
// Bản SQL tương ứng nằm trong goi_p_rank_moi.sql (calc_assignment_xp, rank_level_for_xp) — sửa số ở đâu thì sửa cả hai nơi.

export const RANKS = [
  { level: 1, key: 'moi',      name: 'Học sinh mới',      minXp: 0,    frame: '/frames/frame-1.png', effect: 'Khung đồng, chưa có hiệu ứng' },
  { level: 2, key: 'chamchi',  name: 'Chăm chỉ',          minXp: 300,  frame: '/frames/frame-2.png', effect: 'Khung đồng có ngôi sao, chưa có hiệu ứng' },
  { level: 3, key: 'kha',      name: 'Học sinh khá',      minXp: 1000, frame: '/frames/frame-3.png', effect: 'Ánh sáng xanh nhẹ, vệt sáng quét qua khung' },
  { level: 4, key: 'gioi',     name: 'Học sinh giỏi',     minXp: 2500, frame: '/frames/frame-4.png', effect: 'Viền sáng bạc xanh nhấp nháy, vệt sáng, sao lấp lánh' },
  { level: 5, key: 'xuatsac',  name: 'Học sinh xuất sắc', minXp: 5000, frame: '/frames/frame-5.png', effect: 'Ánh vàng toả sáng, nhiều sao vàng bay lên' },
  { level: 6, key: 'ngoisao',  name: 'Ngôi sao lớp học',  minXp: 8000, frame: '/frames/frame-6.png', effect: 'Hào quang bảy sắc xoay tròn, pháo sao khi hỏi bài hoặc bình luận' },
];

// ---- Hằng số KN ----
export const XP_RULES = {
  ASSIGN_NEW_MAX: 15,       // bài mới: tối đa KN/bài (cũ: 30)
  ASSIGN_REVIEW_MAX: 6,     // bài ôn tập: tối đa KN/bài
  ASSIGN_MIN_RATIO: 0.3,    // dưới 30% điểm thì không được KN
  ASSIGN_DAILY_CAP: 80,     // tổng KN từ bài tập tối đa mỗi ngày
  QUESTION_XP: 2,           // đăng câu hỏi, +2 KN/ngày
  ANSWER_HELPFUL_XP: 5,     // câu trả lời được đánh dấu hữu ích
  ANSWER_HELPFUL_PER_DAY: 3,
};

/**
 * KN của một bài tập (chỉ gọi ở lần chấm đầu tiên).
 * Công thức: KN = làm tròn(KN tối đa × (điểm/điểm tối đa)²) → làm đúng nhiều thì được nhiều, đúng ít thì rất ít.
 * @param {{score:number,maxScore:number,isReview?:boolean,earnedToday?:number}} p
 * @returns {{xp:number, capped:boolean}}
 */
export function calcAssignmentXp({ score, maxScore, isReview = false, earnedToday = 0 }) {
  const ratio = maxScore > 0 ? Math.min(Math.max(score / maxScore, 0), 1) : 0;
  if (ratio < XP_RULES.ASSIGN_MIN_RATIO) return { xp: 0, capped: false };
  const max = isReview ? XP_RULES.ASSIGN_REVIEW_MAX : XP_RULES.ASSIGN_NEW_MAX;
  const raw = Math.round(max * ratio * ratio);
  const room = Math.max(0, XP_RULES.ASSIGN_DAILY_CAP - earnedToday);
  const xp = Math.min(raw, room);
  return { xp, capped: xp < raw };
}

/** Hạng theo tổng KN tích luỹ (không bao giờ mất). */
export function getRank(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let cur = RANKS[0];
  for (const r of RANKS) if (xp >= r.minXp) cur = r;
  const next = RANKS.find((r) => r.level === cur.level + 1) || null;
  const progress = next ? (xp - cur.minXp) / (next.minXp - cur.minXp) : 1;
  return { rank: cur, next, progress: Math.min(1, Math.max(0, progress)), remaining: next ? next.minXp - xp : 0 };
}
