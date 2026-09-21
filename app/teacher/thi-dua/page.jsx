'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useHomeroom } from '@/lib/useHomeroom';
import { teacherNav } from '@/lib/nav';
import { fmtIso, timeVN } from '@/lib/dates';
import AppShell from '@/components/AppShell';
import RankingBoard from '@/components/RankingBoard';

const CAT = { ne_nep: 'Nề nếp', hoc_tap: 'Học tập' };

// Trang giáo viên: xem thi đua lớp như học sinh. Giáo viên chủ nhiệm còn thấy lịch sử trừ điểm (có tên học sinh) của lớp mình.
export default function TeacherRankingPage() {
  const router = useRouter();
  const { profile, ready, logout } = useGuard('any');
  const isStudent = profile && profile.role === 'student' && !profile.is_tpt;
  const staff = profile && (profile.role === 'admin' || profile.is_tpt);
  const homeroom = useHomeroom(ready && !isStudent);
  const [feeds, setFeeds] = useState({});
  const [notices, setNotices] = useState([]);

  useEffect(() => { if (ready && isStudent) router.replace('/student/thi-dua'); }, [ready, isStudent, router]);

  useEffect(() => {
    if (!homeroom.loaded) return;
    homeroom.classes.forEach(async (c) => {
      const { data } = await supabase.rpc('class_deduction_feed', { p_class_id: c.class_id, p_days: 14 });
      setFeeds((f) => ({ ...f, [c.class_id]: data || [] }));
    });
    supabase.from('announcements').select('id, title, body, created_at, pinned, audience').eq('audience', 'gvcn')
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotices(data || []));
  }, [homeroom.loaded, homeroom.classes]);

  const myClass = homeroom.classes[0]?.class_id || null;
  const grouped = useMemo(() => {
    const out = {};
    Object.entries(feeds).forEach(([cid, rows]) => {
      const m = new Map();
      rows.forEach((r) => { if (!m.has(r.occurred_date)) m.set(r.occurred_date, []); m.get(r.occurred_date).push(r); });
      out[cid] = Array.from(m.entries());
    });
    return out;
  }, [feeds]);

  if (!ready || isStudent) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel={staff ? (profile.role === 'admin' ? 'Quản trị viên' : 'Tổng phụ trách Đội') : 'Giáo viên'}
      nav={teacherNav(homeroom.classes.length > 0 || staff)} activeHref="/teacher/thi-dua" onLogout={logout}>
      <h1 className="pg-title">Thi đua lớp</h1>
      <p className="pg-sub">Bảng xếp hạng thi đua các lớp, cập nhật ngay khi Sao đỏ và cô Tổng phụ trách ghi điểm.</p>

      {notices.length > 0 && (
        <div className="card" style={{ borderColor: '#f0d28a', background: '#fffaf0' }}>
          <div className="card-h"><h3>📢 Thông báo dành cho giáo viên chủ nhiệm</h3></div>
          {notices.map((n) => (
            <div key={n.id} style={{ marginBottom: 12 }}>
              <strong>{n.title}</strong>{n.pinned ? ' 📌' : ''}
              <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0', fontSize: 13.5 }}>{n.body}</p>
              <div className="hint" style={{ margin: 0 }}>{new Date(n.created_at).toLocaleDateString('vi-VN')}</div>
            </div>
          ))}
        </div>
      )}

      <RankingBoard myClassId={myClass} />

      {homeroom.classes.map((c) => (
        <div className="card" key={c.class_id} style={{ marginTop: 22 }}>
          <div className="card-h"><h3>Lớp {c.class_name} bị trừ điểm những mục nào (14 ngày gần đây)</h3></div>
          {!grouped[c.class_id] ? <div className="empty">Đang tải…</div> : grouped[c.class_id].length === 0 ? (
            <div className="empty">Chưa có ghi nhận nào. Lớp đang làm rất tốt!</div>
          ) : grouped[c.class_id].map(([date, list]) => (
            <div key={date} style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>{fmtIso(date)}</div>
              {list.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #eef1f5' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}><span className="pill mute" style={{ marginRight: 6 }}>{CAT[r.category] || r.category}</span>{r.reason_label}</div>
                    <div className="hint" style={{ margin: 0, fontSize: 12 }}>
                      {timeVN(r.created_at)}{r.reporter_name ? ` · ${r.reporter_name}` : ''}{r.student_name ? ` · HS: ${r.student_name}` : ''}{r.note ? ` · ${r.note}` : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: r.points < 0 ? 'var(--red)' : 'var(--ok)' }}>{r.points}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </AppShell>
  );
}
