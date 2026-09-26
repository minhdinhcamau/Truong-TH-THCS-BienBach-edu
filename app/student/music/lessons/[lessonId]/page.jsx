'use client';
// Đặt tại: app/student/music/lessons/[lessonId]/page.jsx
// BẢN VIẾT LẠI TOÀN BỘ (v2) theo đúng yêu cầu:
//  - Bàn phím PIANO THẬT (phím trắng/đen đúng hình dạng), âm thanh piano thật
//    (Tone.Sampler, mẫu piano công khai của chính thư viện Tone.js).
//  - KHÔNG còn kiểu quiz "hỏi từng nốt rời rạc" — học sinh chơi liền mạch
//    CẢ BÀI, nốt chạy ngang từ phải sang trái tới vạch chờ, bấm đúng phím
//    khi nốt tới vạch (giống Duolingo Music).
//  - Bỏ số quãng tám khi hiển thị (Sol4 -> Sol).
//  - 3 cấp độ Chậm/Vừa/Nhanh, phải qua cấp trước mới mở cấp sau.
//  - Chấm 2 chỉ số riêng: Cao độ (bấm đúng phím) và Tiết tấu (đúng nhịp),
//    ra sao (0-3) theo điểm trung bình — CHỈ LƯU lần nhiều sao nhất.
//
// npm install tone   (nếu repo chưa có)

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { finishMusicLessonAttempt } from '@/lib/musicXp';
import { pitchToVietnamese, durationBeats, pitchToMidi, buildPianoKeys, starsForScore, LEVELS } from '@/lib/musicNotes';

const HIT_TOLERANCE = 0.4;   // giây — sai lệch tối đa vẫn tính là đúng nhịp
const PPS = 200;             // pixel/giây — tốc độ nốt chạy ngang
const HIT_LINE_PCT = 18;     // vạch chờ cách mép trái (%)

function laneColor(i, n) {
  const hues = [265, 210, 160, 30, 340, 90, 0, 190];
  return `hsl(${hues[i % hues.length]}, 70%, 55%)`;
}

