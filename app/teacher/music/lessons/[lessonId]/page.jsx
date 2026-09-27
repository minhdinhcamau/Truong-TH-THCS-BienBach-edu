'use client';
// Đặt tại: app/teacher/music/lessons/[lessonId]/page.jsx
// VIẾT LẠI TOÀN BỘ (v5) — kiểu "piano roll" như phần mềm dựng nhạc
// (Synthesia/FL Studio/GarageBand): bàn phím piano dọc bên trái, lưới thời
// gian bên phải — BẤM vào ô nào là đặt nốt ở ĐÚNG cao độ + thời điểm đó,
// KÉO ngang lúc bấm để tự chọn ĐỘ DÀI nốt (không kéo = dùng độ dài đang
// chọn sẵn). Không còn kiểu "bấm phím để nối đuôi nốt mới vào cuối bài".
//
// Vì giờ có thể đặt nốt CÁCH QUÃNG (không liền tù tì như trước), những chỗ
// trống sẽ tự động lấp bằng DẤU LẶNG (rest) khi vẽ ra khuông nhạc bên dưới
// để bản nhạc luôn đúng chuẩn nhìn từ khuông nhạc.
//
// Các chế độ "bấm để..." (đổi bằng thanh nút "Chế độ bấm"):
//   Đặt/xoá nốt (mặc định) · Gắn/gỡ dấu miễn nhịp · Nối 2 nốt cùng cao độ ·
//   Luyến 2 nốt khác cao độ · Gõ lời cho nốt (bài hát)
//
// npm install vexflow tone   (nếu repo chưa có)

import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  DURATIONS, KEY_SIGNATURES, TIME_SIGNATURES, NOTE_COLOR,
  pitchToVietnamese, pitchOctave, pitchToMidi, buildPianoKeys,
  keyDefaultAccidental, durationToVexKey, durationBeats, durationToToneKey, beatsPerMeasure,
} from '@/lib/musicNotes';

const backLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};
const OVERRIDE_OPTIONS = [{ key: null, label: 'Theo giọng' }, { key: '#', label: '♯' }, { key: 'b', label: '♭' }, { key: 'n', label: '♮' }];
const PAINT_MODES = [
  { key: 'note', label: '✏️ Đặt / xoá nốt' },
  { key: 'fermata', label: '𝄐 Miễn nhịp' },
  { key: 'tie', label: '⌒ Nối' },
  { key: 'slur', label: '⌣ Luyến' },
  { key: 'lyric', label: '💬 Lời' },
];

const BEAT_PX = 72;
const ROW_H = 26;
const SNAP = 0.25; // lưới nhỏ nhất = móc kép

function snap(beats) { return Math.round(beats / SNAP) * SNAP; }
function nearestDuration(beats) {
  const list = DURATIONS.filter((d) => d.key !== 'grace');
  return list.reduce((best, d) => (Math.abs(d.beats - beats) < Math.abs(best.beats - beats) ? d : best), list[0]);
}
// Lấp khoảng trống giữa các nốt bằng dấu lặng (rest) — tham lam: luôn chọn
// trường độ chuẩn LỚN NHẤT vừa khít, cho tới khi lấp đầy khoảng trống.
function fillGapsWithRests(sortedNotes, endBeat) {
  const restDurations = [...DURATIONS.filter((d) => d.key !== 'grace')].sort((a, b) => b.beats - a.beats);
  const out = [];
  let cursor = 0;
  sortedNotes.forEach((n) => {
    let gap = n.startBeat - cursor;
    while (gap > 0.01) {
      const d = restDurations.find((rd) => rd.beats <= gap + 0.001) || restDurations[restDurations.length - 1];
      out.push({ rest: true, duration: d.key, beats: d.beats });
      gap -= d.beats;
    }
    out.push({ rest: false, original: n }); // giữ nguyên tham chiếu gốc để tra cứu nối/luyến đúng chỉ số
    cursor = n.startBeat + durationBeats(n.duration);
  });
  let tailGap = endBeat - cursor;
  while (tailGap > 0.01) {
    const d = restDurations.find((rd) => rd.beats <= tailGap + 0.001) || restDurations[restDurations.length - 1];
    out.push({ rest: true, duration: d.key, beats: d.beats });
    tailGap -= d.beats;
  }
  return out;
}

