'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function TakeAssignment() {
  const { id } = useParams();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({}); // { questionId: choiceId }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_assignment_for_taking', {
        p_assignment_id: id,
      });
      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }
      setRows(data || []);
      setLoading(false);
    }
    load();
  }, [id]);

  // Gom cac dong tra ve tu RPC (moi dong la 1 cap cau hoi - dap an) thanh
  // danh sach cau hoi, moi cau hoi co mang choices ben trong.
  const questions = Object.values(
    rows.reduce((acc, r) => {
      if (!acc[r.question_id]) {
        acc[r.question_id] = { id: r.question_id, content: r.content, choices: [] };
      }
      acc[r.question_id].choices.push({ id: r.choice_id, content: r.choice_content });
      return acc;
    }, {})
  );

  function choose(questionId, choiceId) {
    setSelected({ ...selected, [questionId]: choiceId });
  }

  async function handleSubmit() {
    setSubmitting(true);
    const answers = Object.entries(selected).map(([question_id, choice_id]) => ({
      question_id,
      choice_id,
    }));

    const { data: score, error } = await supabase.rpc('submit_assignment', {
      p_assignment_id: id,
      p_answers: answers,
    });

    setSubmitting(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(`Đã nộp bài! Điểm: ${score}/10`);
    router.push('/student');
  }

  if (loading) {
    return <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>Đang tải đề bài…</div>;
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <h2>Làm bài</h2>
      {questions.length === 0 && <p>Không tìm thấy đề bài, hoặc bạn không có quyền làm bài này.</p>}
      {questions.map((q, i) => (
        <div key={q.id} style={{ background: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 }}>
          <p><b>Câu {i + 1}:</b> {q.content}</p>
          {q.choices.map((c) => (
            <label key={c.id} style={{ display: 'block', marginBottom: 6 }}>
              <input
                type="radio"
                name={q.id}
                checked={selected[q.id] === c.id}
                onChange={() => choose(q.id, c.id)}
              />{' '}
              {c.content}
            </label>
          ))}
        </div>
      ))}
      {questions.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ padding: 10, background: '#225DA3', color: '#fff', border: 'none', borderRadius: 8 }}
        >
          {submitting ? 'Đang nộp…' : 'Nộp bài'}
        </button>
      )}
    </div>
  );
}
