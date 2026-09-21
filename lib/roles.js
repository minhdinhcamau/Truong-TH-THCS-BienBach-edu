// Chức vụ ban cán sự và quyền tương ứng (khớp với hàm class_can trong fix9.sql)
export const ROLE_LABEL = {
  lop_truong: 'Lớp trưởng',
  lop_pho_hoc_tap: 'Lớp phó học tập',
  lop_pho_lao_dong: 'Lớp phó lao động',
  lop_pho_van_nghe: 'Lớp phó văn nghệ',
  to_truong: 'Tổ trưởng',
  to_pho: 'Tổ phó',
};

export const ROLE_ORDER = ['lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe', 'to_truong', 'to_pho'];

export function roleText(role, group) {
  if (!role) return '';
  return `${ROLE_LABEL[role] || role}${group ? ` ${group}` : ''}`;
}

// isStaff = giáo viên chủ nhiệm của lớp, hoặc TPT / admin
export function permsFor(role, isStaff) {
  const r = role || '';
  return {
    staff: !!isStaff,
    view: !!isStaff || !!r,
    seat: !!isStaff || r === 'lop_truong',
    duty: !!isStaff || ['lop_truong', 'lop_pho_lao_dong'].includes(r),
    dutyLog: !!isStaff || ['lop_truong', 'lop_pho_lao_dong', 'to_truong', 'to_pho'].includes(r),
    violation: !!isStaff || ['lop_truong', 'to_truong', 'to_pho'].includes(r),
    singing: !!isStaff || ['lop_truong', 'lop_pho_van_nghe'].includes(r),
    academic: !!isStaff || r === 'lop_pho_hoc_tap',
    cadre: !!isStaff || r === 'lop_truong',
    report: !!isStaff || r === 'lop_truong',
  };
}
