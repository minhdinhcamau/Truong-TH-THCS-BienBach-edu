'use client';
// Trang chủ học sinh: tổng hợp các môn học. Lộ trình Tiếng Anh nằm ở /student/english.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getRankForXp } from '@/lib/englishXp';

const SUBJECTS = [
  { slug: 'ngu-van', title: 'Ngữ văn', href: '/student/ngu-van', desc: 'Viết bài văn trên web, AI chấm theo barem và nhận xét chi tiết.' },
  { slug: 'tieng-anh', title: 'Tiếng Anh', href: '/student/english', desc: 'Lộ trình học từ vựng theo chủ đề, mở khóa từng bài.' },
  { slug: 'am-nhac', title: 'Âm nhạc', href: '/student/music', desc: 'Luyện bài hát và bài đọc nhạc theo từng chủ đề.' },
  { slug: 'lich-su', title: 'Lịch sử', soon: true, desc: 'Đang được thầy cô chuẩn bị.' },
  { slug: 'dia-li', title: 'Địa lí', soon: true, desc: 'Đang được thầy cô chuẩn bị.' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}
const firstName = (n) => (n || '').trim().split(/\s+/).slice(-1)[0] || 'em';

function dueText(due) {
  if (!due) return 'Không giới hạn hạn nộp';
  const ms = new Date(due) - Date.now();
  const d = Math.floor(ms / 86400000);
  if (d >= 1) return `Còn ${d} ngày · ${new Date(due).toLocaleDateString('vi-VN')}`;
  return `Còn ${Math.max(1, Math.floor(ms / 3600000))} giờ`;
}

export default function StudentHome() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [rank, setRank] = useState(null);
  const [todo, setTodo] = useState([]); // đề văn chưa nộp, còn hạn

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('id, full_name').eq('id', user.id).single();
    const { data: st } = await supabase.from('student_stats').select('total_xp, current_streak').eq('student_id', user.id).maybeSingle();
    const xp = st?.total_xp || 0;
    setProfile(p);
    setStats({ xp, streak: st?.current_streak || 0 });
    setRank(await getRankForXp(xp));

    // Đề văn cần làm (bỏ qua lặng lẽ nếu bảng chưa được tạo)
    const { data: asg } = await supabase.from('lit_assignments').select('id, title, due_date');
    const { data: sb } = await supabase.from('lit_submissions').select('assignment_id, status').eq('student_id', user.id);
    const done = new Set((sb || []).filter((s) => s.status !== 'draft').map((s) => s.assignment_id));
    const open = (asg || [])
      .filter((a) => !done.has(a.id) && (!a.due_date || new Date(a.due_date) > new Date()))
      .sort((a, b) => (a.due_date ? new Date(a.due_date) : Infinity) - (b.due_date ? new Date(b.due_date) : Infinity));
    setTodo(open);
  }

  return (
    <div className="home">
      <style jsx>{`
        .home { font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #12263f; }
        .welcome { display: flex; justify-content: space-between; align-items: center; gap: 22px; flex-wrap: wrap; margin-bottom: 30px; }
        .welcome small { color: #5c6f86; font-size: 13.5px; font-weight: 600; }
        .welcome h1 { margin: 4px 0 0; font-size: clamp(26px, 4vw, 36px); line-height: 1.15; font-weight: 800; }
        .welcome h1 em { font-style: normal; color: #0a52c7; }
        .welcome p { margin: 8px 0 0; color: #5c6f86; font-size: 14.5px; }
        .stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .stat { background: #fff; border: 1px solid #dbe5f3; border-radius: 16px; padding: 12px 20px; min-width: 124px; box-shadow: 0 10px 24px -22px rgba(11,42,102,0.6); }
        .stat b { display: block; font-size: 24px; line-height: 1.15; color: #0b2a66; font-weight: 800; }
        .stat span { font-size: 12px; color: #5c6f86; font-weight: 600; }

        .sec-h { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 14px; }
        .sec-h h2 { margin: 0; font-size: 20px; font-weight: 800; }
        .sec-h span { font-size: 13px; color: #5c6f86; }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(236px, 1fr)); gap: 18px; margin-bottom: 34px; }
        .card { position: relative; display: flex; flex-direction: column; background: #fff; border: 1px solid #dbe5f3; border-radius: 22px; overflow: hidden;
          text-decoration: none; color: inherit; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        a.card:hover { transform: translateY(-4px); border-color: #9bbcf0; box-shadow: 0 22px 36px -24px rgba(10,82,199,0.65); }
        a.card:focus-visible { outline: 3px solid #f5b800; outline-offset: 3px; }
        .art { background: radial-gradient(circle at 50% 18%, #ffffff 0%, #e8f0fc 78%); padding: 22px 22px 14px; display: grid; place-items: center; }
        .art img { width: 82%; max-width: 190px; height: auto; display: block; transition: transform 0.25s ease; }
        a.card:hover .art img { transform: scale(1.04); }
        .meta { padding: 14px 20px 18px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .meta p { margin: 0; font-size: 13.5px; line-height: 1.55; color: #46586f; flex: 1; }
        .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .go { font-weight: 800; font-size: 13.5px; color: #0a52c7; }
        .badge { background: #d92d3a; color: #fff; font-weight: 800; font-size: 12px; border-radius: 999px; padding: 4px 11px; }
        .card.soon { background: #f8fafd; border-style: dashed; }
        .card.soon .art { background: #f1f4f9; }
        .card.soon .art img { filter: grayscale(1); opacity: 0.45; }
        .card.soon .go { color: #8a99ae; }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

        .todo { background: #fff; border: 1px solid #dbe5f3; border-radius: 20px; padding: 6px 8px; margin-bottom: 34px; }
        .item { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; text-decoration: none; color: inherit; }
        .item:hover { background: #f2f6fc; }
        .item + .item { border-top: 1px solid #eef2f8; }
        .item img { width: 46px; height: 46px; object-fit: contain; flex: none; }
        .item b { display: block; font-size: 15px; }
        .item small { color: #5c6f86; font-size: 12.5px; }
        .item .arrow { margin-left: auto; color: #0a52c7; font-weight: 800; }
        @media (prefers-reduced-motion: reduce) { .card, .art img { transition: none; } a.card:hover { transform: none; } a.card:hover .art img { transform: none; } }
      `}</style>

      <section className="welcome">
        <div>
          <small>{greeting()}</small>
          <h1>Xin chào, <em>{firstName(profile?.full_name)}</em></h1>
          <p>Hôm nay em muốn học môn nào?</p>
        </div>
        {stats && (
          <div className="stats" aria-label="Thành tích của em">
            <div className="stat"><b>{stats.xp.toLocaleString('vi-VN')}</b><span>Điểm kinh nghiệm</span></div>
            <div className="stat"><b>{stats.streak}</b><span>Ngày học liên tiếp</span></div>
            <div className="stat"><b style={{ fontSize: 17, paddingTop: 5, color: rank?.badge_color || '#0b2a66' }}>{rank?.name || '—'}</b><span>Cấp bậc</span></div>
          </div>
        )}
      </section>

      {todo.length > 0 && (
        <>
          <div className="sec-h"><h2>Việc cần làm</h2><span>{todo.length} đề văn chưa nộp</span></div>
          <div className="todo">
            {todo.slice(0, 3).map((a) => (
              <Link key={a.id} href={`/student/ngu-van/${a.id}`} className="item">
                <img src="/mon-hoc/ngu-van.png" alt="" />
                <div><b>{a.title}</b><small>{dueText(a.due_date)}</small></div>
                <span className="arrow" aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="sec-h"><h2>Môn học của em</h2></div>
      <div className="grid">
        {SUBJECTS.map((s) => {
          const body = (
            <>
              <h3 className="sr">{s.title}</h3>
              <div className="art"><img src={`/mon-hoc/${s.slug}.png`} alt={s.title} width="190" height="190" /></div>
              <div className="meta">
                <p>{s.desc}</p>
                <div className="foot">
                  <span className="go">{s.soon ? 'Sắp ra mắt' : 'Vào học ›'}</span>
                  {s.slug === 'ngu-van' && todo.length > 0 && <span className="badge">{todo.length} đề cần làm</span>}
                </div>
              </div>
            </>
          );
          return s.soon ? (
            <div key={s.slug} className="card soon">{body}</div>
          ) : (
            <Link key={s.slug} href={s.href} className="card">{body}</Link>
          );
        })}
      </div>
    </div>
  );
}
