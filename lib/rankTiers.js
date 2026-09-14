// Xac dinh khung avatar + danh xung theo tong KN tich luy (student_stats.total_xp).
// Dung chung cho header, bang xep hang va Hoi bai de moi noi hien thi giong nhau.
export function getRankTier(totalXp) {
  const xp = totalXp || 0;
  if (xp >= 10000) return { className: 'frame-huyenthoai', badge: '👑', name: 'Huyền thoại đại dương' };
  if (xp >= 6000) return { className: 'frame-hopdoc', badge: '♦', name: 'Đô đốc' };
  if (xp >= 1500) return { className: 'frame-thuyentruong', badge: '★', name: 'Thuyền trưởng' };
  if (xp >= 600) return { className: 'frame-hoatieu', badge: '⚓', name: 'Hoa tiêu' };
  if (xp >= 200) return { className: 'frame-thuythu', badge: '', name: 'Thủy thủ' };
  return { className: 'frame-tanbinh', badge: '', name: 'Tân binh' };
}

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
