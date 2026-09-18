'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function CourseUnitsPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [units, setUnits] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    load();
  }, [courseId]);

  async function load() {
    const { data: c } = await supabase.from('eng_courses').select('*').eq('id', courseId).single();
    setCourse(c);
    const { data: u } = await supabase
      .from('eng_units')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });
    setUnits(u || []);
  }

  async function addUnit(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await supabase.from('eng_units').insert({
      course_id: courseId,
      title: newTitle,
      order_index: units.length,
    });
    setNewTitle('');
    load();
  }

  async function moveUnit(unit, direction) {
    const idx = units.findIndex((u) => u.id === unit.id);
    const swapWith = units[idx + direction];
    if (!swapWith) return;
    await supabase.from('eng_units').update({ order_index: swapWith.order_index }).eq('id', unit.id);
    await supabase.from('eng_units').update({ order_index: unit.order_index }).eq('id', swapWith.id);
    load();
  }

  async function deleteUnit(id) {
    if (!confirm('Xóa chủ đề này và toàn bộ bài học/từ vựng bên trong?')) return;
    await supabase.from('eng_units').delete().eq('id', id);
    load();
  }

  if (!course) return <p style={{ padding: 24 }}>Đang tải...</p>;

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <Link href="/teacher/english">← Danh sách khóa học</Link>
      <h1>{course.title}</h1>
      <p style={{ color: '#666' }}>Lớp: {course.class_name || '(chưa gán)'}</p>

      <h3 style={{ marginTop: 24 }}>Các chủ đề (Unit)</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {units.map((u, idx) => (
          <div key={u.id} style={row}>
            <Link href={`/teacher/english/units/${u.id}`} style={{ flex: 1 }}>
              {idx + 1}. {u.title}
            </Link>
            <button onClick={() => moveUnit(u, -1)} disabled={idx === 0} style={iconBtn}>↑</button>
            <button onClick={() => moveUnit(u, 1)} disabled={idx === units.length - 1} style={iconBtn}>↓</button>
            <button onClick={() => deleteUnit(u.id)} style={{ ...iconBtn, color: 'crimson' }}>Xóa</button>
          </div>
        ))}
      </div>

      <form onSubmit={addUnit} style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Tên chủ đề mới (vd: Gia đình)"
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
        />
        <button type="submit" style={btnPrimary}>+ Thêm chủ đề</button>
      </form>
    </div>
  );
}

const row = { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 };
const iconBtn = { border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', padding: '4px 8px' };
const btnPrimary = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', cursor: 'pointer' };
