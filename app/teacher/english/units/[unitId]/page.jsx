'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function UnitLessonsPage() {
  const { unitId } = useParams();
  const [unit, setUnit] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [passScore, setPassScore] = useState(80);
  const [maxHearts, setMaxHearts] = useState(5);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', pass_score: 80, max_hearts: 5 });

  useEffect(() => { load(); }, [unitId]);

  async function load() {
    const { data: u } = await supabase.from('eng_units').select('*, eng_courses(id, title)').eq('id', unitId).single();
    setUnit(u);
    const { data: l } = await supabase.from('eng_lessons').select('*').eq('unit_id', unitId).order('order_index', { ascending: true });
    setLessons(l || []);
  }

  async function addLesson(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await supabase.from('eng_lessons').insert({
      unit_id: unitId, title: newTitle, order_index: lessons.length,
      pass_score: Number(passScore) || 80, max_hearts: Number(maxHearts) || 5,
    });
    setNewTitle('');
    load();
  }

  function startEdit(l) { setEditingId(l.id); setEditForm({ title: l.title, pass_score: l.pass_score, max_hearts: l.max_hearts }); }
  async function saveEdit(id) {
    if (!editForm.title.trim()) return;
    await supabase.from('eng_lessons').update({
      title: editForm.title, pass_score: Number(editForm.pass_score) || 80, max_hearts: Number(editForm.max_hearts) || 5,
    }).eq('id', id);
    setEditingId(null);
    load();
  }

  async function moveLesson(lesson, direction) {
    const idx = lessons.findIndex((l) => l.id === lesson.id);
    const swapWith = lessons[idx + direction];
    if (!swapWith) return;
    await supabase.from('eng_lessons').update({ order_index: swapWith.order_index }).eq('id', lesson.id);
    await supabase.from('eng_lessons').update({ order_index: lesson.order_index }).eq('id', swapWith.id);
    load();
  }

  async function deleteLesson(id) {
    if (!confirm('Xóa bài học này và toàn bộ từ vựng bên trong?')) return;
    await supabase.from('eng_lessons').delete().eq('id', id);
    load();
  }

  if (!unit) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 760px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .back-link { color: #225da3; font-weight: 600; font-size: 13.5px; text-decoration: none; }
        h1 { font-size: 22px; color: #17302d; margin: 14px 0 26px; }
        .section-title { font-size: 18px; font-weight: 700; color: #17302d; margin: 0 0 14px; display: flex; align-items: center; gap: 8px; }
        .lesson-list { display: grid; gap: 10px; }
        .lesson-row { background: #fff; border: 1px solid #e5eeec; border-radius: 14px; padding: 14px 16px;
          box-shadow: 0 1px 4px rgba(23,48,45,0.03); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .lesson-row:hover { box-shadow: 0 4px 12px rgba(23,48,45,0.07); }
        .lesson-num { width: 30px; height: 30px; border-radius: 50%; background: #EAFBEA; color: #1a7f4e; font-weight: 700;
          font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .lesson-link { flex: 1; color: #17302d; font-weight: 600; text-decoration: none; font-size: 15px; min-width: 140px; }
        .lesson-link:hover { color: #225da3; }
        .meta-pill { font-size: 11.5px; color: #6b7f7a; background: #f3f6f5; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
        .mini-btn { border: none; background: #f3f4f6; border-radius: 8px; width: 30px; height: 30px; cursor: pointer;
          font-size: 14px; color: #4b5563; display: flex; align-items: center; justify-content: center; }
        .mini-btn:hover { background: #e5e7eb; }
        .mini-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .mini-btn.danger { color: #a3374a; }
        .mini-btn.danger:hover { background: #fdeef0; }
        .empty-lessons { text-align: center; padding: 40px 20px; color: #9ca3af; background: #fff; border-radius: 14px; border: 1px dashed #cfe2f7; }
        .edit-form { flex: 1 1 100%; display: grid; gap: 10px; }
        .edit-row { display: flex; gap: 10px; }
        .edit-row label { flex: 1; font-size: 12px; font-weight: 600; color: #374151; }
        input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; box-sizing: border-box; margin-top: 4px; }
        input:focus { outline: none; border-color: #225da3; }
        .save-btn { background: #225da3; color: #fff; border: none; border-radius: 10px; padding: 9px 18px; font-weight: 700; cursor: pointer; }
        .cancel-btn { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 9px 18px; font-weight: 600; cursor: pointer; color: #374151; }
        .add-card { background: #fff; border-radius: 16px; padding: 20px; margin-top: 18px; border: 1px solid #e5eeec; }
        .add-card h4 { margin: 0 0 14px; font-size: 15px; color: #17302d; }
        label { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 4px; }
        .row2 { display: flex; gap: 10px; margin-top: 10px; }
        .row2 > div { flex: 1; }
        .add-btn { width: 100%; margin-top: 14px; background: #225da3; color: #fff; border: none; border-radius: 11px; padding: 12px; font-weight: 700; cursor: pointer; }
      `}</style>

      <Link href={`/teacher/english/courses/${unit.eng_courses.id}`} className="back-link" style={{ color: '#225da3', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>← {unit.eng_courses.title}</Link>
      <h1>📂 {unit.title}</h1>

      <h2 className="section-title">📝 Các bài học (Lesson)</h2>

      {lessons.length === 0 && <div className="empty-lessons">Chưa có bài học nào — thêm bài học đầu tiên bên dưới.</div>}

      <div className="lesson-list">
        {lessons.map((l, idx) => (
          <div key={l.id} className="lesson-row">
            {editingId === l.id ? (
              <div className="edit-form">
                <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} autoFocus />
                <div className="edit-row">
                  <label>Điểm qua bài (%)
                    <input type="number" value={editForm.pass_score} onChange={(e) => setEditForm({ ...editForm, pass_score: e.target.value })} />
                  </label>
                  <label>Số tim
                    <input type="number" value={editForm.max_hearts} onChange={(e) => setEditForm({ ...editForm, max_hearts: e.target.value })} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="save-btn" onClick={() => saveEdit(l.id)}>Lưu</button>
                  <button className="cancel-btn" onClick={() => setEditingId(null)}>Hủy</button>
                </div>
              </div>
            ) : (
              <>
                <div className="lesson-num">{idx + 1}</div>
                <Link href={`/teacher/english/lessons/${l.id}`} className="lesson-link" style={{ color: '#17302d', fontWeight: 600, fontSize: 15, textDecoration: 'none', flex: 1, minWidth: 140 }}>{l.title}</Link>
                <span className="meta-pill">✅ ≥{l.pass_score}%</span>
                <span className="meta-pill">❤️ {l.max_hearts} tim</span>
                <button className="mini-btn" onClick={() => startEdit(l)} title="Sửa">✎</button>
                <button className="mini-btn" onClick={() => moveLesson(l, -1)} disabled={idx === 0} title="Lên">↑</button>
                <button className="mini-btn" onClick={() => moveLesson(l, 1)} disabled={idx === lessons.length - 1} title="Xuống">↓</button>
                <button className="mini-btn danger" onClick={() => deleteLesson(l.id)} title="Xóa">🗑</button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="add-card">
        <h4>＋ Thêm bài học mới</h4>
        <form onSubmit={addLesson}>
          <label>Tên bài học</label>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ví dụ: Các thành viên trong nhà" />
          <div className="row2">
            <div>
              <label>Điểm qua bài (%)</label>
              <input type="number" value={passScore} onChange={(e) => setPassScore(e.target.value)} />
            </div>
            <div>
              <label>Số tim</label>
              <input type="number" value={maxHearts} onChange={(e) => setMaxHearts(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="add-btn">＋ Thêm bài học</button>
        </form>
      </div>
    </div>
  );
}
