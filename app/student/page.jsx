'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { getSubjectLevel } from '../../lib/rankTiers';
import { useStudent } from './layout';
import { ENGLISH_SUBJECT_ID } from '../../lib/englishXp';

const ICONS = [
  <path key="a" d="M12 22V10M4 10l8-6 8 6M5 10v8a1 1 0 0 0 1 1h2v-6M17 10v9a1 1 0 0 1-1 1h-2v-6" />,
  <path key="b" d="M4 19c6-1 9-6 15-15-3 8-4 13-15 15zM9 15l-4 4" />,
  <path key="c" d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18M3 12h18" />,
  <circle key="d" cx="12" cy="12" r="9" />,
];
const ICON_CLASSES = ['icon-a', 'icon-b', 'icon-c', 'icon-d'];

export default function StudentHome() {
  const { profile } = useStudent();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [progressBySubject, setProgressBySubject] = useState({});
  const [pending, setPending] = useState([]);
  const [doneToday, setDoneToday] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: subjectsData } = await supabase.from('subjects').select('id, name').order('name');

      const { data: progressData } = await supabase
        .from('subject_progress')
        .select('subject_id, subject_xp')
        .eq('student_id', profile.id);

      const progressMap = {};
      (progressData || []).forEach((p) => { progressMap[p.subject_id] = p.subject_xp; });

      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('id, title, due_date, subject_id, subjects(name)')
        .eq('class_id', profile.class_id)
        .order('due_date', { ascending: true });

      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('assignment_id, score')
        .eq('student_id', profile.id);

      const submittedIds = new Set((submissionsData || []).map((s) => s.assignment_id));

      const pendingList = (assignmentsData || []).filter((a) => !submittedIds.has(a.id)).slice(0, 8);
      const doneList = (assignmentsData || []).filter((a) => submittedIds.has(a.id)).slice(0, 5);

      setSubjects(subjectsData || []);
      setProgressBySubject(progressMap);
      setPending(pendingList);
      setDoneToday(doneList);
      setLoading(false);
    }
    load();
  }, [profile.id, profile.class_id]);

  if (loading) {
    return <div className="center-loading">Đang tải môn học…</div>;
  }

  const firstName = profile.full_name?.trim().split(/\s+/).slice(-1)[0] || '';
  const totalPending = pending.length;
  const totalMissions = totalPending + doneToday.length;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h2 className="section-title">Chào {firstName}, hôm nay học gì nào?</h2>
          <p className="section-sub">Mỗi môn học là một chặng trên hành trình của em. Hoàn thành bài tập để lên cấp và giữ chuỗi ngày học.</p>
        </div>
      </div>

      <div className="subject-grid">
        {subjects.length === 0 && (
          <div className="subject-card"><p className="empty-note" style={{ padding: 0 }}>Chưa có môn học nào được thiết lập.</p></div>
        )}
        {subjects.map((s, i) => {
          const xp = progressBySubject[s.id] || 0;
          const { level, nextThreshold, percent } = getSubjectLevel(xp);
          const pendingCount = pending.filter((a) => a.subject_id === s.id).length;
          const isEnglish = s.id === ENGLISH_SUBJECT_ID;

          const cardInner = (
            <>
              <div className="sc-top">
                <div className="sc-id">
                  <div className={`sc-icon ${ICON_CLASSES[i % ICON_CLASSES.length]}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {ICONS[i % ICONS.length]}
                    </svg>
                  </div>
                  <div>
                    <div className="sc-title">{s.name}</div>
                    <div className="sc-tasks">
                      {isEnglish
                        ? 'Học theo lộ trình — bấm để vào học'
                        : (pendingCount > 0 ? `${pendingCount} bài tập đang chờ` : 'Không có bài tập mới')}
                    </div>
                  </div>
                </div>
                <span className="level-badge">Cấp {level}</span>
              </div>
              <div className="bar"><div className="bar-fill" style={{ width: `${percent}%` }} /></div>
              <div className="bar-caption">{xp} / {nextThreshold} KN đến cấp {level + 1}</div>
              <div className="sc-foot">
                <span className="bar-caption">Tổng {xp.toLocaleString('vi-VN')} KN đã tích luỹ</span>
              </div>
            </>
          );

          if (isEnglish) {
            return (
              <Link
                href="/student/english"
                className="subject-card"
                key={s.id}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}
              >
                {cardInner}
              </Link>
            );
          }

          return (
            <div className="subject-card" key={s.id}>
              {cardInner}
            </div>
          );
        })}
      </div>

      <div className="missions">
        <div className="mission-head">
          <h2 className="section-title" style={{ margin: 0, fontSize: 18 }}>Bài tập của em</h2>
          <span className="mission-count">{doneToday.length} / {totalMissions || 0} đã nộp</span>
        </div>
        {totalMissions === 0 && <div className="empty-note">Hiện chưa có bài tập nào được giao, quay lại sau nhé!</div>}
        {pending.map((a) => (
          <div className="mission" key={a.id}>
            <div className="check" />
            <div className="mission-body">
              <div className="mission-title">{a.title}</div>
              <div className="mission-sub">
                {a.subjects?.name || 'Bài tập'}
                {a.due_date ? ` · Hạn ${new Date(a.due_date).toLocaleDateString('vi-VN')}` : ''}
              </div>
            </div>
            <Link href={`/student/assignment/${a.id}`} className="cta">Làm bài</Link>
          </div>
        ))}
        {doneToday.map((a) => (
          <div className="mission" key={a.id}>
            <div className="check done">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" width="13" height="13"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div className="mission-body">
              <div className="mission-title" style={{ color: 'var(--ink-faint)', textDecoration: 'line-through' }}>{a.title}</div>
              <div className="mission-sub">{a.subjects?.name || 'Bài tập'} · Đã nộp</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
