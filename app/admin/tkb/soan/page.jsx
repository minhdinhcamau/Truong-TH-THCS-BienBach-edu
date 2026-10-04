'use client';
import { ADMIN_NAV } from '@/lib/nav';
import TkbPlanner from '@/components/TkbPlanner';

// Trang quản trị: soạn và xếp thời khóa biểu tự động.
export default function AdminTkbPlannerPage() {
  return <TkbPlanner nav={ADMIN_NAV} activeHref="/admin/tkb" roleLabel="Quản trị viên" backHref="/admin/tkb" />;
}
