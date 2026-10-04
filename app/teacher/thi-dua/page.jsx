'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useHomeroom } from '@/lib/useHomeroom';
import { addDays, fmtDate, fmtIso, mondayOf, timeVN, vnTodayIso } from '@/lib/dates';
import HomeroomShell from '@/components/HomeroomShell';
import RankingBoard from '@/components/RankingBoard';

const CAT = { ne_nep: 'Nề nếp', hoc_tap: 'Học tập' };

// Khung "Lớp ... bị trừ điểm những mục nào": xem theo TỪNG TUẦN (giống trang học sinh).
// Dữ liệu lấy tối đa 60 ngày gần nhất (giới hạn của hàm class_deduction_feed), lọc theo tuần ở giao diện.
function ClassDeductions({ cls, rows }) {
  const today = vnTodayIso();
  const thisMonday = mondayOf(today);
  const [viewWeek, setViewWeek] = useState(thisMonday);

  const earliest = mondayOf(addDays(today, -60));

  const weekSum = useMemo(() => {
    const m = new Map();
    (rows || []).forEach((r) => {
      const w = mondayOf(String(r.occurred_date));
      m.set(w, (m.get(w) || 0) + Number(r.points));
    });
    return m;
  }, [rows]);

  const weeksWithDeduct = useMemo(() => {
    const list = [];
    for (let w = thisMonday; w >= earliest; w = addDays(w, -7)) {
      if ((weekSum.get(w) || 0) < 0) list.push(w);
    }
    return list;
  }, [weekSum, thisMonday, earliest]);

  const groups = useMemo(() => {
    const m = new Map();
    (rows || [])
      .filter((r) => mondayOf(String(r.occurred_date)) === viewWeek)
      .forEach((r) => {
        if (!m.has(r.occurred_date)) m.set(r.occurred_date, []);
        m.get(r.occurred_date).push(r);
      });
    return Array.from(m.entries());
  }, [rows, viewWeek]);

  const isThisWeek = viewWeek === thisMonday;
  const canPrev = viewWeek > earliest;
  const total = weekSum.get(viewWeek) || 0;

  return (
    <div className="hr-card" style={{ marginTop: 22 }}>
      <style jsx>{`
        .bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin: 10px 0 4px; }
        .wk { display: inline-flex; align-items: center; border: 1px solid #dce6e1; background: #fff; border-radius: 12px; overflow: hidden; }
        .wk button { border: none; background: #fff; width: 42px; height: 42px; cursor: pointer; color: #1f2d27; display: inline-flex; align-items: center; justify-content: center; }
        .wk button:disabled { opacity: 0.3; cursor: not-allowed; }
        .wk span { padding: 0 12px; font-size: 13px; font-weight: 700; white-space: nowrap; }
        .sum { font-size: 12.5px; font-weight: 700; border-radius: 999px; padding: 6px 13px; color: #167a4e; background: #e6f6ee; }
        .sum.bad { color: #b3261e; background: #fdeceb; }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .chips small { width: 100%; color: #5b6e66; font-size: 12px; }
        .chip { border: 1px solid #f1c4c0; background: #fff6f5; color: #b3261e; border-radius: 999px; font-size: 12.5px; font-weight: 700; padding: 6px 12px; cursor: pointer; min-height: 34px; }
        .chip.on { background: #b3261e; color: #fff; border-color: #b3261e; }
        .dh { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-weight: 700; font-size: 13.5px; border-bottom: 1px solid #dce6e1; padding-bottom: 6px; }
        .ds { color: #b3261e; background: #fdeceb; border-radius: 999px; padding: 2px 11px; font-size: 12.5px; }
        .ds.ok { color: #167a4e; background: #e6f6ee; }
        .it { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef3f1; }
        .it:last-child { border-bottom: none; }
        .pt { flex: none; min-width: 46px; text-align: center; font-weight: 800; font-size: 16px; border-radius: 10px; padding: 3px 8px; }
        .pt.neg { color: #b3261e; background: #fdeceb; }
        .pt.pos { color: #167a4e; background: #e6f6ee; }
        @media (max-width: 560px) { .wk span { padding: 0 8px; font-size: 12.5px; } }
      `}</style>

      <h3 style={{ fontSize: 17, marginBottom: 4 }}>Lớp {cls.class_name} bị trừ điểm những mục nào</h3>
      <p style={{ color: '#5b6e66', fontSize: 13, margin: 0 }}>
        Xem theo từng tuần (thứ Hai đến Chủ nhật). Chọn tuần có bị trừ điểm để xem chi tiết.
      </p>

      {rows !== undefined && (
        <>
          <div className="bar">
            <div className="wk">
              <button type="button" onClick={() => setViewWeek(addDays(viewWeek, -7))} disabled={!canPrev} aria-label="Tuần trước">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              <span>{isThisWeek ? 'Tuần này' : 'Tuần'} {fmtDate(viewWeek)} – {fmtDate(addDays(viewWeek, 6))}</span>
              <button type="button" onClick={() => setViewWeek(addDays(viewWeek, 7))} disabled={isThisWeek} aria-label="Tuần sau">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <span className={`sum ${total < 0 ? 'bad' : ''}`}>
              {total < 0 ? `${isThisWeek ? 'Tuần này' : 'Tuần đó'} bị trừ ${total} điểm` : 'Không bị trừ điểm'}
            </span>
          </div>

          {weeksWithDeduct.length > 0 && (
            <div className="chips">
              <small>Các tuần có bị trừ điểm:</small>
              {weeksWithDeduct.map((w) => (
                <button type="button" key={w} className={`chip ${w === viewWeek ? 'on' : ''}`} onClick={() => setViewWeek(w)}>
                  {fmtDate(w)} – {fmtDate(addDays(w, 6))} ({weekSum.get(w)})
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {rows === undefined ? (
        <div className="hr-empty">Đang tải…</div>
      ) : groups.length === 0 ? (
        <div className="hr-empty">{isThisWeek ? 'Tuần này lớp chưa bị trừ điểm. Lớp đang làm rất tốt!' : 'Tuần đó lớp không bị trừ điểm.'}</div>
      ) : groups.map(([date, list]) => {
        const sum = list.reduce((s, r) => s + Number(r.points), 0);
        return (
          <div key={date} style={{ marginTop: 14 }}>
            <div className="dh">
              <span>{fmtIso(date)}</span>
              <span className={`ds ${sum < 0 ? '' : 'ok'}`}>{sum < 0 ? `${sum} điểm` : 'Không bị trừ'}</span>
            </div>
            {list.map((r) => (
              <div className="it" key={r.id}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    <span style={{ background: '#e8f2ee', color: '#234f42', borderRadius: 999, padding: '1px 9px', fontSize: 11.5, marginRight: 6 }}>{CAT[r.category] || r.category}</span>{r.reason_label}
                  </div>
                  <div style={{ color: '#5b6e66', fontSize: 12, marginTop: 2 }}>
                    {timeVN(r.created_at)}{r.reporter_name ? ` · ${r.reporter_name}` : ''}{r.student_name ? ` · HS: ${r.student_name}` : ''}{r.note ? ` · ${r.note}` : ''}
                  </div>
                </div>
                <div className={`pt ${Number(r.points) < 0 ? 'neg' : 'pos'}`}>{r.points}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Trang giáo viên: xem thi đua lớp như học sinh. Giáo viên chủ nhiệm còn thấy lịch sử trừ điểm (có tên học sinh) của lớp mình.
export default function TeacherRankingPage() {
  const router = useRouter();
  const { profile, ready, logout } = useGuard('any');
  const isStudent = !!profile && profile.role === 'student' && !profile.is_tpt;
  const staff = !!profile && (profile.role === 'admin' || !!profile.is_tpt);
  const homeroom = useHomeroom(ready && !isStudent);
  const [feeds, setFeeds] = useState({});
  const [notices, setNotices] = useState([]);

  useEffect(() => { if (ready && isStudent) router.replace('/student/thi-dua'); }, [ready, isStudent, router]);

  useEffect(() => {
    if (!homeroom.loaded) return;
    homeroom.classes.forEach(async (c) => {
      const { data } = await supabase.rpc('class_deduction_feed', { p_class_id: c.class_id, p_days: 60 });
      setFeeds((f) => ({ ...f, [c.class_id]: data || [] }));
    });
    supabase.from('announcements').select('id, title, body, created_at, pinned, audience').eq('audience', 'gvcn')
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotices(data || []));
  }, [homeroom.loaded, homeroom.classes]);

  if (!ready || isStudent) return <div style={{ padding: 60, textAlign: 'center', color: '#5b6e66' }}>Đang tải…</div>;

  const showHomeroom = staff || homeroom.classes.length > 0;
  return (
    <HomeroomShell profile={profile} roleLabel={staff ? (profile.role === 'admin' ? 'Quản trị viên' : 'Tổng phụ trách Đội') : 'Giáo viên'}
      active="thi-dua" showHomeroom={showHomeroom} onLogout={logout}>
      <h1 className="hr-title">Thi đua lớp</h1>
      <p className="hr-sub">Bảng xếp hạng thi đua các lớp, cập nhật ngay khi Sao đỏ và cô Tổng phụ trách ghi điểm.</p>

      {notices.length > 0 && (
        <div className="hr-card" style={{ background: '#fffaf0', borderColor: '#efd9a0' }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>📢 Thông báo dành cho giáo viên chủ nhiệm</h3>
          {notices.map((n) => (
            <div key={n.id} style={{ marginBottom: 12 }}>
              <strong>{n.title}</strong>{n.pinned ? ' 📌' : ''}
              <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0', fontSize: 13.5 }}>{n.body}</p>
              <div style={{ color: '#5b6e66', fontSize: 12 }}>{new Date(n.created_at).toLocaleDateString('vi-VN')}</div>
            </div>
          ))}
        </div>
      )}

      <RankingBoard myClassId={homeroom.classes[0]?.class_id || null} accent="#2f6f5e" accentDark="#234f42" meBg="#e6f2ed" />

      {homeroom.classes.map((c) => (
        <ClassDeductions key={c.class_id} cls={c} rows={feeds[c.class_id]} />
      ))}
    </HomeroomShell>
  );
}
