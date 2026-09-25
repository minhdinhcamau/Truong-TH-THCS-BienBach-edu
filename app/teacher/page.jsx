'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { ENGLISH_SUBJECT_ID } from '../../lib/englishXp';
import { MUSIC_SUBJECT_ID } from '../../lib/musicXp';
import { isoToUTC, vnTodayIso } from '../../lib/dates';
import { norm } from '../../lib/tkb';

const DAY_MS = 86400000;

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).map((w) => w[0]).join('').toUpperCase();
}

// Biểu tượng theo tên môn (nhận diện không dấu)
const SUBJECT_ICONS = [
  [/toan/, '📐'], [/ngu van/, '📖'], [/tieng anh|anh van/, '🌍'], [/lich su/, '🏛️'], [/dia li|dia ly/, '🗺️'],
  [/vat li|vat ly/, '⚛️'], [/hoa hoc/, '🧪'], [/sinh hoc/, '🌱'], [/tin hoc/, '💻'], [/giao duc cong dan|gdcd/, '⚖️'],
  [/cong nghe/, '🔧'], [/am nhac/, '🎵'], [/mi thuat|my thuat/, '🎨'], [/the duc/, '🏃'],
];
const iconOf = (name) => (SUBJECT_ICONS.find(([re]) => re.test(norm(name))) || [null, '📚'])[1];

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()));
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function todayText() {
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

// Trạng thái hạn nộp của bài tập
function dueInfo(due, today) {
  if (!due) return { label: 'Không đặt hạn', tone: 'mute' };
  const d = String(due).slice(0, 10);
  const diff = Math.round((isoToUTC(d) - isoToUTC(today)) / DAY_MS);
  if (diff < 0) return { label: 'Đã hết hạn', tone: 'mute' };
  if (diff === 0) return { label: 'Hết hạn hôm nay', tone: 'warn' };
  if (diff <= 3) return { label: `Còn ${diff} ngày`, tone: 'warn' };
  return { label: `Còn ${diff} ngày`, tone: 'ok' };
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]); // các môn giáo viên này đang dạy
  const [homeroom, setHomeroom] = useState([]); // các lớp được phân công chủ nhiệm
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // "role": admin có thể bấm "Xem trang Giáo viên" từ trang quản trị để kiểm tra,
        // khi đó hiện nút quay về trang quản trị thay cho các tính năng chỉ dành cho giáo viên.
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, role, is_tpt')
          .eq('id', session.user.id)
          .single();
        setProfile(prof);

        // Các MÔN giáo viên được phân công dạy (bảng teacher_assignments)
        const { data: assignedSubjects } = await supabase
          .from('teacher_assignments')
          .select('subjects(id, name)')
          .eq('teacher_id', session.user.id);

        const uniqueMap = new Map();
        (assignedSubjects || []).forEach((row) => {
          if (row.subjects) uniqueMap.set(row.subjects.id, row.subjects);
        });
        setSubjects(Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name)));

        // Lớp được phân công chủ nhiệm (rỗng nếu chưa được phân công) + xếp hạng thi đua tuần
        const [hr, lb] = await Promise.all([supabase.rpc('my_homeroom_classes'), supabase.rpc('get_class_leaderboard')]);
        setHomeroom(hr.data || []);
        setRanking(lb.data || []);
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
  const canHomeroom = homeroom.length > 0 || isAdminViewing || !!profile?.is_tpt;
  const today = vnTodayIso();

  const rankOf = (classId) => ranking.find((r) => r.class_id === classId);
  const shown = useMemo(() => {
    const k = norm(q);
    return assignments.filter((a) => !k || norm(`${a.title} ${a.subjects?.name || ''} ${a.classes?.name || ''}`).includes(k));
  }, [assignments, q]);
  const dueSoon = useMemo(
    () => assignments.filter((a) => a.due_date && Math.round((isoToUTC(String(a.due_date).slice(0, 10)) - isoToUTC(today)) / DAY_MS) >= 0
      && Math.round((isoToUTC(String(a.due_date).slice(0, 10)) - isoToUTC(today)) / DAY_MS) <= 7).length,
    [assignments, today]
  );

  return (
    <div className="tp-root">
      <style jsx global>{`
        .tp-root {
          --tp-blue: #225da3; --tp-navy: #12305a; --tp-sky: #e9f2fc; --tp-line: #dde7f1; --tp-bg: #f3f6fa;
          --tp-ink: #17253a; --tp-muted: #5c6f86; --tp-green: #2f6f5e; --tp-gold: #e8af2e;
          min-height: 100vh; background: var(--tp-bg); color: var(--tp-ink); line-height: 1.5;
          font-family: 'Be Vietnam Pro', system-ui, sans-serif;
        }
        .tp-root *, .tp-root *::before, .tp-root *::after { box-sizing: border-box; }
        .tp-root :focus-visible { outline: 3px solid var(--tp-gold); outline-offset: 2px; }

        .tp-top { position: sticky; top: 0; z-index: 30; background: rgba(255,255,255,0.94); backdrop-filter: blur(6px); border-bottom: 1px solid var(--tp-line); }
        .tp-top-in { max-width: 1120px; margin: 0 auto; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .tp-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .tp-emblem { width: 44px; height: 44px; border-radius: 12px; background: #fff; border: 1.5px solid var(--tp-blue); color: var(--tp-navy);
          display: grid; place-items: center; font-weight: 800; font-size: 16px; flex: none; }
        .tp-school { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 18px; line-height: 1.15; color: var(--tp-navy); }
        .tp-place { font-size: 12px; color: var(--tp-muted); }
        .tp-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .tp-chip { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid var(--tp-line); border-radius: 999px; padding: 4px 16px 4px 4px; }
        .tp-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--tp-blue); color: #fff; font-weight: 700; font-size: 13px; display: grid; place-items: center; }
        .tp-name { font-weight: 700; font-size: 13.5px; line-height: 1.2; color: var(--tp-navy); }
        .tp-role { font-size: 11.5px; color: var(--tp-muted); }
        .tp-pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--tp-line); background: #fff; color: var(--tp-navy);
          font-weight: 700; font-size: 12.5px; text-decoration: none; white-space: nowrap; cursor: pointer; font-family: inherit; }
        .tp-pill:hover { border-color: var(--tp-blue); }
        .tp-pill.out:hover { border-color: #a3374a; color: #a3374a; }

        .tp-main { max-width: 1120px; margin: 0 auto; padding: 24px 24px 80px; }

        .tp-hero { position: relative; overflow: hidden; background-color: var(--tp-navy); color: #fff; border-radius: 22px; padding: 28px 32px; margin-bottom: 26px;
          background-image: radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px); background-size: 22px 22px;
          display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; }
        .tp-hero::after { content: ''; position: absolute; left: 32px; bottom: 0; width: 96px; height: 5px; background: var(--tp-gold); border-radius: 5px 5px 0 0; }
        .tp-hello small { color: #a9c4e6; font-size: 13.5px; text-transform: none; }
        .tp-hello h1 { margin: 4px 0 0; font-family: 'Baloo 2', sans-serif; font-size: clamp(28px, 4.2vw, 42px); line-height: 1.1; font-weight: 700; }
        .tp-hello p { margin: 8px 0 0; color: #c9dcf3; font-size: 14px; }
        .tp-stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .tp-stat { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); border-radius: 16px; padding: 12px 18px; min-width: 116px; }
        .tp-stat b { display: block; font-family: 'Baloo 2', sans-serif; font-size: 30px; line-height: 1.1; }
        .tp-stat span { font-size: 12px; color: #b9d0ec; }

        .tp-sec { margin-bottom: 30px; }
        .tp-sec-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .tp-sec-h h2 { margin: 0; font-family: 'Baloo 2', sans-serif; font-size: 21px; color: var(--tp-navy); }
        .tp-sec-h p { margin: 2px 0 0; color: var(--tp-muted); font-size: 13px; }

        .tp-quick { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
        .tp-q { display: flex; gap: 14px; align-items: center; background: #fff; border: 1px solid var(--tp-line); border-radius: 16px; padding: 16px 18px; text-decoration: none; color: inherit;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; position: relative; overflow: hidden; }
        .tp-q::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--acc, var(--tp-blue)); }
        .tp-q:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -14px rgba(18,48,90,0.45); border-color: var(--acc, var(--tp-blue)); }
        .tp-q-ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; font-size: 22px; background: var(--acc-bg, var(--tp-sky)); flex: none; }
        .tp-q b { display: block; font-size: 15px; color: var(--tp-navy); }
        .tp-q span { font-size: 12.5px; color: var(--tp-muted); }
        .tp-q-go { margin-left: auto; color: var(--acc, var(--tp-blue)); font-weight: 800; font-size: 18px; }

        .tp-class-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
        .tp-class { background: #fff; border: 1px solid #cfe1d9; border-radius: 18px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
        .tp-class-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .tp-class-name { font-family: 'Baloo 2', sans-serif; font-size: 34px; line-height: 1; font-weight: 700; color: var(--tp-green); }
        .tp-class-tag { font-size: 12px; color: var(--tp-muted); margin-top: 4px; }
        .tp-rank { text-align: right; }
        .tp-rank b { font-family: 'Baloo 2', sans-serif; font-size: 30px; line-height: 1; color: var(--tp-navy); }
        .tp-rank small { display: block; font-size: 11.5px; color: var(--tp-muted); }
        .tp-class-btns { display: flex; gap: 8px; flex-wrap: wrap; }
        .tp-btn { display: inline-flex; align-items: center; justify-content: center; padding: 9px 16px; border-radius: 10px; font-weight: 700; font-size: 13px; text-decoration: none; border: 1px solid var(--tp-green); color: var(--tp-green); background: #fff; }
        .tp-btn.main { background: var(--tp-green); color: #fff; }
        .tp-btn:hover { filter: brightness(0.96); }

        .tp-subjects { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
        .tp-subj { display: flex; gap: 14px; align-items: center; background: #fff; border: 1px solid var(--tp-line); border-radius: 16px; padding: 16px 18px; text-decoration: none; color: inherit; }
        .tp-subj.on:hover { border-color: var(--tp-blue); transform: translateY(-2px); box-shadow: 0 10px 24px -14px rgba(18,48,90,0.45); }
        .tp-subj { transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
        .tp-subj.off { opacity: 0.72; }
        .tp-subj-ic { width: 44px; height: 44px; border-radius: 14px; background: var(--tp-sky); display: grid; place-items: center; font-size: 22px; flex: none; }
        .tp-subj b { display: block; font-size: 15.5px; }
        .tp-subj span { font-size: 12.5px; color: var(--tp-muted); }
        .tp-subj span.ready { color: #1a7f4e; font-weight: 700; }

        .tp-toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .tp-search { border: 1px solid var(--tp-line); background: #fff; border-radius: 10px; padding: 9px 14px; font-size: 13.5px; min-width: 220px; font-family: inherit; color: var(--tp-ink); }
        .tp-new { display: inline-flex; align-items: center; padding: 10px 18px; background: var(--tp-blue); color: #fff; border-radius: 10px; font-weight: 700; font-size: 13.5px; text-decoration: none; }
        .tp-new:hover { background: #1b4c86; }

        .tp-list { display: grid; gap: 10px; }
        .tp-row { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid var(--tp-line); border-radius: 14px; padding: 14px 18px; }
        .tp-row-ic { width: 40px; height: 40px; border-radius: 12px; background: var(--tp-sky); display: grid; place-items: center; font-size: 18px; flex: none; }
        .tp-row-t { font-weight: 700; font-size: 15px; color: var(--tp-navy); min-width: 0; }
        .tp-row-m { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
        .tp-tag { background: #eef3f9; color: #35506f; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
        .tp-due { margin-left: auto; text-align: right; flex: none; }
        .tp-badge { display: inline-block; border-radius: 999px; padding: 3px 12px; font-size: 12px; font-weight: 700; }
        .tp-badge.ok { background: #e6f6ee; color: #1a7f4e; }
        .tp-badge.warn { background: #fff4dc; color: #8a5b0a; }
        .tp-badge.mute { background: #eceff4; color: #5c6f86; }
        .tp-due small { display: block; color: var(--tp-muted); font-size: 12px; margin-top: 3px; }
        .tp-empty { background: #fff; border: 1px dashed #c7d6e6; border-radius: 16px; padding: 34px 20px; text-align: center; color: var(--tp-muted); font-size: 14px; }
        @media (max-width: 640px) {
          .tp-hero { padding: 22px 20px; }
          .tp-main { padding: 18px 16px 70px; }
          .tp-row { flex-wrap: wrap; }
          .tp-due { margin-left: 54px; text-align: left; }
          .tp-name, .tp-role { display: none; }
          .tp-chip { padding-right: 4px; }
        }
        @media (prefers-reduced-motion: reduce) { .tp-q, .tp-subj { transition: none; } .tp-q:hover, .tp-subj.on:hover { transform: none; } }
      `}</style>

      <header className="tp-top">
        <div className="tp-top-in">
          <div className="tp-brand">
            <div className="tp-emblem" aria-hidden="true">BB</div>
            <div>
              <div className="tp-school">Trường TH - THCS Biển Bạch</div>
              <div className="tp-place">Xã Biển Bạch, tỉnh Cà Mau</div>
            </div>
          </div>
          <div className="tp-right">
            {isAdminViewing ? (
              <Link href="/admin" className="tp-pill">← Quay về trang quản trị</Link>
            ) : (
              <div className="tp-chip">
                <div className="tp-avatar">{initialsOf(profile?.full_name)}</div>
                <div>
                  <div className="tp-name">{profile?.full_name || 'Giáo viên'}</div>
                  <div className="tp-role">{homeroom.length > 0 ? 'Giáo viên chủ nhiệm' : 'Giáo viên'}</div>
                </div>
              </div>
            )}
            <button className="tp-pill out" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </div>
      </header>

      <main className="tp-main">
        {profile && (
          <section className="tp-hero" aria-label="Chào mừng">
            <div className="tp-hello">
              <small>{todayText()}</small>
              <h1>{greeting()}{isAdminViewing ? '' : `, ${profile.full_name || 'thầy cô'}`}</h1>
              <p>{isAdminViewing ? 'Bạn đang xem trang giáo viên với quyền quản trị.' : 'Chúc thầy cô một ngày làm việc thật hiệu quả.'}</p>
            </div>
            <div className="tp-stats">
              <div className="tp-stat"><b>{subjects.length}</b><span>Môn đang dạy</span></div>
              <div className="tp-stat"><b>{assignments.length}</b><span>Bài tập đã giao</span></div>
              <div className="tp-stat"><b>{dueSoon}</b><span>Sắp đến hạn (7 ngày)</span></div>
              {homeroom.length > 0 && <div className="tp-stat"><b>{homeroom.length}</b><span>Lớp chủ nhiệm</span></div>}
            </div>
          </section>
        )}

        <section className="tp-sec" aria-label="Lối tắt">
          <div className="tp-sec-h"><div><h2>Bắt đầu nhanh</h2></div></div>
          <div className="tp-quick">
            <Link href="/teacher/assignments/new" className="tp-q" style={{ '--acc': '#225da3', '--acc-bg': '#e9f2fc' }}>
              <div className="tp-q-ic" aria-hidden="true">📝</div>
              <div><b>Tạo bài tập mới</b><span>Soạn và giao bài trắc nghiệm cho lớp</span></div>
              <div className="tp-q-go" aria-hidden="true">›</div>
            </Link>
            {canHomeroom && (
              <Link href="/teacher/chu-nhiem" className="tp-q" style={{ '--acc': '#2f6f5e', '--acc-bg': '#e6f2ed' }}>
                <div className="tp-q-ic" aria-hidden="true">🏫</div>
                <div><b>Chủ nhiệm lớp</b><span>{homeroom.length > 0 ? `Lớp ${homeroom.map((c) => c.class_name).join(', ')} · ban cán sự, sơ đồ, báo cáo tuần` : 'Quản lý lớp, ban cán sự và báo cáo tuần'}</span></div>
                <div className="tp-q-go" aria-hidden="true">›</div>
              </Link>
            )}
            <Link href="/teacher/thi-dua" className="tp-q" style={{ '--acc': '#c98a10', '--acc-bg': '#fff4dc' }}>
              <div className="tp-q-ic" aria-hidden="true">🏆</div>
              <div><b>Thi đua lớp</b><span>Xếp hạng các lớp, cập nhật trực tiếp</span></div>
              <div className="tp-q-go" aria-hidden="true">›</div>
            </Link>
            {!isAdminViewing && profile?.is_tpt && (
              <Link href="/tpt" className="tp-q" style={{ '--acc': '#c4262e', '--acc-bg': '#fdeceb' }}>
                <div className="tp-q-ic" aria-hidden="true">🎖️</div>
                <div><b>Trang Tổng phụ trách Đội</b><span>Sao đỏ, thời khóa biểu, thông báo, trực nhật</span></div>
                <div className="tp-q-go" aria-hidden="true">›</div>
              </Link>
            )}
          </div>
        </section>

        {homeroom.length > 0 && (
          <section className="tp-sec" aria-label="Lớp chủ nhiệm">
            <div className="tp-sec-h"><div><h2>Lớp chủ nhiệm</h2><p>Thi đua tuần này của lớp thầy cô phụ trách</p></div></div>
            <div className="tp-class-grid">
              {homeroom.map((c) => {
                const r = rankOf(c.class_id);
                return (
                  <article key={c.class_id} className="tp-class">
                    <div className="tp-class-top">
                      <div>
                        <div className="tp-class-name">{c.class_name}</div>
                        <div className="tp-class-tag">Giáo viên chủ nhiệm</div>
                      </div>
                      <div className="tp-rank">
                        <b>{r ? `#${r.rank}` : '—'}</b>
                        <small>{r ? `${Number(r.total_score).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} điểm · ${ranking.length} lớp` : 'Chưa có xếp hạng'}</small>
                      </div>
                    </div>
                    <div className="tp-class-btns">
                      <Link href="/teacher/chu-nhiem" className="tp-btn main">Quản lý lớp</Link>
                      <Link href="/teacher/thi-dua" className="tp-btn">Xem thi đua</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!loading && subjects.length > 0 && (
          <section className="tp-sec" aria-label="Môn học của bạn">
            <div className="tp-sec-h"><div><h2>Môn học của bạn</h2></div></div>
            <div className="tp-subjects">
              {subjects.map((s) => {
                if (s.id === ENGLISH_SUBJECT_ID) {
                  return (
                    <Link key={s.id} href="/teacher/english" className="tp-subj on">
                      <div className="tp-subj-ic" aria-hidden="true">{iconOf(s.name)}</div>
                      <div><b>{s.name}</b><span className="ready">Soạn lộ trình & bài học</span></div>
                    </Link>
                  );
                }
                if (s.id === MUSIC_SUBJECT_ID) {
                  return (
                    <Link key={s.id} href="/teacher/music" className="tp-subj on">
                      <div className="tp-subj-ic" aria-hidden="true">{iconOf(s.name)}</div>
                      <div><b>{s.name}</b><span className="ready">Soạn chủ đề, bài hát & bài đọc nhạc</span></div>
                    </Link>
                  );
                }
                return (
                  <div key={s.id} className="tp-subj off">
                    <div className="tp-subj-ic" aria-hidden="true">{iconOf(s.name)}</div>
                    <div><b>{s.name}</b><span>Chưa có công cụ soạn lộ trình riêng — dùng tạm mục Bài tập bên dưới</span></div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="tp-sec" aria-label="Bài tập đã giao">
          <div className="tp-sec-h">
            <div><h2>Bài tập đã giao</h2>{!loading && <p>{assignments.length} bài tập</p>}</div>
            <div className="tp-toolbar">
              {assignments.length > 3 && (
                <input className="tp-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên bài, môn, lớp…" aria-label="Tìm bài tập" />
              )}
              <Link href="/teacher/assignments/new" className="tp-new">+ Tạo bài tập mới</Link>
            </div>
          </div>

          {loading && <div className="tp-empty">Đang tải…</div>}
          {!loading && assignments.length === 0 && <div className="tp-empty">Chưa có bài tập nào. Bấm “Tạo bài tập mới” để bắt đầu.</div>}
          {!loading && assignments.length > 0 && shown.length === 0 && <div className="tp-empty">Không có bài tập nào khớp với “{q}”.</div>}

          <div className="tp-list">
            {shown.map((a) => {
              const d = dueInfo(a.due_date, today);
              return (
                <div key={a.id} className="tp-row">
                  <div className="tp-row-ic" aria-hidden="true">{iconOf(a.subjects?.name || '')}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="tp-row-t">{a.title}</div>
                    <div className="tp-row-m">
                      {a.subjects?.name && <span className="tp-tag">{a.subjects.name}</span>}
                      {a.classes?.name && <span className="tp-tag">Lớp {a.classes.name}</span>}
                    </div>
                  </div>
                  <div className="tp-due">
                    <span className={`tp-badge ${d.tone}`}>{d.label}</span>
                    {a.due_date && <small>Hạn: {new Date(a.due_date).toLocaleDateString('vi-VN')}</small>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
