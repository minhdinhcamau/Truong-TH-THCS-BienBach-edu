'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const backLinkStyle = { color: '#225da3', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' };
const ALL_GRADES = [6, 7, 8, 9];

export default function CourseUnitsPage() {
  const { courseId } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [units, setUnits] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  const [editingCourse, setEditingCourse] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editGrade, setEditGrade] = useState('');

  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editUnitTitle, setEditUnitTitle] = useState('');

  useEffect(() => { load(); }, [courseId]);

  async function load() {
    const { data: c } = await supabase.from('eng_courses').select('*').eq('id', courseId).single();
    setCourse(c);
    setEditTitle(c?.title || '');
    setEditDesc(c?.description || '');
    setEditGrade(c?.grade || '');

    const { data: u } = await supabase.from('eng_units').select('*').eq('course_id', courseId).order('order_index', { ascending: true });
    setUnits(u || []);
  }

  async function saveCourseEdit(e) {
    e.preventDefault();
    await supabase.from('eng_courses').update({ title: editTitle, description: editDesc, grade: editGrade ? Number(editGrade) : null }).eq('id', courseId);
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
    await supabase.from('eng_units').insert({ course_id: courseId, title: newTitle, order_index: units.length });
    setNewTitle('');
    load();
  }

  function startEditUnit(u) { setEditingUnitId(u.id); setEditUnitTitle(u.title); }
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

  if (!course) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 760px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .course-head { background: #fff; border-radius: 18px; padding: 22px 24px; margin: 14px 0 28px; border: 1px solid #e5eeec;
          box-shadow: 0 2px 8px rgba(23,48,45,0.04); display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .course-head h1 { margin: 0 0 4px; font-size: 22px; color: #17302d; }
        .course-head p.desc { color: #4b5563; font-size: 14px; margin: 2px 0 8px; }
        .grade-badge { display: inline-block; font-size: 12px; font-weight: 600; color: #225da3; background: #E9F2FC; padding: 3px 10px; border-radius: 999px; }
        .head-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .icon-btn { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 8px 14px; font-size: 13px;
          font-weight: 600; cursor: pointer; color: #374151; display: inline-flex; align-items: center; gap: 6px; }
        .icon-btn:hover { border-color: #225da3; color: #225da3; }
        .icon-btn.danger:hover { border-color: #a3374a; color: #a3374a; }
        label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; margin-top: 14px; }
        label:first-of-type { margin-top: 0; }
        input, textarea, select { width: 100%; padding: 11px 13px; border-radius: 11px; border: 1.5px solid #e2e8f0;
          font-size: 14px; font-family: inherit; box-sizing: border-box; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: #225da3; }
        .btn-row { display: flex; gap: 8px; margin-top: 16px; }
        .save-btn { background: #225da3; color: #fff; border: none; border-radius: 10px; padding: 10px 20px; font-weight: 700; cursor: pointer; }
        .section-title { font-size: 18px; font-weight: 700; color: #17302d; margin: 0 0 14px; display: flex; align-items: center; gap: 8px; }
        .unit-list { display: grid; gap: 10px; }
        .unit-row { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #e5eeec; border-radius: 14px;
          padding: 12px 16px; box-shadow: 0 1px 4px rgba(23,48,45,0.03); transition: box-shadow 0.15s; }
        .unit-row:hover { box-shadow: 0 4px 12px rgba(23,48,45,0.07); }
        .unit-num { width: 30px; height: 30px; border-radius: 50%; background: #E9F2FC; color: #225da3; font-weight: 700;
          font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .mini-btn { border: none; background: #f3f4f6; border-radius: 8px; width: 30px; height: 30px; cursor: pointer;
          font-size: 14px; color: #4b5563; display: flex; align-items: center; justify-content: center; }
        .mini-btn:hover { background: #e5e7eb; }
        .mini-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .mini-btn.danger { color: #a3374a; }
        .mini-btn.danger:hover { background: #fdeef0; }
        .add-form { display: flex; gap: 8px; margin-top: 16px; }
        .add-form input { flex: 1; margin: 0; }
        .add-btn { background: #225da3; color: #fff; border: none; border-radius: 11px; padding: 0 20px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .empty-units { text-align: center; padding: 40px 20px; color: #9ca3af; background: #fff; border-radius: 14px; border: 1px dashed #cfe2f7; }
      `}</style>

      <Link href="/teacher/english" style={backLinkStyle}>← Lộ trình Tiếng Anh</Link>

      {!editingCourse ? (
        <div className="course-head">
          <div>
            <h1>{course.title}</h1>
            {course.description && <p className="desc">{course.description}</p>}
            <span className="grade-badge">{course.grade ? `Khối ${course.grade}` : 'Chưa chọn khối'}</span>
          </div>
          <div className="head-actions">
            <button className="icon-btn" onClick={() => setEditingCourse(true)}>✎ Sửa</button>
            <button className="icon-btn danger" onClick={deleteCourse}>🗑 Xóa</button>
          </div>
        </div>
      ) : (
        <form onSubmit={saveCourseEdit} className="course-head" style={{ display: 'block' }}>
          <label>Tên khóa học</label>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          <label>Mô tả</label>
          <textarea rows={2} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          <label>Khối</label>
          <select value={editGrade} onChange={(e) => setEditGrade(e.target.value)}>
            <option value="">-- Chưa chọn khối --</option>
            {ALL_GRADES.map((g) => <option key={g} value={g}>Khối {g}</option>)}
          </select>
          <div className="btn-row">
            <button type="submit" className="save-btn">Lưu thay đổi</button>
            <button type="button" className="icon-btn" onClick={() => setEditingCourse(false)}>Hủy</button>
          </div>
        </form>
      )}

      <h2 className="section-title">Các chủ đề (Unit)</h2>

      {units.length === 0 && <div className="empty-units">Chưa có chủ đề nào — thêm chủ đề đầu tiên bên dưới.</div>}

      <div className="unit-list">
        {units.map((u, idx) => (
          <div key={u.id} className="unit-row">
            {editingUnitId === u.id ? (
              <>
                <input value={editUnitTitle} onChange={(e) => setEditUnitTitle(e.target.value)} autoFocus style={{ flex: 1 }} />
                <button className="icon-btn" onClick={() => saveUnitEdit(u.id)}>Lưu</button>
                <button className="icon-btn" onClick={() => setEditingUnitId(null)}>Hủy</button>
              </>
            ) : (
              <>
                <div className="unit-num">{idx + 1}</div>
                <Link href={`/teacher/english/units/${u.id}`} style={{ color: '#17302d', fontWeight: 600, fontSize: 15, textDecoration: 'none', flex: 1 }}>{u.title}</Link>
                <button className="mini-btn" onClick={() => startEditUnit(u)} title="Sửa">✎</button>
                <button className="mini-btn" onClick={() => moveUnit(u, -1)} disabled={idx === 0} title="Lên">↑</button>
                <button className="mini-btn" onClick={() => moveUnit(u, 1)} disabled={idx === units.length - 1} title="Xuống">↓</button>
                <button className="mini-btn danger" onClick={() => deleteUnit(u.id)} title="Xóa">🗑</button>
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={addUnit} className="add-form">
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Tên chủ đề mới (vd: Gia đình)" />
        <button type="submit" className="add-btn">＋ Thêm chủ đề</button>
      </form>
    </div>
  );
}
