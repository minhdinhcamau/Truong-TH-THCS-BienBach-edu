// Chức vụ ban cán sự và quyền tương ứng (khớp với hàm class_can trong goi_a_chong_trung_bao_cao.sql
// và goi_c_truc_nhat_lao_dong_diem_cong.sql)
export const ROLE_LABEL = {
  lop_truong: 'Lớp trưởng',
  lop_pho_hoc_tap: 'Lớp phó học tập',
  lop_pho_lao_dong: 'Lớp phó lao động',
  lop_pho_van_nghe: 'Lớp phó văn nghệ',
  to_truong: 'Tổ trưởng',
  to_pho: 'Tổ phó',
};

export const ROLE_ORDER = ['lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe', 'to_truong', 'to_pho'];

export const ROLE_ICON = {
  lop_truong: '👑',
  lop_pho_hoc_tap: '📘',
  lop_pho_lao_dong: '🧹',
  lop_pho_van_nghe: '🎤',
  to_truong: '⭐',
  to_pho: '🔹',
};

export function roleText(role, group) {
  if (!role) return '';
  return `${ROLE_LABEL[role] || role}${group ? ` ${group}` : ''}`;
}

// Lớp trưởng và các lớp phó: đủ chức năng ghi nhận + kiểm tra ban cán sự
const CAN_BO_LOP = ['lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe'];
const TO = ['to_truong', 'to_pho'];

// isStaff = giáo viên chủ nhiệm của lớp, hoặc TPT / admin
// academic = ghi điểm cộng: tổ trưởng, tổ phó cũng ghi được (cho tổ mình hoặc tổ đang giám sát)
export function permsFor(role, isStaff) {
  const r = role || '';
  return {
    staff: !!isStaff,
    view: !!isStaff || !!r,
    seat: !!isStaff || r === 'lop_truong',
    duty: !!isStaff || ['lop_truong', 'lop_pho_lao_dong'].includes(r),
    dutyLog: !!isStaff || [...CAN_BO_LOP, ...TO].includes(r),
    violation: !!isStaff || [...CAN_BO_LOP, ...TO].includes(r),
    singing: !!isStaff || CAN_BO_LOP.includes(r),
    academic: !!isStaff || [...CAN_BO_LOP, ...TO].includes(r),
    cadre: !!isStaff || CAN_BO_LOP.includes(r),
    report: !!isStaff || r === 'lop_truong',
  };
}
