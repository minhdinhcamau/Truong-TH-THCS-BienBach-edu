'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NotificationBell from '@/components/NotificationBell';

// Chuông thông báo cho giáo viên (khung giáo viên có nền sáng nên đổi màu chuông cho dễ nhìn).
// Tự lấy mã tài khoản đang đăng nhập, dùng được ở mọi trang giáo viên mà không cần truyền gì vào.
export default function TeacherBell() {
  const [uid, setUid] = useState(null);

  useEffect(() => {
    let on = true;
    supabase.auth.getUser().then(({ data }) => { if (on) setUid(data?.user?.id || null); });
    return () => { on = false; };
  }, []);

  if (!uid) return null;

  return (
    <span className="tb-wrap">
      <style jsx global>{`
        .tb-wrap { display: inline-flex; align-items: center; }
        .tb-wrap .bell { background: #fff !important; border: 1px solid #cfdad5 !important; color: #2f6f5e; width: 40px; height: 40px; padding: 0 !important; font-size: 18px !important; }
        .tb-wrap .bell:hover { background: #eef5f1 !important; }
        .tb-wrap .badge { border-color: #fff !important; }
        .tb-wrap .panel { top: 64px !important; }
      `}</style>
      <NotificationBell studentId={uid} />
    </span>
  );
}
