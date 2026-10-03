'use client';
// Trang gốc "Âm nhạc" bên học sinh: các chủ đề áp dụng cho khối của học sinh (hoặc không giới hạn khối)
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import SubjectHeader from '@/components/SubjectHeader';

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
    <div className="mus">
      <style jsx>{`
        .mus { font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #12263f; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
        .unit { display: flex; flex-direction: column; gap: 14px; background: #fff; border: 1px solid #dbe5f3; border-radius: 20px; padding: 20px 22px;
          text-decoration: none; color: inherit; transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s; }
        .unit:hover { transform: translateY(-3px); border-color: #9bbcf0; box-shadow: 0 20px 34px -24px rgba(10,82,199,0.6); }
        .unit:focus-visible { outline: 3px solid #f5b800; outline-offset: 3px; }
        .idx { width: 34px; height: 34px; border-radius: 11px; background: #0a52c7; color: #fff; font-weight: 800; display: grid; place-items: center; }
        .title { font-weight: 800; font-size: 17px; line-height: 1.3; flex: 1; }
        .tags { display: flex; gap: 8px; flex-wrap: wrap; }
        .tag { font-size: 12px; font-weight: 700; padding: 4px 11px; border-radius: 999px; }
        .tag.song { color: #11743f; background: #e3f6ea; }
        .tag.reading { color: #9a5b00; background: #fff1d6; }
        .empty { text-align: center; padding: 44px 20px; background: #fff; border: 1px dashed #b9d0f0; border-radius: 18px; color: #5c6f86; }
        @media (prefers-reduced-motion: reduce) { .unit { transition: none; } .unit:hover { transform: none; } }
      `}</style>

      <SubjectHeader slug="am-nhac" title="Âm nhạc" subtitle="Luyện hát và đọc nhạc theo từng chủ đề của thầy cô." />

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : units.length === 0 ? (
        <div className="empty">Chưa có chủ đề Âm nhạc nào cho lớp em. Em hỏi thầy cô nhé.</div>
      ) : (
        <div className="grid">
          {units.map((u, i) => {
            const nSong = (u.music_lessons || []).filter((l) => l.kind === 'song').length;
            const nReading = (u.music_lessons || []).filter((l) => l.kind === 'sight_reading').length;
            return (
              <Link key={u.id} href={`/student/music/units/${u.id}`} className="unit">
                <div className="idx">{i + 1}</div>
                <div className="title">{u.title}</div>
                <div className="tags">
                  {nSong > 0 && <span className="tag song">{nSong} bài hát</span>}
                  {nReading > 0 && <span className="tag reading">{nReading} bài đọc nhạc</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
