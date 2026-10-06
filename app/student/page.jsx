'use client';
// Trang Học tập của học sinh: lịch học hôm nay + ngày mai, việc cần làm, các môn học.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getRankForXp } from '@/lib/englishXp';
import { addDays, vnTodayIso } from '@/lib/dates';

const SUBJECTS = [
  { slug: 'ngu-van', title: 'Ngữ văn', href: '/student/ngu-van', desc: 'Viết bài văn trên web, AI chấm theo barem và nhận xét chi tiết.' },
  { slug: 'tieng-anh', title: 'Tiếng Anh', href: '/student/english', desc: 'Lộ trình học từ vựng theo chủ đề, mở khóa từng bài.' },
  { slug: 'am-nhac', title: 'Âm nhạc', href: '/student/music', desc: 'Luyện bài hát và bài đọc nhạc theo từng chủ đề.' },
  { slug: 'lich-su', title: 'Lịch sử', soon: true, desc: 'Đang được thầy cô chuẩn bị.' },
  { slug: 'dia-li', title: 'Địa lí', soon: true, desc: 'Đang được thầy cô chuẩn bị.' },
];
const SESS = { sang: 'Buổi sáng', chieu: 'Buổi chiều' };

const firstName = (n) => (n || '').trim().split(/\s+/).slice(-1)[0] || 'em';
const wdOf = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const wdName = (iso) => (wdOf(iso) === 0 ? 'Chủ nhật' : `Thứ ${wdOf(iso) + 1}`);
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const hm = (t) => (t ? String(t).slice(0, 5) : '');
function nowHm() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}
function greeting() {
  const h = Number(nowHm().slice(0, 2));
  return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}
function dueText(due) {
  if (!due) return 'Không giới hạn hạn nộp';
  const ms = new Date(due) - Date.now();
  const d = Math.floor(ms / 86400000);
  if (d >= 1) return `Còn ${d} ngày · ${new Date(due).toLocaleDateString('vi-VN')}`;
  return `Còn ${Math.max(1, Math.floor(ms / 3600000))} giờ`;
}

// Lấy tiết học của một ngày; ưu tiên hàm dành cho mọi học sinh, dự phòng hàm cũ
async function fetchDay(classId, iso) {
  const a = await supabase.rpc('student_day_schedule', { p_date: iso });
  if (!a.error) return a.data || [];
  const b = await supabase.rpc('class_day_periods', { p_class_id: classId, p_date: iso });
  return b.data || [];
}

