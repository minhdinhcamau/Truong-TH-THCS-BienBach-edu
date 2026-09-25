'use client';
// Đặt tại: app/student/music/lessons/[lessonId]/page.jsx
//
// MVP mục 6.2 trong spec: chỉ làm 2 dạng bài đơn giản nhất, dùng chung 1
// bàn phím trả lời — "nhấn đúng phím đàn theo tên nốt" và "nghe âm thanh
// rồi chọn đúng nốt". Khung tim / vòng ôn lại câu sai / gọi hàm cộng XP
// cuối bài mượn nguyên cấu trúc từ app/student/english/.../page.jsx
// (LessonPlayPage) để 2 môn thống nhất 1 kiểu trải nghiệm.
//
// npm install tone   (nếu repo chưa có)

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { finishMusicLessonAttempt } from '@/lib/musicXp';
import { KEYBOARD_PITCHES, pitchToVietnamese, pitchOctave, durationToToneKey } from '@/lib/musicNotes';

function shuffleTypeFor(i) {
  const types = ['press_key', 'listen_choice'];
  return types[i % 2 === 0 ? 0 : Math.floor(Math.random() * 2)];
}

function buildQuestionQueue(notes) {
  // Giữ đúng thứ tự nốt trong bài (khác với Tiếng Anh xáo trộn từ vựng) vì
  // đây là 1 đoạn nhạc có trình tự — học sinh đang học chính bài nhạc đó.
  return notes.map((n, i) => ({ type: shuffleTypeFor(i), pitch: n.pitch, step: i }));
}

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

