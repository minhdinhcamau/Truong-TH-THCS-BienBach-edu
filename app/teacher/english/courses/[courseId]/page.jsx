'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ENGLISH_SUBJECT_ID } from '@/lib/englishXp';

export default function CourseUnitsPage() {
  const { courseId } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [units, setUnits] = useState([]);
  const [classes, setClasses] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  // Sửa thông tin khóa học
  const [editingCourse, setEditingCourse] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editClassId, setEditClassId] = useState('');

  // Sửa tên 1 chủ đề (unit) tại chỗ
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editUnitTitle, setEditUnitTitle] = useState('');

  useEffect(() => {
    load();
  }, [courseId]);

  async function load() {
    const { data: c } = await supabase
      .from('eng_courses')
      .select('*, classes(name, grade)')
      .eq('id', courseId)
      .single();
    setCourse(c);
    setEditTitle(c?.title || '');
    setEditDesc(c?.description || '');
    setEditClassId(c?.class_id || '');

    const { data: u } = await supabase
      .from('eng_units')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });
    setUnits(u || []);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: ta } = await supabase
      .from('teacher_assignments')
      .select('classes(id, name, grade)')
      .eq('teacher_id', user.id)
      .eq('subject_id', ENGLISH_SUBJECT_ID);
    const uniqueMap = new Map();
    (ta || []).forEach((row) => { if (row.classes) uniqueMap.set(row.classes.id, row.classes); });
    setClasses(Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function saveCourseEdit(e) {
    e.preventDefault();
    await supabase
      .from('eng_courses')
      .update({ title: editTitle, description: editDesc, class_id: editClassId || null })
      .eq('id', courseId);
    setEditingCourse(false);
    load();
  }

  async function deleteCourse() {
    if (!confirm('Xóa toàn bộ khóa học này, gồm tất cả chủ đề/bài học/từ vựng bên trong? Không thể hoàn tác.')) return;
    await supabase.from('eng_courses').delete().eq('id', courseId);
    router.push('/teacher/english');
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

  function startEditUnit(u) {
    setEditingUnitId(u.id);
    setEditUnitTitle(u.title);
  }

  async function saveUnitEdit(unitId) {
    if (!editUnitTitle.trim()) return;
    await supabase.from('eng_units').update({ title: editUnitTitle }).eq('id', unitId);
    setEditingUnitId(null);
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

      {!editingCourse ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>{course.title}</h1>
            {course.description && <p style={{ color: '#666', margin: 0 }}>{course.description}</p>}
            <p style={{ color: '#666' }}>
              Lớp: {course.classes ? `${course.classes.name}${course.classes.grade ? ` (Khối ${course.classes.grade})` : ''}` : '(chưa gán)'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setEditingCourse(true)} style={iconBtn}>✎ Sửa</button>
            <button onClick={deleteCourse} style={{ ...iconBtn, color: 'crimson' }}>Xóa khóa học</button>
          </div>
        </div>
      ) : (
        <form onSubmit={saveCourseEdit} style={{ display: 'grid', gap: 10, marginTop: 12, maxWidth: 420 }}>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required style={input} placeholder="Tên khóa học" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} style={input} placeholder="Mô tả" />
          <select value={editClassId} onChange={(e) => setEditClassId(e.target.value)} style={input}>
            <option value="">-- Chưa gán lớp --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.grade ? ` (Khối ${c.grade})` : ''}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={btnPrimary}>Lưu</button>
            <button type="button" onClick={() => setEditingCourse(false)} style={iconBtn}>Hủy</button>
          </div>
        </form>
      )}

      <h3 style={{ marginTop: 24 }}>Các chủ đề (Unit)</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {units.map((u, idx) => (
          <div key={u.id} style={row}>
            {editingUnitId === u.id ? (
              <>
                <input
                  value={editUnitTitle}
                  onChange={(e) => setEditUnitTitle(e.target.value)}
                  style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }}
                  autoFocus
                />
                <button onClick={() => saveUnitEdit(u.id)} style={iconBtn}>Lưu</button>
                <button onClick={() => setEditingUnitId(null)} style={iconBtn}>Hủy</button>
              </>
            ) : (
              <>
                <Link href={`/teacher/english/units/${u.id}`} style={{ flex: 1 }}>
                  {idx + 1}. {u.title}
                </Link>
                <button onClick={() => startEditUnit(u)} style={iconBtn}>✎</button>
                <button onClick={() => moveUnit(u, -1)} disabled={idx === 0} style={iconBtn}>↑</button>
                <button onClick={() => moveUnit(u, 1)} disabled={idx === units.length - 1} style={iconBtn}>↓</button>
                <button onClick={() => deleteUnit(u.id)} style={{ ...iconBtn, color: 'crimson' }}>Xóa</button>
              </>
            )}
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
const input = { display: 'block', width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' };
