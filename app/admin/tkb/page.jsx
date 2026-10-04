'use client';
import { ADMIN_NAV } from '@/lib/nav';
import TkbManager from '@/components/TkbManager';

// Trang quản trị: cũng nhập và quản lý thời khóa biểu như Tổng phụ trách.
export default function AdminTimetablePage() {
  return <TkbManager nav={ADMIN_NAV} activeHref="/admin/tkb" roleLabel="Quản trị viên" />;
}
