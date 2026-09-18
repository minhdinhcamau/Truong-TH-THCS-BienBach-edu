'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ENGLISH_SUBJECT_ID } from '@/lib/englishXp';

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    const { data: { user } } = await supabase.auth.getUser();

    // Lấy đúng các lớp mà giáo viên này ĐANG DẠY MÔN TIẾNG ANH, theo bảng
    // phân công giảng dạy (teacher_assignments) — không dùng classes.teacher_id
    // vì cột đó là giáo viên CHỦ NHIỆM, không phải giáo viên bộ môn.
    const { data } = await supabase
      .from('teacher_assignments')
      .select('school_year, classes(id, name, grade)')
      .eq('teacher_id', user.id)
      .eq('subject_id', ENGLISH_SUBJECT_ID);

    // Có thể 1 lớp xuất hiện nhiều năm học khác nhau -> lọc trùng theo class id
    const uniqueMap = new Map();
    (data || []).forEach((row) => {
      if (row.classes) uniqueMap.set(row.classes.id, row.classes);
    });
    const uniqueClasses = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    setClasses(uniqueClasses);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('eng_courses')
      .insert({ title, description, class_id: classId || null, created_by: user.id })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.push(`/teacher/english/courses/${data.id}`);
  }

  return (
    <div style={{ padding: 24, maxWidth: 500, margin: '0 auto' }}>
      <h1>Tạo khóa học Tiếng Anh</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <label>
          Tên khóa học
          <input value={title} onChange={(e) => setTitle(e.target.value)} required style={input}
                 placeholder="Ví dụ: Tiếng Anh lớp 6" />
        </label>
        <label>
          Mô tả (tùy chọn)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={input} />
        </label>
        <label>
          Gán cho lớp
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={input}>
            <option value="">-- Chưa gán lớp --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.grade ? ` (Khối ${c.grade})` : ''}
              </option>
            ))}
          </select>
          {classes.length === 0 && (
            <span style={{ fontSize: 12, color: '#999' }}>
              Bạn chưa được phân công dạy môn Tiếng Anh ở lớp nào (kiểm tra mục
              "Phân công giảng dạy" trong trang Admin).
            </span>
          )}
        </label>
        {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
        <button type="submit" disabled={saving} style={btnPrimary}>
          {saving ? 'Đang lưu...' : 'Tạo khóa học'}
        </button>
      </form>
    </div>
  );
}

const input = { display: 'block', width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #d1d5db' };
const btnPrimary = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 6, padding: '10px 16px', cursor: 'pointer' };
