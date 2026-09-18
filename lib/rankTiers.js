// Xac dinh khung avatar + danh xung theo tong KN tich luy (student_stats.total_xp).
// Dung chung cho header, bang xep hang va Hoi bai de moi noi hien thi giong nhau.
export function getRankTier(totalXp) {
  const xp = totalXp || 0;
  if (xp >= 10000) return { className: 'frame-huyenthoai', badge: '👑', name: 'Ngôi sao lớp học' };
  if (xp >= 6000) return { className: 'frame-hopdoc', badge: '🏅', name: 'Học sinh xuất sắc' };
  if (xp >= 1500) return { className: 'frame-thuyentruong', badge: '⭐', name: 'Học sinh giỏi' };
  if (xp >= 600) return { className: 'frame-hoatieu', badge: '📘', name: 'Học sinh khá' };
  if (xp >= 200) return { className: 'frame-thuythu', badge: '💪', name: 'Chăm chỉ' };
  return { className: 'frame-tanbinh', badge: '🌱', name: 'Học sinh mới' };
}

// Danh sách đầy đủ 6 cấp bậc theo đúng thứ tự (dùng để vẽ lộ trình/thang hạng
// trên trang xếp hạng nếu cần hiển thị "còn bao nhiêu KN nữa để lên hạng kế").
export const RANK_TIERS = [
  { min: 0, className: 'frame-tanbinh', badge: '🌱', name: 'Học sinh mới' },
  { min: 200, className: 'frame-thuythu', badge: '💪', name: 'Chăm chỉ' },
  { min: 600, className: 'frame-hoatieu', badge: '📘', name: 'Học sinh khá' },
  { min: 1500, className: 'frame-thuyentruong', badge: '⭐', name: 'Học sinh giỏi' },
  { min: 6000, className: 'frame-hopdoc', badge: '🏅', name: 'Học sinh xuất sắc' },
  { min: 10000, className: 'frame-huyenthoai', badge: '👑', name: 'Ngôi sao lớp học' },
];

export function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const a = parts[parts.length - 2]?.[0] || '';
  const b = parts[parts.length - 1]?.[0] || '';
  return (a + b).toUpperCase();
}

// Cap do theo mon hoc (dung tu KN rieng cua mon, khac voi tong KN toan he thong).
// Cong thuc tuyen tinh don gian: moi 200 KN len 1 cap.
export function getSubjectLevel(subjectXp) {
  const xp = subjectXp || 0;
  const level = Math.floor(xp / 200) + 1;
  const currentFloor = (level - 1) * 200;
  const nextThreshold = level * 200;
  const percent = Math.min(100, Math.round(((xp - currentFloor) / 200) * 100));
  return { level, xp, nextThreshold, percent };
}
