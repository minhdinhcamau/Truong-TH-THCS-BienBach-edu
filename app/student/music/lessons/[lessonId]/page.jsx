'use client';
// Đặt tại: app/student/music/lessons/[lessonId]/page.jsx
// BẢN VIẾT LẠI v3 theo góp ý sau khi thử thật trên điện thoại:
//  - Chặn menu "Copy" khi đè lâu trên di động (user-select:none + chặn
//    contextmenu), tự bật toàn màn hình khi bắt đầu (trình duyệt nào hỗ trợ).
//  - Bàn phím CHỈ hiện đúng các phím có trong bài (không hiện phím thừa),
//    phóng to hết cỡ theo chiều ngang cho dễ bấm.
//  - BỎ trái tim — không còn giới hạn số lần sai, chơi hết bài là có kết quả.
//  - Thêm cấp "Luyện tập": KHÔNG chạy theo nhịp — bấm đúng nốt xong nhạc
//    mới trôi tiếp, không có áp lực thời gian. Cấp "Chậm" cũng chậm hơn nữa.
//  - Bỏ âm thanh khi bấm sai/trễ quá — chỉ hiện chữ nổi "Hơi trễ / Tuyệt /
//    Hoàn hảo" theo độ chính xác, có hiệu ứng bay lên rồi mờ dần.
//  - Thanh nốt nhạc hiện luôn TÊN NỐT để học sinh dễ đọc trước khi bấm.
//  - Vạch chờ giờ là 1 dải mờ có hiệu ứng nhấp nháy nhẹ cho đẹp mắt.
//  - Thêm nốt móc đơn chấm dôi (musicNotes.js) cho các bài dân ca có đảo phách
//    kiểu "Lý kéo chài".
//
// npm install tone   (nếu repo chưa có)

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { finishMusicLessonAttempt } from '@/lib/musicXp';
import { pitchToVietnamese, durationBeats, pitchToMidi, starsForScore, LEVELS } from '@/lib/musicNotes';

const PPS = 170; // pixel/giây tốc độ nốt chạy ngang (cấp Chậm/Vừa/Nhanh)
const HIT_LINE_PCT = 20;
const PERFECT_T = 0.12, GREAT_T = 0.25, LATE_T = 0.42; // ngưỡng (giây) cho Hoàn hảo/Tuyệt/Hơi trễ

function laneColor(i) {
  const hues = [265, 210, 160, 30, 340, 90, 5, 190, 45, 120];
  return `hsl(${hues[i % hues.length]}, 70%, 55%)`;
}
function judgeLabel(err) {
  if (err <= PERFECT_T) return { text: 'Hoàn hảo', color: '#58CC02' };
  if (err <= GREAT_T) return { text: 'Tuyệt', color: '#1CB0F6' };
  return { text: 'Hơi trễ', color: '#F5A623' };
}

const noSelectStyle = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' };
function block(e) { e.preventDefault(); }

