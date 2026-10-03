'use client';
// Lộ trình Tiếng Anh của học sinh (trước đây nằm ở trang chủ /student)
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import SubjectHeader from '@/components/SubjectHeader';

export default function StudentEnglishHome() {
  const [course, setCourse] = useState(null);
  const [units, setUnits] = useState([]); // [{ ...unit, lessons: [{ ...lesson, unlocked, completed, bestScore }] }]
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: p } = await supabase.from('profiles').select('id, class_id').eq('id', user.id).single();

    // Khối của lớp học sinh -> khóa học Tiếng Anh gán cho khối đó
    let studentGrade = null;
    if (p?.class_id) {
      const { data: cls } = await supabase.from('classes').select('grade').eq('id', p.class_id).single();
      studentGrade = cls?.grade ?? null;
    }

    const { data: courses } = await supabase
      .from('eng_courses').select('id, title, description')
      .eq('grade', studentGrade).order('created_at', { ascending: false }).limit(1);
    const c = courses?.[0] || null;
    setCourse(c);

    if (c) {
      const { data: unitRows } = await supabase
        .from('eng_units')
        .select('id, title, order_index, eng_lessons(id, title, order_index, pass_score)')
        .eq('course_id', c.id)
        .order('order_index', { ascending: true });

      const { data: progressRows } = await supabase
        .from('eng_lesson_progress').select('lesson_id, is_unlocked, is_completed, best_score')
        .eq('student_id', user.id);
      const progressMap = Object.fromEntries((progressRows || []).map((pr) => [pr.lesson_id, pr]));

      // Bài đầu tiên luôn mở khóa nếu chưa có bản ghi tiến độ nào
      let isFirst = true;
      setUnits((unitRows || []).map((u) => ({
        ...u,
        lessons: [...u.eng_lessons].sort((a, b) => a.order_index - b.order_index).map((l) => {
          const prog = progressMap[l.id];
          const unlocked = prog?.is_unlocked || isFirst;
          isFirst = false;
          return { ...l, unlocked, completed: prog?.is_completed || false, bestScore: prog?.best_score || 0 };
        }),
      })));
    }
    setLoading(false);
  }

  const totalLessons = units.reduce((n, u) => n + u.lessons.length, 0);
  const doneLessons = units.reduce((n, u) => n + u.lessons.filter((l) => l.completed).length, 0);
  const pct = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;

  return (
    <div className="eng">
      <style jsx>{`
        .eng { font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #12263f; }
        .prog { display: flex; align-items: center; gap: 12px; max-width: 420px; }
        .bar { flex: 1; height: 10px; background: #e3ecf8; border-radius: 999px; overflow: hidden; }
        .bar i { display: block; height: 100%; background: linear-gradient(90deg, #0a52c7, #2a9df4); border-radius: 999px; }
        .prog b { font-size: 13px; color: #0b2a66; white-space: nowrap; }
        .empty { text-align: center; padding: 44px 20px; background: #fff; border: 1px dashed #b9d0f0; border-radius: 18px; color: #5c6f86; }
        .unit { background: #fff; border: 1px solid #dbe5f3; border-radius: 20px; padding: 20px 24px 22px; margin-bottom: 16px; }
        .unit-h { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .num { width: 34px; height: 34px; border-radius: 11px; background: #0a52c7; color: #fff; font-weight: 800; display: grid; place-items: center; font-size: 15px; flex: none; }
        .unit-h h3 { margin: 0; font-size: 17px; font-weight: 800; }
        .path { display: flex; flex-wrap: wrap; gap: 18px 14px; }
        .lesson { width: 92px; text-align: center; text-decoration: none; color: inherit; }
        .node { width: 62px; height: 62px; border-radius: 50%; margin: 0 auto; display: grid; place-items: center; color: #fff; transition: transform 0.15s; }
        a.lesson:hover .node { transform: scale(1.07); }
        a.lesson:focus-visible { outline: 3px solid #f5b800; outline-offset: 3px; border-radius: 14px; }
        .node.done { background: #1a9d5c; box-shadow: 0 5px 0 #11743f; }
        .node.open { background: #0a52c7; box-shadow: 0 5px 0 #083d94; }
        .node.lock { background: #cfd8e6; box-shadow: 0 5px 0 #aebbd0; }
        .node svg { width: 26px; height: 26px; }
        .lesson span { display: block; margin-top: 10px; font-size: 12px; font-weight: 600; line-height: 1.35; color: #3a4f6e; }
        .lesson.locked span { color: #8a99ae; }
        .lesson small { color: #1a9d5c; font-weight: 800; font-size: 11px; }
        @media (prefers-reduced-motion: reduce) { .node { transition: none; } a.lesson:hover .node { transform: none; } }
      `}</style>

      <SubjectHeader slug="tieng-anh" title="Tiếng Anh"
        subtitle={course ? `${course.title}${course.description ? ' · ' + course.description : ''}` : 'Lộ trình học từ vựng theo chủ đề.'}>
        {totalLessons > 0 && (
          <div className="prog">
            <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
            <b>{doneLessons}/{totalLessons} bài</b>
          </div>
        )}
      </SubjectHeader>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : !course ? (
        <div className="empty">Lớp em chưa được gán khóa học Tiếng Anh nào. Em hỏi thầy cô nhé.</div>
      ) : (
        units.map((u, i) => (
          <section key={u.id} className="unit">
            <div className="unit-h"><div className="num">{i + 1}</div><h3>{u.title}</h3></div>
            <div className="path">
              {u.lessons.map((l) => {
                const state = l.completed ? 'done' : l.unlocked ? 'open' : 'lock';
                const icon = l.completed ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                ) : l.unlocked ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                );
                const inner = (
                  <>
                    <div className={`node ${state}`}>{icon}</div>
                    <span>{l.title}</span>
                    {l.completed && <small>{l.bestScore}%</small>}
                  </>
                );
                return l.unlocked ? (
                  <Link key={l.id} href={`/student/english/lessons/${l.id}`} className="lesson" title={l.title}>{inner}</Link>
                ) : (
                  <div key={l.id} className="lesson locked" title="Hoàn thành bài trước để mở khóa" aria-disabled="true">{inner}</div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
