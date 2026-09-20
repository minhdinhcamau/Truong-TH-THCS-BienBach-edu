// Thanh điều hướng của khu vực Tổng phụ trách. soon: true = trang chưa có (hiện mờ, không bấm được).
export const TPT_NAV = [
  { href: '/tpt', label: 'Tổng quan' },
  { href: '/tpt/phan-cong', label: 'Sao đỏ & tài khoản' },
  { href: '/tpt/tkb', label: 'Thời khóa biểu' },
  { href: '/tpt/thong-bao', label: 'Thông báo & kế hoạch', soon: true },
  { href: '/tpt/tru-diem', label: 'Trừ điểm lớp', soon: true },
  { href: '/tpt/truc-nhat', label: 'Trực nhật', soon: true },
  { href: '/ranking', label: 'Xếp hạng', soon: true },
];

export const SAODO_NAV = [
  { href: '/saodo', label: 'Kiểm tra lớp' },
  { href: '/ranking', label: 'Xếp hạng', soon: true },
];

export const ADMIN_NAV = [
  { href: '/admin/tpt', label: 'Cấp quyền Tổng phụ trách' },
];
