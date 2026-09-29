'use client';
// Đặt tại: app/student/music/lessons/[lessonId]/page.jsx
// BẢN THIẾT KẾ LẠI v4 (giao diện game toàn màn hình, gọn và đẹp hơn):
//  - Màn chơi luôn phủ kín khung nhìn (100dvh + vùng an toàn của iPhone), bàn phím
//    piano luôn nằm sát đáy — không còn bị tràn / mất phím khi phóng to trên điện thoại.
//  - Khung nốt chạy tự co giãn theo kích thước thật của màn hình (đo bằng
//    ResizeObserver), tốc độ nốt chạy tỉ lệ theo bề ngang nên máy nào cũng
//    thấy trước nốt ~3 giây.
//  - ĐÈ GIỮ phím = âm thanh piano vang tiếp (nhấn → attack, nhả → release),
//    phím sáng lên khi đang đè, làn nốt tương ứng cũng sáng theo.
//  - Thanh nốt hiện tên nốt gọn (Sol♯), độ dài thanh = độ dài nốt; vạch chờ
//    có ô mục tiêu từng làn; chữ "Hoàn hảo / Tuyệt / Hơi trễ" bay lên khi bấm.
//  - Có đếm ngược 3-2-1, thanh tiến độ, nút thoát có hỏi lại, nút toàn màn
//    hình (chỉ hiện ở trình duyệt hỗ trợ — iPhone Safari không hỗ trợ).
//  - Bàn phím dùng 1 loại sự kiện chung (pointer) nên không còn bị bấm 2 lần.
//
// npm install tone   (nếu repo chưa có)

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { finishMusicLessonAttempt } from '@/lib/musicXp';
import { VN_NAME, NOTE_COLOR, pitchToMidi, durationBeats, buildPianoKeys, starsForScore, LEVELS } from '@/lib/musicNotes';

