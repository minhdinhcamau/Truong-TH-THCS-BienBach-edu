'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [className, setClassName] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('eng_courses')
      .insert({ title, description, class_name: className, created_by: user.id })
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
          Gán cho lớp (class_name, để trống nếu chưa gán)
          <input value={className} onChange={(e) => setClassName(e.target.value)} style={input}
                 placeholder="Ví dụ: 6A1" />
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
