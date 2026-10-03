'use client';
// Đặt tại: app/teacher/music/lessons/[lessonId]/page.jsx
// VIẾT LẠI (v6) — BỎ HẲN khuông nhạc/bảng nhạc truyền thống (không còn
// giọng, dấu hóa theo giọng, dấu nối/luyến/miễn nhịp, xem trước khuông
// nhạc VexFlow) vì trang học sinh giờ không còn hiển thị bản nhạc kiểu
// cũ nữa — chỉ còn CÔNG CỤ TẠO NỐT (piano roll): bấm vào ô trên lưới để
// đặt nốt đúng cao độ + thời điểm, kéo ngang để chỉnh độ dài, kéo 1 nốt
// đã có để di chuyển, bấm vào nốt để xoá.
//
// Thêm: giáo viên tự đặt TEMPO RIÊNG cho 3 cấp độ Chậm/Vừa/Nhanh, nút
// Nghe thử dùng tiếng piano thật (mượt hơn hẳn bản cũ dùng tiếng tổng
// hợp), và 1 nút Thử âm thanh nhanh để kiểm tra loa/tai nghe.
//
// npm install tone   (nếu repo chưa có — không cần vexflow nữa)

import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  DURATIONS, TIME_SIGNATURES, NOTE_COLOR, normalizePitch,
  pitchToVietnamese, pitchOctave, pitchToMidi, buildPianoKeys,
  durationBeats, beatsPerMeasure,
} from '@/lib/musicNotes';

const backLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};
const OVERRIDE_OPTIONS = [{ key: null, label: 'Tự nhiên' }, { key: '#', label: '♯ Thăng' }, { key: 'b', label: '♭ Giáng' }];
const PLACE_DURATIONS = DURATIONS.filter((d) => d.key !== 'grace');

const BEAT_PX = 72;
const ROW_H = 26;
const SNAP = 0.25;

function snap(beats) { return Math.round(beats / SNAP) * SNAP; }
function nearestDuration(beats) {
  return PLACE_DURATIONS.reduce((best, d) => (Math.abs(d.beats - beats) < Math.abs(best.beats - beats) ? d : best), PLACE_DURATIONS[0]);
}

