'use client';
// Đặt tại: app/student/music/units/[unitId]/page.jsx
// Danh sách bài học trong 1 chủ đề, có trạng thái khoá/mở/hoàn thành —
// bấm "Bắt đầu" để vào thẳng trang luyện tập (student/music/lessons/[id]).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const backLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};

export default function StudentMusicUnitPage() {
  const { unitId } = useParams();
  const [unit, setUnit] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [unitId]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: u } = await supabase.from('music_units').select('*').eq('id', unitId).single();
    setUnit(u);

    const { data: l } = await supabase.from('music_lessons').select('*').eq('unit_id', unitId).order('order_index', { ascending: true });
    const { data: progressRows } = await supabase
      .from('music_lesson_progress')
      .select('lesson_id, is_unlocked, is_completed, best_score')
      .eq('student_id', user.id);
    const progressMap = Object.fromEntries((progressRows || []).map((pr) => [pr.lesson_id, pr]));

    let isFirst = true;
    const withProgress = (l || []).map((lesson) => {
      const prog = progressMap[lesson.id];
      const unlocked = prog?.is_unlocked || isFirst;
      if (isFirst) isFirst = false;
      return { ...lesson, unlocked, completed: prog?.is_completed || false, bestScore: prog?.best_score || 0 };
    });
    setLessons(withProgress);
    setLoading(false);
  }

  if (loading || !unit) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 700px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        h1 { font-size: 22px; color: #17302d; margin: 14px 0 20px; }
        .lesson-list { display: grid; gap: 10px; }
        .lesson-row { background: #fff; border: 1px solid #e5eeec; border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 1px 4px rgba(23,48,45,0.03); }
        .lesson-left { display: flex; align-items: center; gap: 12px; }
        .kind-icon { font-size: 22px; }
        .lesson-title { font-weight: 700; font-size: 15px; color: #17302d; }
        .lesson-sub { font-size: 11.5px; color: #6b7f7a; }
        .status-btn { border: none; border-radius: 10px; padding: 9px 18px; font-weight: 700; font-size: 13.5px; cursor: pointer; text-decoration: none; display: inline-block; }
        .status-btn.start { background: #58CC02; color: #fff; box-shadow: 0 3px 0 #46a302; }
        .status-btn.done { background: #EAFBEA; color: #58A700; }
        .status-btn.locked { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; }
        .empty { text-align: center; color: #9ca3af; padding: 30px; background: #fff; border-radius: 14px; border: 1px dashed #cfe2f7; }
      `}</style>

      <Link href="/student/music" style={backLinkStyle}>← Âm nhạc</Link>
      <h1>{unit.title}</h1>

      {lessons.length === 0 ? (
        <div className="empty">Chủ đề này chưa có bài học nào.</div>
      ) : (
        <div className="lesson-list">
          {lessons.map((l) => (
            <div key={l.id} className="lesson-row">
              <div className="lesson-left">
                <span className="kind-icon">{l.kind === 'song' ? '🎤' : '🎼'}</span>
                <div>
                  <div className="lesson-title">{l.title}</div>
                  <div className="lesson-sub">
                    {l.kind === 'song' ? 'Bài hát' : 'Bài đọc nhạc'}
                    {l.completed ? ` · Đã đạt ${l.bestScore}%` : ''}
                  </div>
                </div>
              </div>
              {l.unlocked ? (
                <Link href={`/student/music/lessons/${l.id}`} className={l.completed ? 'status-btn done' : 'status-btn start'}>
                  {l.completed ? '✓ Học lại' : '▶ Bắt đầu'}
                </Link>
              ) : (
                <span className="status-btn locked">🔒 Khoá</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
