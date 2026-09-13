'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

export default function StudentDashboard() {
  const [assignments, setAssignments] = useState([]);
  const [doneIds, setDoneIds] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();

      const { data: list } = await supabase
        .from('assignments')
        .select('id, title, due_date, subjects(name)')
        .order('created_at', { ascending: false });
      setAssignments(list || []);

      const { data: subs } = await supabase
        .from('submissions')
        .select('assignment_id, score')
        .eq('student_id', session.user.id);
      setDoneIds(subs || []);
    }
    load();
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <h2>Bài tập của tôi</h2>
      {assignments.map(a => {
        const done = doneIds.find(s => s.assignment_id === a.id);
        return (
          <div key={a.id} style={{ background: '#fff', borderRadius: 12, padding: 16, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b>{a.title}</b>
              <div style={{ color: '#527169', fontSize: 14 }}>{a.subjects?.name}</div>
            </div>
            {done ? (
              <span style={{ color: '#225DA3', fontWeight: 600 }}>Đã làm — {done.score}/10</span>
            ) : (
              <Link href={`/student/assignments/${a.id}`}>
                <button style={{ padding: '8px 16px', background: '#225DA3', color: '#fff', border: 'none', borderRadius: 8 }}>
                  Vào làm bài
                </button>
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
