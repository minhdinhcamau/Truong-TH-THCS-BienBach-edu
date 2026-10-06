'use client';
// Trang chủ học sinh: tổng hợp các môn học + thời khóa biểu hôm nay. Lộ trình Tiếng Anh nằm ở /student/english.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getRankForXp } from '@/lib/englishXp';
import { getRank } from '@/lib/rank';
import { vnTodayIso } from '@/lib/dates';

const SUBJECTS = [
  { slug: 'ngu-van', title: 'Ngữ văn', href: '/student/ngu-van', desc: 'Viết bài văn trên web, AI chấm theo barem và nhận xét chi tiết.' },
  { slug: 'tieng-anh', title: 'Tiếng Anh', href: '/student/english', desc: 'Lộ trình học từ vựng theo chủ đề, mở khóa từng bài.' },
  { slug: 'am-nhac', title: 'Âm nhạc', href: '/student/music', desc: 'Luyện bài hát và bài đọc nhạc theo từng chủ đề.' },
  { slug: 'lich-su', title: 'Lịch sử', soon: true, desc: 'Đang được thầy cô chuẩn bị.' },
  { slug: 'dia-li', title: 'Địa lí', soon: true, desc: 'Đang được thầy cô chuẩn bị.' },
];
const SESS = { sang: 'Sáng', chieu: 'Chiều' };

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
  const [today, setToday] = useState(null); // { rows, label } tiết học hôm nay

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('id, full_name, class_id').eq('id', user.id).single();
    const { data: st } = await supabase.from('student_stats').select('total_xp, current_streak').eq('student_id', user.id).maybeSingle();
    const xp = st?.total_xp || 0;
    setProfile(p);
    setStats({ xp, streak: st?.current_streak || 0 });
    setRank(await getRankForXp(xp));

    // Tiết học hôm nay (bỏ qua lặng lẽ nếu lớp chưa có thời khóa biểu)
    if (p?.class_id) {
      const iso = vnTodayIso();
      const { data: rows } = await supabase.rpc('class_day_periods', { p_class_id: p.class_id, p_date: iso });
      const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
      setToday({ rows: rows || [], label: wd === 0 ? 'Chủ nhật' : `Thứ ${wd + 1}` });
    }

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
        .home { font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #16324f; }
        .welcome { background: linear-gradient(135deg, #e9f3fe, #d6e8fa); border: 1px solid #cfe2f6; border-radius: 24px; padding: 20px 22px; margin-bottom: 18px; }
        .welcome small { color: #52708f; font-size: 13px; font-weight: 600; }
        .welcome h1 { margin: 3px 0 0; font-size: clamp(24px, 6vw, 34px); line-height: 1.15; font-weight: 800; color: #173f6b; }
        .welcome h1 em { font-style: normal; color: #3478b8; }
        .welcome p { margin: 6px 0 0; color: #52708f; font-size: 14px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
        .stat { background: rgba(255, 255, 255, 0.85); border-radius: 16px; padding: 10px 12px; min-width: 0; }
        .stat b { display: block; font-size: 20px; line-height: 1.2; color: #1f5a96; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .stat span { font-size: 11.5px; color: #52708f; font-weight: 600; }

        .sec-h { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 10px; }
        .sec-h h2 { margin: 0; font-size: 18px; font-weight: 800; color: #173f6b; }
        .sec-h span, .sec-h a { font-size: 13px; color: #52708f; text-decoration: none; font-weight: 600; }
        .sec-h a { color: #3478b8; font-weight: 800; }

        .today { background: #fff; border: 1px solid #d7e6f6; border-radius: 20px; padding: 12px; margin-bottom: 22px; }
        .tp { display: flex; align-items: center; gap: 12px; padding: 9px 8px; border-radius: 14px; }
        .tp + .tp { border-top: 1px dashed #e3edf8; }
        .tp-n { flex: none; width: 34px; height: 34px; border-radius: 50%; background: #e6f1fd; color: #1f5a96; display: grid; place-items: center; font-weight: 800; font-size: 14px; }
        .tp b { display: block; font-size: 14.5px; }
        .tp small { color: #6a86a6; font-size: 12px; }
        .none { text-align: center; color: #6a86a6; font-size: 13.5px; padding: 12px 6px; }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(236px, 1fr)); gap: 16px; margin-bottom: 26px; }
        .card { position: relative; display: flex; flex-direction: column; background: #fff; border: 1px solid #d7e6f6; border-radius: 22px; overflow: hidden;
          text-decoration: none; color: inherit; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        a.card:hover { transform: translateY(-3px); border-color: #a9cbee; box-shadow: 0 18px 30px -22px rgba(52, 120, 184, 0.7); }
        a.card:focus-visible { outline: 3px solid #4a8fd6; outline-offset: 3px; }
        .art { background: radial-gradient(circle at 50% 18%, #ffffff 0%, #e6f1fd 80%); padding: 20px 20px 12px; display: grid; place-items: center; }
        .art img { width: 82%; max-width: 180px; height: auto; display: block; }
        .meta { padding: 12px 18px 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .meta p { margin: 0; font-size: 13.5px; line-height: 1.5; color: #4a6585; flex: 1; }
        .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .go { font-weight: 800; font-size: 13.5px; color: #3478b8; }
        .badge { background: #ffe1de; color: #b3261e; font-weight: 800; font-size: 12px; border-radius: 999px; padding: 4px 11px; }
        .card.soon { background: #f7fbff; border-style: dashed; }
        .card.soon .art { background: #f0f5fb; }
        .card.soon .art img { filter: grayscale(1); opacity: 0.45; }
        .card.soon .go { color: #8aa0b8; }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

        .todo { background: #fff; border: 1px solid #d7e6f6; border-radius: 20px; padding: 6px 8px; margin-bottom: 22px; }
        .item { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 14px; text-decoration: none; color: inherit; min-height: 56px; }
        .item:hover { background: #f1f7fe; }
        .item + .item { border-top: 1px solid #eaf1f9; }
        .item img { width: 42px; height: 42px; object-fit: contain; flex: none; }
        .item b { display: block; font-size: 14.5px; }
        .item small { color: #52708f; font-size: 12.5px; }
        .item .arrow { margin-left: auto; color: #3478b8; font-weight: 800; }

        /* Điện thoại: thẻ môn học 2 cột, gọn */
        @media (max-width: 640px) {
          .welcome { padding: 16px; border-radius: 22px; }
          .grid { grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
          .card { border-radius: 18px; }
          .art { padding: 12px 10px 6px; }
          .art img { width: 70%; max-width: 110px; }
          .meta { padding: 8px 12px 12px; gap: 6px; }
          .meta p { display: none; }
          .go { font-size: 13px; }
          .badge { font-size: 11px; padding: 3px 8px; }
        }
        @media (prefers-reduced-motion: reduce) { .card { transition: none; } a.card:hover { transform: none; } }
      `}</style>

      <section className="welcome" data-vip={stats && getRank(stats.xp).rank.level >= 6 ? 1 : 0}>
        {stats && getRank(stats.xp).rank.level >= 6 && (
          <div className="vip-ribbon"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17l-6.1 3.6 1.4-6.8L2.2 9.1l6.9-.8z" /></svg>Ngôi sao lớp học</div>
        )}
        <small>{greeting()}</small>
        <h1>Xin chào, <em>{firstName(profile?.full_name)}</em></h1>
        <p>Hôm nay em muốn học môn nào?</p>
        {stats && (
          <div className="stats" aria-label="Thành tích của em">
            <div className="stat"><b>{stats.xp.toLocaleString('vi-VN')}</b><span>Điểm kinh nghiệm</span></div>
            <div className="stat"><b>{stats.streak}</b><span>Ngày liên tiếp</span></div>
            <div className="stat rk"><b style={{ fontSize: 15, paddingTop: 3, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.2, wordBreak: 'break-word', color: rank?.badge_color || '#1f5a96' }}>{rank?.name || '—'}</b><span>Cấp bậc</span></div>
          </div>
        )}
      </section>

      {today && today.rows.length > 0 && (
        <>
          <div className="sec-h"><h2>Hôm nay học gì · {today.label}</h2><Link href="/student/thoi-khoa-bieu">Xem cả tuần ›</Link></div>
          <div className="today">
            {today.rows.map((r) => (
              <div key={`${r.session}-${r.period}`} className="tp">
                <span className="tp-n">{r.period}</span>
                <div><b>{r.subject}</b><small>{SESS[r.session]}{r.teacher ? ` · ${r.teacher}` : ''}</small></div>
              </div>
            ))}
          </div>
        </>
      )}

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
              <div className="art"><img src={`/mon-hoc/${s.slug}.png`} alt={s.title} width="180" height="180" /></div>
              <div className="meta">
                <p>{s.desc}</p>
                <div className="foot">
                  <span className="go">{s.soon ? 'Sắp ra mắt' : `${s.title} ›`}</span>
                  {s.slug === 'ngu-van' && todo.length > 0 && <span className="badge">{todo.length} đề</span>}
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