export default function MusicLessonPlayPage() {
  const { lessonId } = useParams();
  const router = useRouter();
  const samplerRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const containerRef = useRef(null);

  const [lesson, setLesson] = useState(null);
  const [nextLessonId, setNextLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [levelProgress, setLevelProgress] = useState({ slow: { unlocked: true, stars: 0 }, medium: { unlocked: false, stars: 0 }, fast: { unlocked: false, stars: 0 } });

  const [level, setLevel] = useState(null); // null = màn chọn cấp độ
  const [samplerReady, setSamplerReady] = useState(false);
  const [phase, setPhase] = useState('select'); // select | ready | playing | result
  const [hearts, setHearts] = useState(5);
  const [, forceTick] = useState(0);
  const [result, setResult] = useState(null);

  const timelineRef = useRef([]); // [{ pitch, time, duration, judged, timingError }]
  const answerLogsRef = useRef([]);

  useEffect(() => { if (lessonId) load(); }, [lessonId]);

  async function load() {
    if (!lessonId) return;
    setLoading(true);
    const { data: l } = await supabase
      .from('music_lessons').select('*, music_units(id, order_index)').eq('id', lessonId).single();
    setLesson(l);

    const { data: siblings } = await supabase
      .from('music_lessons').select('id, order_index').eq('unit_id', l.music_units.id).order('order_index', { ascending: true });
    const idx = siblings.findIndex((s) => s.id === lessonId);
    setNextLessonId(siblings[idx + 1]?.id || null);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: prog } = await supabase
      .from('music_lesson_progress').select('level, is_unlocked, stars')
      .eq('student_id', user.id).eq('lesson_id', lessonId);
    const map = { slow: { unlocked: true, stars: 0 }, medium: { unlocked: false, stars: 0 }, fast: { unlocked: false, stars: 0 } };
    (prog || []).forEach((p) => { map[p.level] = { unlocked: p.is_unlocked, stars: p.stars }; });
    setLevelProgress(map);

    setLoading(false);
  }

  const notesForPlay = useMemo(() => (lesson?.notes || []).filter((n) => n.duration !== 'grace'), [lesson]);
  const lanePitches = useMemo(() => {
    const uniq = [...new Set(notesForPlay.map((n) => n.pitch))];
    return uniq.sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  }, [notesForPlay]);
  const pianoKeys = useMemo(() => {
    if (lanePitches.length === 0) return [];
    const midis = lanePitches.map(pitchToMidi);
    return buildPianoKeys(Math.min(...midis) - 1, Math.max(...midis) + 1);
  }, [lanePitches]);

  async function ensureSampler() {
    if (samplerRef.current) return samplerRef.current;
    const Tone = await import('tone');
    await Tone.start();
    let sampler;
    try {
      sampler = new Tone.Sampler({
        urls: { 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', 'A5': 'A5.mp3', 'C6': 'C6.mp3' },
        release: 1,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      }).toDestination();
      await Tone.loaded();
    } catch (e) {
      sampler = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 1 } }).toDestination();
    }
    samplerRef.current = { Tone, sampler };
    setSamplerReady(true);
    return samplerRef.current;
  }

  function playPitch(pitch, dur = 0.4) {
    if (!samplerRef.current) return;
    const { sampler } = samplerRef.current;
    try { sampler.triggerAttackRelease(pitch, dur); } catch (e) { /* nốt ngoài mẫu, bỏ qua */ }
  }
  function playMiss() { if (samplerRef.current) { try { samplerRef.current.sampler.triggerAttackRelease('A2', 0.15); } catch (e) {} } }

  async function chooseLevel(lvKey) {
    await ensureSampler();
    setLevel(lvKey);
    setHearts(lesson.max_hearts || 5);
    setPhase('ready');
  }

  function startGame() {
    const mult = LEVELS.find((l) => l.key === level).mult;
    const bpm = (lesson.tempo_bpm || 90) * mult;
    let t = 0;
    timelineRef.current = notesForPlay.map((n) => {
      const dur = durationBeats(n.duration) * 60 / bpm;
      const item = { pitch: n.pitch, time: t, duration: dur, judged: null, timingError: null };
      t += dur;
      return item;
    });
    answerLogsRef.current = [];
    startTimeRef.current = performance.now() + 1200; // đợi 1.2s đếm nhịp trước khi bắt đầu
    setPhase('playing');
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick() {
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const timeline = timelineRef.current;
    let allDone = true;
    timeline.forEach((n) => {
      if (n.judged) return;
      if (elapsed > n.time + HIT_TOLERANCE) {
        n.judged = 'miss';
        answerLogsRef.current.push({ exercise_type: 'play_note', question_content: n.pitch, correct_answer: n.pitch, student_answer: null, is_correct: false, time_taken_seconds: 0 });
        playMiss();
        setHearts((h) => Math.max(0, h - 1));
      } else {
        allDone = false;
      }
    });
    forceTick((x) => x + 1);
    if (allDone && elapsed > 0.5) { finishGame(); return; }
    if (hearts <= 0 && elapsed > 0.5) { finishGame(); return; }
    rafRef.current = requestAnimationFrame(tick);
  }

  function handleKeyPress(pitch) {
    if (phase !== 'playing') return;
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const candidates = timelineRef.current.filter((n) => n.pitch === pitch && !n.judged && Math.abs(n.time - elapsed) <= HIT_TOLERANCE);
    if (candidates.length === 0) { playPitch(pitch, 0.2); return; } // bấm chơi tự do, không tính điểm
    const note = candidates.sort((a, b) => Math.abs(a.time - elapsed) - Math.abs(b.time - elapsed))[0];
    note.judged = 'hit';
    note.timingError = Math.abs(note.time - elapsed);
    answerLogsRef.current.push({ exercise_type: 'play_note', question_content: note.pitch, correct_answer: note.pitch, student_answer: pitch, is_correct: true, time_taken_seconds: Math.round(note.timingError * 10) / 10 });
    playPitch(pitch, Math.min(0.6, note.duration));
  }

  async function finishGame() {
    cancelAnimationFrame(rafRef.current);
    const timeline = timelineRef.current;
    const total = timeline.length || 1;
    const hits = timeline.filter((n) => n.judged === 'hit');
    const pitchAccuracy = Math.round((hits.length / total) * 100);
    const rhythmSum = timeline.reduce((s, n) => {
      if (n.judged !== 'hit') return s;
      return s + Math.max(0, 100 - (n.timingError / HIT_TOLERANCE) * 100);
    }, 0);
    const rhythmAccuracy = Math.round(rhythmSum / total);
    const stars = starsForScore(Math.round((pitchAccuracy + rhythmAccuracy) / 2));

    const { data: { user } } = await supabase.auth.getUser();
    const res = await finishMusicLessonAttempt({
      studentId: user.id, lesson, nextLessonId, level,
      pitchAccuracy, rhythmAccuracy, stars, heartsLeft: hearts, answerLogs: answerLogsRef.current,
    });
    setResult({ ...res, pitchAccuracy, rhythmAccuracy, stars });
    setPhase('result');
  }

  const [containerWidth, setContainerWidth] = useState(360);
  useEffect(() => {
    function measure() { if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth); }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  if (loading || !lesson) return <div style={styles.center}>Đang tải...</div>;

  // ============ Màn chọn cấp độ ============
  if (phase === 'select') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 44, marginBottom: 4, textAlign: 'center' }}>🎵</div>
          <h1 style={{ textAlign: 'center', color: '#17302d', margin: '0 0 4px' }}>{lesson.title}</h1>
          <p style={{ textAlign: 'center', color: '#6b7280', margin: '0 0 20px' }}>Chọn cấp độ để bắt đầu</p>
          {LEVELS.map((lv) => {
            const p = levelProgress[lv.key];
            return (
              <button key={lv.key} disabled={!p.unlocked} onClick={() => chooseLevel(lv.key)} style={{ ...styles.levelBtn, opacity: p.unlocked ? 1 : 0.45 }}>
                <span>{p.unlocked ? '▶' : '🔒'} {lv.label}</span>
                <span style={{ color: '#F5A623' }}>{'⭐'.repeat(p.stars)}{'☆'.repeat(3 - p.stars)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ============ Màn sẵn sàng (chờ bấm bắt đầu, tải piano) ============
  if (phase === 'ready') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 44, textAlign: 'center' }}>🎹</div>
          <h1 style={{ textAlign: 'center', color: '#17302d' }}>{lesson.title} — {LEVELS.find((l) => l.key === level).label}</h1>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>{samplerReady ? 'Đàn piano đã sẵn sàng!' : 'Đang tải âm thanh đàn piano…'}</p>
          <button style={styles.primaryBtn} disabled={!samplerReady} onClick={startGame}>{samplerReady ? '▶ Bắt đầu' : 'Đang tải…'}</button>
        </div>
      </div>
    );
  }

  // ============ Màn kết quả ============
  if (phase === 'result' && result) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 60, textAlign: 'center' }}>{result.completed ? '🎉' : '💪'}</div>
          <h1 style={{ textAlign: 'center', color: result.completed ? '#58A700' : '#3C3C3C' }}>
            {result.completed ? 'Hoàn thành bản nhạc!' : 'Chưa đạt, chơi lại nào!'}
          </h1>
          <div style={{ textAlign: 'center', fontSize: 30, margin: '10px 0', color: '#F5A623' }}>
            {'⭐'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}
          </div>
          <div style={styles.statsRow}>
            <div style={styles.statBox}><div style={styles.statLabel}>Cao độ</div><div style={styles.statVal}>{result.pitchAccuracy}%</div></div>
            <div style={styles.statBox}><div style={styles.statLabel}>Tiết tấu</div><div style={styles.statVal}>{result.rhythmAccuracy}%</div></div>
            <div style={styles.statBox}><div style={styles.statLabel}>Điểm KN</div><div style={styles.statVal}>+{result.xpEarned}</div></div>
          </div>
          <button style={styles.primaryBtn} onClick={() => setPhase('select')}>Chọn cấp độ khác</button>
          <button style={{ ...styles.primaryBtn, background: '#fff', color: '#225da3', border: '2px solid #225da3', boxShadow: 'none' }} onClick={() => router.push('/student/music')}>Về lộ trình học</button>
        </div>
      </div>
    );
  }

  // ============ Màn chơi (nốt chạy ngang + piano) ============
  const elapsed = phase === 'playing' ? (performance.now() - startTimeRef.current) / 1000 : -1.2;
  const laneHeight = Math.max(36, Math.min(64, 320 / Math.max(1, lanePitches.length)));

  return (
    <div style={styles.playWrap}>
      <div style={styles.topBar}>
        <div style={styles.hearts}>{Array.from({ length: lesson.max_hearts || 5 }).map((_, i) => (
          <span key={i} style={{ opacity: i < hearts ? 1 : 0.2 }}>❤️</span>
        ))}</div>
        <div style={{ color: '#fff', fontWeight: 700 }}>{lesson.title} · {LEVELS.find((l) => l.key === level).label}</div>
      </div>

      <div ref={containerRef} style={{ ...styles.lanesWrap, height: laneHeight * lanePitches.length }}>
        <div style={{ ...styles.hitLine, left: `${HIT_LINE_PCT}%` }} />
        {lanePitches.map((p, i) => (
          <div key={p} style={{ ...styles.lane, top: (lanePitches.length - 1 - i) * laneHeight, height: laneHeight, background: i % 2 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
            <span style={{ ...styles.laneLabel, color: laneColor(i, lanePitches.length) }}>{pitchToVietnamese(p)}</span>
          </div>
        ))}
        {timelineRef.current.map((n, idx) => {
          const laneIdx = lanePitches.indexOf(n.pitch);
          const xPct = HIT_LINE_PCT + ((n.time - elapsed) * PPS / containerWidth) * 100;
          if (xPct < -15 || xPct > 115) return null;
          return (
            <div key={idx} style={{
              ...styles.noteBlock,
              left: `${xPct}%`,
              top: (lanePitches.length - 1 - laneIdx) * laneHeight + 4,
              height: laneHeight - 8,
              background: n.judged === 'hit' ? '#58CC02' : n.judged === 'miss' ? '#FF4B4B' : laneColor(laneIdx, lanePitches.length),
              opacity: n.judged ? 0.55 : 1,
            }} />
          );
        })}
      </div>

      <div style={styles.pianoWrap}>
        <div style={styles.pianoWhite}>
          {pianoKeys.filter((k) => !k.isBlack).map((k) => (
            <button key={k.midi} onMouseDown={() => handleKeyPress(k.pitch)} onTouchStart={(e) => { e.preventDefault(); handleKeyPress(k.pitch); }} style={styles.whiteKey}>
              <span style={{ color: lanePitches.includes(k.pitch) ? laneColor(lanePitches.indexOf(k.pitch), lanePitches.length) : '#c7ccd1', fontWeight: 700, fontSize: 11 }}>{pitchToVietnamese(k.pitch)}</span>
            </button>
          ))}
        </div>
        <div style={styles.pianoBlackLayer}>
          {(() => {
            const whites = pianoKeys.filter((k) => !k.isBlack);
            const whiteWidthPct = 100 / whites.length;
            return pianoKeys.filter((k) => k.isBlack).map((k) => {
              // vị trí: ngay sau phím trắng có midi = k.midi - 1
              const idx = whites.findIndex((w) => w.midi === k.midi - 1);
              if (idx === -1) return null;
              const leftPct = (idx + 1) * whiteWidthPct - whiteWidthPct * 0.28;
              return (
                <button key={k.midi} onMouseDown={() => handleKeyPress(k.pitch)} onTouchStart={(e) => { e.preventDefault(); handleKeyPress(k.pitch); }}
                  style={{ ...styles.blackKey, left: `${leftPct}%`, width: `${whiteWidthPct * 0.56}%` }} />
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  center: { padding: 40, textAlign: 'center', color: '#6b7280' },
  page: { minHeight: '70vh', background: 'linear-gradient(180deg,#F0F9FF 0%,#EFF5F3 100%)', padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto', fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" },
  card: { background: '#fff', borderRadius: 20, padding: '32px 24px', boxShadow: '0 4px 16px rgba(23,48,45,0.06)' },
  levelBtn: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 16, fontWeight: 700, color: '#17302d', marginBottom: 10, cursor: 'pointer' },
  primaryBtn: { width: '100%', background: '#58CC02', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 12, boxShadow: '0 4px 0 #58A700' },
  statsRow: { display: 'flex', gap: 10, margin: '18px 0' },
  statBox: { flex: 1, background: '#F3F6F5', borderRadius: 12, padding: '12px 8px', textAlign: 'center' },
  statLabel: { fontSize: 11.5, color: '#6b7280' },
  statVal: { fontSize: 20, fontWeight: 800, color: '#17302d' },
  playWrap: { minHeight: '100vh', background: '#0F1A2A', display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' },
  hearts: { display: 'flex', gap: 4, fontSize: 18 },
  lanesWrap: { position: 'relative', margin: '0 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden' },
  hitLine: { position: 'absolute', top: 0, bottom: 0, width: 3, background: 'rgba(255,255,255,0.6)' },
  lane: { position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' },
  laneLabel: { position: 'absolute', left: 6, fontSize: 12, fontWeight: 700 },
  noteBlock: { position: 'absolute', width: 46, borderRadius: 8, transition: 'opacity 0.15s' },
  pianoWrap: { position: 'relative', marginTop: 'auto', padding: '10px 12px 24px' },
  pianoWhite: { display: 'flex', width: '100%', height: 110, gap: 2 },
  whiteKey: { flex: 1, background: '#fff', border: '1px solid #d5dde3', borderRadius: '0 0 8px 8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, cursor: 'pointer' },
  pianoBlackLayer: { position: 'absolute', top: 10, left: 12, right: 12, height: 66, pointerEvents: 'none' },
  blackKey: { position: 'absolute', top: 0, height: '100%', background: '#1a1a1a', borderRadius: '0 0 6px 6px', border: '1px solid #000', pointerEvents: 'auto', cursor: 'pointer' },
};