const LABEL_W = 58;          // cột tên nốt bên trái khung nốt chạy
const HIT_FRAC = 0.2;        // vạch chờ nằm ở 20% bề ngang vùng nốt chạy
const LEAD_IN = 3;           // giây đếm ngược trước khi nốt đầu tiên tới vạch
const PERFECT_T = 0.12, GREAT_T = 0.25, LATE_T = 0.42; // ngưỡng chấm (giây)
const KEY_GAP = 3;           // px giữa các phím trắng

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
.mp-root { position: fixed; inset: 0; z-index: 9999; height: 100vh; height: 100dvh; display: flex; flex-direction: column;
  background: radial-gradient(1100px 560px at 50% -10%, #1d2f55 0%, #0e1729 58%, #080d18 100%); color: #fff;
  font-family: 'Be Vietnam Pro', system-ui, sans-serif; box-sizing: border-box; overscroll-behavior: none;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.mp-root, .mp-root * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
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
.mp-stage { position: relative; flex: 1 1 0; min-height: 0; margin: 0 10px; border-radius: 16px; overflow: hidden;
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); border: 1px solid rgba(255,255,255,.09); }
.mp-popup { position: absolute; font-weight: 900; font-size: 16px; text-shadow: 0 2px 8px rgba(0,0,0,.65); pointer-events: none;
  white-space: nowrap; z-index: 6; animation: mpFloat .75s ease-out forwards; }
.mp-count { position: absolute; font-weight: 900; font-size: 64px; color: rgba(255,255,255,.92); text-shadow: 0 4px 24px rgba(0,0,0,.5);
  pointer-events: none; z-index: 6; animation: mpCount 1s ease-out; }
.mp-piano { position: relative; flex: 0 0 auto; height: 30vh; height: clamp(104px, 30dvh, 210px); margin: 10px 10px 12px; }
.mp-white-row { display: flex; gap: ${KEY_GAP}px; height: 100%; }
.mp-white { position: relative; flex: 1; min-width: 0; border: none; padding: 0 0 9px; display: flex; align-items: flex-end; justify-content: center;
  border-radius: 0 0 12px 12px; background: linear-gradient(180deg, #ffffff 0%, #eef1f6 100%); border-bottom: 5px solid var(--c);
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
@keyframes mpPulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
@keyframes mpFloat { 0% { opacity: 0; transform: translate(-50%, 8px) scale(.85); } 20% { opacity: 1; transform: translate(-50%, 0) scale(1.06); } 100% { opacity: 0; transform: translate(-50%, -28px) scale(1); } }
@keyframes mpCount { 0% { opacity: 0; transform: scale(1.5); } 25% { opacity: 1; transform: scale(1); } 100% { opacity: .15; transform: scale(.9); } }
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
  const stageRef = useRef(null);
  const timelineRef = useRef([]);
  const answerLogsRef = useRef([]);
  const activeRef = useRef(new Map());   // pointerId -> pitch đang đè
  const finishedRef = useRef(false);
  const practiceRef = useRef(false);

  const [lesson, setLesson] = useState(null);
  const [nextLessonId, setNextLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [levelProgress, setLevelProgress] = useState(Object.fromEntries(LEVELS.map((l, i) => [l.key, { unlocked: i === 0, stars: 0 }])));
  const [level, setLevel] = useState(null);
  const [phase, setPhase] = useState('select'); // select | ready | playing | result
  const [samplerReady, setSamplerReady] = useState(false);
  const [result, setResult] = useState(null);
  const [popups, setPopups] = useState([]);
  const [pressed, setPressed] = useState(() => new Set());
  const [stage, setStage] = useState({ w: 360, h: 200 });
  const [fullscreen, setFullscreen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [, forceRender] = useState(0);

  // ---------- Tải dữ liệu ----------
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
    const { data: l } = await supabase
      .from('music_lessons').select('*, music_units(id, order_index)').eq('id', lessonId).single();
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

  // ---------- Hệ thống: toàn màn hình, xoay máy, kích thước khung ----------
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
    if (phase !== 'playing' || !stageRef.current) return undefined;
    const el = stageRef.current;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(el); }
    window.addEventListener('resize', measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', measure); };
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
      // Không tải được mẫu piano (mạng chặn/chậm) -> dùng âm tổng hợp dự phòng để vẫn chơi được.
      sampler = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.4, sustain: 0.25, release: 1 } }).toDestination();
    }
    samplerRef.current = { Tone, sampler };
    setSamplerReady(true);
    return samplerRef.current;
  }
  function noteOn(pitch) {
    const s = samplerRef.current;
    if (!s) return;
    try { s.sampler.triggerAttack(pitch, s.Tone.now(), 0.9); } catch (e) { /* nốt ngoài dải mẫu */ }
  }
  function noteOff(pitch) {
    const s = samplerRef.current;
    if (!s) return;
    try { s.sampler.triggerRelease(pitch, s.Tone.now()); } catch (e) { /* bỏ qua */ }
  }
  function releaseAll() {
    activeRef.current.clear();
    try { samplerRef.current && samplerRef.current.sampler.releaseAll && samplerRef.current.sampler.releaseAll(); } catch (e) { /* bỏ qua */ }
    setPressed(new Set());
  }

  // ---------- Luồng chơi ----------
  function chooseLevel(lvKey) {
    setLevel(lvKey);
    setPhase('ready');
    ensureSampler();
  }

  function startGame() {
    if (!samplerRef.current || notesForPlay.length === 0) return;
    try { samplerRef.current.Tone.start(); } catch (e) { /* bỏ qua */ }
    enterFullscreen();
    const lv = LEVELS.find((l) => l.key === level);
    practiceRef.current = !!lv.selfPaced;
    const bpm = (lesson.tempo_bpm || 90) * (lv.mult ?? 1);
    timelineRef.current = notesForPlay.map((n) => ({
      pitch: n.pitch,
      time: (n.startBeat || 0) * 60 / bpm,
      duration: durationBeats(n.duration) * 60 / bpm,
      judged: null,
      timingError: null,
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
      if (elapsed >= first.time) { pauseOffsetRef.current = raw - first.time; elapsed = first.time; } // khựng lại chờ bấm đúng
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

  function addPopup(text, color, lane) {
    const id = Math.random().toString(36).slice(2);
    setPopups((p) => [...p, { id, text, color, lane }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 800);
  }

  function judgePress(pitch) {
    if (finishedRef.current) return;
    const raw = (performance.now() - startTimeRef.current) / 1000;
    const elapsed = raw - pauseOffsetRef.current;
    const lane = lanePitches.indexOf(pitch);
    const timeline = timelineRef.current;

    if (practiceRef.current) {
      const first = timeline.find((n) => !n.judged);
      if (first && first.pitch === pitch) {
        first.judged = 'hit'; first.timingError = 0;
        answerLogsRef.current.push({ exercise_type: 'play_note', question_content: pitch, correct_answer: pitch, student_answer: pitch, is_correct: true, time_taken_seconds: 0 });
        addPopup('Tuyệt', '#4CC2FF', lane);
        pauseOffsetRef.current = raw - first.time;
      }
      return;
    }

    const candidates = timeline.filter((n) => n.pitch === pitch && !n.judged && Math.abs(n.time - elapsed) <= LATE_T);
    if (candidates.length === 0) return; // bấm chơi tự do — không tính điểm, không phạt
    const note = candidates.sort((a, b) => Math.abs(a.time - elapsed) - Math.abs(b.time - elapsed))[0];
    note.judged = 'hit';
    note.timingError = Math.abs(note.time - elapsed);
    answerLogsRef.current.push({ exercise_type: 'play_note', question_content: note.pitch, correct_answer: note.pitch, student_answer: pitch, is_correct: true, time_taken_seconds: Math.round(note.timingError * 100) / 100 });
    const j = judgeLabel(note.timingError);
    addPopup(j.text, j.color, lane);
  }

  // Đè phím: âm thanh vang tiếp cho tới khi nhả tay.
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
      res = await finishMusicLessonAttempt({
        studentId: user.id, lesson, nextLessonId, level,
        pitchAccuracy, rhythmAccuracy, stars, heartsLeft: lesson.max_hearts || 5, answerLogs: answerLogsRef.current,
      });
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
    finishedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    releaseAll();
    leaveFullscreen();
    backToUnit();
  }

  async function backToSelect() {
    finishedRef.current = true;
    await loadProgress();
    setPhase('select');
  }

  // ================= Giao diện =================
  const styleTag = <style dangerouslySetInnerHTML={{ __html: CSS }} />;

  if (loading || !lesson) {
    return <div className="mp-root">{styleTag}<div className="mp-scroll"><p className="mp-sub">Đang tải…</p></div></div>;
  }

  const levelObj = level ? LEVELS.find((l) => l.key === level) : null;

  if (phase === 'select') {
    return (
      <div className="mp-root">
        {styleTag}
        <div className="mp-top">
          <button className="mp-iconbtn" onClick={backToUnit} aria-label="Quay lại">←</button>
          <div className="mp-title">Chọn cấp độ</div>
          <span style={{ width: 38 }} />
        </div>
        <div className="mp-scroll">
          <div className="mp-card">
            <div style={{ fontSize: 40, textAlign: 'center' }}>🎵</div>
            <h1 className="mp-h1">{lesson.title}</h1>
            <p className="mp-sub">Hoàn thành từng cấp độ để mở cấp tiếp theo</p>
            {LEVELS.map((lv) => {
              const p = levelProgress[lv.key];
              return (
                <button key={lv.key} className="mp-level" disabled={!p.unlocked} onClick={() => chooseLevel(lv.key)}>
                  <span>
                    {p.unlocked ? '▶' : '🔒'} {lv.label}
                    <small>{LEVEL_HINT[lv.key]}</small>
                  </span>
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
      <div className="mp-root">
        {styleTag}
        <div className="mp-top">
          <button className="mp-iconbtn" onClick={backToSelect} aria-label="Quay lại">←</button>
          <div className="mp-title">{lesson.title}<span className="mp-chip">{levelObj.label}</span></div>
          <span style={{ width: 38 }} />
        </div>
        <div className="mp-scroll">
          <div className="mp-card">
            <div style={{ fontSize: 40, textAlign: 'center' }}>🎹</div>
            <h1 className="mp-h1">Sẵn sàng chưa?</h1>
            <p className="mp-sub">{LEVEL_HINT[level]}</p>
            {notesForPlay.length === 0 ? (
              <p className="mp-err">Bài này chưa có nốt nhạc. Nhờ giáo viên soạn thêm nhé.</p>
            ) : (
              <p className="mp-sub">{samplerReady ? '✓ Đàn piano đã sẵn sàng' : 'Đang tải âm thanh đàn piano…'}</p>
            )}
            {isPortrait && <p className="mp-sub">Nên xoay ngang thiết bị để có trải nghiệm tốt nhất.</p>}
            <button className="mp-btn" disabled={!samplerReady || notesForPlay.length === 0} onClick={startGame}>▶ Bắt đầu</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <div className="mp-root">
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

  // ---------- Màn chơi ----------
  const timeline = timelineRef.current;
  const elapsed = elapsedRef.current;
  const layerW = Math.max(120, stage.w - LABEL_W - 2);
  const hitX = layerW * HIT_FRAC;
  const pps = clamp(layerW * 0.27, 110, 230);
  const count = Math.max(1, lanePitches.length);
  const laneH = clamp((stage.h - 16) / count, 28, 64);
  const groupH = laneH * count;
  const innerH = Math.max(stage.h, groupH + 16);
  const groupTop = Math.max(8, (innerH - groupH) / 2);
  const laneTop = (idx) => groupTop + (count - 1 - idx) * laneH;
  const judgedCount = timeline.filter((n) => n.judged).length;
  const pct = timeline.length ? Math.round((judgedCount / timeline.length) * 100) : 0;

  const nW = Math.max(1, whiteKeys.length);
  const wCalc = `((100% - ${(nW - 1) * KEY_GAP}px) / ${nW})`;

  return (
    <div className="mp-root" onContextMenu={block}>
      {styleTag}
      <div className="mp-top">
        <button className="mp-iconbtn" onClick={exitGame} aria-label="Thoát bài học">✕</button>
        <div className="mp-title">{lesson.title}<span className="mp-chip">{levelObj.label}</span></div>
        {canFullscreen ? (
          <button className="mp-iconbtn" onClick={toggleFullscreen} aria-label="Toàn màn hình">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {fullscreen
                ? <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
                : <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />}
            </svg>
          </button>
        ) : <span style={{ width: 38 }} />}
      </div>
      <div className="mp-progress"><div style={{ width: `${pct}%` }} /></div>

      {isPortrait && !hintDismissed && (
        <div className="mp-hint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></svg>
          <span>Xoay ngang thiết bị để có trải nghiệm tốt nhất</span>
          <button onClick={() => setHintDismissed(true)} aria-label="Đóng gợi ý">✕</button>
        </div>
      )}

      <div ref={stageRef} className="mp-stage" style={{ overflowY: groupH + 16 > stage.h + 1 ? 'auto' : 'hidden' }}>
        <div style={{ position: 'relative', width: '100%', height: innerH }}>
          {lanePitches.map((p, i) => {
            const c = noteColor(p);
            return (
              <div key={p} style={{ position: 'absolute', left: 0, right: 0, top: laneTop(i), height: laneH, borderTop: '1px solid rgba(255,255,255,.06)',
                background: pressed.has(p) ? `${c}2b` : (i % 2 ? 'rgba(255,255,255,.025)' : 'transparent'), transition: 'background .08s' }} />
            );
          })}

          <div style={{ position: 'absolute', left: LABEL_W, right: 0, top: 0, height: innerH, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: hitX - 5, top: 0, bottom: 0, width: 10, animation: 'mpPulse 1.2s ease-in-out infinite',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent)' }} />
            {lanePitches.map((p, i) => {
              const c = noteColor(p);
              const on = pressed.has(p);
              return (
                <div key={p} style={{ position: 'absolute', left: hitX - 15, top: laneTop(i) + laneH / 2 - 15, width: 30, height: 30, borderRadius: '50%',
                  border: `2px solid ${c}`, background: on ? `${c}88` : `${c}1f`, boxShadow: on ? `0 0 16px ${c}` : 'none', transition: 'all .08s' }} />
              );
            })}
            {timeline.map((n, idx) => {
              if (n.judged === 'hit' && elapsed - n.time > 0.35) return null;
              const li = lanePitches.indexOf(n.pitch);
              const w = Math.max(30, n.duration * pps - 4);
              const x = hitX + (n.time - elapsed) * pps - 0;
              if (x > layerW + 10 || x + w < -10) return null;
              const c = noteColor(n.pitch);
              const h = Math.max(20, laneH - 12);
              const hit = n.judged === 'hit';
              const miss = n.judged === 'miss';
              return (
                <div key={idx} style={{
                  position: 'absolute', left: 0, top: laneTop(li) + (laneH - h) / 2, width: w, height: h, transform: `translate3d(${x}px,0,0)`, willChange: 'transform',
                  borderRadius: Math.min(14, h / 2), background: hit ? '#58CC02' : miss ? 'rgba(148,163,184,.35)' : c,
                  boxShadow: hit ? '0 0 18px rgba(88,204,2,.8)' : miss ? 'none' : `0 4px 14px ${c}55, inset 0 -3px 0 rgba(0,0,0,.22)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, whiteSpace: 'nowrap',
                  fontSize: Math.min(15, h * 0.42), opacity: miss ? 0.6 : 1,
                }}>{w >= 40 ? shortName(n.pitch) : ''}</div>
              );
            })}
          </div>

          {lanePitches.map((p, i) => (
            <div key={p} style={{ position: 'absolute', left: 8, top: laneTop(i) + laneH / 2 - 12, minWidth: LABEL_W - 16, height: 24, padding: '0 8px', borderRadius: 999,
              background: `${noteColor(p)}26`, border: `1px solid ${noteColor(p)}66`, color: noteColor(p), fontWeight: 800, fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4 }}>{shortName(p)}</div>
          ))}

          {popups.map((pu) => (
            <div key={pu.id} className="mp-popup" style={{ left: LABEL_W + hitX, top: laneTop(pu.lane) + laneH / 2 - 36, color: pu.color }}>{pu.text}</div>
          ))}

          {elapsed < -0.05 && (
            <div key={Math.ceil(-elapsed)} className="mp-count" style={{ left: LABEL_W + layerW / 2, top: Math.max(0, stage.h / 2 - 40), transform: 'translateX(-50%)' }}>
              {Math.ceil(-elapsed)}
            </div>
          )}
        </div>
      </div>

      <div className="mp-piano">
        <div className="mp-white-row">
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
