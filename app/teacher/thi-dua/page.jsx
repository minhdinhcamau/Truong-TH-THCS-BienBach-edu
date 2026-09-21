'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useHomeroom } from '@/lib/useHomeroom';
import { fmtIso, timeVN } from '@/lib/dates';
import HomeroomShell from '@/components/HomeroomShell';
import RankingBoard from '@/components/RankingBoard';

const CAT = { ne_nep: 'Nề nếp', hoc_tap: 'Học tập' };

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
      const { data } = await supabase.rpc('class_deduction_feed', { p_class_id: c.class_id, p_days: 14 });
      setFeeds((f) => ({ ...f, [c.class_id]: data || [] }));
    });
    supabase.from('announcements').select('id, title, body, created_at, pinned, audience').eq('audience', 'gvcn')
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotices(data || []));
  }, [homeroom.loaded, homeroom.classes]);

  const grouped = useMemo(() => {
    const out = {};
    Object.entries(feeds).forEach(([cid, rows]) => {
      const m = new Map();
      rows.forEach((r) => { if (!m.has(r.occurred_date)) m.set(r.occurred_date, []); m.get(r.occurred_date).push(r); });
      out[cid] = Array.from(m.entries());
    });
    return out;
  }, [feeds]);

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
        <div className="hr-card" key={c.class_id} style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 17, marginBottom: 6 }}>Lớp {c.class_name} bị trừ điểm những mục nào (14 ngày gần đây)</h3>
          {!grouped[c.class_id] ? <div className="hr-empty">Đang tải…</div> : grouped[c.class_id].length === 0 ? (
            <div className="hr-empty">Chưa có ghi nhận nào. Lớp đang làm rất tốt!</div>
          ) : grouped[c.class_id].map(([date, list]) => (
            <div key={date} style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, borderBottom: '1px solid #dce6e1', paddingBottom: 4 }}>{fmtIso(date)}</div>
              {list.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #eef3f1' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      <span style={{ background: '#e8f2ee', color: '#234f42', borderRadius: 999, padding: '1px 9px', fontSize: 11.5, marginRight: 6 }}>{CAT[r.category] || r.category}</span>{r.reason_label}
                    </div>
                    <div style={{ color: '#5b6e66', fontSize: 12 }}>
                      {timeVN(r.created_at)}{r.reporter_name ? ` · ${r.reporter_name}` : ''}{r.student_name ? ` · HS: ${r.student_name}` : ''}{r.note ? ` · ${r.note}` : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: r.points < 0 ? '#b3261e' : '#1a8a58' }}>{r.points}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </HomeroomShell>
  );
}
