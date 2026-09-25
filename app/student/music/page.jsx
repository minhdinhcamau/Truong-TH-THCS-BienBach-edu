'use client';
// Đặt tại: app/student/music/page.jsx
// Trang gốc "Âm nhạc" bên học sinh — liệt kê các chủ đề áp dụng cho khối
// của học sinh (hoặc chủ đề không giới hạn khối). Đây là trang còn THIẾU
// khiến học sinh không có nút nào để vào làm bài Âm nhạc.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const backLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};

export default function StudentMusicHome() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: p } = await supabase.from('profiles').select('class_id').eq('id', user.id).single();

    let grade = null;
    if (p?.class_id) {
      const { data: cls } = await supabase.from('classes').select('grade').eq('id', p.class_id).single();
      grade = cls?.grade ?? null;
    }

    const { data } = await supabase
      .from('music_units')
      .select('*, music_lessons(id, kind)')
      .or(grade ? `grade.is.null,grade.eq.${grade}` : 'grade.is.null')
      .order('order_index', { ascending: true });
    setUnits(data || []);
    setLoading(false);
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 900px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .head { margin: 18px 0 28px; }
        .head h1 { margin: 0; font-size: 26px; color: #17302d; }
        .unit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .unit-card { display: block; background: #fff; border-radius: 18px; padding: 22px; text-decoration: none; color: inherit; border: 1px solid #e5eeec; box-shadow: 0 2px 8px rgba(23,48,45,0.05); }
        .unit-card:hover { box-shadow: 0 8px 20px rgba(34,93,163,0.12); border-color: #b9d4ee; transform: translateY(-2px); }
        .unit-title { font-weight: 700; font-size: 16px; color: #17302d; margin-bottom: 6px; }
        .unit-meta { display: flex; gap: 6px; flex-wrap: wrap; }
        .badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
        .badge.song { color: #58A700; background: #EAFBEA; }
        .badge.reading { color: #b45309; background: #FEF3E2; }
        .empty { text-align: center; color: #9ca3af; padding: 40px; background: #fff; border-radius: 14px; border: 1px dashed #cfe2f7; }
      `}</style>

      <Link href="/student" style={backLinkStyle}>← Trang học sinh</Link>
      <div className="head"><h1>🎵 Âm nhạc</h1></div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : units.length === 0 ? (
        <div className="empty">Chưa có chủ đề Âm nhạc nào cho lớp bạn — hỏi giáo viên nhé.</div>
      ) : (
        <div className="unit-grid">
          {units.map((u) => {
            const nSong = (u.music_lessons || []).filter((l) => l.kind === 'song').length;
            const nReading = (u.music_lessons || []).filter((l) => l.kind === 'sight_reading').length;
            return (
              <Link key={u.id} href={`/student/music/units/${u.id}`} className="unit-card">
                <div className="unit-title">{u.title}</div>
                <div className="unit-meta">
                  {nSong > 0 && <span className="badge song">🎤 {nSong} bài hát</span>}
                  {nReading > 0 && <span className="badge reading">🎼 {nReading} đọc nhạc</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
