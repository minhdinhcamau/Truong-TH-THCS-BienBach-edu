'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { finishLessonAttempt } from '@/lib/englishXp';

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildQuestions(vocabItems) {
  return vocabItems.map((item) => {
    const distractors = shuffle(vocabItems.filter((v) => v.id !== item.id)).slice(0, 2).map((v) => v.meaning);
    const options = shuffle([item.meaning, ...distractors]);
    return {
      vocabId: item.id,
      word: item.word,
      phonetic: item.phonetic,
      correctAnswer: item.meaning,
      options,
    };
  });
}

// ---- Phát âm bằng giọng đọc trình duyệt (Web Speech API), không cần file audio ----
function speak(text, lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

// ---- Âm thanh đúng/sai, tự tạo bằng Web Audio API, không cần file mp3 ----
function playTone(freqs, type = 'sine', duration = 0.14) {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime + i * duration);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i + 1) * duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + i * duration);
    osc.stop(ctx.currentTime + (i + 1) * duration);
  });
  setTimeout(() => ctx.close(), (freqs.length + 1) * duration * 1000);
}
const playCorrectSound = () => playTone([523.25, 659.25, 783.99], 'sine');
const playWrongSound = () => playTone([196, 146.83], 'sawtooth', 0.18);

function SpeakerIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
function HeartIcon({ filled }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? '#FF4B4B' : 'none'} stroke={filled ? '#FF4B4B' : '#D1D5DB'} strokeWidth="2">
      <path d="M12 21s-7.2-4.6-9.7-9.1C.6 8.7 1.8 5 5.4 4.1c2-.5 3.9.3 5.1 2 .3.4.9.4 1.2 0 1.2-1.7 3.1-2.5 5.1-2 3.6.9 4.8 4.6 3.1 7.8C19.2 16.4 12 21 12 21z" />
    </svg>
  );
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
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [result, setResult] = useState(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [heartPulse, setHeartPulse] = useState(false);

  useEffect(() => { load(); }, [lessonId]);

  async function load() {
    setLoading(true);
    const { data: l } = await supabase
      .from('eng_lessons')
      .select('*, eng_units(id, order_index, course_id)')
      .eq('id', lessonId)
      .single();
    setLesson(l);
    setHearts(l.max_hearts);

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

  // Tự động phát âm khi hiện từ mới
  useEffect(() => {
    if (current) {
      const t = setTimeout(() => speak(current.word, 'en-US'), 350);
      return () => clearTimeout(t);
    }
  }, [step, current]);

  function handleSelect(option) {
    if (checked) return;
    setSelected(option);
    speak(option, 'vi-VN');
  }

  function handleCheck() {
    if (!selected || checked) return;
    const correct = selected === current.correctAnswer;
    setIsCorrect(correct);
    setChecked(true);

    if (correct) {
      playCorrectSound();
    } else {
      playWrongSound();
      setHeartPulse(true);
      setTimeout(() => setHeartPulse(false), 500);
    }

    const log = {
      exercise_type: 'meaning_choice',
      question_content: current.word,
      correct_answer: current.correctAnswer,
      student_answer: selected,
      is_correct: correct,
      time_taken_seconds: Math.round((Date.now() - startTime) / 1000),
    };
    setAnswerLogs((prev) => [...prev, log]);
    setHearts((h) => (correct ? h : h - 1));
  }

  async function handleContinue() {
    const heartsLeft = isCorrect ? hearts : hearts;
    const logs = answerLogs;
    setSelected(null);
    setChecked(false);
    setStartTime(Date.now());

    if (heartsLeft <= 0) {
      await submitResult(logs, heartsLeft);
      return;
    }
    if (step + 1 >= questions.length) {
      await submitResult(logs, heartsLeft);
      return;
    }
    setStep((s) => s + 1);
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

  if (loading) return <div style={styles.center}>Đang tải...</div>;

  if (result) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, textAlign: 'center', animation: 'popIn 0.4s ease' }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>{result.completed ? '🎉' : '💪'}</div>
          <h1 style={{ margin: '0 0 8px', color: result.completed ? '#58A700' : '#3C3C3C' }}>
            {result.completed ? 'Hoàn thành bài học!' : 'Chưa đạt, cố lên nào!'}
          </h1>
          <p style={{ fontSize: 18, color: '#6b7280', margin: '4px 0' }}>Điểm: <b>{result.score}%</b></p>
          <p style={{ fontSize: 18, color: '#F5A623', margin: '4px 0', fontWeight: 700 }}>⭐ +{result.xpEarned} KN</p>
          <button style={styles.primaryBtn} onClick={() => router.push('/student/english')}>
            Về lộ trình học
          </button>
        </div>
      </div>
    );
  }

  if (hearts <= 0 && !checked) return null;
  if (!current) return null;

  const progressPct = Math.round((step / questions.length) * 100);

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes popIn { 0% { opacity:0; transform: scale(0.85) translateY(8px);} 100% { opacity:1; transform: scale(1) translateY(0);} }
        @keyframes shake { 0%,100%{transform:translateX(0);} 20%{transform:translateX(-6px);} 40%{transform:translateX(6px);} 60%{transform:translateX(-4px);} 80%{transform:translateX(4px);} }
        @keyframes heartPop { 0%{transform:scale(1);} 50%{transform:scale(1.4);} 100%{transform:scale(1);} }
        @keyframes slideUp { from{transform:translateY(100%);} to{transform:translateY(0);} }
        .word-enter { animation: popIn 0.35s ease; }
        .shake { animation: shake 0.4s ease; }
        .heart-pulse { animation: heartPop 0.4s ease; }
        .opt-btn { transition: all 0.15s ease; }
        .opt-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 0 #d1d5db; }
      `}</style>

      <div style={styles.topBar}>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 12 }} className={heartPulse ? 'heart-pulse' : ''}>
          {Array.from({ length: lesson.max_hearts }).map((_, i) => (
            <HeartIcon key={i} filled={i < hearts} />
          ))}
        </div>
      </div>

      <div style={styles.card} key={step} className={checked && !isCorrect ? 'word-enter shake' : 'word-enter'}>
        <div style={styles.wordRow}>
          <button onClick={() => speak(current.word, 'en-US')} style={styles.speakerBtn} aria-label="Nghe phát âm">
            <SpeakerIcon />
          </button>
          <div>
            <div style={styles.word}>{current.word}</div>
            {current.phonetic && <div style={styles.phonetic}>{current.phonetic}</div>}
          </div>
        </div>
        <p style={styles.prompt}>Chọn nghĩa đúng</p>

        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          {current.options.map((opt) => {
            let optStyle = { ...styles.option };
            if (checked) {
              if (opt === current.correctAnswer) optStyle = { ...optStyle, ...styles.optionCorrect };
              else if (opt === selected) optStyle = { ...optStyle, ...styles.optionWrong };
              else optStyle = { ...optStyle, opacity: 0.5 };
            } else if (selected === opt) {
              optStyle = { ...optStyle, ...styles.optionSelected };
            }
            return (
              <button key={opt} className="opt-btn" onClick={() => handleSelect(opt)} disabled={checked} style={optStyle}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {!checked ? (
        <button
          onClick={handleCheck}
          disabled={!selected}
          style={{ ...styles.checkBtn, ...(selected ? {} : styles.checkBtnDisabled) }}
        >
          KIỂM TRA
        </button>
      ) : (
        <div style={{ ...styles.feedbackBar, background: isCorrect ? '#D7FFB8' : '#FFDFE0', animation: 'slideUp 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 640, margin: '0 auto', padding: '14px 20px' }}>
            <span style={{ fontSize: 28 }}>{isCorrect ? '✅' : '❌'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: isCorrect ? '#58A700' : '#EA2B2B', fontSize: 17 }}>
                {isCorrect ? 'Chính xác!' : 'Chưa đúng!'}
              </div>
              {!isCorrect && (
                <div style={{ fontSize: 14, color: '#6b7280' }}>Đáp án đúng: <b>{current.correctAnswer}</b></div>
              )}
            </div>
            <button
              onClick={handleContinue}
              style={{ ...styles.primaryBtn, background: isCorrect ? '#58CC02' : '#EA2B2B', margin: 0 }}
            >
              TIẾP TỤC
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '70vh',
    background: 'linear-gradient(180deg,#F0F9FF 0%,#EFF5F3 100%)',
    padding: '24px 16px 100px',
    maxWidth: 640,
    margin: '0 auto',
    position: 'relative',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  center: { padding: 40, textAlign: 'center', color: '#6b7280' },
  topBar: { display: 'flex', alignItems: 'center', marginBottom: 28 },
  progressTrack: { flex: 1, height: 14, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#58CC02', borderRadius: 999, transition: 'width 0.4s ease' },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '32px 24px',
    boxShadow: '0 4px 16px rgba(23,48,45,0.06)',
  },
  wordRow: { display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' },
  speakerBtn: {
    width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#E0F2FE',
    color: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  },
  word: { fontSize: 34, fontWeight: 800, color: '#17302D', textAlign: 'center' },
  phonetic: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 2 },
  prompt: { textAlign: 'center', color: '#6b7280', marginTop: 12, fontSize: 15 },
  option: {
    padding: '16px 20px', borderRadius: 14, border: '2px solid #E5E7EB', background: '#fff',
    fontSize: 17, fontWeight: 600, cursor: 'pointer', textAlign: 'left', color: '#17302D',
  },
  optionSelected: { border: '2px solid #1CB0F6', background: '#DDF4FF', color: '#1CB0F6' },
  optionCorrect: { border: '2px solid #58CC02', background: '#D7FFB8', color: '#58A700' },
  optionWrong: { border: '2px solid #FF4B4B', background: '#FFDFE0', color: '#EA2B2B' },
  checkBtn: {
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 48px)', maxWidth: 592,
    background: '#58CC02', color: '#fff', border: 'none', borderRadius: 16, padding: '16px', fontSize: 17, fontWeight: 800,
    letterSpacing: 0.5, cursor: 'pointer', boxShadow: '0 4px 0 #58A700',
  },
  checkBtnDisabled: { background: '#E5E7EB', color: '#9CA3AF', boxShadow: '0 4px 0 #D1D5DB', cursor: 'not-allowed' },
  feedbackBar: { position: 'fixed', left: 0, right: 0, bottom: 0 },
  primaryBtn: {
    background: '#58CC02', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 24px', fontSize: 16,
    fontWeight: 800, cursor: 'pointer', marginTop: 16, boxShadow: '0 4px 0 #58A700',
  },
};
