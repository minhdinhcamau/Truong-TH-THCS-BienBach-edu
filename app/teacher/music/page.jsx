'use client';
// Đặt tại: app/teacher/music/page.jsx
// Trang gốc "Âm nhạc" bên giáo viên — CHỈ vào được khi useMusicAccess()
// báo assigned=true (được admin phân công ở app/admin/mon-hoc). Liệt kê
// các chủ đề (music_units) giáo viên đã tạo, cho tạo chủ đề mới.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useMusicAccess } from '@/lib/useMusicAccess';

const backLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};
const ALL_GRADES = [6, 7, 8, 9];

export default function TeacherMusicHome() {
  const router = useRouter();
  const { profile, ready } = useGuard('any');
  const access = useMusicAccess(ready);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (access.loaded && access.assigned) load(); }, [access.loaded, access.assigned]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('music_units')
      .select('*, music_lessons(id, kind)')
      .eq('created_by', profile.id)
      .order('order_index', { ascending: true });
    setUnits(data || []);
    setLoading(false);
  }

  async function createUnit(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('music_units')
      .insert({ title: newTitle, grade: newGrade ? Number(newGrade) : null, order_index: units.length, created_by: profile.id })
      .select()
      .single();
    setCreating(false);
    if (error) { alert(error.message); return; }
    router.push(`/teacher/music/units/${data.id}`);
  }

  if (!ready || !access.loaded) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;

  if (!access.assigned) {
    return (
      <div className="wrap">
        <style jsx>{`.wrap { max-width: 520px; margin: 0 auto; padding: 28px 24px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }`}</style>
        <Link href="/teacher" style={backLinkStyle}>← Trang giáo viên</Link>
        <div style={{ background: '#fff', borderRadius: 18, padding: '40px 24px', marginTop: 20, textAlign: 'center', border: '1px dashed #cfe2f7' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎵</div>
          <h2 style={{ margin: '0 0 8px', color: '#17302d' }}>Chưa được phân công môn Âm nhạc</h2>
          <p style={{ color: '#6b7f7a', fontSize: 14 }}>Nhờ quản trị viên vào mục "Phân công giáo viên theo môn học" để cấp quyền cho tài khoản của bạn.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 900px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .head { display: flex; justify-content: space-between; align-items: flex-end; margin: 18px 0 28px; flex-wrap: wrap; gap: 14px; }
        .head h1 { margin: 0; font-size: 26px; color: #17302d; }
        .card { background: #fff; border-radius: 18px; padding: 22px; margin-bottom: 18px; border: 1px solid #e5eeec; box-shadow: 0 2px 8px rgba(23,48,45,0.04); }
        .card h2 { margin: 0 0 14px; font-size: 15px; color: #17302d; }
        .row { display: flex; gap: 10px; flex-wrap: wrap; }
        .row input { flex: 2; min-width: 200px; }
        .row select { flex: 1; min-width: 120px; }
        input, select { padding: 11px 13px; border-radius: 11px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .add-btn { background: #58CC02; color: #fff; border: none; border-radius: 11px; padding: 0 20px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 #46a302; }
        .add-btn:disabled { background: #9ca3af; box-shadow: none; }
        .unit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .unit-card { display: block; background: #fff; border-radius: 18px; padding: 22px; text-decoration: none; color: inherit; border: 1px solid #e5eeec; box-shadow: 0 2px 8px rgba(23,48,45,0.05); }
        .unit-card:hover { box-shadow: 0 8px 20px rgba(34,93,163,0.12); border-color: #b9d4ee; }
        .unit-title { font-weight: 700; font-size: 16px; color: #17302d; margin-bottom: 6px; }
        .unit-meta { display: flex; gap: 6px; flex-wrap: wrap; }
        .badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
        .badge.grade { color: #225da3; background: #E9F2FC; }
        .badge.song { color: #58A700; background: #EAFBEA; }
        .badge.reading { color: #b45309; background: #FEF3E2; }
        .empty { text-align: center; color: #9ca3af; padding: 40px; background: #fff; border-radius: 14px; border: 1px dashed #cfe2f7; }
      `}</style>

      <Link href="/teacher" style={backLinkStyle}>← Trang giáo viên</Link>
      <div className="head"><h1>🎵 Âm nhạc</h1></div>

      <div className="card">
        <h2>+ Tạo chủ đề mới</h2>
        <form onSubmit={createUnit} className="row">
          <input placeholder="Tên chủ đề — vd: Chủ đề 1: Mái trường mến yêu" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
          <select value={newGrade} onChange={(e) => setNewGrade(e.target.value)}>
            <option value="">Mọi khối</option>
            {ALL_GRADES.map((g) => <option key={g} value={g}>Khối {g}</option>)}
          </select>
          <button className="add-btn" disabled={creating}>{creating ? 'Đang tạo…' : '+ Tạo'}</button>
        </form>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : units.length === 0 ? (
        <div className="empty">Chưa có chủ đề nào — tạo chủ đề đầu tiên ở trên.</div>
      ) : (
        <div className="unit-grid">
          {units.map((u) => {
            const nSong = (u.music_lessons || []).filter((l) => l.kind === 'song').length;
            const nReading = (u.music_lessons || []).filter((l) => l.kind === 'sight_reading').length;
            return (
              <Link key={u.id} href={`/teacher/music/units/${u.id}`} className="unit-card">
                <div className="unit-title">{u.title}</div>
                <div className="unit-meta">
                  {u.grade && <span className="badge grade">Khối {u.grade}</span>}
                  {nSong > 0 && <span className="badge song">🎤 {nSong} bài hát</span>}
                  {nReading > 0 && <span className="badge reading">🎼 {nReading} đọc nhạc</span>}
                  {nSong === 0 && nReading === 0 && <span className="badge grade">Chưa có bài học</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
