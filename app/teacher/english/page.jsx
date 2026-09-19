'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function TeacherEnglishHome() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('eng_courses')
      .select('id, title, description, created_at, grade')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    setCourses(data || []);
    setLoading(false);
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 1040px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .back-link { color: #225da3; font-weight: 600; font-size: 13.5px; text-decoration: none; }
        .head { display: flex; justify-content: space-between; align-items: flex-end; margin: 14px 0 28px; flex-wrap: wrap; gap: 14px; }
        .head h1 { margin: 0; font-size: 26px; color: #17302d; display: flex; align-items: center; gap: 10px; }
        .head p { margin: 6px 0 0; color: #6b7f7a; font-size: 14px; }
        .new-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; background: #225da3; color: #fff;
          border: none; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 3px 0 #184270; text-decoration: none; }
        .new-btn:hover { background: #1c4f8c; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .course-card { display: block; background: #fff; border-radius: 16px; padding: 20px; text-decoration: none; color: inherit;
          border: 1px solid #e5eeec; box-shadow: 0 2px 6px rgba(23,48,45,0.04); transition: transform 0.15s, box-shadow 0.15s; }
        .course-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(34,93,163,0.12); border-color: #b9d4ee; }
        .cc-icon { width: 44px; height: 44px; border-radius: 12px; background: #E9F2FC; display: flex; align-items: center;
          justify-content: center; font-size: 22px; margin-bottom: 12px; }
        .cc-title { font-weight: 700; font-size: 17px; color: #17302d; margin-bottom: 4px; }
        .cc-class { display: inline-block; font-size: 12px; font-weight: 600; color: #225da3; background: #E9F2FC;
          padding: 3px 10px; border-radius: 999px; margin-top: 2px; }
        .cc-desc { color: #6b7f7a; font-size: 13.5px; margin-top: 10px; line-height: 1.5; }
        .empty { text-align: center; padding: 60px 20px; background: #fff; border-radius: 20px; border: 1px dashed #cfe2f7; }
        .empty-emoji { font-size: 44px; margin-bottom: 10px; }
        .empty h3 { margin: 0 0 6px; color: #17302d; }
        .empty p { color: #6b7f7a; font-size: 14px; margin: 0 0 20px; }
        .skeleton { text-align: center; padding: 60px; color: #9ca3af; }
      `}</style>

      <Link href="/teacher" className="back-link" style={{ color: '#225da3', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>← Trang giáo viên</Link>

      <div className="head">
        <div>
          <h1>Lộ trình Tiếng Anh</h1>
          <p>Soạn khóa học theo cấu trúc Khóa học → Chủ đề → Bài học → Từ vựng, học sinh học theo kiểu chinh phục từng chặng.</p>
        </div>
        <Link href="/teacher/english/courses/new" className="new-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', background: '#225da3', color: '#fff', border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 0 #184270', textDecoration: 'none' }}>＋ Tạo khóa học</Link>
      </div>

      {loading && <div className="skeleton">Đang tải...</div>}

      {!loading && courses.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">📚</div>
          <h3>Chưa có khóa học nào</h3>
          <p>Tạo khóa học đầu tiên để bắt đầu soạn lộ trình cho lớp bạn dạy.</p>
          <Link href="/teacher/english/courses/new" className="new-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', background: '#225da3', color: '#fff', border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 0 #184270', textDecoration: 'none' }}>＋ Tạo khóa học</Link>
        </div>
      )}

      <div className="grid">
        {courses.map((c) => (
          <Link key={c.id} href={`/teacher/english/courses/${c.id}`} className="course-card" style={{ display: 'block', background: '#fff', borderRadius: 16, padding: 20, textDecoration: 'none', color: 'inherit', border: '1px solid #e5eeec', boxShadow: '0 2px 6px rgba(23,48,45,0.04)' }}>
            <div className="cc-icon">🇬🇧</div>
            <div className="cc-title">{c.title}</div>
            <span className="cc-class">
              {c.grade ? `Khối ${c.grade}` : 'Chưa chọn khối'}
            </span>
            {c.description && <div className="cc-desc">{c.description}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