export default function MusicLessonComposerPage() {
  const { lessonId } = useParams();
  const router = useRouter();
  const gridScrollRef = useRef(null);
  const dragRef = useRef(null);
  const historyRef = useRef([]);
  const samplerRef = useRef(null);

  const [lesson, setLesson] = useState(null);
  const [notes, setNotes] = useState([]);
  const [composer, setComposer] = useState('');
  const [lyricist, setLyricist] = useState('');
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [tempoBpm, setTempoBpm] = useState(90);
  const [tempoSlow, setTempoSlow] = useState('');
  const [tempoMedium, setTempoMedium] = useState('');
  const [tempoFast, setTempoFast] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('quarter');
  const [accidentalOverride, setAccidentalOverride] = useState(null);
  const [rangeMin, setRangeMin] = useState(60);
  const [rangeMax, setRangeMax] = useState(72);
  const [, force] = useState(0);
  const [saving, setSaving] = useState(false);
  const [samplerReady, setSamplerReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [isDraft, setIsDraft] = useState(false);
  const [aiInfo, setAiInfo] = useState(null); // { warnings: [], meta: {} } do AI trả về
  const [playing, setPlaying] = useState(false);

  const isSong = lesson?.kind === 'song';

  useEffect(() => { if (lessonId) load(); }, [lessonId]);
  useEffect(() => {
    ensureSampler();
    return () => {
      try { samplerRef.current?.Tone.Transport.stop(); samplerRef.current?.Tone.Transport.cancel(); } catch (e) { /* bỏ qua */ }
    };
  }, []);

  async function load() {
    if (!lessonId) return;
    const { data: l, error } = await supabase.from('music_lessons').select('*, music_units(id, title)').eq('id', lessonId).single();
    if (error) { setErrorMsg(error.message); return; }
    setLesson(l);
    const ns = (l?.notes || []).filter((n) => n.duration !== 'grace').slice().sort((a, b) => (a.startBeat ?? 0) - (b.startBeat ?? 0));
    setNotes(ns);
    setComposer(l?.composer || '');
    setLyricist(l?.lyricist || '');
    setTimeSignature(l?.time_signature || '4/4');
    const base = l?.tempo_bpm || 90;
    setTempoBpm(base);
    setTempoSlow(l?.tempo_slow || Math.round(base * 0.6));
    setTempoMedium(l?.tempo_medium || base);
    setTempoFast(l?.tempo_fast || Math.round(base * 1.3));
    if (ns.length > 0) {
      const midis = ns.map((n) => pitchToMidi(n.pitch));
      setRangeMin(Math.min(...midis) - 2);
      setRangeMax(Math.max(...midis) + 2);
    }
  }

  async function ensureSampler() {
    if (samplerRef.current) return samplerRef.current;
    const Tone = await import('tone');
    let sampler;
    try {
      sampler = new Tone.Sampler({
        urls: { 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', 'A5': 'A5.mp3', 'C6': 'C6.mp3' },
        release: 1, baseUrl: 'https://tonejs.github.io/audio/salamander/',
      }).toDestination();
      await Promise.race([Tone.loaded(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000))]);
    } catch (e) {
      sampler = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 1 } }).toDestination();
    }
    samplerRef.current = { Tone, sampler };
    setSamplerReady(true);
    return samplerRef.current;
  }
  async function playNote(pitch, dur = '8n') {
    const s = await ensureSampler();
    try { s.Tone.start(); } catch (e) { /* bỏ qua */ }
    try { s.sampler.triggerAttackRelease(pitch, dur); } catch (e) { /* ngoài dải mẫu */ }
  }
  async function testSound() { await playNote('C4', '4n'); }

  // Nghe cả bài (dùng cấp Vừa) để giáo viên đối chiếu bản nháp AI với bản nhạc gốc.
  async function playDraft() {
    if (notes.length === 0) return;
    const s = await ensureSampler();
    try { await s.Tone.start(); } catch (e) { /* bỏ qua */ }
    const T = s.Tone.Transport;
    T.stop(); T.cancel(); T.position = 0;
    const bpm = Number(tempoMedium) || Number(tempoBpm) || 90;
    let end = 0;
    notes.forEach((n) => {
      const startSec = (n.startBeat * 60) / bpm;
      const durSec = Math.max(0.1, ((durationBeats(n.duration) * 60) / bpm) * 0.95);
      T.schedule((time) => { try { s.sampler.triggerAttackRelease(n.pitch, durSec, time); } catch (e) { /* ngoài dải mẫu */ } }, startSec);
      end = Math.max(end, startSec + durSec);
    });
    T.schedule(() => setPlaying(false), end + 0.3);
    setPlaying(true);
    T.start('+0.1');
  }
  function stopPlay() {
    try { const s = samplerRef.current; if (s) { s.Tone.Transport.stop(); s.Tone.Transport.cancel(); s.sampler.releaseAll(); } } catch (e) { /* bỏ qua */ }
    setPlaying(false);
  }

  // Nén/giảm kích thước ảnh trước khi gửi AI (đỡ tốn thời gian tải lên + chi phí).
  function compressImage(file, maxDim = 1568, quality = 0.9) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width: canvas.width, height: canvas.height });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    setErrorMsg('');
    let dataUrl;
    try { ({ dataUrl } = await compressImage(file)); } catch (e) { setErrorMsg('Không mở được file ảnh này (thử PNG/JPG).'); return; }
    setAiPreview(dataUrl);
    runAiExtract(dataUrl);
  }

  async function runAiExtract(dataUrl) {
    setAiLoading(true);
    setErrorMsg('');
    try {
      const base64 = dataUrl.split(',')[1];
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { setErrorMsg('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.'); return; }
      const res = await fetch('/api/ai/transcribe-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg', timeSignature }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg('AI trích xuất lỗi: ' + (data.error || res.statusText)); return; }
      if (!data.notes || data.notes.length === 0) { setErrorMsg('AI không đọc được nốt nào trong ảnh này — thử ảnh rõ hơn hoặc chụp thẳng góc hơn.'); return; }
      if (notes.length > 0 && !window.confirm(`AI đọc được ${data.notes.length} nốt từ ảnh. Thay thế ${notes.length} nốt đang có trong bài bằng bản nháp này? (Vẫn có thể bấm Hoàn tác nếu đổi ý)`)) return;
      pushHistory();
      setNotes(data.notes);
      setIsDraft(true);
      setAiInfo({ warnings: data.warnings || [], meta: data.meta || {} });
      if (data.meta?.timeSignature && TIME_SIGNATURES.includes(data.meta.timeSignature)) setTimeSignature(data.meta.timeSignature);
      if (data.notes.length > 0) {
        const midis = data.notes.map((n) => pitchToMidi(n.pitch));
        setRangeMin(Math.min(...midis) - 2);
        setRangeMax(Math.max(...midis) + 2);
      }
    } catch (e) {
      setErrorMsg('Không gọi được AI: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    function onPaste(e) {
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'));
      if (!item) return;
      e.preventDefault();
      handleImageFile(item.getAsFile());
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const pitchRows = useMemo(() => buildPianoKeys(rangeMin, rangeMax).reverse(), [rangeMin, rangeMax]);
  const gridBeats = useMemo(() => {
    const last = notes.reduce((m, n) => Math.max(m, n.startBeat + durationBeats(n.duration)), 0);
    return Math.max(32, Math.ceil((last + 8) / 4) * 4);
  }, [notes]);

  function pushHistory() { historyRef.current.push({ notes, rangeMin, rangeMax }); if (historyRef.current.length > 30) historyRef.current.shift(); setIsDraft(false); }
  function undo() {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setNotes(prev.notes); setRangeMin(prev.rangeMin); setRangeMax(prev.rangeMax);
    force((x) => x + 1);
  }

  function usedRange() {
    if (notes.length === 0) return null;
    const midis = notes.map((n) => pitchToMidi(n.pitch));
    return { min: Math.min(...midis), max: Math.max(...midis) };
  }
  function addOctaveHigh() { pushHistory(); setRangeMax((v) => v + 12); }
  function removeOctaveHigh() {
    const used = usedRange(); const floor = used ? used.max + 1 : rangeMin + 12;
    if (rangeMax - 12 < floor) { alert('Không bớt được nữa — trong bài đang có nốt cần tới quãng này.'); return; }
    pushHistory(); setRangeMax((v) => v - 12);
  }
  function addOctaveLow() { pushHistory(); setRangeMin((v) => v - 12); }
  function removeOctaveLow() {
    const used = usedRange(); const ceil = used ? used.min - 1 : rangeMax - 12;
    if (rangeMin + 12 > ceil) { alert('Không bớt được nữa — trong bài đang có nốt cần tới quãng này.'); return; }
    pushHistory(); setRangeMin((v) => v + 12);
  }

  function beatFromEvent(clientX) {
    const rect = gridScrollRef.current.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left + gridScrollRef.current.scrollLeft) / BEAT_PX);
  }
  function computePitch(letter, octave) { return normalizePitch(`${letter}${accidentalOverride || ''}${octave}`); }

  function placeNote(rowKey, startBeat, durKey) {
    pushHistory();
    const dur = durationBeats(durKey);
    const pitch = computePitch(rowKey.letter, pitchOctave(rowKey.pitch));
    setNotes((prev) => {
      const filtered = prev.filter((n) => !(n.startBeat < startBeat + dur - 0.001 && n.startBeat + durationBeats(n.duration) > startBeat + 0.001));
      return [...filtered, { pitch, duration: durKey, startBeat: snap(startBeat), lyric: '' }].sort((a, b) => a.startBeat - b.startBeat);
    });
    playNote(pitch);
  }

  function onGridPointerDown(e, rowKey) {
    e.preventDefault();
    const startBeat = snap(beatFromEvent(e.clientX));
    dragRef.current = { place: true, rowKey, startBeat };
    function onMove(ev) {
      const cur = snap(beatFromEvent(ev.clientX));
      dragRef.current.moved = Math.abs(cur - startBeat) >= SNAP;
      dragRef.current.previewEnd = Math.max(startBeat + SNAP, cur);
      force((x) => x + 1);
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const d = dragRef.current;
      if (!d) return;
      const durKey = d.moved ? nearestDuration(d.previewEnd - d.startBeat).key : selectedDuration;
      placeNote(d.rowKey, d.startBeat, durKey);
      dragRef.current = null;
      setAccidentalOverride(null);
      force((x) => x + 1);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onNotePointerDown(e, note) {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startRow = pitchRows.findIndex((r) => r.pitch === note.pitch);
    dragRef.current = { moveNote: note, startBeat: note.startBeat, row: startRow, moved: false, previewEnd: note.startBeat + durationBeats(note.duration) };
    function onMove(ev) {
      const dxBeats = (ev.clientX - startX) / BEAT_PX;
      const dyRows = Math.round((ev.clientY - startY) / ROW_H);
      if (Math.abs(ev.clientX - startX) > 6 || Math.abs(ev.clientY - startY) > 6) dragRef.current.moved = true;
      const newRow = Math.min(pitchRows.length - 1, Math.max(0, startRow + dyRows));
      const newStart = Math.max(0, snap(note.startBeat + dxBeats));
      dragRef.current.row = newRow; dragRef.current.startBeat = newStart; dragRef.current.previewEnd = newStart + durationBeats(note.duration);
      force((x) => x + 1);
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      if (!d.moved) { pushHistory(); setNotes((prev) => prev.filter((n) => n !== note)); force((x) => x + 1); return; }
      const newPitch = pitchRows[d.row].pitch;
      pushHistory();
      setNotes((prev) => {
        const dur = durationBeats(note.duration);
        const withoutSelf = prev.filter((n) => n !== note);
        const filtered = withoutSelf.filter((n) => !(n.pitch === newPitch && n.startBeat < d.startBeat + dur - 0.001 && n.startBeat + durationBeats(n.duration) > d.startBeat + 0.001));
        return [...filtered, { ...note, pitch: newPitch, startBeat: d.startBeat }].sort((a, b) => a.startBeat - b.startBeat);
      });
      playNote(newPitch);
      force((x) => x + 1);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function clearAll() { if (notes.length === 0) return; if (confirm('Xoá hết nốt trong bài này?')) { pushHistory(); setNotes([]); } }

  async function handleSave() {
    setSaving(true); setErrorMsg('');
    const payload = {
      notes, time_signature: timeSignature, tempo_bpm: Number(tempoBpm) || 90,
      tempo_slow: Number(tempoSlow) || null, tempo_medium: Number(tempoMedium) || null, tempo_fast: Number(tempoFast) || null,
      key_signature: 'C', tempo_marking: null, // giữ 2 cột này = mặc định cho tương thích ngược, không còn dùng ở giao diện
      updated_at: new Date().toISOString(),
    };
    if (isSong) { payload.composer = composer || null; payload.lyricist = lyricist || null; }
    const { data, error } = await supabase.from('music_lessons').update(payload).eq('id', lessonId).select();
    setSaving(false);
    if (error) { setErrorMsg(error.message); return; }
    if (!data || data.length === 0) { setErrorMsg('Lưu không thành công — kiểm tra lại phân công môn Âm nhạc (teacher_assignments).'); return; }
    router.push(`/teacher/music/units/${lesson.music_units.id}`);
  }

  if (!lesson) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;
  const preview = dragRef.current;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 24px 20px 70px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        h1 { font-size: 21px; color: #17302d; margin: 12px 0 4px; }
        .sub-note { color: #6b7f7a; font-size: 13px; margin: 0 0 16px; max-width: 700px; }
        .card { background: #fff; border-radius: 16px; padding: 16px 18px; margin-bottom: 14px; border: 1px solid #e5eeec; box-shadow: 0 2px 8px rgba(23,48,45,0.04); }
        .card h2 { margin: 0 0 12px; font-size: 14px; color: #17302d; }
        .meta-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .meta-row > div { flex: 1; min-width: 130px; }
        label.fl { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
        input.f, select.f { width: 100%; padding: 8px 10px; border-radius: 9px; border: 1.5px solid #e2e8f0; font-size: 13px; font-family: inherit; box-sizing: border-box; }
        .chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 6px 13px; font-size: 12.5px; font-weight: 600; color: #374151; cursor: pointer; }
        .chip.active { border-color: #225da3; background: #E9F2FC; color: #225da3; }
        .toolbar { display: flex; gap: 6px; flex-wrap: wrap; }
        .toolbar button { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 9px; padding: 7px 12px; font-size: 12.5px; font-weight: 600; color: #374151; cursor: pointer; }
        .toolbar button:disabled { opacity: 0.4; }
        .toolbar button.primary { background: #58CC02; border-color: #58CC02; color: #fff; }
        .roll { display: flex; border: 1px solid #e5eeec; border-radius: 12px; overflow: hidden; }
        .piano-col { flex-shrink: 0; width: 76px; }
        .grid-scroll { overflow-x: auto; flex: 1; position: relative; }
        .row-key { height: ${ROW_H}px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-size: 10.5px; font-weight: 700; border-bottom: 1px solid #eef1f0; box-sizing: border-box; }
        .error { color: #a3374a; font-size: 13px; background: #fdeef0; padding: 9px 13px; border-radius: 9px; margin-bottom: 12px; }
        .save-btn { width: 100%; padding: 13px; background: #225da3; color: #fff; border: none; border-radius: 11px; font-weight: 700; font-size: 14.5px; cursor: pointer; box-shadow: 0 3px 0 #184270; }
        .save-btn:disabled { background: #9ca3af; box-shadow: none; }
      `}</style>

      <Link href={`/teacher/music/units/${lesson.music_units.id}`} style={backLinkStyle}>← {lesson.music_units.title}</Link>
      <h1>{lesson.title} {isSong ? '🎤' : '🎼'}</h1>
      <p className="sub-note">Bấm vào ô trên lưới để đặt nốt (đúng cao độ theo hàng, đúng thời điểm theo cột) — kéo ngang lúc bấm để tự chọn độ dài. Bấm vào 1 nốt đã có để xoá; bấm giữ rồi kéo để di chuyển sang thời điểm/cao độ khác.</p>

      {isDraft && (
        <div className="card" style={{ background: '#FEF3E2', borderColor: '#f3cf8f' }}>
          <strong style={{ color: '#92400e' }}>⚠️ Đây là bản nháp do AI đọc từ ảnh — chưa chắc đúng 100%.</strong>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#92400e' }}>Hãy rà lại từng nốt trên lưới (so với bản nhạc gốc), bấm giữ-kéo để sửa nốt sai trước khi bấm Lưu bài học. Dòng cảnh báo này tự biến mất khi bạn sửa bất kỳ nốt nào.</p>
        </div>
      )}

      {aiInfo && (aiInfo.warnings.length > 0 || aiInfo.meta?.keySignature || aiInfo.meta?.tempoBpm) && (
        <div className="card" style={{ background: '#EEF5FD', borderColor: '#bcd5f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <strong style={{ color: '#184270', fontSize: 13.5 }}>
              AI nhận thấy: {[aiInfo.meta?.keySignature && `giọng ${aiInfo.meta.keySignature}`, aiInfo.meta?.timeSignature && `nhịp ${aiInfo.meta.timeSignature}`, aiInfo.meta?.tempoBpm && `♩ = ${aiInfo.meta.tempoBpm}`].filter(Boolean).join(' · ') || 'không có thông tin đầu khuông'}
            </strong>
            <button className="chip" onClick={() => setAiInfo(null)}>Ẩn</button>
          </div>
          {aiInfo.warnings.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: '#184270' }}>
              {aiInfo.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h2>🤖 Trích xuất nốt từ ảnh bản nhạc (AI — chỉ ra bản nháp)</h2>
        <p className="sub-note" style={{ margin: '0 0 10px' }}>Dán ảnh (Ctrl+V sau khi chụp màn hình/copy ảnh) hoặc chọn file ảnh chụp bản nhạc. AI chỉ đọc ra bản nháp — bạn vẫn cần tự nghe/sửa lại cho đúng trước khi lưu, vì AI đọc bản nhạc phức tạp có thể sai.</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="chip" style={{ cursor: 'pointer' }}>
            📁 Chọn ảnh
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && handleImageFile(e.target.files[0])} />
          </label>
          <span style={{ fontSize: 12.5, color: '#9ca3af' }}>hoặc dán ảnh trực tiếp vào trang (Ctrl+V)</span>
          {aiLoading && <span style={{ fontSize: 12.5, color: '#225da3', fontWeight: 700 }}>⏳ AI đang đọc bản nhạc… (có thể mất 10-30 giây)</span>}
        </div>
        {aiPreview && <img src={aiPreview} alt="Ảnh bản nhạc vừa gửi AI" style={{ maxWidth: 220, maxHeight: 140, marginTop: 10, borderRadius: 8, border: '1px solid #e5eeec' }} />}
      </div>

      {isSong && (
        <div className="card">
          <div className="meta-row">
            <div><label className="fl">Nhạc sĩ</label><input className="f" value={composer} onChange={(e) => setComposer(e.target.value)} /></div>
            <div><label className="fl">Lời thơ</label><input className="f" value={lyricist} onChange={(e) => setLyricist(e.target.value)} /></div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Nhịp &amp; tốc độ 3 cấp độ</h2>
        <div className="meta-row" style={{ marginBottom: 10 }}>
          <div><label className="fl">Nhịp (chỉ để kẻ lưới)</label><select className="f" value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)}>{TIME_SIGNATURES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="fl">Tempo cơ bản (BPM)</label><input className="f" type="number" value={tempoBpm} onChange={(e) => setTempoBpm(e.target.value)} /></div>
        </div>
        <div className="meta-row">
          <div><label className="fl">🐢 Cấp Chậm (BPM)</label><input className="f" type="number" value={tempoSlow} onChange={(e) => setTempoSlow(e.target.value)} /></div>
          <div><label className="fl">🚶 Cấp Vừa (BPM)</label><input className="f" type="number" value={tempoMedium} onChange={(e) => setTempoMedium(e.target.value)} /></div>
          <div><label className="fl">🐇 Cấp Nhanh (BPM)</label><input className="f" type="number" value={tempoFast} onChange={(e) => setTempoFast(e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <h2>Độ dài khi bấm (không kéo)</h2>
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {PLACE_DURATIONS.map((d) => <button key={d.key} className={selectedDuration === d.key ? 'chip active' : 'chip'} onClick={() => setSelectedDuration(d.key)}>{d.label}</button>)}
        </div>
        <label className="fl">Dấu hóa cho nốt tiếp theo</label>
        <div className="chip-row">
          {OVERRIDE_OPTIONS.map((o) => <button key={o.label} className={accidentalOverride === o.key ? 'chip active' : 'chip'} onClick={() => setAccidentalOverride(o.key)}>{o.label}</button>)}
        </div>
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <button onClick={undo} disabled={historyRef.current.length === 0}>↩ Hoàn tác</button>
          <button onClick={clearAll} disabled={notes.length === 0}>🗑 Xoá hết</button>
          <button onClick={testSound} disabled={!samplerReady}>🔈 Thử âm thanh</button>
          <button className="primary" onClick={playing ? stopPlay : playDraft} disabled={!samplerReady || notes.length === 0}>{playing ? '⏹ Dừng' : '▶ Nghe cả bài'}</button>
          <button onClick={addOctaveLow}>⬇ Thêm quãng thấp</button>
          <button onClick={removeOctaveLow}>✕ Bớt quãng thấp</button>
          <button onClick={addOctaveHigh}>⬆ Thêm quãng cao</button>
          <button onClick={removeOctaveHigh}>✕ Bớt quãng cao</button>
        </div>

        <div className="roll">
          <div className="piano-col">
            {pitchRows.map((k) => (
              <div key={k.midi} className="row-key" style={{ background: k.isBlack ? '#2a2a2a' : '#fff', color: k.isBlack ? '#fff' : NOTE_COLOR[k.letter] }}>
                {pitchToVietnamese(k.pitch)}{pitchOctave(k.pitch)}
              </div>
            ))}
          </div>
          <div ref={gridScrollRef} className="grid-scroll" style={{ height: pitchRows.length * ROW_H }}>
            <div style={{ position: 'relative', width: gridBeats * BEAT_PX, height: pitchRows.length * ROW_H }}>
              {pitchRows.map((k, ri) => (
                <div key={k.midi} onPointerDown={(e) => onGridPointerDown(e, k)}
                  style={{ position: 'absolute', top: ri * ROW_H, width: gridBeats * BEAT_PX, height: ROW_H, background: k.isBlack ? '#f7f8f9' : '#fff', borderBottom: '1px solid #eef1f0' }} />
              ))}
              {Array.from({ length: Math.floor(gridBeats / beatsPerMeasure(timeSignature)) + 1 }).map((_, mi) => (
                <div key={mi} style={{ position: 'absolute', left: mi * beatsPerMeasure(timeSignature) * BEAT_PX, top: 0, bottom: 0, width: mi === 0 ? 0 : 1.5, background: '#c7ccd1' }} />
              ))}
              {notes.map((n, i) => {
                const ri = pitchRows.findIndex((r) => r.pitch === n.pitch);
                if (ri === -1) return null;
                const isBeingMoved = preview && preview.moveNote === n && preview.moved;
                return (
                  <div key={i} onPointerDown={(e) => onNotePointerDown(e, n)}
                    style={{ position: 'absolute', top: ri * ROW_H + 1, left: n.startBeat * BEAT_PX, width: durationBeats(n.duration) * BEAT_PX - 2, background: NOTE_COLOR[n.pitch[0]], height: ROW_H - 3, borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 10.5, display: 'flex', alignItems: 'center', padding: '0 5px', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', opacity: isBeingMoved ? 0.25 : 1 }}>
                    {pitchToVietnamese(n.pitch)}{pitchOctave(n.pitch)}
                  </div>
                );
              })}
              {preview && preview.rowKey && (
                <div style={{ position: 'absolute', top: pitchRows.findIndex((r) => r.pitch === preview.rowKey.pitch) * ROW_H + 1, left: preview.startBeat * BEAT_PX, width: Math.max(SNAP, (preview.previewEnd || preview.startBeat + SNAP) - preview.startBeat) * BEAT_PX - 2, height: ROW_H - 3, background: 'rgba(34,93,163,0.5)', borderRadius: 6 }} />
              )}
              {preview && preview.moveNote && preview.moved && (
                <div style={{ position: 'absolute', top: preview.row * ROW_H + 1, left: preview.startBeat * BEAT_PX, width: (preview.previewEnd - preview.startBeat) * BEAT_PX - 2, height: ROW_H - 3, background: NOTE_COLOR[preview.moveNote.pitch[0]], opacity: 0.85, borderRadius: 6, border: '2px dashed #fff' }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {errorMsg && <div className="error">{errorMsg}</div>}
      <button className="save-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu…' : '💾 Lưu bài học'}</button>
    </div>
  );
}
