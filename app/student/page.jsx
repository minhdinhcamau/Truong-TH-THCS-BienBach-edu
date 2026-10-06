'use client';
// Trang Học tập của học sinh: tổng quan, lịch học hôm nay/ngày mai, việc cần làm, tiến độ từng môn.
// CSS nằm ở app/student/home.css (tiền tố hm-) để áp được cho cả component con.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getRank } from '@/lib/rank';
import { addDays, vnTodayIso } from '@/lib/dates';
import './home.css';
import { useStudent } from './layout';

const SESS = { sang: 'Buổi sáng', chieu: 'Buổi chiều' };

// Màu nhấn riêng từng môn (pastel, chữ đủ tương phản)
const SUBJECT_DEFS = [
  { slug: 'ngu-van', title: 'Ngữ văn', href: '/student/ngu-van', ac: '#b8374f', bg: '#fde9ed', key: 'lit' },
  { slug: 'tieng-anh', title: 'Tiếng Anh', href: '/student/english', ac: '#2a68ad', bg: '#e4effc', key: 'eng' },
  { slug: 'am-nhac', title: 'Âm nhạc', href: '/student/music', ac: '#6d47bd', bg: '#f0e9fc', key: 'mus' },
];
const SOON = [
  { slug: 'lich-su', title: 'Lịch sử' },
  { slug: 'dia-li', title: 'Địa lí' },
];

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
const pctOf = (done, total) => (total > 0 ? Math.round((done / total) * 100) : 0);
function stageOf(pct, total) {
  if (!total) return 'Chưa có bài';
  if (pct === 0) return 'Chưa bắt đầu';
  if (pct < 25) return 'Khởi động';
  if (pct < 50) return 'Đang tiến bộ';
  if (pct < 75) return 'Tăng tốc';
  if (pct < 100) return 'Sắp về đích';
  return 'Hoàn thành';
}
const segFill = (i, pct) => Math.max(0, Math.min(100, (pct - i * 25) * 4));

// ---------- Lấy dữ liệu ----------
async function fetchDay(classId, iso) {
  const a = await supabase.rpc('student_day_schedule', { p_date: iso });
  if (!a.error) return a.data || [];
  const b = await supabase.rpc('class_day_periods', { p_class_id: classId, p_date: iso });
  return b.data || [];
}

const EMPTY = { total: 0, done: 0, groups: 0, avg: null, next: null, failed: false };

async function loadLit(userId) {
  try {
    const { data: asg } = await supabase.from('lit_assignments').select('id, title, due_date');
    const { data: sb } = await supabase.from('lit_submissions').select('assignment_id, status').eq('student_id', userId);
    const doneSet = new Set((sb || []).filter((s) => s.status !== 'draft').map((s) => s.assignment_id));
    const all = asg || [];
    const open = all
      .filter((a) => !doneSet.has(a.id) && (!a.due_date || new Date(a.due_date) > new Date()))
      .sort((a, b) => (a.due_date ? new Date(a.due_date) : Infinity) - (b.due_date ? new Date(b.due_date) : Infinity));
    return {
      total: all.length,
      done: all.filter((a) => doneSet.has(a.id)).length,
      groups: 0,
      avg: null,
      next: open[0] ? { href: `/student/ngu-van/${open[0].id}`, label: open[0].title, verb: 'Viết bài' } : null,
      open,
      failed: false,
    };
  } catch (e) {
    return { ...EMPTY, open: [], failed: true };
  }
}

async function loadEng(userId, grade) {
  try {
    if (grade == null) return { ...EMPTY };
    const { data: courses } = await supabase
      .from('eng_courses').select('id').eq('grade', grade).order('created_at', { ascending: false }).limit(1);
    const c = courses?.[0];
    if (!c) return { ...EMPTY };
    const { data: unitRows } = await supabase
      .from('eng_units')
      .select('id, order_index, eng_lessons(id, title, order_index)')
      .eq('course_id', c.id)
      .order('order_index', { ascending: true });
    const { data: pr } = await supabase
      .from('eng_lesson_progress').select('lesson_id, is_unlocked, is_completed, best_score').eq('student_id', userId);
    const map = Object.fromEntries((pr || []).map((p) => [p.lesson_id, p]));
    let isFirst = true;
    let total = 0; let done = 0; let sum = 0; let next = null;
    (unitRows || []).forEach((u) => {
      [...(u.eng_lessons || [])].sort((a, b) => a.order_index - b.order_index).forEach((l) => {
        const p = map[l.id];
        const unlocked = p?.is_unlocked || isFirst;
        isFirst = false;
        total += 1;
        if (p?.is_completed) { done += 1; sum += p.best_score || 0; }
        else if (unlocked && !next) next = { href: `/student/english/lessons/${l.id}`, label: l.title, verb: 'Học tiếp' };
      });
    });
    return { total, done, groups: (unitRows || []).length, avg: done ? Math.round(sum / done) : null, next, failed: false };
  } catch (e) {
    return { ...EMPTY, failed: true };
  }
}

