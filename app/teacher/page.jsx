'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

export default function TeacherDashboard() {
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('assignments')
        .select('id, title, due_date, subjects(name), classes(name)')
        .order('created_at', { ascending: false });
      setAssignments(data || []);
    }
    load();
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Bài tập đã giao</h2>
        <Link href="/teacher/assignments/new">
          <button style={{ padding: '8px 16px', background: '#225DA3', color: '#fff', border: 'none', borderRadius: 8 }}>
            + Tạo bài tập mới
          </button>
        </Link>
      </div>

      {assignments.length === 0 && <p>Chưa có bài tập nào. Bấm "Tạo bài tập mới" để bắt đầu.</p>}

      {assignments.map(a => (
        <div key={a.id} style={{ background: '#fff', borderRadius: 12, padding: 16, marginTop: 12 }}>
          <b>{a.title}</b>
          <div style={{ color: '#527169', fontSize: 14 }}>
            {a.subjects?.name} · {a.classes?.name} · Hạn: {a.due_date ? new Date(a.due_date).toLocaleDateString('vi-VN') : 'không đặt hạn'}
          </div>
        </div>
      ))}
    </div>
  );
}
