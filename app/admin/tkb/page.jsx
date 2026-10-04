'use client';
import TkbManager from '@/components/TkbManager';

// Trang quản trị: nhập và quản lý thời khóa biểu (khung giao diện kiểu trường học).
export default function AdminTimetablePage() {
  return <TkbManager school activeHref="/admin/tkb" roleLabel="Quản trị viên" />;
}
