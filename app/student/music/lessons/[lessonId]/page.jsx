'use client';
// Đặt tại: app/student/music/lessons/[lessonId]/page.jsx
// BẢN THIẾT KẾ LẠI v5 — nốt RƠI TỪ TRÊN XUỐNG đúng vào phím đàn bên dưới
// (kiểu Piano Tiles / Synthesia), thay cho kiểu "làn chạy ngang" trước đây.
// Mỗi nốt rơi thẳng xuống ĐÚNG vị trí phím của nó — canh phím dễ hơn nhiều
// trên điện thoại vì mắt chỉ cần nhìn 1 trục dọc.
//
// Đồng thời chặn "Copy" khi đè lâu bằng CẢ CSS lẫn trình lắng nghe sự kiện
// gốc (không qua React) — cách chắc chắn nhất trên Safari iOS.
//
// npm install tone   (nếu repo chưa có)

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { finishMusicLessonAttempt } from '@/lib/musicXp';
import { VN_NAME, NOTE_COLOR, pitchToMidi, durationBeats, buildPianoKeys, starsForScore, LEVELS } from '@/lib/musicNotes';

const LEAD_IN = 3;                  // giây đếm ngược trước khi nốt đầu tới phím
const LOOKAHEAD_SEC = 2.6;          // số giây nhìn thấy trước khi nốt rơi tới nơi
const PERFECT_T = 0.12, GREAT_T = 0.25, LATE_T = 0.42; // ngưỡng chấm (giây)
const KEY_GAP = 3;

const LEVEL_HINT = {
  practice: 'Không tính giờ — bấm đúng nốt thì nhạc mới chạy tiếp',
  slow: 'Nhịp chậm, dễ theo kịp',
  medium: 'Đúng tốc độ của bài',
  fast: 'Nhanh hơn, dành cho thử thách',
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function noteColor(pitch) { return NOTE_COLOR[pitch && pitch[0]] || '#3B82F6'; }
function shortName(pitch) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch || '');
  if (!m) return pitch;
  return VN_NAME[m[1]] + (m[2] === '#' ? '♯' : m[2] === 'b' ? '♭' : '');
}
function judgeLabel(err) {
  if (err <= PERFECT_T) return { text: 'Hoàn hảo', color: '#7CE04A' };
  if (err <= GREAT_T) return { text: 'Tuyệt', color: '#4CC2FF' };
  return { text: 'Hơi trễ', color: '#FFB84D' };
}
function block(e) { e.preventDefault(); }

