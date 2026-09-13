'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

// Bảng màu tự động gán cho từng môn học (không cố định 4 môn như bản mẫu,
// vì một lớp có thể có bất kỳ môn nào trong bảng `subjects`).
const SUBJECT_COLORS = [
  { text: '#225DA3', bg: '#E8F1FB' }, // xanh dương
  { text: '#B5720B', bg: '#FBF0DC' }, // vàng đất
  { text: '#1E8A6E', bg: '#E1F3ED' }, // xanh lá
  { text: '#A3374A', bg: '#FBE7EA' }, // đỏ mận
  { text: '#6B4FA0', bg: '#EDE7F8' }, // tím
  { text: '#0F7C89', bg: '#DFF1F3' }, // xanh ngọc
];

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).map((w) => w[0]).join('').toUpperCase();
}

export default function StudentDashboard() {
  const [profile, setProfile] = useState(null);
  const [className, setClassName] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }
      const uid = session.user.id;

      // 1. Hồ sơ học sinh (tên, mã học sinh, lớp)
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, student_code, class_id')
        .eq('id', uid)
        .single();
      setProfile(prof);

      // 2. Tên lớp + nhiệm vụ được giao cho lớp đó
      if (prof?.class_id) {
        const { data: cls } = await supabase
          .from('classes')
          .select('name')
          .eq('id', prof.class_id)
          .single();
        setClassName(cls?.name || '');

        const { data: list } = await supabase
          .from('assignments')
          .select('id, title, due_date, subjects(name)')
          .eq('class_id', prof.class_id)
          .order('created_at', { ascending: false });
        setAssignments(list || []);
      }

      // 3. Bài đã nộp của học sinh này
      const { data: subs } = await supabase
        .from('submissions')
        .select('assignment_id, score')
        .eq('student_id', uid);
      setSubmissions(subs || []);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>Đang tải…</div>;
  }

  const doneMap = new Map(submissions.map((s) => [s.assignment_id, s.score]));
  const doneCount = assignments.filter((a) => doneMap.has(a.id)).length;
  const totalCount = assignments.length;

  // Gom nhiệm vụ theo môn học để vẽ lưới thẻ môn
  const bySubject = {};
  assignments.forEach((a) => {
    const subj = a.subjects?.name || 'Khác';
    if (!bySubject[subj]) bySubject[subj] = [];
    bySubject[subj].push(a);
  });

  const firstName = profile?.full_name?.trim().split(/\s+/).slice(-1)[0] || 'bạn';

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap {
          --bg: #eff5f3;
          --card: #ffffff;
          --ink: #17302d;
          --ink-soft: #527169;
          --ink-faint: #8aa39c;
          --masthead-bg: #e9f2fc;
          --masthead-border: #cfe2f7;
          --masthead-ink: #1b3a63;
          --masthead-soft: #5c7a9c;
          --line: #d7e3df;
          --radius: 16px;
          max-width: 1040px;
          margin: 0 auto;
          padding: 28px 24px 64px;
          background: var(--bg);
          color: var(--ink);
          font-family: 'Be Vietnam Pro', sans-serif;
          line-height: 1.5;
        }
        header.masthead {
          background: var(--masthead-bg);
          border: 1px solid var(--masthead-border);
          border-radius: 20px;
          padding: 24px 32px;
          margin-bottom: 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .emblem {
          width: 58px;
          height: 58px;
          border-radius: 16px;
          background: #fff;
          border: 1.5px solid #225da3;
          color: var(--masthead-ink);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 21px;
          flex-shrink: 0;
        }
        .brand-name {
          font-weight: 700;
          font-size: 23px;
          line-height: 1.3;
          color: var(--masthead-ink);
          margin: 0 0 6px;
        }
        .brand-place {
          font-size: 12.5px;
          color: var(--masthead-soft);
          font-weight: 500;
        }
        .profile {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #fff;
          border: 1px solid var(--masthead-border);
          border-radius: 999px;
          padding: 6px 18px 6px 6px;
        }
        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #225da3;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          color: #fff;
          flex-shrink: 0;
        }
        .profile-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--masthead-ink);
        }
        .profile-class {
          font-size: 12.5px;
          color: var(--masthead-soft);
        }
        .hero {
          margin-bottom: 40px;
        }
        .hero h1 {
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 8px;
          max-width: 520px;
          letter-spacing: -0.3px;
        }
        .hero p {
          font-size: 15.5px;
          color: var(--ink-soft);
          margin: 0;
          max-width: 480px;
        }
        .section-title {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 14px;
          color: var(--ink);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 36px;
        }
        @media (max-width: 640px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
        .card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .card-title {
          font-size: 16px;
          font-weight: 600;
        }
        .card-tasks {
          font-size: 12.5px;
          color: var(--ink-soft);
          margin-top: 2px;
        }
        .badge {
          font-weight: 700;
          font-size: 15px;
          padding: 4px 11px;
          border-radius: 999px;
        }
        .bar {
          height: 8px;
          border-radius: 999px;
          background: var(--bg);
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 1s ease;
        }
        .bar-caption {
          font-size: 12px;
          color: var(--ink-soft);
        }
        .card-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2px;
        }
        .cta {
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-weight: 600;
          font-size: 13.5px;
          padding: 9px 16px;
          border-radius: 10px;
          color: #fff;
        }
        .missions {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 22px 24px;
        }
        .mission-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .mission-count {
          font-size: 13px;
          color: var(--ink-soft);
          font-weight: 600;
        }
        .mission {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 0;
          border-top: 1px solid var(--line);
          cursor: default;
        }
        .mission:first-of-type {
          border-top: none;
        }
        .check {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--line);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .mission.done .check {
          background: #1e8a6e;
        }
        .mission-body {
          flex: 1;
        }
        .mission-title {
          font-size: 14.5px;
          font-weight: 600;
        }
        .mission-sub {
          font-size: 12.5px;
          color: var(--ink-soft);
          margin-top: 2px;
        }
        .mission-tag {
          font-size: 12.5px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 999px;
          white-space: nowrap;
        }
        footer {
          text-align: center;
          font-size: 12.5px;
          color: var(--ink-faint);
          margin-top: 40px;
        }
      `}</style>

      <header className="masthead">
        <div className="brand">
          <div className="emblem">BB</div>
          <div>
            <div className="brand-name">Trường TH - THCS Biển Bạch</div>
            <div className="brand-place">Xã Biển Bạch, tỉnh Cà Mau</div>
          </div>
        </div>
        <div className="profile">
          <div className="avatar">{initialsOf(profile?.full_name)}</div>
          <div>
            <div className="profile-name">
              {profile?.full_name || 'Học sinh'} {className ? `· Lớp ${className}` : ''}
            </div>
            <div className="profile-class">Mã học sinh: {profile?.student_code || '—'}</div>
          </div>
        </div>
      </header>

      <section className="hero">
        <h1>Chào {firstName}, hôm nay học gì nào?</h1>
        <p>
          {totalCount > 0
            ? `Em đã hoàn thành ${doneCount}/${totalCount} nhiệm vụ được giao.`
            : 'Hiện chưa có nhiệm vụ nào được giao, quay lại sau nhé!'}
        </p>
      </section>

      {totalCount > 0 && (
        <div className="grid">
          {Object.entries(bySubject).map(([subject, list], i) => {
            const done = list.filter((a) => doneMap.has(a.id)).length;
            const pct = list.length ? Math.round((done / list.length) * 100) : 0;
            const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
            const pending = list.find((a) => !doneMap.has(a.id));
            return (
              <div className="card" key={subject}>
                <div className="card-top">
                  <div>
                    <div className="card-title">{subject}</div>
                    <div className="card-tasks">{list.length} nhiệm vụ được giao</div>
                  </div>
                  <div className="badge" style={{ background: color.bg, color: color.text }}>
                    {done}/{list.length}
                  </div>
                </div>
                <div className="bar">
                  <div className="bar-fill" style={{ width: pct + '%', background: color.text }} />
                </div>
                <div className="card-foot">
                  <span className="bar-caption">
                    {pending ? 'Còn nhiệm vụ chưa làm' : 'Đã hoàn thành hết'}
                  </span>
                  {pending ? (
                    <Link href={`/student/assignments/${pending.id}`}>
                      <button className="cta" style={{ background: color.text }}>
                        Vào học
                      </button>
                    </Link>
                  ) : (
                    <button
                      className="cta"
                      style={{ opacity: 0.5, cursor: 'not-allowed', background: color.text }}
                      disabled
                    >
                      Vào học
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="missions">
        <div className="mission-head">
          <h2 className="section-title" style={{ margin: 0 }}>
            Nhiệm vụ hôm nay
          </h2>
          <span className="mission-count">
            {doneCount} / {totalCount} hoàn thành
          </span>
        </div>

        {assignments.length === 0 && (
          <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Chưa có nhiệm vụ nào được giao.</p>
        )}

        {assignments.map((a) => {
          const done = doneMap.has(a.id);
          return (
            <div className={`mission${done ? ' done' : ''}`} key={a.id}>
              <div className="check">
                {done && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" width="14" height="14">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
              <div className="mission-body">
                <div className="mission-title">{a.title}</div>
                <div className="mission-sub">
                  {a.subjects?.name}
                  {a.due_date ? ` · Hạn: ${new Date(a.due_date).toLocaleDateString('vi-VN')}` : ''}
                </div>
              </div>
              {done ? (
                <span className="mission-tag" style={{ background: '#e1f3ed', color: '#1e8a6e' }}>
                  Đã làm — {doneMap.get(a.id)}/10
                </span>
              ) : (
                <Link href={`/student/assignments/${a.id}`}>
                  <span
                    className="mission-tag"
                    style={{ background: '#e8f1fb', color: '#225da3', cursor: 'pointer' }}
                  >
                    Vào làm bài
                  </span>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <footer>Trường TH-THCS Biển Bạch</footer>
    </div>
  );
}
