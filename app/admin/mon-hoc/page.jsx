'use client';
// Đặt tại: app/admin/mon-hoc/page.jsx
// SỬA: thao tác trên bảng "teacher_assignments" đã có sẵn trong dự án
// (không phải "subject_teachers" mình tự đặt nhầm lúc trước) — bảng này
// đã đang được dùng thật để quyết định môn nào hiện ở "Môn học của bạn"
// bên app/teacher/page.jsx. NẾU dự án đã có sẵn 1 trang admin khác để
// phân công môn học rồi thì có thể bỏ qua file này, không cần dùng.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGuard } from '@/lib/useGuard';
import { supabase } from '@/lib/supabaseClient';

const backLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};

export default function SubjectTeacherAssignPage() {
  const { profile, ready } = useGuard('admin');
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [pickTeacherId, setPickTeacherId] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { if (ready) loadBase(); }, [ready]);
  useEffect(() => { if (subjectId) loadAssigned(); }, [subjectId]);

  async function loadBase() {
    setLoading(true);
    // Cột tên môn học trong bảng "subjects" ở đây giả định là "name" —
    // đổi thành "title" nếu bảng thật dùng tên cột khác.
    const [{ data: subs }, { data: profs }] = await Promise.all([
      supabase.from('subjects').select('id, name').order('name'),
      supabase.from('profiles').select('id, full_name').eq('role', 'teacher').order('full_name'),
    ]);
    setSubjects(subs || []);
    setTeachers(profs || []);
    const music = (subs || []).find((s) => s.name === 'Âm nhạc');
    setSubjectId(music?.id || subs?.[0]?.id || '');
    setLoading(false);
  }

  async function loadAssigned() {
    const { data } = await supabase
      .from('teacher_assignments')
      .select('id, teacher_id, assigned_at, profiles(full_name)')
      .eq('subject_id', subjectId)
      .order('assigned_at', { ascending: false });
    setAssigned(data || []);
  }

  async function addAssignment(e) {
    e.preventDefault();
    if (!pickTeacherId) return;
    setErrorMsg('');
    const { error } = await supabase.from('teacher_assignments').insert({
      subject_id: subjectId, teacher_id: pickTeacherId, assigned_by: profile.id,
    });
    if (error) { setErrorMsg(error.code === '23505' ? 'Giáo viên này đã được phân công môn này rồi.' : error.message); return; }
    setPickTeacherId('');
    loadAssigned();
  }

  async function removeAssignment(id) {
    if (!confirm('Bỏ phân công giáo viên này khỏi môn học?')) return;
    await supabase.from('teacher_assignments').delete().eq('id', id);
    loadAssigned();
  }

  const assignedIds = new Set(assigned.map((a) => a.teacher_id));
  const availableTeachers = teachers.filter((t) => !assignedIds.has(t.id));

  if (!ready || loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 640px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        h1 { font-size: 22px; color: #17302d; margin: 14px 0 4px; }
        .sub-note { color: #6b7f7a; font-size: 13.5px; margin: 0 0 22px; }
        .card { background: #fff; border-radius: 18px; padding: 22px; margin-bottom: 18px; border: 1px solid #e5eeec; box-shadow: 0 2px 8px rgba(23,48,45,0.04); }
        label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
        select { width: 100%; padding: 11px 13px; border-radius: 11px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .assign-row { display: flex; gap: 8px; margin-top: 14px; }
        .assign-row select { flex: 1; }
        .assign-btn { background: #225da3; color: #fff; border: none; border-radius: 11px; padding: 0 20px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .assign-btn:disabled { background: #9ca3af; cursor: not-allowed; }
        .teacher-list { display: grid; gap: 8px; margin-top: 4px; }
        .teacher-row { display: flex; justify-content: space-between; align-items: center; background: #f8fafb; border: 1px solid #eef1f0; border-radius: 12px; padding: 10px 14px; }
        .remove-btn { border: none; background: transparent; color: #a3374a; font-weight: 600; font-size: 13px; cursor: pointer; }
        .empty { text-align: center; color: #9ca3af; padding: 16px; font-size: 13.5px; }
        .error { color: #a3374a; font-size: 13.5px; background: #fdeef0; padding: 10px 14px; border-radius: 10px; margin-top: 12px; }
      `}</style>

      <Link href="/admin" style={backLinkStyle}>← Trang quản trị</Link>
      <h1>Phân công giáo viên theo môn học</h1>
      <p className="sub-note">Chỉ giáo viên được phân công ở đây mới thấy mục soạn bài của môn tương ứng bên trang giáo viên.</p>

      <div className="card">
        <label>Môn học</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div className="assign-row">
          <select value={pickTeacherId} onChange={(e) => setPickTeacherId(e.target.value)}>
            <option value="">-- Chọn giáo viên --</option>
            {availableTeachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <button className="assign-btn" onClick={addAssignment} disabled={!pickTeacherId}>+ Phân công</button>
        </div>
        {errorMsg && <div className="error">{errorMsg}</div>}
      </div>

      <div className="card">
        <label>Giáo viên đang được phân công ({assigned.length})</label>
        {assigned.length === 0 ? (
          <div className="empty">Chưa có giáo viên nào được phân công môn này.</div>
        ) : (
          <div className="teacher-list">
            {assigned.map((a) => (
              <div key={a.id} className="teacher-row">
                <span>{a.profiles?.full_name || '—'}</span>
                <button className="remove-btn" onClick={() => removeAssignment(a.id)}>Bỏ phân công</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