const CSS = `
.mp-root { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column;
  background: radial-gradient(1100px 560px at 50% -10%, #1d2f55 0%, #0e1729 58%, #080d18 100%); color: #fff;
  font-family: 'Be Vietnam Pro', system-ui, sans-serif; box-sizing: border-box; overscroll-behavior: none;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  -webkit-tap-highlight-color: transparent; touch-action: none; }
.mp-root, .mp-root * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; -webkit-user-drag: none !important; }
.mp-top { display: flex; align-items: center; gap: 10px; padding: 8px 12px 6px; flex: 0 0 auto; }
.mp-iconbtn { width: 38px; height: 38px; border-radius: 12px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.08);
  color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; font-size: 15px; }
.mp-iconbtn:active { background: rgba(255,255,255,.18); }
.mp-title { flex: 1; min-width: 0; text-align: center; font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-chip { display: inline-block; margin-left: 8px; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
  background: rgba(88,204,2,.16); color: #8be04a; border: 1px solid rgba(88,204,2,.35); vertical-align: 1px; }
.mp-progress { height: 5px; margin: 0 14px 8px; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden; flex: 0 0 auto; }
.mp-progress > div { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #58cc02, #a4ea66); transition: width .2s; }
.mp-hint { display: flex; align-items: center; gap: 8px; margin: 0 10px 8px; padding: 8px 8px 8px 12px; border-radius: 12px; flex: 0 0 auto;
  background: rgba(56,139,253,.12); border: 1px solid rgba(56,139,253,.3); color: #cfe3ff; font-size: 12.5px; line-height: 1.35; }
.mp-hint span { flex: 1; }
.mp-hint button { background: none; border: none; color: inherit; opacity: .7; font-size: 14px; padding: 2px 8px; cursor: pointer; }
.mp-stage { position: relative; flex: 1 1 0; min-height: 0; margin: 0 10px; border-radius: 16px 16px 0 0; overflow: hidden;
  background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.015)); border: 1px solid rgba(255,255,255,.09); border-bottom: none; }
.mp-popup { position: absolute; font-weight: 900; font-size: 15px; text-shadow: 0 2px 8px rgba(0,0,0,.65); pointer-events: none;
  white-space: nowrap; z-index: 6; animation: mpFloat .75s ease-out forwards; transform: translateX(-50%); }
.mp-count { position: absolute; font-weight: 900; font-size: 64px; color: rgba(255,255,255,.92); text-shadow: 0 4px 24px rgba(0,0,0,.5);
  pointer-events: none; z-index: 6; animation: mpCount 1s ease-out; transform: translateX(-50%); }
.mp-piano { position: relative; flex: 0 0 auto; height: 26vh; height: clamp(96px, 26dvh, 190px); margin: 0 10px 10px; border-radius: 0 0 16px 16px; overflow: hidden; }
.mp-white-row { display: flex; gap: ${KEY_GAP}px; height: 100%; background: #050810; padding: 0 0 0 0; }
.mp-white { position: relative; flex: 1; min-width: 0; border: none; padding: 0 0 9px; display: flex; align-items: flex-end; justify-content: center;
  border-radius: 0 0 10px 10px; background: linear-gradient(180deg, #ffffff 0%, #eef1f6 100%); border-bottom: 5px solid var(--c);
  box-shadow: 0 6px 12px rgba(0,0,0,.35); cursor: pointer; touch-action: none; transition: transform .06s;
  font-family: inherit; font-weight: 800; font-size: clamp(10px, 1.6vw, 14px); color: var(--c); }
.mp-white span { pointer-events: none; }
.mp-white.on { transform: translateY(3px); }
.mp-white.on::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--c); opacity: .24; }
.mp-black { position: absolute; top: 0; height: 62%; border: none; border-radius: 0 0 9px 9px; z-index: 2; cursor: pointer; touch-action: none;
  background: linear-gradient(180deg, #3b3f47 0%, #15171b 70%, #0a0b0e 100%); box-shadow: 0 6px 10px rgba(0,0,0,.5), inset 0 -3px 0 rgba(255,255,255,.08);
  transition: transform .06s, filter .06s; }
.mp-black.on { transform: translateY(2px); filter: brightness(1.7); }
.mp-scroll { flex: 1; overflow-y: auto; display: flex; align-items: center; justify-content: center; padding: 8px 16px 24px; }
.mp-card { width: 100%; max-width: 440px; border-radius: 22px; padding: 26px 22px; background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12); box-shadow: 0 20px 50px rgba(0,0,0,.35); }
.mp-h1 { margin: 0 0 4px; font-size: 22px; font-weight: 800; text-align: center; }
.mp-sub { margin: 0 0 16px; text-align: center; color: rgba(255,255,255,.66); font-size: 14px; line-height: 1.45; }
.mp-level { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 16px; margin-bottom: 10px;
  border-radius: 14px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.07); color: #fff; font-size: 16px; font-weight: 700;
  cursor: pointer; text-align: left; font-family: inherit; }
.mp-level:active:not(:disabled) { background: rgba(255,255,255,.14); }
.mp-level:disabled { opacity: .4; cursor: not-allowed; }
.mp-level small { display: block; font-weight: 500; font-size: 12px; color: rgba(255,255,255,.6); margin-top: 3px; }
.mp-btn { width: 100%; margin-top: 12px; padding: 14px; border-radius: 14px; border: none; font-size: 16px; font-weight: 800; cursor: pointer;
  background: #58cc02; color: #fff; box-shadow: 0 4px 0 #3f9a00; font-family: inherit; }
.mp-btn.ghost { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,.3); box-shadow: none; }
.mp-btn:disabled { opacity: .5; cursor: not-allowed; }
.mp-stats { display: flex; gap: 10px; margin: 16px 0 4px; }
.mp-stat { flex: 1; text-align: center; border-radius: 14px; padding: 12px 6px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); }
.mp-stat b { display: block; font-size: 22px; }
.mp-stat span { font-size: 11.5px; color: rgba(255,255,255,.6); }
.mp-err { margin-top: 10px; font-size: 12.5px; color: #ffb4b4; text-align: center; }
@keyframes mpFloat { 0% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(.85); } 20% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.06); } 100% { opacity: 0; transform: translateX(-50%) translateY(-28px) scale(1); } }
@keyframes mpCount { 0% { opacity: 0; transform: translateX(-50%) scale(1.5); } 25% { opacity: 1; transform: translateX(-50%) scale(1); } 100% { opacity: .15; transform: translateX(-50%) scale(.9); } }
`;

