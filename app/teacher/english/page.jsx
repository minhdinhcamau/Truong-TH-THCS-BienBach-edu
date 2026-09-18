'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function TeacherEnglishHome() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('eng_courses')
      .select('id, title, description, created_at, classes(name, grade)')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    setCourses(data || []);
    setLoading(false);
  }

  if (loading) return <p style={{ padding: 24 }}>Đang tải...</p>;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Môn Tiếng Anh — Lộ trình học</h1>
        <Link href="/teacher/english/courses/new">
          <button style={btnPrimary}>+ Tạo khóa học</button>
        </Link>
      </div>

      {courses.length === 0 && (
        <p style={{ color: '#666', marginTop: 24 }}>
          Chưa có khóa học nào. Bấm "Tạo khóa học" để bắt đầu soạn lộ trình
          (Khóa học → Chủ đề → Bài học → Từ vựng).
        </p>
      )}

      <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
        {courses.map((c) => (
          <Link key={c.id} href={`/teacher/english/courses/${c.id}`} style={card}>
            <strong>{c.title}</strong>
            <div style={{ color: '#666', fontSize: 14 }}>
              Lớp: {c.classes ? `${c.classes.name}${c.classes.grade ? ` (Khối ${c.classes.grade})` : ''}` : '(chưa gán lớp)'}
            </div>
            {c.description && <div style={{ marginTop: 4 }}>{c.description}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}

const card = {
  display: 'block',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 16,
  textDecoration: 'none',
  color: '#111',
};

const btnPrimary = {
  background: '#2563eb',
  color: '#fff',
  border: 0,
  borderRadius: 6,
  padding: '8px 16px',
  cursor: 'pointer',
};
