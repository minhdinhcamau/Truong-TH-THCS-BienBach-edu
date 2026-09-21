'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

// Nút "Chủ nhiệm lớp" cho trang giáo viên: CHỈ hiện khi tài khoản được phân công chủ nhiệm.
// Cách dùng (trong app/teacher/page.jsx):
//   import TeacherHomeroomButton from '@/components/TeacherHomeroomButton';
//   ... rồi đặt <TeacherHomeroomButton /> cạnh các nút ở đầu trang.
// Truyền className của nút sẵn có trong trang để giống giao diện, ví dụ className={styles.navBtn}.
export default function TeacherHomeroomButton({ className, style }) {
  const [assigned, setAssigned] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.rpc('my_homeroom_classes').then(({ data }) => { if (alive) setAssigned((data || []).length > 0); });
    return () => { alive = false; };
  }, []);
  if (!assigned) return null;
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: '#2f6f5e', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' };
  return (
    <>
      <Link href="/teacher/chu-nhiem" className={className} style={className ? style : { ...base, ...style }}>Chủ nhiệm lớp</Link>
      <Link href="/teacher/thi-dua" className={className} style={className ? style : { ...base, background: '#fff', color: '#2f6f5e', border: '1px solid #2f6f5e', ...style }}>Thi đua lớp</Link>
    </>
  );
}
