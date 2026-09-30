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
  DURATIONS, TIME_SIGNATURES, NOTE_COLOR,
  pitchToVietnamese, pitchOctave, pitchToMidi, buildPianoKeys,
  durationBeats, durationToToneKey, beatsPerMeasure,
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
  const [playing, setPlaying] = useState(false);
  const [samplerReady, setSamplerReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isSong = lesson?.kind === 'song';

  useEffect(() => { if (lessonId) load(); }, [lessonId]);
  useEffect(() => { ensureSampler(); }, []);

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

  const pitchRows = useMemo(() => buildPianoKeys(rangeMin, rangeMax).reverse(), [rangeMin, rangeMax]);
  const gridBeats = useMemo(() => {
    const last = notes.reduce((m, n) => Math.max(m, n.startBeat + durationBeats(n.duration)), 0);
    return Math.max(32, Math.ceil((last + 8) / 4) * 4);
  }, [notes]);

  function pushHistory() { historyRef.current.push({ notes, rangeMin, rangeMax }); if (historyRef.current.length > 30) historyRef.current.shift(); }
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
  function computePitch(letter, octave) { return `${letter}${accidentalOverride || ''}${octave}`; }

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

  async function playPreview() {
    if (notes.length === 0 || playing) return;
    setPlaying(true);
    try {
      const s = await ensureSampler();
      await s.Tone.start();
      const spb = 60 / (Number(tempoMedium) || tempoBpm || 90);
      const base = s.Tone.now() + 0.1;
      let maxEnd = 0;
      notes.forEach((n) => {
        s.sampler.triggerAttackRelease(n.pitch, durationToToneKey(n.duration), base + n.startBeat * spb);
        maxEnd = Math.max(maxEnd, n.startBeat + durationBeats(n.duration));
      });
      setTimeout(() => setPlaying(false), maxEnd * spb * 1000 + 300);
    } catch (e) { setErrorMsg('Không phát được: ' + e.message); setPlaying(false); }
  }

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
          <button className="primary" onClick={playPreview} disabled={notes.length === 0 || playing || !samplerReady}>{playing ? '🔊 Đang phát…' : samplerReady ? '▶ Nghe thử cả bài' : 'Đang tải piano…'}</button>
          <button onClick={testSound} disabled={!samplerReady}>🔈 Thử âm thanh</button>
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
