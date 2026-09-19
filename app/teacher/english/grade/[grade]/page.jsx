'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const backBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};
const newBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', background: '#225da3', color: '#fff',
  border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 #184270',
  textDecoration: 'none', marginTop: 18,
};

export default function GradeRedirectPage() {
  const { grade } = useParams();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [found, setFound] = useState(false);

  useEffect(() => { checkCourse(); }, [grade]);

  async function checkCourse() {
    setChecking(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('eng_courses')
      .select('id')
      .eq('created_by', user.id)
      .eq('grade', Number(grade))
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data[0]) {
      setFound(true);
      router.replace(`/teacher/english/courses/${data[0].id}`);
    } else {
      setChecking(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 24px 64px', fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" }}>
      <Link href="/teacher/english" style={backBtnStyle}>← Lộ trình Tiếng Anh</Link>

      {checking || found ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Đang tải...</div>
      ) : (
        <div style={{
          textAlign: 'center', background: '#fff', borderRadius: 20, padding: '48px 28px', marginTop: 24,
          border: '1px dashed #cfe2f7',
        }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📗</div>
          <h2 style={{ margin: '0 0 8px', color: '#17302d' }}>Khối {grade} chưa có lộ trình</h2>
          <p style={{ color: '#6b7f7a', fontSize: 14, margin: '0 0 4px' }}>
            Tạo khóa học đầu tiên cho khối này để bắt đầu soạn Chủ đề → Bài học → Từ vựng.
          </p>
          <Link href={`/teacher/english/courses/new?grade=${grade}`} style={newBtnStyle}>
            ＋ Tạo khóa học cho Khối {grade}
          </Link>
        </div>
      )}
    </div>
  );
}
