'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

// Bài tập demo: 2 câu hỏi mặc định, giáo viên có thể thêm/sửa nội dung trước khi lưu
export default function NewAssignment() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [questions, setQuestions] = useState([
    { content: '', choices: [{ content: '', is_correct: true }, { content: '', is_correct: false }] },
  ]);

  function addQuestion() {
    setQuestions([...questions, { content: '', choices: [{ content: '', is_correct: true }, { content: '', is_correct: false }] }]);
  }

  function updateQuestion(qi, content) {
    const next = [...questions];
    next[qi].content = content;
    setQuestions(next);
  }

  function updateChoice(qi, ci, content) {
    const next = [...questions];
    next[qi].choices[ci].content = content;
    setQuestions(next);
  }

  function setCorrect(qi, ci) {
    const next = [...questions];
    next[qi].choices.forEach((c, idx) => (c.is_correct = idx === ci));
    setQuestions(next);
  }

  async function handleSave(e) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();

    const { data: assignment, error } = await supabase
      .from('assignments')
      .insert({ title, class_id: classId, subject_id: subjectId, teacher_id: session.user.id })
      .select()
      .single();
    if (error) return alert(error.message);

    for (const q of questions) {
      const { data: question } = await supabase
        .from('questions')
        .insert({ assignment_id: assignment.id, content: q.content })
        .select()
        .single();
      const choicesToInsert = q.choices.map(c => ({ ...c, question_id: question.id }));
      await supabase.from('choices').insert(choicesToInsert);
    }

    router.push('/teacher');
  }

  // Ghi chú: classId và subjectId ở bản demo này nhập trực tiếp UUID.
  // Ở bản hoàn thiện nên thay bằng <select> load từ bảng classes/subjects.
  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <h2>Tạo bài tập trắc nghiệm</h2>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input placeholder="Tên bài tập" value={title} onChange={e => setTitle(e.target.value)} required />
        <input placeholder="Class ID (UUID lớp — xem trong bảng classes)" value={classId} onChange={e => setClassId(e.target.value)} required />
        <input placeholder="Subject ID (UUID môn — xem trong bảng subjects)" value={subjectId} onChange={e => setSubjectId(e.target.value)} required />

        {questions.map((q, qi) => (
          <div key={qi} style={{ background: '#fff', padding: 12, borderRadius: 10 }}>
            <input
              placeholder={`Câu hỏi ${qi + 1}`}
              value={q.content}
              onChange={e => updateQuestion(qi, e.target.value)}
              style={{ width: '100%', marginBottom: 8 }}
              required
            />
            {q.choices.map((c, ci) => (
              <div key={ci} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <input type="radio" checked={c.is_correct} onChange={() => setCorrect(qi, ci)} />
                <input
                  placeholder={`Đáp án ${ci + 1}`}
                  value={c.content}
                  onChange={e => updateChoice(qi, ci, e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
              </div>
            ))}
          </div>
        ))}

        <button type="button" onClick={addQuestion}>+ Thêm câu hỏi</button>
        <button type="submit" style={{ padding: 10, background: '#225DA3', color: '#fff', border: 'none', borderRadius: 8 }}>
          Lưu bài tập
        </button>
      </form>
    </div>
  );
}