export default function MusicLessonPlayPage() {
  const { lessonId } = useParams();
  const router = useRouter();
  const synthRef = useRef(null);

  const [lesson, setLesson] = useState(null);
  const [nextLessonId, setNextLessonId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);

  const [step, setStep] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [heartPulse, setHeartPulse] = useState(false);
  const [answerLogs, setAnswerLogs] = useState([]);
  const [startTime, setStartTime] = useState(Date.now());
  const [reviewMode, setReviewMode] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [result, setResult] = useState(null);

  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => { load(); }, [lessonId]);

  async function load() {
    setLoading(true);
    const { data: l } = await supabase
      .from('music_lessons')
      .select('*, music_units(id, order_index)')
      .eq('id', lessonId)
      .single();
    setLesson(l);
    setHearts(l?.max_hearts ?? 5);

    const { data: siblings } = await supabase
      .from('music_lessons')
      .select('id, order_index')
      .eq('unit_id', l.music_units.id)
      .order('order_index', { ascending: true });
    const idx = siblings.findIndex((s) => s.id === lessonId);
    setNextLessonId(siblings[idx + 1]?.id || null);

    setQuestions(buildQuestionQueue(l?.notes || []));
    setLoading(false);
  }

  async function ensureSynth() {
    if (!synthRef.current) {
      const Tone = await import('tone');
      await Tone.start();
      synthRef.current = { Tone, synth: new Tone.Synth().toDestination() };
    }
    return synthRef.current;
  }

  async function playPitch(pitch, duration = 'quarter') {
    const { Tone, synth } = await ensureSynth();
    synth.triggerAttackRelease(pitch, durationToToneKey(duration), Tone.now());
  }

  function playCorrectSound() { playPitch('C5', 'sixteenth'); setTimeout(() => playPitch('E5', 'sixteenth'), 90); }
  function playWrongSound() { playPitch('A3', 'eighth'); }

  const current = questions[step];

  useEffect(() => {
    if (!started || !current) return;
    setSelected(null);
    setChecked(false);
    setIsCorrect(false);
    setStartTime(Date.now());
    if (current.type === 'listen_choice') {
      const t = setTimeout(() => playPitch(current.pitch, 'quarter'), 350);
      return () => clearTimeout(t);
    }
  }, [step, current, started]);

  async function handleStart() {
    await ensureSynth();
    setStarted(true);
  }

  function pickKey(pitch) {
    if (checked) return;
    setSelected(pitch);
    playPitch(pitch, 'quarter');
  }

  function handleCheck() {
    if (checked || !selected) return;
    const correct = selected === current.pitch;
    setIsCorrect(correct);
    setChecked(true);
    setAnswerLogs((prev) => [...prev, {
      exercise_type: current.type,
      question_content: current.pitch,
      correct_answer: current.pitch,
      student_answer: selected,
      is_correct: correct,
      time_taken_seconds: Math.round((Date.now() - startTime) / 1000),
    }]);
    if (correct) {
      playCorrectSound();
    } else {
      playWrongSound();
      setHeartPulse(true);
      setTimeout(() => setHeartPulse(false), 500);
      if (!reviewMode) setWrongQuestions((prev) => [...prev, current]);
    }
    setHearts((h) => (correct ? h : h - 1));
  }

  async function handleContinue() {
    const logs = answerLogs;
    if (hearts <= 0) { await submitResult(logs, hearts); return; }

    if (step + 1 >= questions.length) {
      if (!reviewMode && wrongQuestions.length > 0) {
        setQuestions(wrongQuestions);
        setWrongQuestions([]);
        setReviewMode(true);
        setStep(0);
        return;
      }
      await submitResult(logs, hearts);
      return;
    }
    setStep((s) => s + 1);
  }

  async function submitResult(logs, heartsLeft) {
    const lastByKey = new Map();
    logs.forEach((l) => lastByKey.set(`${l.exercise_type}|${l.question_content}`, l));
    const finalLogs = Array.from(lastByKey.values());
    const correctCount = finalLogs.filter((a) => a.is_correct).length;
    const score = finalLogs.length > 0 ? Math.round((correctCount / finalLogs.length) * 100) : 0;

    const { data: { user } } = await supabase.auth.getUser();
    const { xpEarned, completed } = await finishMusicLessonAttempt({
      studentId: user.id, lesson, nextLessonId, score, heartsLeft, answerLogs: logs,
    });
    setResult({ score, xpEarned, completed });
  }

  if (loading) return <div style={styles.center}>Đang tải...</div>;

  if (!started) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🎵</div>
          <h1 style={{ margin: '0 0 8px', color: '#17302d' }}>{lesson.title}</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 20px' }}>{questions.length} nốt · {lesson.max_hearts} tim · cần đạt {lesson.pass_score}%</p>
          <button style={styles.primaryBtn} onClick={handleStart}>▶ Bắt đầu</button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>{result.completed ? '🎉' : '💪'}</div>
          <h1 style={{ margin: '0 0 8px', color: result.completed ? '#58A700' : '#3C3C3C' }}>
            {result.completed ? 'Hoàn thành bài học!' : 'Chưa đạt, cố lên nào!'}
          </h1>
          <p style={{ fontSize: 18, color: '#6b7280', margin: '4px 0' }}>Điểm: <b>{result.score}%</b></p>
          <p style={{ fontSize: 18, color: '#F5A623', margin: '4px 0', fontWeight: 700 }}>⭐ +{result.xpEarned} KN</p>
          <button style={styles.primaryBtn} onClick={() => router.push('/student/music')}>Về lộ trình học</button>
        </div>
      </div>
    );
  }

  if (hearts <= 0 && !checked) return null;
  if (!current) return null;

  const progressPct = Math.round((step / questions.length) * 100);

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.hearts}>
          {Array.from({ length: lesson.max_hearts }).map((_, i) => (
            <span key={i} style={heartPulse && i === hearts ? { animation: 'pulse 0.4s' } : undefined}>
              <HeartIcon filled={i < hearts} />
            </span>
          ))}
        </div>
        <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${progressPct}%` }} /></div>
      </div>

      {reviewMode && <div style={styles.reviewBanner}>🔁 Đang ôn lại những nốt bấm sai</div>}

      {current.type === 'press_key' && (
        <div style={styles.card} key={step}>
          <p style={styles.prompt}>Hãy bấm đúng phím:</p>
          <div style={styles.bigNote}>{pitchToVietnamese(current.pitch)}{pitchOctave(current.pitch)}</div>
        </div>
      )}

      {current.type === 'listen_choice' && (
        <div style={styles.card} key={step}>
          <p style={styles.prompt}>Nghe rồi bấm đúng phím em vừa nghe</p>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button onClick={() => playPitch(current.pitch, 'quarter')} style={styles.speakerBtn} aria-label="Nghe lại"><SpeakerIcon /></button>
          </div>
        </div>
      )}

      <div style={styles.keyboard}>
        {KEYBOARD_PITCHES.map((p) => {
          const isSel = selected === p;
          const showCorrect = checked && p === current.pitch;
          const showWrong = checked && isSel && !isCorrect;
          return (
            <button key={p} onClick={() => pickKey(p)} disabled={checked} style={{
              ...styles.key,
              borderColor: showCorrect ? '#58CC02' : showWrong ? '#FF4B4B' : isSel ? '#1CB0F6' : '#dbe7f3',
              background: showCorrect ? '#D7FFB8' : showWrong ? '#FFDFE0' : isSel ? '#DDF4FF' : '#fff',
            }}>
              <span style={styles.keyName}>{pitchToVietnamese(p)}</span>
              <span style={styles.keyOct}>{pitchOctave(p)}</span>
            </button>
          );
        })}
      </div>

      {!checked && (
        <button onClick={handleCheck} disabled={!selected} style={{ ...styles.checkBtn, ...(!selected ? styles.checkBtnDisabled : {}) }}>
          KIỂM TRA
        </button>
      )}

      {checked && (
        <div style={{ ...styles.feedbackBar, background: isCorrect ? '#D7FFB8' : '#FFDFE0' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>{isCorrect ? '✅' : '❌'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: isCorrect ? '#58A700' : '#EA2B2B', fontSize: 17 }}>
                {isCorrect ? 'Chính xác!' : 'Chưa đúng!'}
              </div>
              {!isCorrect && (
                <div style={{ fontSize: 13.5, color: '#6b7280', marginTop: 2 }}>
                  Nốt đúng: <b>{pitchToVietnamese(current.pitch)}{pitchOctave(current.pitch)}</b>
                </div>
              )}
            </div>
            <button onClick={handleContinue} style={{ ...styles.primaryBtn, background: isCorrect ? '#58CC02' : '#EA2B2B', margin: 0 }}>TIẾP TỤC</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '70vh', background: 'linear-gradient(180deg,#F0F9FF 0%,#EFF5F3 100%)', padding: '24px 16px 100px', maxWidth: 640, margin: '0 auto', fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" },
  center: { padding: 40, textAlign: 'center', color: '#6b7280' },
  topBar: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 },
  hearts: { display: 'flex', gap: 4 },
  progressTrack: { flex: 1, height: 14, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#58CC02', borderRadius: 999, transition: 'width 0.4s ease' },
  reviewBanner: { background: '#FEF3E2', color: '#b45309', fontWeight: 600, fontSize: 13.5, textAlign: 'center', padding: '10px 16px', borderRadius: 12, marginBottom: 16 },
  card: { background: '#fff', borderRadius: 20, padding: '32px 24px', boxShadow: '0 4px 16px rgba(23,48,45,0.06)', marginBottom: 20 },
  prompt: { textAlign: 'center', color: '#6b7280', fontSize: 15, margin: '0 0 14px' },
  bigNote: { fontSize: 40, fontWeight: 800, color: '#17302d', textAlign: 'center' },
  speakerBtn: { width: 64, height: 64, borderRadius: '50%', border: 'none', background: '#E0F2FE', color: '#0EA5E9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  keyboard: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  key: { width: 52, height: 72, borderRadius: 10, border: '2px solid #dbe7f3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10, gap: 2, cursor: 'pointer' },
  keyName: { fontWeight: 700, fontSize: 12.5, color: '#17302d' },
  keyOct: { fontSize: 10, color: '#9ca3af' },
  checkBtn: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 48px)', maxWidth: 592, background: '#58CC02', color: '#fff', border: 'none', borderRadius: 16, padding: 16, fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 0 #58A700' },
  checkBtnDisabled: { background: '#E5E7EB', color: '#9CA3AF', boxShadow: '0 4px 0 #D1D5DB', cursor: 'not-allowed' },
  feedbackBar: { position: 'fixed', left: 0, right: 0, bottom: 0 },
  primaryBtn: { background: '#58CC02', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 16, boxShadow: '0 4px 0 #58A700' },
};
