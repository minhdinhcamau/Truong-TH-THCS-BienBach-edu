// Xac dinh khung avatar + danh xung theo tong KN tich luy (student_stats.total_xp).
// Dung chung cho header, bang xep hang va Hoi bai de moi noi hien thi giong nhau.
// Nguong hang nam o lib/rank.js (MOT noi duy nhat). File nay giu lai cac ten ham cu de cac trang khac van chay.
import { RANKS, getRank } from './rank';

// Ten class cu (con dung o CSS cu cua cac trang chua doi sang khung moi).
const CLASS_NAMES = ['frame-tanbinh', 'frame-thuythu', 'frame-hoatieu', 'frame-thuyentruong', 'frame-hopdoc', 'frame-huyenthoai'];
const BADGES = ['🌱', '💪', '📘', '⭐', '🏅', '👑'];

export function getRankTier(totalXp) {
  const { rank } = getRank(totalXp);
  const i = rank.level - 1;
  return { level: rank.level, className: CLASS_NAMES[i], badge: BADGES[i], name: rank.name };
}

// Danh sach day du 6 cap bac theo dung thu tu (ve lo trinh / thang hang).
export const RANK_TIERS = RANKS.map((r, i) => ({ min: r.minXp, className: CLASS_NAMES[i], badge: BADGES[i], name: r.name, level: r.level }));

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
