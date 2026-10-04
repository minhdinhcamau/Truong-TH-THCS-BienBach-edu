'use client';
import TkbLeaveMakeup from '@/components/TkbLeaveMakeup';

// Trang quản trị: giáo viên xin nghỉ và xếp dạy bù.
export default function AdminTkbMakeupPage() {
  return <TkbLeaveMakeup school activeHref="/admin/tkb/day-bu" roleLabel="Quản trị viên" backHref="/admin/tkb" />;
}
