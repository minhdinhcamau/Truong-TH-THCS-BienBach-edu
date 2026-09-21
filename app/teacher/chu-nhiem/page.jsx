'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useHomeroom } from '@/lib/useHomeroom';
import { useRankingPing } from '@/lib/useRankingPing';
import HomeroomShell from '@/components/HomeroomShell';
import ClassManager from '@/components/classmgr/ClassManager';

// Chủ nhiệm lớp: chỉ mở được khi tài khoản giáo viên được admin phân công chủ nhiệm (TPT / admin xem được mọi lớp).
export default function HomeroomPage() {
  const router = useRouter();
  const { profile, ready, logout } = useGuard('any');
  const isStudent = !!profile && profile.role === 'student' && !profile.is_tpt;
  const staff = !!profile && (profile.role === 'admin' || !!profile.is_tpt);
  const homeroom = useHomeroom(ready && !isStudent);
  const [allClasses, setAllClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [hero, setHero] = useState({ rank: null, of: null, total: null, students: null, cadre: null });

  useEffect(() => { if (ready && isStudent) router.replace('/student/ban-can-su'); }, [ready, isStudent, router]);
  useEffect(() => {
    if (!ready || !staff) return;
    supabase.from('classes').select('id, name').order('name').then(({ data }) => setAllClasses((data || []).map((c) => ({ class_id: c.id, class_name: c.name }))));
  }, [ready, staff]);

  const classes = staff ? allClasses : homeroom.classes;
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].class_id); }, [classes, classId]);
  const current = classes.find((c) => c.class_id === classId);

  const loadHero = useCallback(async () => {
    if (!classId) return;
    const [lb, st] = await Promise.all([
      supabase.rpc('get_class_leaderboard'),
      supabase.rpc('class_students', { p_class_id: classId }),
    ]);
    const row = (lb.data || []).find((r) => r.class_id === classId);
    setHero({
      rank: row?.rank ?? null, of: (lb.data || []).length || null, total: row?.total_score ?? null,
      students: st.data ? st.data.length : null, cadre: st.data ? st.data.filter((s) => s.role).length : null,
    });
  }, [classId]);

  useEffect(() => { loadHero(); }, [loadHero]);
  useRankingPing(loadHero);

  if (!ready || isStudent || (!staff && !homeroom.loaded)) return <div style={{ padding: 60, textAlign: 'center', color: '#5b6e66' }}>Đang tải…</div>;

  const allowed = staff || homeroom.classes.length > 0;
  const roleLabel = staff ? (profile.role === 'admin' ? 'Quản trị viên' : 'Tổng phụ trách Đội') : 'Giáo viên chủ nhiệm';

  return (
    <HomeroomShell profile={profile} roleLabel={roleLabel} active="chu-nhiem" showHomeroom={allowed} onLogout={logout}>
      {!allowed ? (
        <div className="hr-card" style={{ marginTop: 20 }}>
          <div className="hr-empty">
            Bạn chưa được phân công chủ nhiệm lớp nào nên chưa dùng được mục này.<br />Hãy nhờ quản trị viên phân công chủ nhiệm.
            <div style={{ marginTop: 14 }}><Link href="/teacher" className="hr-back">← Về trang giáo viên</Link></div>
          </div>
        </div>
      ) : (
        <>
          <section className="hr-hero">
            <div className="hr-hero-l">
              <small>{staff ? 'Xem với quyền quản lý' : `Giáo viên chủ nhiệm · ${profile.full_name}`}</small>
              <h1>Lớp {current?.class_name || '…'}</h1>
              <p>{hero.students != null ? `${hero.students} học sinh · ${hero.cadre ?? 0} bạn trong ban cán sự` : 'Đang tải…'}</p>
              {classes.length > 1 && (
                <select className="hr-pick" style={{ marginTop: 10 }} value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Chọn lớp">
                  {classes.map((c) => <option key={c.class_id} value={c.class_id}>Lớp {c.class_name}</option>)}
                </select>
              )}
            </div>
            <div className="hr-stats">
              <div className="hr-stat"><small>Hạng thi đua tuần</small><b>{hero.rank ?? '—'}{hero.of ? <span style={{ fontSize: 15, color: '#b9d6cb' }}>/{hero.of}</span> : null}</b></div>
              <div className="hr-stat"><small>Điểm thi đua</small><b>{hero.total != null ? Number(hero.total).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—'}</b></div>
            </div>
          </section>
          {classId && <ClassManager key={classId} classId={classId} className={current?.class_name} isStaff role={null} roleGroup={null} profileId={profile.id} />}
        </>
      )}
    </HomeroomShell>
  );
}