export default function MusicLessonPlayPage() {
  const { lessonId } = useParams();
  const router = useRouter();
  const samplerRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const containerRef = useRef(null);
  const pageRef = useRef(null);

  const [lesson, setLesson] = useState(null);
  const [nextLessonId, setNextLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [levelProgress, setLevelProgress] = useState(
    Object.fromEntries(LEVELS.map((l, i) => [l.key, { unlocked: i === 0, stars: 0 }]))
  );

  const [level, setLevel] = useState(null);
  const [samplerReady, setSamplerReady] = useState(false);
  const [phase, setPhase] = useState('select'); // select | ready | playing | result
  const [result, setResult] = useState(null);
  const [popups, setPopups] = useState([]); // [{id, text, color, lane}]
  const [containerWidth, setContainerWidth] = useState(360);
  const [, forceRender] = useState(0);

  const timelineRef = useRef([]);
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
    const map = Object.fromEntries(LEVELS.map((lv, i) => [lv.key, { unlocked: i === 0, stars: 0 }]));
    (prog || []).forEach((p) => { if (map[p.level]) map[p.level] = { unlocked: p.is_unlocked, stars: p.stars }; });
    setLevelProgress(map);

    setLoading(false);
  }

  const notesForPlay = useMemo(() => (lesson?.notes || []).filter((n) => n.duration !== 'grace'), [lesson]);
  const lanePitches = useMemo(() => {
    const uniq = [...new Set(notesForPlay.map((n) => n.pitch))];
    return uniq.sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  }, [notesForPlay]);

  useEffect(() => {
    function measure() { if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth); }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [phase]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

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
    try { samplerRef.current.sampler.triggerAttackRelease(pitch, dur); } catch (e) { /* nốt ngoài mẫu, bỏ qua */ }
  }

  function tryFullscreen() {
    const el = pageRef.current;
    const req = el?.requestFullscreen || el?.webkitRequestFullscreen;
    try { req && req.call(el); } catch (e) { /* trình duyệt không hỗ trợ (vd Safari iOS) — bỏ qua, không sao */ }
  }

  async function chooseLevel(lvKey) {
    await ensureSampler();
    setLevel(lvKey);
    setPhase('ready');
  }

  function startGame() {
    tryFullscreen();
    const lv = LEVELS.find((l) => l.key === level);
    const bpm = (lesson.tempo_bpm || 90) * (lv.mult ?? 1);
    let t = 0;
    timelineRef.current = notesForPlay.map((n) => {
      const dur = durationBeats(n.duration) * 60 / bpm;
      const item = { pitch: n.pitch, time: t, duration: dur, judged: null, timingError: null };
      t += dur;
      return item;
    });
    answerLogsRef.current = [];
    pauseOffsetRef.current = 0;
    startTimeRef.current = performance.now() + 1200;
    setPhase('playing');
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick() {
    const raw = (performance.now() - startTimeRef.current) / 1000;
    const timeline = timelineRef.current;
    const isPractice = level === 'practice';
    let elapsed = raw - pauseOffsetRef.current;

    if (isPractice) {
      const firstUnjudged = timeline.find((n) => !n.judged);
      if (firstUnjudged && elapsed >= firstUnjudged.time) {
        // Khựng lại đúng tại nốt cần bấm — chỉ trôi tiếp khi bấm đúng.
        pauseOffsetRef.current = raw - firstUnjudged.time;
        elapsed = firstUnjudged.time;
      }
    } else {
      let allDone = true;
      timeline.forEach((n) => {
        if (n.judged) return;
        if (elapsed > n.time + LATE_T) {
          n.judged = 'miss';
          answerLogsRef.current.push({ exercise_type: 'play_note', question_content: n.pitch, correct_answer: n.pitch, student_answer: null, is_correct: false, time_taken_seconds: 0 });
        } else { allDone = false; }
      });
      if (allDone && elapsed > 0.5) { finishGame(); return; }
    }
    if (isPractice && timeline.every((n) => n.judged)) { finishGame(); return; }

    forceRender((x) => x + 1);
    rafRef.current = requestAnimationFrame(tick);
  }

  function addPopup(text, color, lane) {
    const id = Math.random().toString(36).slice(2);
    setPopups((p) => [...p, { id, text, color, lane }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 700);
  }

  function handleKeyPress(pitch) {
    if (phase !== 'playing') return;
    const raw = (performance.now() - startTimeRef.current) / 1000;
    const elapsed = raw - pauseOffsetRef.current;
    const isPractice = level === 'practice';
    const laneIdx = lanePitches.indexOf(pitch);

    if (isPractice) {
      const firstUnjudged = timelineRef.current.find((n) => !n.judged);
      if (firstUnjudged && firstUnjudged.pitch === pitch) {
        firstUnjudged.judged = 'hit'; firstUnjudged.timingError = 0;
        answerLogsRef.current.push({ exercise_type: 'play_note', question_content: pitch, correct_answer: pitch, student_answer: pitch, is_correct: true, time_taken_seconds: 0 });
        addPopup('Tuyệt', '#1CB0F6', laneIdx);
        pauseOffsetRef.current = raw - firstUnjudged.time; // giữ mốc để nốt sau tính đúng
      }
      playPitch(pitch, 0.4);
      return;
    }

    const candidates = timelineRef.current.filter((n) => n.pitch === pitch && !n.judged && Math.abs(n.time - elapsed) <= LATE_T);
    if (candidates.length === 0) { playPitch(pitch, 0.2); return; }
    const note = candidates.sort((a, b) => Math.abs(a.time - elapsed) - Math.abs(b.time - elapsed))[0];
    note.judged = 'hit';
    note.timingError = Math.abs(note.time - elapsed);
    answerLogsRef.current.push({ exercise_type: 'play_note', question_content: note.pitch, correct_answer: note.pitch, student_answer: pitch, is_correct: true, time_taken_seconds: Math.round(note.timingError * 100) / 100 });
    const j = judgeLabel(note.timingError);
    addPopup(j.text, j.color, laneIdx);
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
      return s + Math.max(0, 100 - (n.timingError / LATE_T) * 100);
    }, 0);
    const rhythmAccuracy = level === 'practice' ? 100 : Math.round(rhythmSum / total);
    const stars = starsForScore(Math.round((pitchAccuracy + rhythmAccuracy) / 2));

    const { data: { user } } = await supabase.auth.getUser();
    const res = await finishMusicLessonAttempt({
      studentId: user.id, lesson, nextLessonId, level,
      pitchAccuracy, rhythmAccuracy, stars, heartsLeft: lesson.max_hearts || 5, answerLogs: answerLogsRef.current,
    });
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setResult({ ...res, pitchAccuracy, rhythmAccuracy, stars });
    setPhase('result');
  }

  if (loading || !lesson) return <div style={styles.center}>Đang tải...</div>;

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
                {lv.key !== 'practice' && <span style={{ color: '#F5A623' }}>{'⭐'.repeat(p.stars)}{'☆'.repeat(3 - p.stars)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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

  const raw = (performance.now() - startTimeRef.current) / 1000;
  const elapsed = raw - pauseOffsetRef.current;
  const laneHeight = Math.max(40, Math.min(70, 340 / Math.max(1, lanePitches.length)));

  return (
    <div ref={pageRef} style={{ ...styles.playWrap, ...noSelectStyle }} onContextMenu={block}>
      <div style={styles.topBar}>
        <div style={{ color: '#fff', fontWeight: 700 }}>{lesson.title} · {LEVELS.find((l) => l.key === level).label}</div>
      </div>

      <div ref={containerRef} style={{ ...styles.lanesWrap, height: laneHeight * lanePitches.length }}>
        <div style={styles.hitLine} />
        {lanePitches.map((p, i) => (
          <div key={p} style={{ ...styles.lane, top: (lanePitches.length - 1 - i) * laneHeight, height: laneHeight }} />
        ))}
        {timelineRef.current.map((n, idx) => {
          const laneIdx = lanePitches.indexOf(n.pitch);
          const xPct = HIT_LINE_PCT + ((n.time - elapsed) * PPS / containerWidth) * 100;
          if (xPct < -20 || xPct > 115) return null;
          return (
            <div key={idx} style={{
              ...styles.noteBlock, left: `${xPct}%`,
              top: (lanePitches.length - 1 - laneIdx) * laneHeight + 4, height: laneHeight - 8,
              background: n.judged === 'hit' ? '#58CC02' : n.judged === 'miss' ? 'rgba(255,75,75,0.5)' : laneColor(laneIdx),
              opacity: n.judged ? 0.5 : 1,
            }}>{pitchToVietnamese(n.pitch)}</div>
          );
        })}
        {popups.map((pu) => (
          <div key={pu.id} style={{ ...styles.popup, top: (lanePitches.length - 1 - pu.lane) * laneHeight, color: pu.color }}>{pu.text}</div>
        ))}
      </div>

      <div style={styles.pianoWrap}>
        {lanePitches.map((p, i) => (
          <button key={p} onMouseDown={() => handleKeyPress(p)} onTouchStart={(e) => { e.preventDefault(); handleKeyPress(p); }} onContextMenu={block}
            style={{ ...styles.pianoKey, background: laneColor(i), ...noSelectStyle }}>
            {pitchToVietnamese(p)}
          </button>
        ))}
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
  topBar: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '14px 18px' },
  lanesWrap: { position: 'relative', margin: '0 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden' },
  hitLine: {
    position: 'absolute', top: 0, bottom: 0, left: `${HIT_LINE_PCT}%`, width: 10, marginLeft: -5,
    background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 60%, transparent 100%)',
    animation: 'musicPulse 1s ease-in-out infinite',
  },
  lane: { position: 'absolute', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.06)' },
  noteBlock: { position: 'absolute', minWidth: 54, padding: '0 8px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, transition: 'opacity 0.2s', whiteSpace: 'nowrap' },
  popup: { position: 'absolute', left: `${HIT_LINE_PCT}%`, transform: 'translate(-50%, -140%)', fontWeight: 800, fontSize: 16, animation: 'musicFloat 0.7s ease-out forwards', pointerEvents: 'none' },
  pianoWrap: { display: 'flex', gap: 4, padding: '14px 12px 28px' },
  pianoKey: { flex: 1, minHeight: 84, border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 rgba(0,0,0,0.25)' },
};

if (typeof document !== 'undefined' && !document.getElementById('music-anim-style')) {
  const style = document.createElement('style');
  style.id = 'music-anim-style';
  style.innerHTML = `
    @keyframes musicPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
    @keyframes musicFloat { 0% { opacity: 0; transform: translate(-50%, -100%); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -220%); } }
  `;
  document.head.appendChild(style);
}
