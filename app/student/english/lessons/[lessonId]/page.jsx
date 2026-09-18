'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { finishLessonAttempt } from '@/lib/englishXp';

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Từ danh sách từ vựng, tạo câu hỏi trắc nghiệm: cho từ tiếng Anh, chọn đúng nghĩa
function buildQuestions(vocabItems) {
  return vocabItems.map((item) => {
    const distractors = shuffle(vocabItems.filter((v) => v.id !== item.id)).slice(0, 2).map((v) => v.meaning);
    const options = shuffle([item.meaning, ...distractors]);
    return { vocabId: item.id, word: item.word, correctAnswer: item.meaning, options };
  });
}

export default function LessonPlayPage() {
  const { lessonId } = useParams();
  const router = useRouter();

  const [lesson, setLesson] = useState(null);
  const [nextLessonId, setNextLessonId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [answerLogs, setAnswerLogs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [result, setResult] = useState(null); // { score, xpEarned, completed }
  const [startTime, setStartTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [lessonId]);

  async function load() {
    setLoading(true);
    const { data: l } = await supabase
      .from('eng_lessons')
      .select('*, eng_units(id, order_index, course_id)')
      .eq('id', lessonId)
      .single();
    setLesson(l);
    setHearts(l.max_hearts);

    // Tìm bài học kế tiếp trong cùng unit
    const { data: siblingLessons } = await supabase
      .from('eng_lessons')
      .select('id, order_index')
      .eq('unit_id', l.eng_units.id)
      .order('order_index', { ascending: true });
    const idx = siblingLessons.findIndex((s) => s.id === lessonId);
    setNextLessonId(siblingLessons[idx + 1]?.id || null);

    const { data: vocab } = await supabase
      .from('eng_vocab_items')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true });

    setQuestions(shuffle(buildQuestions(vocab || [])));
    setStartTime(Date.now());
    setLoading(false);
  }

  const current = questions[step];

  async function handleAnswer(option) {
    if (selected) return; // đã trả lời câu này rồi
    const isCorrect = option === current.correctAnswer;
    setSelected(option);
    setFeedback(isCorrect ? 'correct' : 'wrong');

    const log = {
      exercise_type: 'meaning_choice',
      question_content: current.word,
      correct_answer: current.correctAnswer,
      student_answer: option,
      is_correct: isCorrect,
      time_taken_seconds: Math.round((Date.now() - startTime) / 1000),
    };
    const newLogs = [...answerLogs, log];
    setAnswerLogs(newLogs);

    const heartsLeft = isCorrect ? hearts : hearts - 1;
    setHearts(heartsLeft);

    setTimeout(async () => {
      setSelected(null);
      setFeedback(null);
      setStartTime(Date.now());

      if (heartsLeft <= 0) {
        await submitResult(newLogs, heartsLeft);
        return;
      }
      if (step + 1 >= questions.length) {
        await submitResult(newLogs, heartsLeft);
        return;
      }
      setStep(step + 1);
    }, 900);
  }

  async function submitResult(logs, heartsLeft) {
    const correctCount = logs.filter((a) => a.is_correct).length;
    const score = Math.round((correctCount / questions.length) * 100);

    const { data: { user } } = await supabase.auth.getUser();
    const { xpEarned, completed } = await finishLessonAttempt({
      studentId: user.id,
      lesson,
      nextLessonId,
      score,
      heartsLeft,
      answerLogs: logs,
    });

    setResult({ score, xpEarned, completed });
  }

  if (loading) return <p style={{ padding: 24 }}>Đang tải...</p>;

  if (result) {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h1>{result.completed ? '🎉 Hoàn thành bài học!' : '😅 Chưa đạt, thử lại nhé'}</h1>
        <p>Điểm: {result.score}%</p>
        <p>XP nhận được: +{result.xpEarned}</p>
        <button style={btnPrimary} onClick={() => router.push('/student/english')}>
          Về lộ trình học
        </button>
      </div>
    );
  }

  if (hearts <= 0) return null; // đang chuyển sang màn kết quả

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Câu {step + 1}/{questions.length}</span>
        <span>{'❤️'.repeat(hearts)}{'🖤'.repeat(lesson.max_hearts - hearts)}</span>
      </div>

      <h2 style={{ marginTop: 32, textAlign: 'center' }}>{current.word}</h2>
      <p style={{ textAlign: 'center', color: '#666' }}>Chọn nghĩa đúng</p>

      <div style={{ display: 'grid', gap: 10, marginTop: 24 }}>
        {current.options.map((opt) => {
          let bg = '#fff';
          if (selected === opt) bg = feedback === 'correct' ? '#DCFCE7' : '#FEE2E2';
          else if (feedback && opt === current.correctAnswer) bg = '#DCFCE7';
          return (
            <button key={opt} onClick={() => handleAnswer(opt)} style={{ ...optionBtn, background: bg }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const optionBtn = {
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 16,
  cursor: 'pointer',
  textAlign: 'left',
};

const btnPrimary = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 6, padding: '10px 20px', cursor: 'pointer', marginTop: 16 };
