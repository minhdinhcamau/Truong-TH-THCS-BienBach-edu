'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const ALL_GRADES = [6, 7, 8, 9];
const backBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};
const cardStyle = {
  display: 'block', background: '#fff', borderRadius: 20, padding: '28px 24px', textDecoration: 'none',
  color: 'inherit', border: '1px solid #e5eeec', boxShadow: '0 2px 8px rgba(23,48,45,0.05)',
};
const newBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', background: '#225da3', color: '#fff',
  border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 0 #184270',
  textDecoration: 'none',
};

export default function TeacherEnglishHome() {
  const [courseByGrade, setCourseByGrade] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('eng_courses')
      .select('id, title, grade, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    const map = {};
    (data || []).forEach((c) => {
      if (c.grade != null && !map[c.grade]) map[c.grade] = c; // giữ khóa học mới nhất cho mỗi khối
    });
    setCourseByGrade(map);
    setLoading(false);
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 1000px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .head { display: flex; justify-content: space-between; align-items: flex-end; margin: 18px 0 32px; flex-wrap: wrap; gap: 14px; }
        .head h1 { margin: 0; font-size: 26px; color: #17302d; }
        .head p { margin: 6px 0 0; color: #6b7f7a; font-size: 14px; max-width: 520px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
        .grade-card { position: relative; transition: transform 0.15s, box-shadow 0.15s; }
        .grade-card:hover { transform: translateY(-4px); box-shadow: 0 10px 24px rgba(34,93,163,0.14) !important; border-color: #b9d4ee !important; }
        .grade-num { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg,#225da3,#3b82f6);
          color: #fff; font-size: 24px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
        .grade-title { font-size: 19px; font-weight: 700; color: #17302d; margin-bottom: 6px; }
        .grade-status { font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 999px; display: inline-block; }
        .grade-status.ready { color: #1a7f4e; background: #EAFBEA; }
        .grade-status.empty { color: #9ca3af; background: #f3f4f6; }
        .grade-course-name { font-size: 13px; color: #6b7f7a; margin-top: 10px; }
        .skeleton { text-align: center; padding: 60px; color: #9ca3af; }
      `}</style>

      <Link href="/teacher" style={backBtnStyle}>← Trang giáo viên</Link>

      <div className="head">
        <div>
          <h1>Lộ trình Tiếng Anh</h1>
          <p>Chọn khối để soạn hoặc tiếp tục chỉnh sửa lộ trình học: Khóa học → Chủ đề → Bài học → Từ vựng.</p>
        </div>
        <Link href="/teacher/english/courses/new" style={newBtnStyle}>＋ Tạo khóa học</Link>
      </div>

      {loading ? (
        <div className="skeleton">Đang tải...</div>
      ) : (
        <div className="grid">
          {ALL_GRADES.map((g) => {
            const course = courseByGrade[g];
            return (
              <Link
                key={g}
                href={course ? `/teacher/english/courses/${course.id}` : `/teacher/english/grade/${g}`}
                className="grade-card"
                style={cardStyle}
              >
                <div className="grade-num">{g}</div>
                <div className="grade-title">Khối {g}</div>
                <span className={`grade-status ${course ? 'ready' : 'empty'}`}>
                  {course ? '✓ Đã có lộ trình' : 'Chưa soạn'}
                </span>
                {course && <div className="grade-course-name">{course.title}</div>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
