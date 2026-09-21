'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { finishLessonAttempt } from '@/lib/englishXp';

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:"']/g, '')
    .replace(/\s+/g, ' ');
}

// ---- Xây dựng hàng đợi câu hỏi: học từ vựng trước, rồi mới ghép câu (câu ngắn, dễ) ----
function buildQuestionQueue(lesson, vocabItems) {
  const usablePerItemTypes = ['meaning_choice', 'listen_choice'];
  const wordQuestions = [];

  vocabItems.forEach((item) => {
    const type = usablePerItemTypes[Math.floor(Math.random() * usablePerItemTypes.length)];
    const otherWords = shuffle(vocabItems.filter((v) => v.id !== item.id)).slice(0, 2);

    if (type === 'meaning_choice') {
      wordQuestions.push({
        type: 'meaning_choice',
        vocabId: item.id,
        word: item.word,
        partOfSpeech: item.part_of_speech,
        phonetic: item.phonetic,
        correctAnswer: item.meaning,
        options: shuffle([item.meaning, ...otherWords.map((v) => v.meaning)]),
      });
    } else {
      wordQuestions.push({
        type: 'listen_choice',
        vocabId: item.id,
        word: item.word,
        phonetic: item.phonetic,
        correctAnswer: item.word,
        options: shuffle([item.word, ...otherWords.map((v) => v.word)]),
      });
    }
  });

  // Câu ghép (Dịch câu / Nghe rồi ghép) — CHỈ lấy câu NGẮN (≤6 từ), tránh đưa từ lạ
  // chưa học vào bài ghép, giữ độ khó vừa sức kiểu Duolingo.
  const MAX_SENTENCE_WORDS = 6;
  const sentenceQuestions = [];
  vocabItems
    .filter((item) => item.example_sentence && item.example_translation)
    .forEach((item) => {
      const enTokens = item.example_sentence.trim().split(/\s+/);
      if (enTokens.length > MAX_SENTENCE_WORDS) return;

      sentenceQuestions.push({
        type: 'translate',
        vocabId: item.id,
        prompt: item.example_translation,
        correctSentence: item.example_sentence,
        wordBank: shuffle(enTokens.map((t, i) => ({ id: `en-${item.id}-${i}`, text: t }))),
      });

      const viTokens = item.example_translation.trim().split(/\s+/);
      if (viTokens.length >= 2 && viTokens.length <= MAX_SENTENCE_WORDS) {
        sentenceQuestions.push({
          type: 'listen_translate',
          vocabId: item.id,
          audioText: item.example_sentence,
          correctSentence: item.example_translation,
          wordBank: shuffle(viTokens.map((t, i) => ({ id: `vi-${item.id}-${i}`, text: t }))),
        });
      }
    });

  const queue = [...shuffle(wordQuestions)];

  // "Ghép cặp" chèn SAU khi đã học hết từ, làm cầu nối trước khi vào phần ghép câu.
  if (vocabItems.length >= 3) {
    const picked = shuffle(vocabItems).slice(0, Math.min(6, vocabItems.length));
    queue.push({
      type: 'matching',
      pairs: picked.map((it) => ({ id: it.id, word: it.word, meaning: it.meaning })),
    });
  }

  // Câu ghép luôn ở CUỐI CÙNG — học sinh đã học hết từ vựng liên quan trước đó.
  queue.push(...shuffle(sentenceQuestions));

  return queue;
}