export default function MusicLessonComposerPage() {
  const { lessonId } = useParams();
  const router = useRouter();
  const staffRef = useRef(null);
  const gridScrollRef = useRef(null);
  const dragRef = useRef(null);
  const historyRef = useRef([]);

  const [lesson, setLesson] = useState(null);
  const [notes, setNotes] = useState([]);
  const [composer, setComposer] = useState('');
  const [lyricist, setLyricist] = useState('');
  const [keySignature, setKeySignature] = useState('C');
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [tempoMarking, setTempoMarking] = useState('');
  const [tempoBpm, setTempoBpm] = useState(90);
  const [selectedDuration, setSelectedDuration] = useState('quarter');
  const [accidentalOverride, setAccidentalOverride] = useState(null);
  const [paintMode, setPaintMode] = useState('note');
  const [rangeMin, setRangeMin] = useState(60); // C4
  const [rangeMax, setRangeMax] = useState(72); // C5
  const [, force] = useState(0);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isSong = lesson?.kind === 'song';

  useEffect(() => { if (lessonId) load(); }, [lessonId]);

  async function load() {
    if (!lessonId) return;
    const { data: l, error } = await supabase
      .from('music_lessons').select('*, music_units(id, title)').eq('id', lessonId).single();
    if (error) { setErrorMsg(error.message); return; }
    setLesson(l);
    const ns = (l?.notes || []).slice().sort((a, b) => (a.startBeat ?? 0) - (b.startBeat ?? 0));
    setNotes(ns);
    setComposer(l?.composer || '');
    setLyricist(l?.lyricist || '');
    setKeySignature(l?.key_signature || 'C');
    setTimeSignature(l?.time_signature || '4/4');
    setTempoMarking(l?.tempo_marking || '');
    setTempoBpm(l?.tempo_bpm || 90);
    if (ns.length > 0) {
      const midis = ns.map((n) => pitchToMidi(n.pitch));
      setRangeMin(Math.min(...midis) - 2);
      setRangeMax(Math.max(...midis) + 2);
    }
  }

  const pitchRows = useMemo(() => buildPianoKeys(rangeMin, rangeMax).reverse(), [rangeMin, rangeMax]); // cao ở trên
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

  useEffect(() => { if (lesson) renderStaff(); }, [notes, lesson, keySignature, timeSignature]);

  async function renderStaff() {
    if (!staffRef.current) return;
    staffRef.current.innerHTML = '';
    if (notes.length === 0) return;

    const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Articulation, StaveTie, Curve } = await import('vexflow');
    const bpMeasure = beatsPerMeasure(timeSignature);
    const measuresPerLine = 4;
    const lineBeats = bpMeasure * measuresPerLine;

    const withRests = fillGapsWithRests(notes, Math.ceil(gridBeats / lineBeats) * lineBeats);
    // Gán lại startBeat tuyệt đối cho từng phần tử (kể cả rest) để chia dòng đúng.
    let cursor = 0;
    const items = withRests.map((it) => {
      const startBeat = cursor;
      cursor += it.rest ? it.beats : durationBeats(it.original.duration);
      return { ...it, startBeat };
    });

    const lines = [];
    items.forEach((it) => {
      const lineNo = Math.floor(it.startBeat / lineBeats);
      if (!lines[lineNo]) lines[lineNo] = [];
      lines[lineNo].push(it);
    });

    const lineHeight = isSong ? 190 : 160;
    const width = Math.max(500, measuresPerLine * bpMeasure * 90);
    const renderer = new Renderer(staffRef.current, Renderer.Backends.SVG);
    renderer.resize(width, lineHeight * lines.length + 10);
    const context = renderer.getContext();
    const idxToStaveNote = new Map();

    lines.forEach((lineItems, lineNo) => {
      if (!lineItems) return;
      const y = 20 + lineNo * lineHeight;
      const stave = new Stave(10, y, width - 20);
      if (lineNo === 0) {
        stave.addClef('treble').addTimeSignature(timeSignature);
        if (keySignature !== 'C') stave.addKeySignature(keySignature);
      }
      stave.setContext(context).draw();

      const staveNotes = lineItems.map((it) => {
        if (it.rest) return new StaveNote({ keys: ['b/4'], duration: durationToVexKey(it.duration) + 'r' });
        const n = it.original;
        const m = /^([A-G])(#|b)?(\d)$/.exec(n.pitch);
        const letter = m ? m[1] : 'C', accidental = m ? (m[2] || '') : '', octave = m ? m[3] : '4';
        const sn = new StaveNote({ keys: [`${letter.toLowerCase()}${accidental}/${octave}`], duration: durationToVexKey(n.duration) });
        const expected = keyDefaultAccidental(keySignature, letter) || '';
        if (accidental !== expected) sn.addModifier(new Accidental(accidental || 'n'));
        if (n.fermata) sn.addModifier(new Articulation('a@a').setPosition(3));
        idxToStaveNote.set(notes.indexOf(n), sn);
        return sn;
      });
      const totalBeats = lineItems.reduce((s, it) => s + (it.rest ? it.beats : durationBeats(it.original.duration)), 0);
      const voice = new Voice({ numBeats: totalBeats || bpMeasure, beatValue: 4 }).setStrict(false);
      voice.addTickables(staveNotes);
      new Formatter().joinVoices([voice]).format([voice], width - (lineNo === 0 ? 90 : 40));
      voice.draw(context, stave);
    });

    notes.forEach((n, i) => {
      if (!n.tieToNext && !n.slurToNext) return;
      const nxt = notes.find((o) => Math.abs(o.startBeat - (n.startBeat + durationBeats(n.duration))) < 0.05 && o.pitch === (n.tieToNext ? n.pitch : o.pitch));
      const a = idxToStaveNote.get(i);
      const b = nxt ? idxToStaveNote.get(notes.indexOf(nxt)) : null;
      if (!a || !b) return;
      if (n.tieToNext) new StaveTie({ first_note: a, last_note: b, first_indices: [0], last_indices: [0] }).setContext(context).draw();
      else if (n.slurToNext) new Curve(a, b, {}).setContext(context).draw();
    });
  }

  function beatFromEvent(clientX) {
    const rect = gridScrollRef.current.getBoundingClientRect();
    const x = clientX - rect.left + gridScrollRef.current.scrollLeft;
    return Math.max(0, x / BEAT_PX);
  }

  function computePitch(letter, octave) {
    let accidental;
    if (accidentalOverride === 'n') accidental = '';
    else if (accidentalOverride) accidental = accidentalOverride;
    else accidental = keyDefaultAccidental(keySignature, letter) || '';
    return `${letter}${accidental}${octave}`;
  }

  function placeNote(rowKey, startBeat, durKey) {
    pushHistory();
    const dur = durationBeats(durKey);
    setNotes((prev) => {
      const filtered = prev.filter((n) => !(n.startBeat < startBeat + dur - 0.001 && n.startBeat + durationBeats(n.duration) > startBeat + 0.001));
      const next = [...filtered, { pitch: rowKey.pitch, duration: durKey, startBeat: snap(startBeat), lyric: '', fermata: false, tieToNext: false, slurToNext: false }];
      return next.sort((a, b) => a.startBeat - b.startBeat);
    });
    import('tone').then(async (Tone) => { await Tone.start(); const s = new Tone.Synth().toDestination(); s.triggerAttackRelease(rowKey.pitch, '8n'); });
  }

  function onGridPointerDown(e, rowKey) {
    if (paintMode !== 'note') return;
    e.preventDefault();
    const startBeat = snap(beatFromEvent(e.clientX));
    dragRef.current = { rowKey, startBeat, moved: false };
    function onMove(ev) {
      const cur = snap(beatFromEvent(ev.clientX));
      if (Math.abs(cur - startBeat) >= SNAP) dragRef.current.moved = true;
      dragRef.current.previewEnd = Math.max(startBeat + SNAP, cur);
      force((x) => x + 1);
    }
    function onUp() {
      const d = dragRef.current;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
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

  function usedRange() {
    if (notes.length === 0) return null;
    const midis = notes.map((n) => pitchToMidi(n.pitch));
    return { min: Math.min(...midis), max: Math.max(...midis) };
  }
  function addOctaveHigh() { pushHistory(); setRangeMax((v) => v + 12); }
  function removeOctaveHigh() {
    const used = usedRange();
    const floor = used ? used.max + 1 : rangeMin + 12;
    if (rangeMax - 12 < floor) { alert('Không bớt được nữa — trong bài đang có nốt cần tới quãng này.'); return; }
    pushHistory(); setRangeMax((v) => v - 12);
  }
  function addOctaveLow() { pushHistory(); setRangeMin((v) => v - 12); }
  function removeOctaveLow() {
    const used = usedRange();
    const ceil = used ? used.min - 1 : rangeMax - 12;
    if (rangeMin + 12 > ceil) { alert('Không bớt được nữa — trong bài đang có nốt cần tới quãng này.'); return; }
    pushHistory(); setRangeMin((v) => v + 12);
  }

  function onNotePointerDown(e, note) {
    e.stopPropagation();
    if (paintMode !== 'note') {
      // Các chế độ khác: bấm là làm ngay, không kéo-di-chuyển được.
      if (paintMode === 'fermata') { pushHistory(); setNotes((prev) => prev.map((n) => (n === note ? { ...n, fermata: !n.fermata } : n))); }
      else if (paintMode === 'tie') { pushHistory(); setNotes((prev) => prev.map((n) => (n === note ? { ...n, tieToNext: !n.tieToNext, slurToNext: false } : n))); }
      else if (paintMode === 'slur') { pushHistory(); setNotes((prev) => prev.map((n) => (n === note ? { ...n, slurToNext: !n.slurToNext, tieToNext: false } : n))); }
      else if (paintMode === 'lyric') {
        const text = window.prompt('Lời cho nốt này:', note.lyric || '');
        if (text !== null) { pushHistory(); setNotes((prev) => prev.map((n) => (n === note ? { ...n, lyric: text } : n))); }
      }
      return;
    }
    // Chế độ "Đặt/xoá nốt": bấm giữ rồi kéo = DI CHUYỂN nốt sang vị trí/cao độ khác; bấm không kéo = XOÁ.
    const startX = e.clientX, startY = e.clientY;
    const startRow = pitchRows.findIndex((r) => r.pitch === note.pitch);
    dragRef.current = { moveNote: note, startBeat: note.startBeat, row: startRow, moved: false, previewEnd: note.startBeat + durationBeats(note.duration) };
    function onMove(ev) {
      const dxBeats = (ev.clientX - startX) / BEAT_PX;
      const dyRows = Math.round((ev.clientY - startY) / ROW_H);
      if (Math.abs(ev.clientX - startX) > 6 || Math.abs(ev.clientY - startY) > 6) dragRef.current.moved = true;
      const newRow = Math.min(pitchRows.length - 1, Math.max(0, startRow + dyRows));
      const newStart = Math.max(0, snap(note.startBeat + dxBeats));
      dragRef.current.row = newRow;
      dragRef.current.startBeat = newStart;
      dragRef.current.previewEnd = newStart + durationBeats(note.duration);
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
        const moved = { ...note, pitch: newPitch, startBeat: d.startBeat };
        return [...filtered, moved].sort((a, b) => a.startBeat - b.startBeat);
      });
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
      const Tone = await import('tone');
      await Tone.start();
      const synth = new Tone.Synth().toDestination();
      const spb = 60 / (tempoBpm || 90);
      const base = Tone.now();
      let maxEnd = 0;
      notes.forEach((n) => {
        const t = base + n.startBeat * spb;
        synth.triggerAttackRelease(n.pitch, durationToToneKey(n.duration), t);
        maxEnd = Math.max(maxEnd, n.startBeat + durationBeats(n.duration));
      });
      setTimeout(() => setPlaying(false), maxEnd * spb * 1000 + 200);
    } catch (e) { setErrorMsg('Không phát được: ' + e.message); setPlaying(false); }
  }

  async function handleSave() {
    setSaving(true); setErrorMsg('');
    const payload = { notes, key_signature: keySignature, time_signature: timeSignature, tempo_marking: tempoMarking || null, tempo_bpm: Number(tempoBpm) || 90, updated_at: new Date().toISOString() };
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
        .meta-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .meta-row > div { flex: 1; min-width: 140px; }
        label.fl { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
        input.f, select.f { width: 100%; padding: 8px 10px; border-radius: 9px; border: 1.5px solid #e2e8f0; font-size: 13px; font-family: inherit; box-sizing: border-box; }
        .chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 6px 13px; font-size: 12.5px; font-weight: 600; color: #374151; cursor: pointer; }
        .chip.active { border-color: #225da3; background: #E9F2FC; color: #225da3; }
        .toolbar { display: flex; gap: 6px; flex-wrap: wrap; }
        .toolbar button { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 9px; padding: 7px 12px; font-size: 12.5px; font-weight: 600; color: #374151; cursor: pointer; }
        .toolbar button:disabled { opacity: 0.4; }
        .roll { display: flex; border: 1px solid #e5eeec; border-radius: 12px; overflow: hidden; }
        .piano-col { flex-shrink: 0; width: 76px; }
        .grid-scroll { overflow-x: auto; flex: 1; position: relative; }
        .row-key { height: ${ROW_H}px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-size: 10.5px; font-weight: 700; border-bottom: 1px solid #eef1f0; box-sizing: border-box; }
        .grid-row { position: absolute; left: 0; right: 0; height: ${ROW_H}px; border-bottom: 1px solid #eef1f0; }
        .grid-note { position: absolute; height: ${ROW_H - 3}px; border-radius: 6px; color: #fff; font-weight: 700; font-size: 10.5px; display: flex; align-items: center; padding: 0 5px; cursor: pointer; overflow: hidden; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        .staff-card .staff { overflow-x: auto; min-height: 40px; }
        .error { color: #a3374a; font-size: 13px; background: #fdeef0; padding: 9px 13px; border-radius: 9px; margin-bottom: 12px; }
        .save-btn { width: 100%; padding: 13px; background: #225da3; color: #fff; border: none; border-radius: 11px; font-weight: 700; font-size: 14.5px; cursor: pointer; box-shadow: 0 3px 0 #184270; }
        .save-btn:disabled { background: #9ca3af; box-shadow: none; }
      `}</style>

      <Link href={`/teacher/music/units/${lesson.music_units.id}`} style={backLinkStyle}>← {lesson.music_units.title}</Link>
      <h1>{lesson.title} {isSong ? '🎤' : '🎼'}</h1>
      <p className="sub-note">Bấm vào ô trên lưới để đặt nốt (theo đúng cao độ của hàng, đúng thời điểm của cột) — kéo ngang lúc bấm để tự chọn độ dài, không kéo thì dùng độ dài đang chọn sẵn bên dưới. Bấm vào 1 nốt đã có để xoá (hoặc để gắn dấu miễn nhịp/nối/luyến/lời tuỳ chế độ bấm đang chọn).</p>

      {isSong && (
        <div className="card">
          <div className="meta-row">
            <div><label className="fl">Nhạc sĩ</label><input className="f" value={composer} onChange={(e) => setComposer(e.target.value)} /></div>
            <div><label className="fl">Lời thơ</label><input className="f" value={lyricist} onChange={(e) => setLyricist(e.target.value)} /></div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="meta-row">
          <div><label className="fl">Giọng</label><select className="f" value={keySignature} onChange={(e) => setKeySignature(e.target.value)}>{KEY_SIGNATURES.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></div>
          <div><label className="fl">Nhịp</label><select className="f" value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)}>{TIME_SIGNATURES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="fl">Chỉ dẫn tốc độ</label><input className="f" value={tempoMarking} onChange={(e) => setTempoMarking(e.target.value)} placeholder="Vừa phải" /></div>
          <div><label className="fl">Tempo (BPM)</label><input className="f" type="number" value={tempoBpm} onChange={(e) => setTempoBpm(e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <label className="fl">Độ dài khi bấm (không kéo)</label>
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {DURATIONS.map((d) => <button key={d.key} className={selectedDuration === d.key ? 'chip active' : 'chip'} onClick={() => setSelectedDuration(d.key)}>{d.label}</button>)}
        </div>
        <label className="fl">Dấu hóa cho nốt tiếp theo</label>
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {OVERRIDE_OPTIONS.map((o) => <button key={o.label} className={accidentalOverride === o.key ? 'chip active' : 'chip'} onClick={() => setAccidentalOverride(o.key)}>{o.label}</button>)}
        </div>
        <label className="fl">Chế độ bấm</label>
        <div className="chip-row">
          {PAINT_MODES.filter((m) => isSong || m.key !== 'lyric').map((m) => <button key={m.key} className={paintMode === m.key ? 'chip active' : 'chip'} onClick={() => setPaintMode(m.key)}>{m.label}</button>)}
        </div>
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <button onClick={undo} disabled={historyRef.current.length === 0}>↩ Hoàn tác</button>
          <button onClick={clearAll} disabled={notes.length === 0}>🗑 Xoá hết</button>
          <button onClick={playPreview} disabled={notes.length === 0 || playing}>{playing ? '🔊 Đang phát…' : '▶ Nghe thử'}</button>
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
                <div key={k.midi} className="grid-row" onPointerDown={(e) => onGridPointerDown(e, k)}
                  style={{ top: ri * ROW_H, width: gridBeats * BEAT_PX, background: k.isBlack ? '#f7f8f9' : '#fff' }} />
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
                    {pitchToVietnamese(n.pitch)}{n.fermata ? ' 𝄐' : ''}{n.tieToNext ? ' ⌒' : ''}{n.slurToNext ? ' ⌣' : ''}{n.lyric ? ` "${n.lyric}"` : ''}
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

      <div className="card staff-card">
        <label className="fl">Xem trước khuông nhạc (tự chia dòng theo ô nhịp)</label>
        <div ref={staffRef} className="staff" />
      </div>

      {errorMsg && <div className="error">{errorMsg}</div>}
      <button className="save-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu…' : '💾 Lưu bài học'}</button>
    </div>
  );
}
