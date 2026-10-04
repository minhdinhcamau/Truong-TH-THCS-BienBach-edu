'use client';
import TkbPlanner from '@/components/TkbPlanner';

// Trang quản trị: soạn và xếp thời khóa biểu tự động.
export default function AdminTkbPlannerPage() {
  return <TkbPlanner school activeHref="/admin/tkb/soan" roleLabel="Quản trị viên" backHref="/admin/tkb" />;
}
