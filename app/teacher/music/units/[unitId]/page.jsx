'use client';
// Đặt tại: app/teacher/music/units/[unitId]/page.jsx
// Danh sách bài học (Bài hát / Bài đọc nhạc) trong 1 chủ đề.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const backLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};

export default function MusicUnitLessonsPage() {
  const { unitId } = useParams();
  const router = useRouter();
  const [unit, setUnit] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState('song');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (unitId) load(); }, [unitId]);

  async function load() {
    if (!unitId) return;
    const { data: u } = await supabase.from('music_units').select('*').eq('id', unitId).single();
    setUnit(u);
    const { data: l } = await supabase.from('music_lessons').select('*').eq('unit_id', unitId).order('order_index', { ascending: true });
    setLessons(l || []);
  }

  async function addLesson(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('music_lessons')
      .insert({ unit_id: unitId, title: newTitle, kind: newKind, order_index: lessons.length })
      .select()
      .single();
    setCreating(false);
    if (error) { alert('Không tạo được bài học: ' + error.message); return; }
    if (!data) { alert('Không tạo được bài học — có thể tài khoản chưa được phân công đúng môn Âm nhạc. Nhờ admin kiểm tra teacher_assignments.'); return; }
    router.push(`/teacher/music/lessons/${data.id}`);
  }

  async function deleteLesson(id) {
    if (!confirm('Xoá bài học này?')) return;
    await supabase.from('music_lessons').delete().eq('id', id);
    load();
  }

  async function moveLesson(lesson, direction) {
    const idx = lessons.findIndex((l) => l.id === lesson.id);
    const swapWith = lessons[idx + direction];
    if (!swapWith) return;
    await supabase.from('music_lessons').update({ order_index: swapWith.order_index }).eq('id', lesson.id);
    await supabase.from('music_lessons').update({ order_index: lesson.order_index }).eq('id', swapWith.id);
    load();
  }

  if (!unit) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 760px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        h1 { font-size: 22px; color: #17302d; margin: 14px 0 8px; }
        .grade-badge { display: inline-block; font-size: 12px; font-weight: 600; color: #225da3; background: #E9F2FC; padding: 3px 10px; border-radius: 999px; margin-bottom: 18px; }
        .section-title { font-size: 18px; font-weight: 700; color: #17302d; margin: 0 0 14px; }
        .lesson-list { display: grid; gap: 10px; margin-bottom: 22px; }
        .lesson-row { background: #fff; border: 1px solid #e5eeec; border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(23,48,45,0.03); }
        .lesson-left { display: flex; align-items: center; gap: 12px; }
        .kind-icon { font-size: 20px; }
        .lesson-link { color: #17302d; font-weight: 700; text-decoration: none; font-size: 15px; }
        .lesson-link:hover { color: #225da3; }
        .kind-label { font-size: 11.5px; color: #6b7f7a; }
        .lesson-actions { display: flex; gap: 4px; background: #f8fafb; border: 1px solid #eef1f0; border-radius: 12px; padding: 5px; }
        .mini-btn { border: none; background: transparent; border-radius: 8px; width: 30px; height: 30px; cursor: pointer; font-size: 14px; color: #4b5563; }
        .mini-btn:hover { background: #e5e7eb; }
        .mini-btn.danger { color: #a3374a; }
        .mini-btn.danger:hover { background: #fdeef0; }
        .empty-lessons { text-align: center; padding: 30px 20px; color: #9ca3af; background: #fff; border-radius: 14px; border: 1px dashed #cfe2f7; margin-bottom: 22px; }
        .add-card { background: #fff; border-radius: 16px; padding: 20px; border: 1px solid #e5eeec; }
        .add-card h4 { margin: 0 0 14px; font-size: 15px; color: #17302d; }
        .kind-toggle { display: flex; gap: 8px; margin-bottom: 12px; }
        .kind-btn { flex: 1; border: 1.5px solid #e2e8f0; background: #fff; border-radius: 11px; padding: 10px; font-size: 13.5px; font-weight: 600; color: #374151; cursor: pointer; }
        .kind-btn.active { border-color: #225da3; background: #E9F2FC; color: #225da3; }
        input { width: 100%; padding: 11px 13px; border-radius: 11px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .add-btn { width: 100%; margin-top: 14px; background: #58CC02; color: #fff; border: none; border-radius: 11px; padding: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 #46a302; }
        .add-btn:disabled { background: #9ca3af; box-shadow: none; }
      `}</style>

      <Link href="/teacher/music" style={backLinkStyle}>← Âm nhạc</Link>
      <h1>{unit.title}</h1>
      {unit.grade && <span className="grade-badge">Khối {unit.grade}</span>}

      <h2 className="section-title">Bài học</h2>
      {lessons.length === 0 ? (
        <div className="empty-lessons">Chưa có bài học nào — thêm bài học đầu tiên bên dưới.</div>
      ) : (
        <div className="lesson-list">
          {lessons.map((l, idx) => (
            <div key={l.id} className="lesson-row">
              <div className="lesson-left">
                <span className="kind-icon">{l.kind === 'song' ? '🎤' : '🎼'}</span>
                <div>
                  <Link href={`/teacher/music/lessons/${l.id}`} className="lesson-link">{l.title}</Link>
                  <div className="kind-label">{l.kind === 'song' ? 'Bài hát' : 'Bài đọc nhạc'} · {(l.notes || []).length} nốt</div>
                </div>
              </div>
              <div className="lesson-actions">
                <button className="mini-btn" onClick={() => moveLesson(l, -1)} disabled={idx === 0} title="Lên">↑</button>
                <button className="mini-btn" onClick={() => moveLesson(l, 1)} disabled={idx === lessons.length - 1} title="Xuống">↓</button>
                <button className="mini-btn danger" onClick={() => deleteLesson(l.id)} title="Xoá">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="add-card">
        <h4>＋ Thêm bài học mới</h4>
        <div className="kind-toggle">
          <button type="button" className={newKind === 'song' ? 'kind-btn active' : 'kind-btn'} onClick={() => setNewKind('song')}>🎤 Bài hát</button>
          <button type="button" className={newKind === 'sight_reading' ? 'kind-btn active' : 'kind-btn'} onClick={() => setNewKind('sight_reading')}>🎼 Bài đọc nhạc</button>
        </div>
        <form onSubmit={addLesson}>
          <input
            placeholder={newKind === 'song' ? 'Tên bài hát — vd: Con đường học trò' : 'Tên bài — vd: Bài đọc nhạc số 1'}
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          />
          <button className="add-btn" disabled={creating}>{creating ? 'Đang tạo…' : '＋ Thêm bài học'}</button>
        </form>
      </div>
    </div>
  );
}