async function loadMusic(userId, grade) {
  try {
    const { data: units } = await supabase
      .from('music_units')
      .select('id, order_index, music_lessons(id, title, order_index)')
      .or(grade != null ? `grade.is.null,grade.eq.${grade}` : 'grade.is.null')
      .order('order_index', { ascending: true });
    const { data: pr } = await supabase
      .from('music_lesson_progress').select('lesson_id, is_unlocked, is_completed, best_score').eq('student_id', userId);
    const map = Object.fromEntries((pr || []).map((p) => [p.lesson_id, p]));
    let total = 0; let done = 0; let sum = 0; let next = null;
    (units || []).forEach((u) => {
      let isFirst = true; // bài đầu mỗi chủ đề luôn mở
      [...(u.music_lessons || [])].sort((a, b) => a.order_index - b.order_index).forEach((l) => {
        const p = map[l.id];
        const unlocked = p?.is_unlocked || isFirst;
        isFirst = false;
        total += 1;
        if (p?.is_completed) { done += 1; sum += p.best_score || 0; }
        else if (unlocked && !next) next = { href: `/student/music/lessons/${l.id}`, label: l.title, verb: 'Học tiếp' };
      });
    });
    return { total, done, groups: (units || []).length, avg: done ? Math.round(sum / done) : null, next, failed: false };
  } catch (e) {
    return { ...EMPTY, failed: true };
  }
}

// ---------- Thành phần giao diện ----------
function Ring({ pct }) {
  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <svg className="hm-ring" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
      <circle className="trk" cx="26" cy="26" r={R} fill="none" strokeWidth="5" />
      <circle className="val" cx="26" cy="26" r={R} fill="none" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 26 26)" />
      <text x="26" y="30.5" textAnchor="middle">{pct}%</text>
    </svg>
  );
}

function StageBar({ pct }) {
  return (
    <div className="hm-stage" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ hoàn thành">
      {[0, 1, 2, 3].map((i) => (<i key={i}><b style={{ width: `${segFill(i, pct)}%` }} /></i>))}
    </div>
  );
}

function SubjectCard({ def, p }) {
  const loading = p === null;
  const total = p?.total || 0;
  const done = p?.done || 0;
  const pct = pctOf(done, total);
  const unit = def.key === 'lit' ? 'đề' : 'bài';
  const chip = (() => {
    if (!p || !total) return null;
    if (def.key === 'lit') {
      const left = total - done;
      return left > 0 ? { t: `${left} đề chưa nộp`, warn: true } : { t: 'Đã nộp đủ', ok: true };
    }
    return p.avg != null ? { t: `Điểm trung bình ${p.avg}%` } : null;
  })();
  const meta = loading
    ? 'Đang tải tiến độ…'
    : !total
      ? 'Chưa có bài học nào'
      : def.key === 'lit'
        ? `${done}/${total} đề đã nộp`
        : `${done}/${total} bài · ${p.groups} ${def.key === 'eng' ? 'unit' : 'chủ đề'}`;
  const finished = total > 0 && done === total;
  const cta = p?.next
    ? { href: p.next.href, text: `${p.next.verb}: ${p.next.label}` }
    : { href: def.href, text: finished ? 'Đã hoàn thành · Ôn lại' : 'Vào môn học' };

  return (
    <article className={`hm-sub ${loading ? 'is-loading' : ''}`} style={{ '--ac': def.ac, '--ac-bg': def.bg }}>
      <Link href={def.href} className="hm-sub-top" aria-label={`Mở môn ${def.title}`}>
        <span className="hm-ico"><img src={`/mon-hoc/${def.slug}.png`} alt="" width="44" height="44" /></span>
        <span className="hm-sub-t">
          <h3>{def.title}</h3>
          <span className="hm-meta">{meta}</span>
          {chip && <span className={`hm-chip ${chip.warn ? 'warn' : chip.ok ? 'ok' : ''}`}>{chip.t}</span>}
        </span>
        {total > 0 ? <Ring pct={pct} /> : <span className="hm-ring-empty" aria-hidden="true">—</span>}
      </Link>
      <div>
        <StageBar pct={pct} />
        <div className="hm-stage-l">
          <span>{loading ? '' : stageOf(pct, total)}</span>
          <span>{total > 0 ? `Còn ${total - done} ${unit}` : ''}</span>
        </div>
      </div>
      <Link href={cta.href} className="hm-cta"><span>{cta.text}</span><i aria-hidden="true">›</i></Link>
    </article>
  );
}

