'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { ENGLISH_SUBJECT_ID } from '../../lib/englishXp';

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).map((w) => w[0]).join('').toUpperCase();
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]); // các môn giáo viên này đang dạy
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // Them "role" vao select: admin co the bam "Xem trang Giao vien" tu
        // trang admin de kiem tra, can biet tai khoan dang xem co phai admin
        // khong de hien nut "Quay ve trang quan tri" thay vi cac tinh nang
        // chi danh cho giao vien.
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, role, is_tpt')
          .eq('id', session.user.id)
          .single();
        setProfile(prof);

        // Lấy danh sách MÔN mà giáo viên này đang được phân công dạy
        // (bảng teacher_assignments), để hiện thành các lối vào riêng
        // — ví dụ Tiếng Anh sẽ dẫn tới khu "xây dựng bài học" kiểu Duolingo,
        // các môn khác tạm thời dùng chung khu "Bài tập trắc nghiệm" cũ.
        const { data: assignedSubjects } = await supabase
          .from('teacher_assignments')
          .select('subjects(id, name)')
          .eq('teacher_id', session.user.id);

        const uniqueMap = new Map();
        (assignedSubjects || []).forEach((row) => {
          if (row.subjects) uniqueMap.set(row.subjects.id, row.subjects);
        });
        setSubjects(Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      }

      const { data } = await supabase
        .from('assignments')
        .select('id, title, due_date, subjects(name), classes(name)')
        .order('created_at', { ascending: false });
      setAssignments(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const isAdminViewing = profile?.role === 'admin';

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap {
          --bg: #eff5f3;
          --card: #ffffff;
          --ink: #17302d;
          --ink-soft: #527169;
          --masthead-bg: #e9f2fc;
          --masthead-border: #cfe2f7;
          --masthead-ink: #1b3a63;
          --masthead-soft: #5c7a9c;
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
        .profile-row {
          display: flex;
          align-items: center;
          gap: 12px;
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
        .profile-role {
          font-size: 12.5px;
          color: var(--masthead-soft);
        }
        .admin-return-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid var(--masthead-border);
          background: #fff;
          color: var(--masthead-ink);
          font-weight: 600;
          font-size: 12.5px;
          white-space: nowrap;
          text-decoration: none;
        }
        .admin-return-btn:hover {
          border-color: #225da3;
        }
        .logout-btn {
          border: 1px solid var(--masthead-border);
          background: #fff;
          color: var(--masthead-soft);
          font-family: inherit;
          font-weight: 600;
          font-size: 12.5px;
          padding: 8px 16px;
          border-radius: 999px;
          cursor: pointer;
          white-space: nowrap;
        }
        .logout-btn:hover {
          border-color: #a3374a;
          color: #a3374a;
        }
        .section-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .section-top h2 {
          margin: 0;
          font-size: 20px;
        }
        .new-btn {
          padding: 10px 18px;
          background: #225da3;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
        }
        .card {
          background: var(--card);
          border-radius: 12px;
          padding: 16px 18px;
          margin-top: 12px;
        }
        .card b {
          font-size: 15px;
        }
        .card-sub {
          color: var(--ink-soft);
          font-size: 13.5px;
          margin-top: 4px;
        }
        .empty {
          color: var(--ink-soft);
          font-size: 14px;
        }
        .subject-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 36px;
        }
        .subject-card {
          display: block;
          background: var(--card);
          border-radius: 14px;
          padding: 18px;
          text-decoration: none;
          color: inherit;
          border: 1px solid #e2ece9;
          transition: border-color 0.15s, transform 0.15s;
        }
        .subject-card.active:hover {
          border-color: #225da3;
          transform: translateY(-2px);
        }
        .subject-card.disabled {
          opacity: 0.55;
          cursor: default;
        }
        .subject-name {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 6px;
        }
        .subject-status {
          font-size: 12.5px;
          color: var(--ink-soft);
        }
        .subject-status.ready {
          color: #1a7f4e;
          font-weight: 600;
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
        <div className="profile-row">
          {!isAdminViewing && profile?.is_tpt && (
            <Link
              href="/tpt"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 999, border: '1px solid #e8af2e',
                background: '#fff8e8', color: '#8a5b0a', fontWeight: 700, fontSize: 13,
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              🎖️ Trang Tổng phụ trách Đội
            </Link>
          )}
          {!isAdminViewing && (
            <div className="profile">
              <div className="avatar">{initialsOf(profile?.full_name)}</div>
              <div>
                <div className="profile-name">{profile?.full_name || 'Giáo viên'}</div>
                <div className="profile-role">Giáo viên</div>
              </div>
            </div>
          )}
          {isAdminViewing && (
            <Link
              href="/admin"
              className="admin-return-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
                border: '1px solid #cfe2f7', background: '#fff', color: '#1b3a63', fontWeight: 600, fontSize: 12.5,
                whiteSpace: 'nowrap', textDecoration: 'none',
              }}
            >
              ← Quay về trang quản trị
            </Link>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      {!loading && subjects.length > 0 && (
        <>
          <div className="section-top">
            <h2>Môn học của bạn</h2>
          </div>
          <div className="subject-grid">
            {subjects.map((s) => {
              const isEnglish = s.id === ENGLISH_SUBJECT_ID;
              if (isEnglish) {
                return (
                  <Link
                    key={s.id}
                    href="/teacher/english"
                    className="subject-card active"
                    style={{
                      display: 'block', background: '#fff', borderRadius: 14, padding: 18,
                      textDecoration: 'none', color: 'inherit', border: '1px solid #e2ece9',
                    }}
                  >
                    <div className="subject-name">{s.name}</div>
                    <div className="subject-status ready">Soạn lộ trình & bài học</div>
                  </Link>
                );
              }
              return (
                <div key={s.id} className="subject-card disabled">
                  <div className="subject-name">{s.name}</div>
                  <div className="subject-status">Chưa có công cụ soạn lộ trình riêng — dùng tạm mục bên dưới</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="section-top">
        <h2>Bài tập đã giao</h2>
        <Link href="/teacher/assignments/new">
          <button className="new-btn">+ Tạo bài tập mới</button>
        </Link>
      </div>

      {loading && <p className="empty">Đang tải…</p>}

      {!loading && assignments.length === 0 && (
        <p className="empty">Chưa có bài tập nào. Bấm "Tạo bài tập mới" để bắt đầu.</p>
      )}

      {assignments.map((a) => (
        <div key={a.id} className="card">
          <b>{a.title}</b>
          <div className="card-sub">
            {a.subjects?.name} · {a.classes?.name} · Hạn:{' '}
            {a.due_date ? new Date(a.due_date).toLocaleDateString('vi-VN') : 'không đặt hạn'}
          </div>
        </div>
      ))}
    </div>
  );
}
