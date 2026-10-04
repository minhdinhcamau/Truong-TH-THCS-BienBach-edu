'use client';
import { ADMIN_NAV } from '@/lib/nav';
import TkbLeaveMakeup from '@/components/TkbLeaveMakeup';

// Trang quản trị: giáo viên xin nghỉ và xếp dạy bù.
export default function AdminTkbMakeupPage() {
  return <TkbLeaveMakeup nav={ADMIN_NAV} activeHref="/admin/tkb" roleLabel="Quản trị viên" backHref="/admin/tkb" />;
}
