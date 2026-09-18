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

  useEffect(() => {
    load();
  }, [unitId]);

  async function load() {
    const { data: u } = await supabase.from('eng_units').select('*, eng_courses(id, title)').eq('id', unitId).single();
    setUnit(u);
    const { data: l } = await supabase
      .from('eng_lessons')
      .select('*')
      .eq('unit_id', unitId)
      .order('order_index', { ascending: true });
    setLessons(l || []);
  }

  async function addLesson(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await supabase.from('eng_lessons').insert({
      unit_id: unitId,
      title: newTitle,
      order_index: lessons.length,
      pass_score: Number(passScore) || 80,
      max_hearts: Number(maxHearts) || 5,
    });
    setNewTitle('');
    load();
  }

  function startEdit(l) {
    setEditingId(l.id);
    setEditForm({ title: l.title, pass_score: l.pass_score, max_hearts: l.max_hearts });
  }

  async function saveEdit(id) {
    if (!editForm.title.trim()) return;
    await supabase.from('eng_lessons').update({
      title: editForm.title,
      pass_score: Number(editForm.pass_score) || 80,
      max_hearts: Number(editForm.max_hearts) || 5,
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

  if (!unit) return <p style={{ padding: 24 }}>Đang tải...</p>;

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <Link href={`/teacher/english/courses/${unit.eng_courses.id}`}>← {unit.eng_courses.title}</Link>
      <h1>{unit.title}</h1>

      <h3 style={{ marginTop: 24 }}>Các bài học (Lesson)</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {lessons.map((l, idx) => (
          <div key={l.id} style={row}>
            {editingId === l.id ? (
              <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  style={input}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1, fontSize: 12 }}>
                    Điểm qua bài (%)
                    <input type="number" value={editForm.pass_score}
                      onChange={(e) => setEditForm({ ...editForm, pass_score: e.target.value })} style={input} />
                  </label>
                  <label style={{ flex: 1, fontSize: 12 }}>
                    Số tim
                    <input type="number" value={editForm.max_hearts}
                      onChange={(e) => setEditForm({ ...editForm, max_hearts: e.target.value })} style={input} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveEdit(l.id)} style={btnPrimary}>Lưu</button>
                  <button onClick={() => setEditingId(null)} style={iconBtn}>Hủy</button>
                </div>
              </div>
            ) : (
              <>
                <Link href={`/teacher/english/lessons/${l.id}`} style={{ flex: 1 }}>
                  {idx + 1}. {l.title}
                </Link>
                <span style={{ fontSize: 12, color: '#666' }}>Qua bài ≥{l.pass_score}% · {l.max_hearts} tim</span>
                <button onClick={() => startEdit(l)} style={iconBtn}>✎</button>
                <button onClick={() => moveLesson(l, -1)} disabled={idx === 0} style={iconBtn}>↑</button>
                <button onClick={() => moveLesson(l, 1)} disabled={idx === lessons.length - 1} style={iconBtn}>↓</button>
                <button onClick={() => deleteLesson(l.id)} style={{ ...iconBtn, color: 'crimson' }}>Xóa</button>
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={addLesson} style={{ marginTop: 16, display: 'grid', gap: 8, maxWidth: 360 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Tên bài học mới (vd: Các thành viên trong nhà)"
          style={input}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1 }}>
            Điểm qua bài (%)
            <input type="number" value={passScore} onChange={(e) => setPassScore(e.target.value)} style={input} />
          </label>
          <label style={{ flex: 1 }}>
            Số tim
            <input type="number" value={maxHearts} onChange={(e) => setMaxHearts(e.target.value)} style={input} />
          </label>
        </div>
        <button type="submit" style={btnPrimary}>+ Thêm bài học</button>
      </form>
    </div>
  );
}

const row = { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 };
const iconBtn = { border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', padding: '4px 8px' };
const btnPrimary = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', cursor: 'pointer' };
const input = { display: 'block', width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #d1d5db' };
