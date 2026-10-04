'use client';
import { TPT_NAV } from '@/lib/nav';
import TkbManager from '@/components/TkbManager';

// Trang Tổng phụ trách: nhập và quản lý thời khóa biểu toàn trường, giờ học các tiết, tên giáo viên trên thời khóa biểu.
export default function TptTimetablePage() {
  return <TkbManager nav={TPT_NAV} activeHref="/tpt/tkb" roleLabel="Tổng phụ trách Đội" />;
}
