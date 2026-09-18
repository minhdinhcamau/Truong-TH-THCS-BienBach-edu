'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getRankForXp } from '@/lib/englishXp';

export default function StudentEnglishHome() {
  const [profile, setProfile] = useState(null);
  const [rank, setRank] = useState(null);
  const [course, setCourse] = useState(null);
  const [units, setUnits] = useState([]); // [{ ...unit, lessons: [{ ...lesson, progress }] }]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: p } = await supabase
      .from('profiles')
      .select('id, full_name, class_id')
      .eq('id', user.id)
      .single();

    const { data: stats } = await supabase
      .from('student_stats')
      .select('total_xp, current_streak')
      .eq('student_id', user.id)
      .maybeSingle();

    const totalXp = stats?.total_xp || 0;
    setProfile({ ...p, xp: totalXp, streak_days: stats?.current_streak || 0 });
    setRank(await getRankForXp(totalXp));

    // Lấy khóa học đầu tiên gán cho lớp của học sinh (tuỳ chỉnh nếu 1 lớp có nhiều khóa)
    const { data: courses } = await supabase
      .from('eng_courses')
      .select('id, title, description')
      .eq('class_id', p.class_id)
      .order('created_at', { ascending: true })
      .limit(1);
    const c = courses?.[0] || null;
    setCourse(c);

    if (c) {
      const { data: unitRows } = await supabase
        .from('eng_units')
        .select('id, title, order_index, eng_lessons(id, title, order_index, pass_score)')
        .eq('course_id', c.id)
        .order('order_index', { ascending: true });

      const { data: progressRows } = await supabase
        .from('eng_lesson_progress')
        .select('lesson_id, is_unlocked, is_completed, best_score')
        .eq('student_id', user.id);
      const progressMap = Object.fromEntries((progressRows || []).map((pr) => [pr.lesson_id, pr]));

      // Sắp bài học theo order_index, và mở khóa bài đầu tiên nếu chưa có bản ghi progress nào
      const sortedUnits = (unitRows || []).map((u) => ({
        ...u,
        eng_lessons: [...u.eng_lessons].sort((a, b) => a.order_index - b.order_index),
      }));
      let isFirstLessonOverall = true;
      const unitsWithProgress = sortedUnits.map((u) => ({
        ...u,
        lessons: u.eng_lessons.map((l) => {
          const prog = progressMap[l.id];
          const unlocked = prog?.is_unlocked || isFirstLessonOverall;
          if (isFirstLessonOverall) isFirstLessonOverall = false;
          return { ...l, unlocked, completed: prog?.is_completed || false, bestScore: prog?.best_score || 0 };
        }),
      }));
      setUnits(unitsWithProgress);
    }

    setLoading(false);
  }

  if (loading) return <p style={{ padding: 24 }}>Đang tải...</p>;
  if (!course) return <p style={{ padding: 24 }}>Lớp bạn chưa được gán khóa học Tiếng Anh nào. Hỏi giáo viên nhé.</p>;

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <div style={statsBar}>
        <div>
          <strong>{profile.full_name}</strong>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: rank?.badge_color, fontWeight: 600 }}>{rank?.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>⭐ {profile.xp} XP</span>
          <span>🔥 {profile.streak_days} ngày</span>
        </div>
      </div>

      <h1 style={{ marginTop: 24 }}>{course.title}</h1>

      {units.map((u) => (
        <div key={u.id} style={{ marginTop: 24 }}>
          <h3>{u.title}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {u.lessons.map((l) => (
              <LessonNode key={l.id} lesson={l} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LessonNode({ lesson }) {
  const content = (
    <div
      style={{
        ...node,
        background: lesson.completed ? '#22C55E' : lesson.unlocked ? '#2563eb' : '#D1D5DB',
        cursor: lesson.unlocked ? 'pointer' : 'not-allowed',
      }}
      title={lesson.title}
    >
      {lesson.completed ? '✓' : lesson.unlocked ? '▶' : '🔒'}
    </div>
  );
  return (
    <div style={{ textAlign: 'center', width: 72 }}>
      {lesson.unlocked ? (
        <Link href={`/student/english/lessons/${lesson.id}`}>{content}</Link>
      ) : (
        content
      )}
      <div style={{ fontSize: 11, marginTop: 4 }}>{lesson.title}</div>
    </div>
  );
}

const statsBar = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: '#F9FAFB',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 12,
};

const node = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  margin: '0 auto',
};
