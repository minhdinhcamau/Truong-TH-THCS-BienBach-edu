// Thanh điều hướng của khu vực Tổng phụ trách / Sao đỏ / admin.
// soon: true = trang chưa có (hiện mờ, không bấm được).
export const TPT_NAV = [
  { href: '/tpt', label: 'Tổng quan' },
  { href: '/tpt/phan-tich', label: 'Phân tích & AI' },
  { href: '/tpt/tru-diem', label: 'Trừ điểm lớp' },
  { href: '/tpt/noi-dung-vi-pham', label: 'Nội dung vi phạm' },
  { href: '/tpt/tuan', label: 'Lịch năm học' },
  { href: '/tpt/thong-bao', label: 'Thông báo & kế hoạch' },
  { href: '/tpt/tkb', label: 'Thời khóa biểu' },
  { href: '/tpt/phan-cong', label: 'Sao đỏ & tài khoản' },
  { href: '/tpt/truc-nhat', label: 'Trực nhật' },
  { href: '/ranking', label: 'Xếp hạng' },
];

export const SAODO_NAV = [
  { href: '/saodo', label: 'Kiểm tra lớp' },
  { href: '/ranking', label: 'Xếp hạng' },
];

export const ADMIN_NAV = [
  { href: '/admin/tpt', label: 'Cấp quyền Tổng phụ trách' },
  { href: '/admin/gvcn', label: 'Phân công chủ nhiệm' },
  { href: '/admin/mon-hoc', label: 'Phân công giáo viên theo môn học' },
];

// Khu vực giáo viên:
// - "Chủ nhiệm lớp" chỉ hiện với giáo viên được phân công chủ nhiệm (hoặc TPT / admin).
// - "Âm nhạc" chỉ hiện với giáo viên được admin phân công dạy môn này (bảng subject_teachers,
//   xem lib/useMusicAccess.js — showMusic = useMusicAccess(ready).assigned).
export function teacherNav(showHomeroom, showMusic) {
  return [
    { href: '/teacher', label: '← Trang giáo viên' },
    { href: '/teacher/thi-dua', label: 'Thi đua lớp' },
    ...(showHomeroom ? [{ href: '/teacher/chu-nhiem', label: 'Chủ nhiệm lớp' }] : []),
    ...(showMusic ? [{ href: '/teacher/music', label: 'Âm nhạc' }] : []),
  ];
}
