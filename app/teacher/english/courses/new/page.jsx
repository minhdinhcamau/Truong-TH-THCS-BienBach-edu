'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

  useEffect(() => { loadClasses(); }, []);

  async function loadClasses() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('teacher_assignments')
      .select('classes(id, name, grade)')
      .eq('teacher_id', user.id)
      .eq('subject_id', ENGLISH_SUBJECT_ID);
    const uniqueMap = new Map();
    (data || []).forEach((row) => { if (row.classes) uniqueMap.set(row.classes.id, row.classes); });
    setClasses(Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
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
    if (error) { setErrorMsg(error.message); return; }
    router.push(`/teacher/english/courses/${data.id}`);
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 520px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .back-link { color: #225da3; font-weight: 600; font-size: 13.5px; text-decoration: none; }
        .card { background: #fff; border-radius: 20px; padding: 28px; margin-top: 16px; box-shadow: 0 2px 10px rgba(23,48,45,0.05); border: 1px solid #e5eeec; }
        .card h1 { margin: 0 0 4px; font-size: 22px; color: #17302d; }
        .card .sub { color: #6b7f7a; font-size: 13.5px; margin: 0 0 22px; }
        label { display: block; font-size: 13.5px; font-weight: 600; color: #374151; margin-bottom: 6px; margin-top: 16px; }
        label:first-of-type { margin-top: 0; }
        input, textarea, select {
          width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-size: 14.5px;
          font-family: inherit; box-sizing: border-box; transition: border-color 0.15s;
        }
        input:focus, textarea:focus, select:focus { outline: none; border-color: #225da3; }
        .hint { font-size: 12px; color: #9ca3af; margin-top: 6px; }
        .error { color: #a3374a; font-size: 13.5px; background: #fdeef0; padding: 10px 14px; border-radius: 10px; margin-top: 16px; }
        .submit-btn { width: 100%; margin-top: 22px; padding: 13px; background: #225da3; color: #fff; border: none;
          border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 3px 0 #184270; }
        .submit-btn:disabled { background: #9ca3af; box-shadow: none; cursor: not-allowed; }
      `}</style>

      <Link href="/teacher/english" className="back-link" style={{ color: '#225da3', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>← Lộ trình Tiếng Anh</Link>

      <div className="card">
        <h1>Tạo khóa học mới</h1>
        <p className="sub">Ví dụ: một khóa học cho mỗi khối lớp bạn phụ trách.</p>

        <form onSubmit={handleSubmit}>
          <label>Tên khóa học</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ví dụ: Tiếng Anh lớp 6" />

          <label>Mô tả (tùy chọn)</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ghi chú ngắn về nội dung khóa học..." />

          <label>Gán cho lớp</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">-- Chưa gán lớp --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.grade ? ` (Khối ${c.grade})` : ''}</option>
            ))}
          </select>
          {classes.length === 0 && (
            <p className="hint">Bạn chưa được phân công dạy môn Tiếng Anh ở lớp nào — kiểm tra mục "Phân công giảng dạy" trong trang Admin.</p>
          )}

          {errorMsg && <div className="error">{errorMsg}</div>}

          <button type="submit" disabled={saving} className="submit-btn">
            {saving ? 'Đang lưu...' : 'Tạo khóa học'}
          </button>
        </form>
      </div>
    </div>
  );
}
