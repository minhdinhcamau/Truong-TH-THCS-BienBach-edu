// lib/rank.js — Cấu hình hạng (rank), khung avatar và cách tính KN. MỘT NƠI DUY NHẤT để chỉnh số phía giao diện.
// Phần tính KN chạy trong cơ sở dữ liệu (bài tập GV giao, bài văn) nằm ở supabase/goi_p_rank_moi.sql — sửa số ở đâu thì sửa cả hai nơi.

export const RANKS = [
  { level: 1, key: 'moi',     name: 'Học sinh mới',      minXp: 0,     frame: '/frames/frame-1.png', effect: 'Khung đồng, chưa có hiệu ứng' },
  { level: 2, key: 'chamchi', name: 'Chăm chỉ',          minXp: 300,   frame: '/frames/frame-2.png', effect: 'Khung đồng có ngôi sao, chưa có hiệu ứng' },
  { level: 3, key: 'kha',     name: 'Học sinh khá',      minXp: 1000,  frame: '/frames/frame-3.png', effect: 'Ánh sáng xanh nhẹ, vệt sáng quét qua khung' },
  { level: 4, key: 'gioi',    name: 'Học sinh giỏi',     minXp: 2500,  frame: '/frames/frame-4.png', effect: 'Viền sáng bạc xanh nhấp nháy, vệt sáng, sao lấp lánh' },
  { level: 5, key: 'xuatsac', name: 'Học sinh xuất sắc', minXp: 6000,  frame: '/frames/frame-5.png', effect: 'Ánh vàng toả sáng, sao vàng bay lên, pháo sao khi hỏi bài hoặc bình luận' },
  { level: 6, key: 'ngoisao', name: 'Ngôi sao lớp học',  minXp: 12000, frame: '/frames/frame-6.png', effect: 'Hào quang bảy sắc xoay tròn, khung đổi màu rực rỡ, pháo sao khi hỏi bài hoặc bình luận' },
];

// ---- Hằng số KN ----
export const XP_RULES = {
  ASSIGN_MAX: 15,            // bài tập giáo viên giao + bài Ngữ văn: tối đa KN/bài (cũ: 30)
  ASSIGN_MIN_RATIO: 0.3,     // dưới 30% điểm thì không được KN
  LESSON_NEW_MAX: 20,        // Tiếng Anh: lần ĐẦU qua bài học mới, tối đa KN
  LESSON_REVIEW_MAX: 6,      // Tiếng Anh: làm lại / ôn tập, tối đa KN (thấp hơn bài mới)
  MUSIC_LEVEL_BASE: { practice: 5, slow: 8, medium: 12, fast: 15 }, // Âm nhạc: KN gốc khi qua cấp độ lần đầu
  MUSIC_REPLAY_FACTOR: 0.3,  // Âm nhạc: chơi lại cấp đã qua chỉ nhận tỉ lệ này
  MUSIC_STAR_BONUS: 2,       // Âm nhạc: thưởng cho mỗi sao mới vượt kỷ lục
  LEARNING_DAILY_CAP: 100,   // Tổng KN từ học tập (bài tập, Ngữ văn, Tiếng Anh, Âm nhạc) tối đa mỗi ngày
  QUESTION_XP: 2,            // đăng câu hỏi, +2 KN/ngày
  ANSWER_HELPFUL_XP: 5,      // câu trả lời được đánh dấu hữu ích
  ANSWER_HELPFUL_PER_DAY: 3,
};

/** KN = làm tròn(KN tối đa × tỉ lệ đúng²). Đúng nhiều được nhiều, đúng ít được rất ít, dưới mức tối thiểu thì 0. */
export function xpFromRatio(ratio, max) {
  const r = Math.min(Math.max(Number(ratio) || 0, 0), 1);
  if (r < XP_RULES.ASSIGN_MIN_RATIO) return 0;
  return Math.round(max * r * r);
}

/** Bài tập giáo viên giao / bài văn (chỉ tính ở lần chấm đầu tiên). */
export function calcAssignmentXp({ score, maxScore }) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  return { xp: xpFromRatio(ratio, XP_RULES.ASSIGN_MAX) };
}

/** Bài học Tiếng Anh. isReview = đã qua bài này rồi hoặc lần làm chưa đạt. */
export function calcLessonXp({ ratio, isReview = false }) {
  return xpFromRatio(ratio, isReview ? XP_RULES.LESSON_REVIEW_MAX : XP_RULES.LESSON_NEW_MAX);
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