function DayCard({ title, sub, rows, active, emptyText, now, isToday }) {
  const groups = ['sang', 'chieu'].map((s) => ({ s, list: rows.filter((r) => r.session === s) })).filter((g) => g.list.length);
  return (
    <section className={`day ${active ? 'on' : ''}`} aria-label={title}>
      <header className="day-h">
        <b>{title}</b>
        <span>{sub}</span>
      </header>
      {rows.length === 0 ? (
        <p className="none">{emptyText}</p>
      ) : (
        groups.map((g) => (
          <div key={g.s}>
            <div className="sess">{SESS[g.s]}</div>
            {g.list.map((r) => {
              const live = isToday && r.start_time && r.end_time && now >= hm(r.start_time) && now < hm(r.end_time);
              return (
                <div key={`${r.session}-${r.period}`} className={`tp ${live ? 'live' : ''}`}>
                  <span className="tp-n">{r.period}</span>
                  <div className="tp-m">
                    <b>{r.subject}</b>
                    {r.teacher ? <small>{r.teacher}</small> : null}
                  </div>
                  <div className="tp-t">
                    {live && <em>Đang học</em>}
                    {r.start_time ? <span>{hm(r.start_time)}–{hm(r.end_time)}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </section>
  );
}

export default function StudentHome() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [rank, setRank] = useState(null);
  const [todo, setTodo] = useState([]);
  const [days, setDays] = useState(null); // { today: {iso, rows}, next: {iso, rows, skipped} }
  const [tab, setTab] = useState('today');
  const [now, setNow] = useState(nowHm());

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(nowHm()), 30000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('id, full_name, class_id').eq('id', user.id).single();
    const { data: st } = await supabase.from('student_stats').select('total_xp, current_streak').eq('student_id', user.id).maybeSingle();
    const xp = st?.total_xp || 0;
    setProfile(p);
    setStats({ xp, streak: st?.current_streak || 0 });
    setRank(await getRankForXp(xp));

    if (p?.class_id) {
      const iso = vnTodayIso();
      const todayRows = await fetchDay(p.class_id, iso);
      // Ngày mai; nếu không có tiết (thứ 7, chủ nhật...) thì lấy ngày học kế tiếp trong 4 ngày tới
      let nextIso = addDays(iso, 1);
      let nextRows = await fetchDay(p.class_id, nextIso);
      let skipped = false;
      for (let i = 2; i <= 5 && nextRows.length === 0; i++) {
        const d = addDays(iso, i);
        const r = await fetchDay(p.class_id, d);
        if (r.length) { nextIso = d; nextRows = r; skipped = true; }
      }
      setDays({ today: { iso, rows: todayRows }, next: { iso: nextIso, rows: nextRows, skipped, tomorrow: addDays(iso, 1) } });
    }

    const { data: asg } = await supabase.from('lit_assignments').select('id, title, due_date');
    const { data: sb } = await supabase.from('lit_submissions').select('assignment_id, status').eq('student_id', user.id);
    const done = new Set((sb || []).filter((s) => s.status !== 'draft').map((s) => s.assignment_id));
    const open = (asg || [])
      .filter((a) => !done.has(a.id) && (!a.due_date || new Date(a.due_date) > new Date()))
      .sort((a, b) => (a.due_date ? new Date(a.due_date) : Infinity) - (b.due_date ? new Date(b.due_date) : Infinity));
    setTodo(open);
  }

  const nextTitle = days
    ? days.next.rows.length === 0
      ? 'Ngày mai học gì'
      : days.next.skipped ? `${wdName(days.next.iso)} học gì` : 'Ngày mai học gì'
    : '';

  return (
    <div className="home">
      <style jsx>{`
        .home { font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #16324f; display: flex; flex-direction: column; gap: 18px; }
        .hero { background: linear-gradient(135deg, #eaf4ff, #d8eafc); border: 1px solid #cfe2f6; border-radius: 24px; padding: 18px 20px; }
        .hero small { color: #52708f; font-size: 13px; font-weight: 600; }
        .hero h1 { margin: 2px 0 0; font-size: clamp(23px, 6vw, 32px); line-height: 1.15; font-weight: 800; color: #173f6b; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
        .stat { background: rgba(255, 255, 255, 0.88); border-radius: 14px; padding: 9px 11px; min-width: 0; }
        .stat b { display: block; font-size: 19px; line-height: 1.2; color: #1f5a96; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .stat span { font-size: 11.5px; color: #52708f; font-weight: 600; }

        .sec-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 10px; }
        .sec-h h2 { margin: 0; font-size: 18px; font-weight: 800; color: #173f6b; }
        .sec-h a { font-size: 13px; color: #3478b8; text-decoration: none; font-weight: 800; padding: 6px 2px; }
        .sec-h span { font-size: 13px; color: #52708f; font-weight: 600; }

        .seg { display: none; background: #e6f0fb; border-radius: 14px; padding: 4px; gap: 4px; margin-bottom: 10px; }
        .seg button { flex: 1; border: 0; background: transparent; border-radius: 11px; padding: 11px 8px; font: inherit; font-weight: 800; font-size: 14px; color: #52708f; cursor: pointer; min-height: 44px; }
        .seg button.on { background: #fff; color: #173f6b; box-shadow: 0 2px 8px -3px rgba(31, 90, 150, 0.4); }
        .days { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .day { background: #fff; border: 1px solid #d7e6f6; border-radius: 20px; padding: 6px 12px 10px; }
        .day-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 10px 4px 6px; }
        .day-h b { font-size: 15.5px; color: #173f6b; }
        .day-h span { font-size: 12.5px; color: #6a86a6; font-weight: 600; }
        .sess { font-size: 12px; font-weight: 800; color: #3478b8; background: #eef5fd; border-radius: 8px; padding: 4px 9px; margin: 8px 0 4px; display: inline-block; }
        .tp { display: flex; align-items: center; gap: 11px; padding: 9px 8px; border-radius: 14px; }
        .tp + .tp { border-top: 1px dashed #e3edf8; }
        .tp.live { background: #e8f6ee; border-top-color: transparent; }
        .tp-n { flex: none; width: 34px; height: 34px; border-radius: 12px; background: #e6f1fd; color: #1f5a96; display: grid; place-items: center; font-weight: 800; font-size: 14px; }
        .tp.live .tp-n { background: #2e9d63; color: #fff; }
        .tp-m { flex: 1; min-width: 0; }
        .tp-m b { display: block; font-size: 14.5px; line-height: 1.25; }
        .tp-m small { color: #6a86a6; font-size: 12px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tp-t { flex: none; text-align: right; font-size: 12px; color: #52708f; font-weight: 700; display: flex; flex-direction: column; gap: 2px; }
        .tp-t em { font-style: normal; color: #1d7a49; font-size: 11.5px; }
        .none { text-align: center; color: #6a86a6; font-size: 13.5px; padding: 18px 6px; margin: 0; }

        .todo { background: #fff; border: 1px solid #d7e6f6; border-radius: 20px; padding: 6px 8px; }
        .item { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 14px; text-decoration: none; color: inherit; min-height: 56px; }
        .item:hover { background: #f1f7fe; }
        .item + .item { border-top: 1px solid #eaf1f9; }
        .item img { width: 42px; height: 42px; object-fit: contain; flex: none; }
        .item b { display: block; font-size: 14.5px; }
        .item small { color: #52708f; font-size: 12.5px; }
        .item .arrow { margin-left: auto; color: #3478b8; font-weight: 800; }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
        .card { position: relative; display: flex; flex-direction: column; background: #fff; border: 1px solid #d7e6f6; border-radius: 22px; overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.18s ease, box-shadow 0.18s ease; }
        a.card:hover { transform: translateY(-3px); box-shadow: 0 18px 30px -22px rgba(52, 120, 184, 0.7); }
        a.card:focus-visible { outline: 3px solid #4a8fd6; outline-offset: 3px; }
        .art { background: radial-gradient(circle at 50% 18%, #fff 0%, #e6f1fd 80%); padding: 18px 18px 10px; display: grid; place-items: center; }
        .art img { width: 80%; max-width: 170px; height: auto; display: block; }
        .meta { padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .meta p { margin: 0; font-size: 13.5px; line-height: 1.5; color: #4a6585; flex: 1; }
        .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .go { font-weight: 800; font-size: 13.5px; color: #3478b8; }
        .badge { background: #ffe1de; color: #b3261e; font-weight: 800; font-size: 12px; border-radius: 999px; padding: 4px 11px; }
        .card.soon { background: #f7fbff; border-style: dashed; }
        .card.soon .art { background: #f0f5fb; }
        .card.soon .art img { filter: grayscale(1); opacity: 0.45; }
        .card.soon .go { color: #8aa0b8; }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

        @media (max-width: 720px) {
          .home { gap: 14px; }
          .hero { padding: 15px; border-radius: 22px; }
          .seg { display: flex; }
          .days { grid-template-columns: 1fr; }
          .day { display: none; }
          .day.on { display: block; }
          .grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .card { border-radius: 18px; }
          .art { padding: 12px 10px 6px; }
          .art img { width: 68%; max-width: 104px; }
          .meta { padding: 8px 12px 12px; gap: 6px; }
          .meta p { display: none; }
          .go { font-size: 13px; }
          .badge { font-size: 11px; padding: 3px 8px; }
        }
        @media (prefers-reduced-motion: reduce) { .card { transition: none; } a.card:hover { transform: none; } }
      `}</style>

      <section className="hero">
        <small>{greeting()}</small>
        <h1>Xin chào, {firstName(profile?.full_name)}</h1>
        {stats && (
          <div className="stats" aria-label="Thành tích của em">
            <div className="stat"><b>{stats.xp.toLocaleString('vi-VN')}</b><span>Điểm kinh nghiệm</span></div>
            <div className="stat"><b>{stats.streak}</b><span>Ngày liên tiếp</span></div>
            <div className="stat"><b style={{ fontSize: 15, paddingTop: 3, color: rank?.badge_color || '#1f5a96' }}>{rank?.name || '—'}</b><span>Cấp bậc</span></div>
          </div>
        )}
      </section>

      {days && (
        <section>
          <div className="sec-h"><h2>Lịch học</h2><Link href="/student/thoi-khoa-bieu">Xem cả tuần ›</Link></div>
          <div className="seg" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'today'} className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>Hôm nay học gì</button>
            <button type="button" role="tab" aria-selected={tab === 'next'} className={tab === 'next' ? 'on' : ''} onClick={() => setTab('next')}>{nextTitle}</button>
          </div>
          <div className="days">
            <DayCard
              title="Hôm nay học gì"
              sub={`${wdName(days.today.iso)}, ${dm(days.today.iso)}`}
              rows={days.today.rows}
              active={tab === 'today'}
              now={now}
              isToday
              emptyText="Hôm nay lớp em không có tiết nào."
            />
            <DayCard
              title={nextTitle}
              sub={`${wdName(days.next.iso)}, ${dm(days.next.iso)}`}
              rows={days.next.rows}
              active={tab === 'next'}
              now={now}
              emptyText="Chưa có thời khóa biểu cho những ngày tới."
            />
          </div>
        </section>
      )}

      {todo.length > 0 && (
        <section>
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
        </section>
      )}

      <section>
        <div className="sec-h"><h2>Môn học của em</h2></div>
        <div className="grid">
          {SUBJECTS.map((s) => {
            const body = (
              <>
                <h3 className="sr">{s.title}</h3>
                <div className="art"><img src={`/mon-hoc/${s.slug}.png`} alt={s.title} width="170" height="170" /></div>
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
      </section>
    </div>
  );
}