function DayList({ rows, now, isToday, emptyText }) {
  const groups = ['sang', 'chieu'].map((s) => ({ s, list: rows.filter((r) => r.session === s) })).filter((g) => g.list.length);
  if (rows.length === 0) return <p className="hm-none">{emptyText}</p>;
  return (
    <div>
      {groups.map((g) => (
        <div key={g.s}>
          <div className="hm-sess">{SESS[g.s]}</div>
          {g.list.map((r) => {
            const live = isToday && r.start_time && r.end_time && now >= hm(r.start_time) && now < hm(r.end_time);
            const past = isToday && r.end_time && now >= hm(r.end_time);
            return (
              <div key={`${r.session}-${r.period}`} className={`hm-tp ${live ? 'live' : ''} ${past ? 'past' : ''}`}>
                <span className="hm-tp-n">{r.period}</span>
                <div className="hm-tp-m">
                  <b>{r.subject}</b>
                  {r.teacher ? <small>{r.teacher}</small> : null}
                </div>
                <div className="hm-tp-t">
                  {live && <em>Đang học</em>}
                  {r.start_time ? <span>{hm(r.start_time)}–{hm(r.end_time)}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function StudentHome() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(undefined); // undefined: đang tải, null: lớp chưa có, object: có
  const [prog, setProg] = useState(null); // { lit, eng, mus }
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
    setProfile(p);
    setStats({ xp: st?.total_xp || 0, streak: st?.current_streak || 0 });

    // Tiến độ các môn (chạy song song với lịch học)
    const progressTask = (async () => {
      let grade = null;
      if (p?.class_id) {
        const { data: cls } = await supabase.from('classes').select('grade').eq('id', p.class_id).single();
        grade = cls?.grade ?? null;
      }
      const [lit, eng, mus] = await Promise.all([loadLit(user.id), loadEng(user.id, grade), loadMusic(user.id, grade)]);
      setProg({ lit, eng, mus });
    })();

    const dayTask = (async () => {
      if (!p?.class_id) { setDays(null); return; }
      const iso = vnTodayIso();
      const todayRows = await fetchDay(p.class_id, iso);
      // Ngày mai; nếu không có tiết (thứ 7, chủ nhật...) thì lấy ngày học kế tiếp trong 5 ngày tới
      let nextIso = addDays(iso, 1);
      let nextRows = await fetchDay(p.class_id, nextIso);
      let skipped = false;
      for (let i = 2; i <= 5 && nextRows.length === 0; i++) {
        const d = addDays(iso, i);
        const r = await fetchDay(p.class_id, d);
        if (r.length) { nextIso = d; nextRows = r; skipped = true; }
      }
      setDays({ today: { iso, rows: todayRows }, next: { iso: nextIso, rows: nextRows, skipped } });
    })();

    await Promise.all([progressTask, dayTask]);
  }

  const rk = useMemo(() => (stats ? getRank(stats.xp).rank : null), [stats]);
  const ctxTheme = useStudent()?.uiTheme;
  const vip = (rk?.level || 0) >= 6 && ctxTheme !== 'classic';

  const overall = useMemo(() => {
    if (!prog) return null;
    const list = [prog.lit, prog.eng, prog.mus];
    const total = list.reduce((n, x) => n + x.total, 0);
    const done = list.reduce((n, x) => n + x.done, 0);
    return { total, done, pct: pctOf(done, total) };
  }, [prog]);

  const todo = prog?.lit?.open || [];
  const nextTitle = days && days.next.rows.length > 0 && days.next.skipped ? `${wdName(days.next.iso)} học gì` : 'Ngày mai học gì';
  const cur = days ? (tab === 'today' ? days.today : days.next) : null;

  return (
    <div className="hm">
      {/* ===== Chào + thành tích ===== */}
      <section className="welcome hm-hero" data-vip={vip ? '1' : undefined}>
        {vip && (
          <div className="vip-ribbon">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.1 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" /></svg>
            Ngôi sao lớp học
          </div>
        )}
        <small>{greeting()}</small>
        <h1>Xin chào, <em>{firstName(profile?.full_name)}</em></h1>
        {stats && (
          <>
            <div className="hm-stats" aria-label="Thành tích của em">
              <div className="stat"><b>{stats.xp.toLocaleString('vi-VN')}</b><span>Điểm kinh nghiệm</span></div>
              <div className="stat"><b>{stats.streak}</b><span>Ngày liên tiếp</span></div>
              <div className="stat rk"><b>{rk?.name || '—'}</b><span>Cấp bậc</span></div>
            </div>
            {overall && overall.total > 0 && (
              <div className="hm-ov">
                <div className="hm-ov-h"><span>Tiến độ chung các môn</span><b>{overall.pct}%</b></div>
                <div className="hm-ov-bar" role="progressbar" aria-valuenow={overall.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${overall.pct}%` }} /></div>
                <div className="hm-ov-f">Đã hoàn thành {overall.done}/{overall.total} bài và đề</div>
              </div>
            )}
          </>
        )}
      </section>

      <div className="hm-layout">
        {/* ===== Cột chính: các môn ===== */}
        <div className="hm-main">
          <div className="hm-sec-h">
            <h2>Môn học của em</h2>
            <span>Tiến độ theo từng giai đoạn</span>
          </div>
          <div className="hm-subjects">
            {SUBJECT_DEFS.map((d) => (<SubjectCard key={d.slug} def={d} p={prog ? prog[d.key] : null} />))}
          </div>
          <div className="hm-soon" aria-label="Các môn sắp ra mắt">
            {SOON.map((s) => (
              <div key={s.slug} className="hm-soon-i">
                <span className="hm-soon-ic"><img src={`/mon-hoc/${s.slug}.png`} alt="" width="30" height="30" /></span>
                <b>{s.title}</b>
                <small>Sắp ra mắt</small>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Cột phụ: lịch học + việc cần làm ===== */}
        <aside className="hm-aside">
          {days !== null && (
            <section className="hm-card">
              <div className="hm-sec-h in">
                <h2>Lịch học</h2>
                <Link href="/student/thoi-khoa-bieu">Xem cả tuần ›</Link>
              </div>
              {days === undefined ? (
                <p className="hm-none">Đang tải lịch học…</p>
              ) : (
                <>
                  <div className="hm-seg" role="tablist">
                    <button type="button" role="tab" aria-selected={tab === 'today'} className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>Hôm nay học gì</button>
                    <button type="button" role="tab" aria-selected={tab === 'next'} className={tab === 'next' ? 'on' : ''} onClick={() => setTab('next')}>{nextTitle}</button>
                  </div>
                  <div className="hm-day-h">
                    <b>{wdName(cur.iso)}, {dm(cur.iso)}</b>
                    <span>{cur.rows.length ? `${cur.rows.length} tiết` : ''}</span>
                  </div>
                  <DayList
                    rows={cur.rows}
                    now={now}
                    isToday={tab === 'today'}
                    emptyText={tab === 'today' ? 'Hôm nay lớp em không có tiết nào.' : 'Chưa có thời khóa biểu cho những ngày tới.'}
                  />
                </>
              )}
            </section>
          )}

          {todo.length > 0 && (
            <section className="hm-card">
              <div className="hm-sec-h in"><h2>Việc cần làm</h2><span>{todo.length} đề văn chưa nộp</span></div>
              <div className="hm-todo">
                {todo.slice(0, 3).map((a) => (
                  <Link key={a.id} href={`/student/ngu-van/${a.id}`} className="hm-item">
                    <span className="hm-item-ic"><img src="/mon-hoc/ngu-van.png" alt="" width="30" height="30" /></span>
                    <span className="hm-item-t"><b>{a.title}</b><small>{dueText(a.due_date)}</small></span>
                    <i aria-hidden="true">›</i>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