function speak(text, lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

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
  const [result, setResult] = useState(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [heartPulse, setHeartPulse] = useState(false);

  const [selected, setSelected] = useState(null); // meaning_choice, listen_choice
  const [wordBank, setWordBank] = useState([]); // translate, listen_translate
  const [built, setBuilt] = useState([]);
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const [matchLeft, setMatchLeft] = useState([]);
  const [matchRight, setMatchRight] = useState([]);
  const [selLeftId, setSelLeftId] = useState(null);
  const [selRightId, setSelRightId] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);
  const [matchWrongFlash, setMatchWrongFlash] = useState(null);
  const [matchDone, setMatchDone] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState([]);

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

    setQuestions(buildQuestionQueue(l, vocab || []));
    setReviewMode(false);
    setWrongQuestions([]);
    setStartTime(Date.now());
    setLoading(false);
  }

  const current = questions[step];

  useEffect(() => {
    if (!current) return;
    setSelected(null);
    setChecked(false);
    setIsCorrect(false);

    if (current.type === 'meaning_choice' || current.type === 'listen_choice') {
      const t = setTimeout(() => speak(current.word, 'en-US'), 350);
      return () => clearTimeout(t);
    }
    if (current.type === 'translate') {
      setWordBank(current.wordBank);
      setBuilt([]);
    }
    if (current.type === 'listen_translate') {
      setWordBank(current.wordBank);
      setBuilt([]);
      const t = setTimeout(() => speak(current.audioText, 'en-US'), 350);
      return () => clearTimeout(t);
    }
    if (current.type === 'matching') {
      setMatchLeft(shuffle(current.pairs.map((p) => ({ id: p.id, text: p.word }))));
      setMatchRight(shuffle(current.pairs.map((p) => ({ id: p.id, text: p.meaning }))));
      setSelLeftId(null);
      setSelRightId(null);
      setMatchedIds([]);
      setMatchWrongFlash(null);
      setMatchDone(false);
    }
  }, [step, current]);

  function logAnswer(exerciseType, question, studentAnswer, correct, correctAnswerText) {
    setAnswerLogs((prev) => [...prev, {
      exercise_type: exerciseType,
      question_content: question,
      correct_answer: correctAnswerText,
      student_answer: studentAnswer,
      is_correct: correct,
      time_taken_seconds: Math.round((Date.now() - startTime) / 1000),
    }]);
  }

  function handleCheck() {
    if (checked) return;
    let correct = false;

    if (current.type === 'meaning_choice') {
      if (!selected) return;
      correct = selected === current.correctAnswer;
      logAnswer('meaning_choice', current.word, selected, correct, current.correctAnswer);
    } else if (current.type === 'listen_choice') {
      if (!selected) return;
      correct = selected === current.correctAnswer;
      logAnswer('listen_choice', current.word, selected, correct, current.correctAnswer);
    } else if (current.type === 'translate') {
      if (wordBank.length > 0) return;
      const builtText = built.map((t) => t.text).join(' ');
      correct = normalizeText(builtText) === normalizeText(current.correctSentence);
      logAnswer('translate', current.prompt, builtText, correct, current.correctSentence);
    } else if (current.type === 'listen_translate') {
      if (wordBank.length > 0) return;
      const builtText = built.map((t) => t.text).join(' ');
      correct = normalizeText(builtText) === normalizeText(current.correctSentence);
      logAnswer('listen_translate', current.audioText, builtText, correct, current.correctSentence);
    }

    setIsCorrect(correct);
    setChecked(true);
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
    setStartTime(Date.now());

    if (hearts <= 0) { await submitResult(logs, hearts); return; }

    if (step + 1 >= questions.length) {
      if (!reviewMode && wrongQuestions.length > 0) {
        // Cho ôn lại đúng những câu đã sai, đúng 1 lần, trước khi kết thúc bài.
        setQuestions(shuffle(wrongQuestions));
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

  function handleMatchTap(side, id, text) {
    if (matchedIds.includes(id)) return;
    if (side === 'left') {
      speak(text, 'en-US');
      setSelLeftId(id);
      if (selRightId) checkMatchPair(id, selRightId);
    } else {
      setSelRightId(id);
      if (selLeftId) checkMatchPair(selLeftId, id);
    }
  }
  function checkMatchPair(leftId, rightId) {
    if (leftId === rightId) {
      const newMatched = [...matchedIds, leftId];
      setMatchedIds(newMatched);
      setSelLeftId(null);
      setSelRightId(null);
      playCorrectSound();
      if (newMatched.length === matchLeft.length) {
        logAnswer('matching', 'Ghép cặp', 'Hoàn thành', true, 'Hoàn thành');
        setMatchDone(true);
      }
    } else {
      setMatchWrongFlash({ leftId, rightId });
      playWrongSound();
      setTimeout(() => {
        setMatchWrongFlash(null);
        setSelLeftId(null);
        setSelRightId(null);
      }, 500);
    }
  }

  function tapBankWord(token) {
    setWordBank((prev) => prev.filter((t) => t.id !== token.id));
    setBuilt((prev) => [...prev, token]);
  }
  function tapBuiltWord(token) {
    setBuilt((prev) => prev.filter((t) => t.id !== token.id));
    setWordBank((prev) => [...prev, token]);
  }

  async function submitResult(logs, heartsLeft) {
    // Nếu 1 câu xuất hiện lại ở vòng ôn (đã sửa đúng/sai), chỉ tính lần trả lời CUỐI CÙNG.
    const lastByKey = new Map();
    logs.forEach((l) => lastByKey.set(`${l.exercise_type}|${l.question_content}`, l));
    const finalLogs = Array.from(lastByKey.values());

    const correctCount = finalLogs.filter((a) => a.is_correct).length;
    const score = finalLogs.length > 0 ? Math.round((correctCount / finalLogs.length) * 100) : 0;

    const { data: { user } } = await supabase.auth.getUser();
    const { xpEarned, completed } = await finishLessonAttempt({
      studentId: user.id,
      lesson,
      nextLessonId,
      score,
      heartsLeft,
      answerLogs: logs, // lưu đầy đủ mọi lượt trả lời (kể cả vòng ôn) để giáo viên xem chi tiết
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

  function pickOption(opt) {
    if (checked) return;
    setSelected(opt);
    if (current.type === 'meaning_choice') speak(opt, 'vi-VN');
    else speak(opt, 'en-US');
  }

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
        .bank-chip { transition: all 0.15s ease; }
        .bank-chip:hover { transform: translateY(-2px); }
        .match-btn { transition: all 0.15s ease; }
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

      {reviewMode && (
        <div style={styles.reviewBanner}>🔁 Ôn lại những câu đã sai — làm đúng để hoàn thành bài học</div>
      )}

      {/* ===== CHỌN NGHĨA ĐÚNG ===== */}
      {current.type === 'meaning_choice' && (
        <div style={styles.card} key={step} className={checked && !isCorrect ? 'word-enter shake' : 'word-enter'}>
          <div style={styles.wordRow}>
            <button onClick={() => speak(current.word, 'en-US')} style={styles.speakerBtn} aria-label="Nghe phát âm">
              <SpeakerIcon />
            </button>
            <div>
              <div style={styles.word}>
                {current.word}
                {current.partOfSpeech && <span style={styles.posBadge}>{current.partOfSpeech}</span>}
              </div>
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
                <button key={opt} className="opt-btn" onClick={() => pickOption(opt)} disabled={checked} style={optStyle}>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== NGHE VÀ CHỌN ĐÚNG TỪ ===== */}
      {current.type === 'listen_choice' && (
        <div style={styles.card} key={step} className={checked && !isCorrect ? 'word-enter shake' : 'word-enter'}>
          <p style={styles.prompt}>🎧 Nghe và chọn đúng từ em nghe được</p>
          <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
            <button onClick={() => speak(current.word, 'en-US')} style={{ ...styles.speakerBtn, width: 64, height: 64, margin: '0 auto' }} aria-label="Nghe phát âm">
              <SpeakerIcon size={28} />
            </button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {current.options.map((opt) => {
              let optStyle = { ...styles.option, textAlign: 'center' };
              if (checked) {
                if (opt === current.correctAnswer) optStyle = { ...optStyle, ...styles.optionCorrect };
                else if (opt === selected) optStyle = { ...optStyle, ...styles.optionWrong };
                else optStyle = { ...optStyle, opacity: 0.5 };
              } else if (selected === opt) {
                optStyle = { ...optStyle, ...styles.optionSelected };
              }
              return (
                <button key={opt} className="opt-btn" onClick={() => pickOption(opt)} disabled={checked} style={optStyle}>
                  {opt}
                </button>
              );
            })}
          </div>
          {checked && current.phonetic && (
            <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 12, fontSize: 13 }}>{current.phonetic}</p>
          )}
        </div>
      )}

      {/* ===== DỊCH CÂU (Việt -> Anh) ===== */}
      {current.type === 'translate' && (
        <div style={styles.card} key={step} className={checked && !isCorrect ? 'word-enter shake' : 'word-enter'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => speak(current.correctSentence, 'en-US')} style={styles.speakerBtn} aria-label="Nghe câu">
              <SpeakerIcon />
            </button>
            <p style={{ ...styles.prompt, margin: 0 }}>Dịch câu này sang tiếng Anh</p>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#17302D', textAlign: 'center', margin: '14px 0 20px' }}>
            {current.prompt}
          </div>
          <div style={styles.builtBox}>
            {built.length === 0 && <span style={{ color: '#9ca3af', fontSize: 14 }}>Bấm chọn từ bên dưới theo đúng thứ tự...</span>}
            {built.map((t) => (
              <button key={t.id} className="bank-chip" onClick={() => !checked && tapBuiltWord(t)} style={styles.chipBuilt} disabled={checked}>{t.text}</button>
            ))}
          </div>
          <div style={styles.bankBox}>
            {wordBank.map((t) => (
              <button key={t.id} className="bank-chip" onClick={() => tapBankWord(t)} style={styles.chipBank}>{t.text}</button>
            ))}
          </div>
          {checked && !isCorrect && (
            <p style={{ textAlign: 'center', color: '#6b7280', marginTop: 14 }}>Câu đúng: <b>{current.correctSentence}</b></p>
          )}
        </div>
      )}

      {/* ===== NGHE RỒI GHÉP CÂU DỊCH (Anh -> Việt, nghe trước) ===== */}
      {current.type === 'listen_translate' && (
        <div style={styles.card} key={step} className={checked && !isCorrect ? 'word-enter shake' : 'word-enter'}>
          <p style={styles.prompt}>🎧 Nghe câu, rồi ghép nghĩa tiếng Việt</p>
          <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
            <button onClick={() => speak(current.audioText, 'en-US')} style={{ ...styles.speakerBtn, width: 64, height: 64, margin: '0 auto' }} aria-label="Nghe câu">
              <SpeakerIcon size={28} />
            </button>
          </div>
          <div style={styles.builtBox}>
            {built.length === 0 && <span style={{ color: '#9ca3af', fontSize: 14 }}>Nghe rồi bấm chọn từ bên dưới theo đúng thứ tự...</span>}
            {built.map((t) => (
              <button key={t.id} className="bank-chip" onClick={() => !checked && tapBuiltWord(t)} style={styles.chipBuilt} disabled={checked}>{t.text}</button>
            ))}
          </div>
          <div style={styles.bankBox}>
            {wordBank.map((t) => (
              <button key={t.id} className="bank-chip" onClick={() => tapBankWord(t)} style={styles.chipBank}>{t.text}</button>
            ))}
          </div>
          {checked && !isCorrect && (
            <p style={{ textAlign: 'center', color: '#6b7280', marginTop: 14 }}>Câu đúng: <b>{current.correctSentence}</b></p>
          )}
        </div>
      )}

      {/* ===== GHÉP CẶP ===== */}
      {current.type === 'matching' && (
        <div style={styles.card} key={step} className="word-enter">
          <p style={styles.prompt}>🔗 Bấm chọn cặp từ - nghĩa tương ứng</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {matchLeft.map((it) => {
                const isMatched = matchedIds.includes(it.id);
                const isWrong = matchWrongFlash?.leftId === it.id;
                const isSel = selLeftId === it.id;
                return (
                  <button key={it.id} className="match-btn" onClick={() => handleMatchTap('left', it.id, it.text)} disabled={isMatched}
                    style={{ ...styles.matchBtn, opacity: isMatched ? 0.35 : 1, borderColor: isWrong ? '#FF4B4B' : isSel ? '#1CB0F6' : '#E5E7EB', background: isWrong ? '#FFDFE0' : isSel ? '#DDF4FF' : isMatched ? '#EAFBEA' : '#fff' }}>
                    {it.text}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {matchRight.map((it) => {
                const isMatched = matchedIds.includes(it.id);
                const isWrong = matchWrongFlash?.rightId === it.id;
                const isSel = selRightId === it.id;
                return (
                  <button key={it.id} className="match-btn" onClick={() => handleMatchTap('right', it.id, it.text)} disabled={isMatched}
                    style={{ ...styles.matchBtn, opacity: isMatched ? 0.35 : 1, borderColor: isWrong ? '#FF4B4B' : isSel ? '#1CB0F6' : '#E5E7EB', background: isWrong ? '#FFDFE0' : isSel ? '#DDF4FF' : isMatched ? '#EAFBEA' : '#fff' }}>
                    {it.text}
                  </button>
                );
              })}
            </div>
          </div>
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12.5, marginTop: 14 }}>Ghép sai không bị mất tim, cứ thử lại thoải mái.</p>
        </div>
      )}

      {current.type !== 'matching' && !checked && (
        <button
          onClick={handleCheck}
          disabled={
            (current.type === 'meaning_choice' && !selected) ||
            (current.type === 'listen_choice' && !selected) ||
            (current.type === 'translate' && wordBank.length > 0) ||
            (current.type === 'listen_translate' && wordBank.length > 0)
          }
          style={{
            ...styles.checkBtn,
            ...((current.type === 'meaning_choice' && !selected) ||
              (current.type === 'listen_choice' && !selected) ||
              (current.type === 'translate' && wordBank.length > 0) ||
              (current.type === 'listen_translate' && wordBank.length > 0)
              ? styles.checkBtnDisabled : {}),
          }}
        >
          KIỂM TRA
        </button>
      )}

      {current.type !== 'matching' && checked && (
        <div style={{ ...styles.feedbackBar, background: isCorrect ? '#D7FFB8' : '#FFDFE0', animation: 'slideUp 0.3s ease' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>{isCorrect ? '✅' : '❌'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: isCorrect ? '#58A700' : '#EA2B2B', fontSize: 17 }}>
                  {isCorrect ? 'Chính xác!' : 'Chưa đúng!'}
                </div>
                {!isCorrect && (current.type === 'meaning_choice' || current.type === 'listen_choice') && (
                  <div style={{ fontSize: 13.5, color: '#6b7280', marginTop: 2 }}>
                    Đáp án đúng: <b>{current.correctAnswer}</b>
                  </div>
                )}
              </div>
              <button onClick={handleContinue} style={{ ...styles.primaryBtn, background: isCorrect ? '#58CC02' : '#EA2B2B', margin: 0 }}>TIẾP TỤC</button>
            </div>
          </div>
        </div>
      )}

      {current.type === 'matching' && matchDone && (
        <div style={{ ...styles.feedbackBar, background: '#D7FFB8', animation: 'slideUp 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 640, margin: '0 auto', padding: '14px 20px' }}>
            <span style={{ fontSize: 28 }}>🎉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#58A700', fontSize: 17 }}>Ghép cặp hoàn thành!</div>
            </div>
            <button onClick={handleContinue} style={{ ...styles.primaryBtn, background: '#58CC02', margin: 0 }}>TIẾP TỤC</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '70vh', background: 'linear-gradient(180deg,#F0F9FF 0%,#EFF5F3 100%)',
    padding: '24px 16px 100px', maxWidth: 640, margin: '0 auto', position: 'relative',
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  },
  center: { padding: 40, textAlign: 'center', color: '#6b7280' },
  topBar: { display: 'flex', alignItems: 'center', marginBottom: 28 },
  progressTrack: { flex: 1, height: 14, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#58CC02', borderRadius: 999, transition: 'width 0.4s ease' },
  reviewBanner: { background: '#FEF3E2', color: '#b45309', fontWeight: 600, fontSize: 13.5, textAlign: 'center', padding: '10px 16px', borderRadius: 12, marginBottom: 16 },
  card: { background: '#fff', borderRadius: 20, padding: '32px 24px', boxShadow: '0 4px 16px rgba(23,48,45,0.06)' },
  wordRow: { display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' },
  speakerBtn: { width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#E0F2FE', color: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  word: { fontSize: 34, fontWeight: 700, color: '#17302D', textAlign: 'center' },
  posBadge: { fontSize: 13, fontWeight: 700, color: '#6d3fd6', background: '#F3F0FF', borderRadius: 8, padding: '2px 10px', marginLeft: 10, verticalAlign: 'middle' },
  phonetic: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 2 },
  prompt: { textAlign: 'center', color: '#6b7280', marginTop: 12, fontSize: 15 },
  option: { padding: '16px 20px', borderRadius: 14, border: '2px solid #E5E7EB', background: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer', textAlign: 'left', color: '#17302D' },
  optionSelected: { border: '2px solid #1CB0F6', background: '#DDF4FF', color: '#1CB0F6' },
  optionCorrect: { border: '2px solid #58CC02', background: '#D7FFB8', color: '#58A700' },
  optionWrong: { border: '2px solid #FF4B4B', background: '#FFDFE0', color: '#EA2B2B' },
  builtBox: { minHeight: 56, border: '2px dashed #E5E7EB', borderRadius: 14, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 },
  bankBox: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chipBuilt: { padding: '8px 14px', borderRadius: 10, border: '2px solid #1CB0F6', background: '#DDF4FF', color: '#1CB0F6', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  chipBank: { padding: '8px 14px', borderRadius: 10, border: '2px solid #E5E7EB', background: '#fff', color: '#17302D', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  matchBtn: { padding: '12px 10px', borderRadius: 12, border: '2px solid #E5E7EB', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#17302D', textAlign: 'center' },
  checkBtn: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 48px)', maxWidth: 592, background: '#58CC02', color: '#fff', border: 'none', borderRadius: 16, padding: '16px', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 0 #58A700' },
  checkBtnDisabled: { background: '#E5E7EB', color: '#9CA3AF', boxShadow: '0 4px 0 #D1D5DB', cursor: 'not-allowed' },
  feedbackBar: { position: 'fixed', left: 0, right: 0, bottom: 0 },
  primaryBtn: { background: '#58CC02', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 16, boxShadow: '0 4px 0 #58A700' },
};