function Stars({ n, size = 22 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 2 }}>
      <span style={{ color: '#FFC83D' }}>{'★'.repeat(n)}</span>
      <span style={{ color: 'rgba(255,255,255,.22)' }}>{'★'.repeat(3 - n)}</span>
    </span>
  );
}

export default function MusicLessonPlayPage() {
  const { lessonId } = useParams();
  const router = useRouter();

  const samplerRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const elapsedRef = useRef(-LEAD_IN);
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const pianoRowRef = useRef(null);
  const timelineRef = useRef([]);
  const answerLogsRef = useRef([]);
  const activeRef = useRef(new Map());
  const finishedRef = useRef(false);
  const practiceRef = useRef(false);

  const [lesson, setLesson] = useState(null);
  const [nextLessonId, setNextLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [levelProgress, setLevelProgress] = useState(Object.fromEntries(LEVELS.map((l, i) => [l.key, { unlocked: i === 0, stars: 0 }])));
  const [level, setLevel] = useState(null);
  const [phase, setPhase] = useState('select');
  const [samplerReady, setSamplerReady] = useState(false);
  const [result, setResult] = useState(null);
  const [popups, setPopups] = useState([]);
  const [pressed, setPressed] = useState(() => new Set());
  const [stageH, setStageH] = useState(240);
  const [pianoW, setPianoW] = useState(360);
  const [fullscreen, setFullscreen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => { if (lessonId) load(); }, [lessonId]);

  async function loadProgress() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prog } = await supabase
      .from('music_lesson_progress').select('level, is_unlocked, stars')
      .eq('student_id', user.id).eq('lesson_id', lessonId);
    const map = Object.fromEntries(LEVELS.map((lv, i) => [lv.key, { unlocked: i === 0, stars: 0 }]));
    (prog || []).forEach((p) => { if (map[p.level]) map[p.level] = { unlocked: map[p.level].unlocked || !!p.is_unlocked, stars: p.stars || 0 }; });
    setLevelProgress(map);
  }

  async function load() {
    if (!lessonId) return;
    setLoading(true);
    const { data: l } = await supabase.from('music_lessons').select('*, music_units(id, order_index)').eq('id', lessonId).single();
    setLesson(l);
    const { data: siblings } = await supabase
      .from('music_lessons').select('id, order_index').eq('unit_id', l.music_units.id).order('order_index', { ascending: true });
    const idx = siblings.findIndex((s) => s.id === lessonId);
    setNextLessonId(siblings[idx + 1]?.id || null);
    await loadProgress();
    setLoading(false);
  }

  const notesForPlay = useMemo(
    () => (lesson?.notes || []).filter((n) => n.duration !== 'grace').slice().sort((a, b) => (a.startBeat || 0) - (b.startBeat || 0)),
    [lesson]
  );
  const lanePitches = useMemo(() => {
    const uniq = [...new Set(notesForPlay.map((n) => n.pitch))];
    return uniq.sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  }, [notesForPlay]);
  const pianoKeys = useMemo(() => {
    if (lanePitches.length === 0) return [];
    const midis = lanePitches.map(pitchToMidi);
    return buildPianoKeys(Math.min(...midis) - 1, Math.max(...midis) + 1);
  }, [lanePitches]);
  const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys]);
  const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys]);

  // Toạ độ X / bề rộng của TỪNG phím theo bề ngang bàn phím đo được — nốt rơi
  // dùng đúng toạ độ này để rơi THẲNG xuống đúng phím của nó.
  const keyLayout = useMemo(() => {
    const map = new Map();
    if (whiteKeys.length === 0 || pianoW <= 0) return map;
    const wW = (pianoW - (whiteKeys.length - 1) * KEY_GAP) / whiteKeys.length;
    whiteKeys.forEach((k, i) => map.set(k.pitch, { x: i * (wW + KEY_GAP), w: wW, isBlack: false }));
    const bW = wW * 0.56;
    blackKeys.forEach((k) => {
      const idx = whiteKeys.findIndex((w) => w.midi === k.midi - 1);
      if (idx === -1) return;
      const x = (idx + 1) * (wW + KEY_GAP) - KEY_GAP / 2 - bW / 2;
      map.set(k.pitch, { x, w: bW, isBlack: true });
    });
    return map;
  }, [whiteKeys, blackKeys, pianoW]);

  // ---------- Toàn màn hình / xoay máy / đo kích thước ----------
  useEffect(() => {
    function onFs() { setFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement)); }
    function onSize() { setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 820); }
    onSize();
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    window.addEventListener('resize', onSize);
    window.addEventListener('orientationchange', onSize);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      window.removeEventListener('resize', onSize);
      window.removeEventListener('orientationchange', onSize);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return undefined;
    function measure() {
      if (stageRef.current) setStageH(stageRef.current.clientHeight);
      if (pianoRowRef.current) setPianoW(pianoRowRef.current.clientWidth);
    }
    measure();
    let ro1, ro2;
    if (typeof ResizeObserver !== 'undefined') {
      ro1 = new ResizeObserver(measure); ro1.observe(stageRef.current);
      ro2 = new ResizeObserver(measure); ro2.observe(pianoRowRef.current);
    }
    window.addEventListener('resize', measure);
    return () => { ro1 && ro1.disconnect(); ro2 && ro2.disconnect(); window.removeEventListener('resize', measure); };
  }, [phase]);

  // Chặn "đè lâu -> Copy" một cách CHẮC CHẮN trên Safari iOS: gắn thẳng vào
  // DOM (không qua React) với { passive:false } để preventDefault() có hiệu lực.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const stop = (e) => e.preventDefault();
    const stopUnlessButton = (e) => { if (!e.target.closest('button, a, input, select, textarea')) e.preventDefault(); };
    el.addEventListener('touchstart', stopUnlessButton, { passive: false });
    el.addEventListener('contextmenu', stop, { passive: false });
    el.addEventListener('selectstart', stop, { passive: false });
    el.addEventListener('gesturestart', stop, { passive: false });
    return () => {
      el.removeEventListener('touchstart', stopUnlessButton);
      el.removeEventListener('contextmenu', stop);
      el.removeEventListener('selectstart', stop);
      el.removeEventListener('gesturestart', stop);
    };
  }, [phase]);

  useEffect(() => () => {
    finishedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    releaseAll();
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* bỏ qua */ }
  }, []);

  const canFullscreen = typeof document !== 'undefined' && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  function enterFullscreen() {
    if (!canFullscreen) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    try {
      const p = req.call(el);
      if (p && p.then) p.then(() => { try { window.screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* bỏ qua */ } }).catch(() => {});
    } catch (e) { /* bỏ qua */ }
  }
  function leaveFullscreen() {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      window.screen.orientation.unlock();
    } catch (e) { /* bỏ qua */ }
  }
  function toggleFullscreen() { (document.fullscreenElement || document.webkitFullscreenElement) ? leaveFullscreen() : enterFullscreen(); }

  // ---------- Âm thanh piano ----------
  async function ensureSampler() {
    if (samplerRef.current) return samplerRef.current;
    const Tone = await import('tone');
    let sampler;
    try {
      sampler = new Tone.Sampler({
        urls: { 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', 'A5': 'A5.mp3', 'C6': 'C6.mp3' },
        release: 1.2,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      }).toDestination();
      await Promise.race([Tone.loaded(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000))]);
    } catch (e) {
      sampler = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.4, sustain: 0.25, release: 1 } }).toDestination();
    }
    samplerRef.current = { Tone, sampler };
    setSamplerReady(true);
    return samplerRef.current;
  }
  function noteOn(pitch) { const s = samplerRef.current; if (!s) return; try { s.sampler.triggerAttack(pitch, s.Tone.now(), 0.9); } catch (e) { /* ngoài dải mẫu */ } }
  function noteOff(pitch) { const s = samplerRef.current; if (!s) return; try { s.sampler.triggerRelease(pitch, s.Tone.now()); } catch (e) { /* bỏ qua */ } }
  function releaseAll() {
    activeRef.current.clear();
    try { samplerRef.current && samplerRef.current.sampler.releaseAll && samplerRef.current.sampler.releaseAll(); } catch (e) { /* bỏ qua */ }
    setPressed(new Set());
  }

  // ---------- Luồng chơi ----------
  function chooseLevel(lvKey) { setLevel(lvKey); setPhase('ready'); ensureSampler(); }

  function startGame() {
    if (!samplerRef.current || notesForPlay.length === 0) return;
    try { samplerRef.current.Tone.start(); } catch (e) { /* bỏ qua */ }
    enterFullscreen();
    const lv = LEVELS.find((l) => l.key === level);
    practiceRef.current = !!lv.selfPaced;
    const bpm = (lesson.tempo_bpm || 90) * (lv.mult ?? 1);
    timelineRef.current = notesForPlay.map((n) => ({
      pitch: n.pitch, time: (n.startBeat || 0) * 60 / bpm, duration: durationBeats(n.duration) * 60 / bpm, judged: null, timingError: null,
    }));
    answerLogsRef.current = [];
    pauseOffsetRef.current = 0;
    finishedRef.current = false;
    elapsedRef.current = -LEAD_IN;
    startTimeRef.current = performance.now() + LEAD_IN * 1000;
    setPopups([]);
    setResult(null);
    setPhase('playing');
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick() {
    if (finishedRef.current) return;
    const raw = (performance.now() - startTimeRef.current) / 1000;
    const timeline = timelineRef.current;
    let elapsed = raw - pauseOffsetRef.current;

    if (practiceRef.current) {
      const first = timeline.find((n) => !n.judged);
      if (!first) { elapsedRef.current = elapsed; finishGame(); return; }
      if (elapsed >= first.time) { pauseOffsetRef.current = raw - first.time; elapsed = first.time; }
    } else {
      let allDone = true;
      timeline.forEach((n) => {
        if (n.judged) return;
        if (elapsed > n.time + LATE_T) {
          n.judged = 'miss';
          answerLogsRef.current.push({ exercise_type: 'play_note', question_content: n.pitch, correct_answer: n.pitch, student_answer: null, is_correct: false, time_taken_seconds: 0 });
        } else { allDone = false; }
      });
      if (allDone && elapsed > 0.3) { elapsedRef.current = elapsed; finishGame(); return; }
    }
    elapsedRef.current = elapsed;
    forceRender((x) => x + 1);
    rafRef.current = requestAnimationFrame(tick);
  }

  function addPopup(text, color, pitch) {
    const id = Math.random().toString(36).slice(2);
    setPopups((p) => [...p, { id, text, color, pitch }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 800);
  }

  function judgePress(pitch) {
    if (finishedRef.current) return;
    const raw = (performance.now() - startTimeRef.current) / 1000;
    const elapsed = raw - pauseOffsetRef.current;
    const timeline = timelineRef.current;

    if (practiceRef.current) {
      const first = timeline.find((n) => !n.judged);
      if (first && first.pitch === pitch) {
        first.judged = 'hit'; first.timingError = 0;
        answerLogsRef.current.push({ exercise_type: 'play_note', question_content: pitch, correct_answer: pitch, student_answer: pitch, is_correct: true, time_taken_seconds: 0 });
        addPopup('Tuyệt', '#4CC2FF', pitch);
        pauseOffsetRef.current = raw - first.time;
      }
      return;
    }
    const candidates = timeline.filter((n) => n.pitch === pitch && !n.judged && Math.abs(n.time - elapsed) <= LATE_T);
    if (candidates.length === 0) return;
    const note = candidates.sort((a, b) => Math.abs(a.time - elapsed) - Math.abs(b.time - elapsed))[0];
    note.judged = 'hit';
    note.timingError = Math.abs(note.time - elapsed);
    answerLogsRef.current.push({ exercise_type: 'play_note', question_content: note.pitch, correct_answer: note.pitch, student_answer: pitch, is_correct: true, time_taken_seconds: Math.round(note.timingError * 100) / 100 });
    const j = judgeLabel(note.timingError);
    addPopup(j.text, j.color, pitch);
  }

  function pressKey(e, pitch) {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
    activeRef.current.set(e.pointerId, pitch);
    setPressed((prev) => { const n = new Set(prev); n.add(pitch); return n; });
    noteOn(pitch);
    if (phase === 'playing') judgePress(pitch);
  }
  function releaseKey(e) {
    const pitch = activeRef.current.get(e.pointerId);
    if (!pitch) return;
    activeRef.current.delete(e.pointerId);
    noteOff(pitch);
    const stillHeld = Array.from(activeRef.current.values()).includes(pitch);
    if (!stillHeld) setPressed((prev) => { const n = new Set(prev); n.delete(pitch); return n; });
  }

  async function finishGame() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    releaseAll();
    const timeline = timelineRef.current;
    const total = timeline.length || 1;
    const hits = timeline.filter((n) => n.judged === 'hit');
    const pitchAccuracy = Math.round((hits.length / total) * 100);
    const rhythmSum = timeline.reduce((s, n) => (n.judged === 'hit' ? s + Math.max(0, 100 - (n.timingError / LATE_T) * 100) : s), 0);
    const rhythmAccuracy = practiceRef.current ? 100 : Math.round(rhythmSum / total);
    const score = Math.round((pitchAccuracy + rhythmAccuracy) / 2);
    const stars = starsForScore(score);
    let res;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      res = await finishMusicLessonAttempt({ studentId: user.id, lesson, nextLessonId, level, pitchAccuracy, rhythmAccuracy, stars, heartsLeft: lesson.max_hearts || 5, answerLogs: answerLogsRef.current });
    } catch (e) {
      res = { xpEarned: 0, completed: score >= (lesson.pass_score ?? 80), score, stars, saveError: e.message };
    }
    leaveFullscreen();
    setResult({ ...res, pitchAccuracy, rhythmAccuracy, stars });
    setPhase('result');
  }

  function backToUnit() { router.push(`/student/music/units/${lesson.music_units.id}`); }
  function exitGame() {
    if (phase === 'playing' && !window.confirm('Thoát bài? Kết quả lần chơi này sẽ không được lưu.')) return;
    finishedRef.current = true; cancelAnimationFrame(rafRef.current); releaseAll(); leaveFullscreen(); backToUnit();
  }
  async function backToSelect() { finishedRef.current = true; await loadProgress(); setPhase('select'); }

  // ================= Giao diện =================
  const styleTag = <style dangerouslySetInnerHTML={{ __html: CSS }} />;
  if (loading || !lesson) return <div className="mp-root" ref={rootRef}>{styleTag}<div className="mp-scroll"><p className="mp-sub">Đang tải…</p></div></div>;

  const levelObj = level ? LEVELS.find((l) => l.key === level) : null;

  if (phase === 'select') {
    return (
      <div className="mp-root" ref={rootRef}>
        {styleTag}
        <div className="mp-top"><button className="mp-iconbtn" onClick={backToUnit}>←</button><div className="mp-title">Chọn cấp độ</div><span style={{ width: 38 }} /></div>
        <div className="mp-scroll">
          <div className="mp-card">
            <div style={{ fontSize: 40, textAlign: 'center' }}>🎵</div>
            <h1 className="mp-h1">{lesson.title}</h1>
            <p className="mp-sub">Hoàn thành từng cấp độ để mở cấp tiếp theo</p>
            {LEVELS.map((lv) => {
              const p = levelProgress[lv.key];
              return (
                <button key={lv.key} className="mp-level" disabled={!p.unlocked} onClick={() => chooseLevel(lv.key)}>
                  <span>{p.unlocked ? '▶' : '🔒'} {lv.label}<small>{LEVEL_HINT[lv.key]}</small></span>
                  {lv.key !== 'practice' && <Stars n={p.stars} size={18} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className="mp-root" ref={rootRef}>
        {styleTag}
        <div className="mp-top"><button className="mp-iconbtn" onClick={backToSelect}>←</button><div className="mp-title">{lesson.title}<span className="mp-chip">{levelObj.label}</span></div><span style={{ width: 38 }} /></div>
        <div className="mp-scroll">
          <div className="mp-card">
            <div style={{ fontSize: 40, textAlign: 'center' }}>🎹</div>
            <h1 className="mp-h1">Sẵn sàng chưa?</h1>
            <p className="mp-sub">{LEVEL_HINT[level]}</p>
            {notesForPlay.length === 0 ? <p className="mp-err">Bài này chưa có nốt nhạc. Nhờ giáo viên soạn thêm nhé.</p> : <p className="mp-sub">{samplerReady ? '✓ Đàn piano đã sẵn sàng' : 'Đang tải âm thanh đàn piano…'}</p>}
            {isPortrait && <p className="mp-sub">Nên xoay ngang thiết bị để có trải nghiệm tốt nhất.</p>}
            <button className="mp-btn" disabled={!samplerReady || notesForPlay.length === 0} onClick={startGame}>▶ Bắt đầu</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <div className="mp-root" ref={rootRef}>
        {styleTag}
        <div className="mp-scroll">
          <div className="mp-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52 }}>{result.completed ? '🎉' : '💪'}</div>
            <h1 className="mp-h1">{result.completed ? 'Hoàn thành bản nhạc!' : 'Chưa đạt, thử lại nhé!'}</h1>
            <div style={{ margin: '6px 0' }}><Stars n={result.stars} size={34} /></div>
            <div className="mp-stats">
              <div className="mp-stat"><b>{result.pitchAccuracy}%</b><span>Cao độ</span></div>
              <div className="mp-stat"><b>{result.rhythmAccuracy}%</b><span>Tiết tấu</span></div>
              <div className="mp-stat"><b>+{result.xpEarned}</b><span>Điểm KN</span></div>
            </div>
            {result.saveError && <p className="mp-err">Chưa lưu được kết quả lên hệ thống ({result.saveError}).</p>}
            <button className="mp-btn" onClick={() => setPhase('ready')}>Chơi lại</button>
            <button className="mp-btn ghost" onClick={backToSelect}>Chọn cấp độ khác</button>
            <button className="mp-btn ghost" onClick={backToUnit}>Về lộ trình học</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Màn chơi: nốt rơi từ trên xuống ----------
  const timeline = timelineRef.current;
  const elapsed = elapsedRef.current;
  const pps = stageH > 0 ? stageH / LOOKAHEAD_SEC : 90;
  const judgedCount = timeline.filter((n) => n.judged).length;
  const pct = timeline.length ? Math.round((judgedCount / timeline.length) * 100) : 0;
  const nW = Math.max(1, whiteKeys.length);
  const wCalc = `((100% - ${(nW - 1) * KEY_GAP}px) / ${nW})`;

  return (
    <div className="mp-root" ref={rootRef} onContextMenu={block}>
      {styleTag}
      <div className="mp-top">
        <button className="mp-iconbtn" onClick={exitGame}>✕</button>
        <div className="mp-title">{lesson.title}<span className="mp-chip">{levelObj.label}</span></div>
        {canFullscreen ? (
          <button className="mp-iconbtn" onClick={toggleFullscreen}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {fullscreen ? <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /> : <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />}
            </svg>
          </button>
        ) : <span style={{ width: 38 }} />}
      </div>
      <div className="mp-progress"><div style={{ width: `${pct}%` }} /></div>
      {isPortrait && !hintDismissed && (
        <div className="mp-hint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></svg>
          <span>Xoay ngang thiết bị để có trải nghiệm tốt nhất</span>
          <button onClick={() => setHintDismissed(true)}>✕</button>
        </div>
      )}

      <div ref={stageRef} className="mp-stage">
        {/* Vạch tới hạn ngay sát mép trên bàn phím */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(255,255,255,.35)' }} />
        {keyLayout && Array.from(keyLayout.entries()).map(([pitch, k]) => {
          if (k.isBlack) return null;
          const c = noteColor(pitch);
          const on = pressed.has(pitch);
          return <div key={pitch} style={{ position: 'absolute', left: k.x, bottom: 0, width: k.w, top: 0, borderLeft: '1px solid rgba(255,255,255,.04)', background: on ? `${c}22` : 'transparent', transition: 'background .08s' }} />;
        })}
        {timeline.map((n, idx) => {
          if (n.judged === 'hit' && elapsed - n.time > 0.3) return null;
          const k = keyLayout.get(n.pitch);
          if (!k) return null;
          const h = Math.max(22, n.duration * pps - 4);
          const bottomY = (n.time - elapsed) * pps; // khoảng cách từ đáy (vạch tới hạn) lên đáy thanh nốt
          if (bottomY > stageH + h + 20 || bottomY < -h - 20) return null;
          const c = noteColor(n.pitch);
          const hit = n.judged === 'hit', miss = n.judged === 'miss';
          return (
            <div key={idx} style={{
              position: 'absolute', left: k.x + 2, width: Math.max(20, k.w - 4), height: h,
              bottom: bottomY, willChange: 'bottom',
              borderRadius: Math.min(12, k.w / 3), background: hit ? '#58CC02' : miss ? 'rgba(148,163,184,.35)' : c,
              boxShadow: hit ? '0 0 16px rgba(88,204,2,.8)' : miss ? 'none' : `0 4px 14px ${c}55, inset 0 3px 0 rgba(255,255,255,.25)`,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4, color: '#fff', fontWeight: 800,
              fontSize: Math.min(13, k.w * 0.34), opacity: miss ? 0.55 : 1,
            }}>{h >= 34 ? shortName(n.pitch) : ''}</div>
          );
        })}
        {popups.map((pu) => {
          const k = keyLayout.get(pu.pitch);
          return <div key={pu.id} className="mp-popup" style={{ left: k ? k.x + k.w / 2 : '50%', bottom: 46, color: pu.color }}>{pu.text}</div>;
        })}
        {elapsed < -0.05 && <div key={Math.ceil(-elapsed)} className="mp-count" style={{ left: '50%', top: '38%' }}>{Math.ceil(-elapsed)}</div>}
      </div>

      <div className="mp-piano">
        <div ref={pianoRowRef} className="mp-white-row">
          {whiteKeys.map((k) => (
            <button key={k.midi} className={`mp-white${pressed.has(k.pitch) ? ' on' : ''}`} style={{ '--c': NOTE_COLOR[k.letter] }}
              onPointerDown={(e) => pressKey(e, k.pitch)} onPointerUp={releaseKey} onPointerCancel={releaseKey} onLostPointerCapture={releaseKey} onContextMenu={block}>
              <span>{VN_NAME[k.letter]}</span>
            </button>
          ))}
        </div>
        {blackKeys.map((k) => {
          const idx = whiteKeys.findIndex((w) => w.midi === k.midi - 1);
          if (idx === -1) return null;
          return (
            <button key={k.midi} className={`mp-black${pressed.has(k.pitch) ? ' on' : ''}`}
              style={{ left: `calc(${idx + 1} * ${wCalc} + ${idx * KEY_GAP + KEY_GAP / 2}px - 0.29 * ${wCalc})`, width: `calc(0.58 * ${wCalc})` }}
              onPointerDown={(e) => pressKey(e, k.pitch)} onPointerUp={releaseKey} onPointerCancel={releaseKey} onLostPointerCapture={releaseKey} onContextMenu={block} />
          );
        })}
      </div>
    </div>
  );
}
