'use client';
// Đặt tại: app/teacher/music/lessons/[lessonId]/page.jsx
// BẢN CẬP NHẬT v2: theo cấu trúc 2 tầng mới (music_units -> music_lessons),
// thêm chọn "loại bài" (Bài hát có lời / Bài đọc nhạc không lời), nhập
// nhạc sĩ + lời thơ cho bài hát, và ô nhập LỜI cho từng nốt khi soạn bài
// hát (để khớp cách trình bày kiểu "Con đường học trò": mỗi nốt đi kèm 1
// chữ trong lời). Cách nhập nốt vẫn giữ nguyên: bấm phím đàn theo trường
// độ đang chọn, khuông nhạc + Tone.js chỉ đọc lại đúng dữ liệu đã nhập.
//
// npm install vexflow tone   (nếu repo chưa có 2 gói này)

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  KEYBOARD_PITCHES, DURATIONS,
  pitchToVietnamese, pitchOctave,
  durationToVexKey, durationBeats, durationToToneKey,
} from '@/lib/musicNotes';

const backLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};

export default function MusicLessonComposerPage() {
  const { lessonId } = useParams();
  const router = useRouter();
  const staffRef = useRef(null);

  const [lesson, setLesson] = useState(null);
  const [notes, setNotes] = useState([]);
  const [composer, setComposer] = useState('');
  const [lyricist, setLyricist] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('quarter');
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isSong = lesson?.kind === 'song';

  useEffect(() => { load(); }, [lessonId]);

  async function load() {
    const { data: l, error } = await supabase
      .from('music_lessons')
      .select('*, music_units(id, title)')
      .eq('id', lessonId)
      .single();
    if (error) { setErrorMsg(error.message); return; }
    setLesson(l);
    setNotes(l?.notes || []);
    setComposer(l?.composer || '');
    setLyricist(l?.lyricist || '');
  }

  useEffect(() => { if (lesson) renderStaff(); }, [notes, lesson]);

  async function renderStaff() {
    if (!staffRef.current) return;
    staffRef.current.innerHTML = '';
    if (notes.length === 0) return;

    const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Annotation } = await import('vexflow');

    const width = Math.max(380, 60 + notes.length * (isSong ? 70 : 55));
    const renderer = new Renderer(staffRef.current, Renderer.Backends.SVG);
    renderer.resize(width, isSong ? 190 : 160);
    const context = renderer.getContext();

    const stave = new Stave(10, 20, width - 20);
    stave.addClef('treble').addTimeSignature(lesson.time_signature || '4/4');
    stave.setContext(context).draw();

    const staveNotes = notes.map((n) => {
      const m = /^([A-G])(#|b)?(\d)$/.exec(n.pitch);
      const letter = m ? m[1].toLowerCase() : 'c';
      const accidental = m ? m[2] : undefined;
      const octave = m ? m[3] : '4';
      const key = `${letter}${accidental || ''}/${octave}`;
      const sn = new StaveNote({ keys: [key], duration: durationToVexKey(n.duration) });
      if (accidental) sn.addModifier(new Accidental(accidental));
      if (isSong && n.lyric) {
        const ann = new Annotation(n.lyric).setFont('Be Vietnam Pro, sans-serif', 12).setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
        sn.addModifier(ann);
      }
      return sn;
    });

    const totalBeats = notes.reduce((s, n) => s + durationBeats(n.duration), 0);
    const voice = new Voice({ numBeats: totalBeats || 4, beatValue: 4 }).setStrict(false);
    voice.addTickables(staveNotes);
    new Formatter().joinVoices([voice]).format([voice], width - 60);
    voice.draw(context, stave);
  }

  function addNote(pitch) {
    setNotes((prev) => [
      ...prev,
      { pitch, duration: selectedDuration, startBeat: prev.reduce((s, n) => s + durationBeats(n.duration), 0), lyric: '' },
    ]);
  }

  function setLyricAt(idx, lyric) {
    setNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, lyric } : n)));
  }

  function removeNoteAt(idx) {
    setNotes((prev) => {
      let acc = 0;
      return prev.filter((_, i) => i !== idx).map((n) => {
        const withStart = { ...n, startBeat: acc };
        acc += durationBeats(n.duration);
        return withStart;
      });
    });
  }

  function undoLast() { setNotes((prev) => prev.slice(0, -1)); }
  function clearAll() {
    if (notes.length === 0) return;
    if (confirm('Xoá hết nốt đã nhập trong bài này?')) setNotes([]);
  }

  async function playPreview() {
    if (notes.length === 0 || playing) return;
    setPlaying(true);
    try {
      const Tone = await import('tone');
      await Tone.start();
      const synth = new Tone.Synth().toDestination();
      let t = Tone.now();
      notes.forEach((n) => {
        const toneDur = durationToToneKey(n.duration);
        synth.triggerAttackRelease(n.pitch, toneDur, t);
        t += Tone.Time(toneDur).toSeconds() * (90 / (lesson.tempo_bpm || 90));
      });
      setTimeout(() => setPlaying(false), (t - Tone.now()) * 1000 + 150);
    } catch (e) {
      setErrorMsg('Không phát được âm thanh: ' + e.message);
      setPlaying(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setErrorMsg('');
    const payload = { notes, updated_at: new Date().toISOString() };
    if (isSong) { payload.composer = composer || null; payload.lyricist = lyricist || null; }
    const { error } = await supabase.from('music_lessons').update(payload).eq('id', lessonId);
    setSaving(false);
    if (error) { setErrorMsg(error.message); return; }
    router.push(`/teacher/music/units/${lesson.music_units.id}`);
  }

  if (!lesson) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 760px; margin: 0 auto; padding: 28px 24px 80px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        h1 { font-size: 22px; color: #17302d; margin: 14px 0 4px; display: flex; align-items: center; gap: 8px; }
        .kind-pill { font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
        .kind-pill.song { color: #58A700; background: #EAFBEA; }
        .kind-pill.reading { color: #b45309; background: #FEF3E2; }
        .sub-note { color: #6b7f7a; font-size: 13.5px; margin: 0 0 22px; max-width: 560px; }
        .card { background: #fff; border-radius: 18px; padding: 20px 22px; margin-bottom: 18px; border: 1px solid #e5eeec; box-shadow: 0 2px 8px rgba(23,48,45,0.04); }
        .card h2 { margin: 0 0 14px; font-size: 15px; color: #17302d; }
        .card-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
        .card-head h2 { margin: 0; }
        .meta-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .meta-row > div { flex: 1; min-width: 180px; }
        label.field-label { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 5px; }
        input.field { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 13.5px; font-family: inherit; box-sizing: border-box; }
        .duration-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .dur-btn { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 8px 16px; font-size: 13.5px; font-weight: 600; color: #374151; cursor: pointer; }
        .dur-btn.active { border-color: #225da3; background: #E9F2FC; color: #225da3; }
        .keyboard { display: flex; gap: 6px; flex-wrap: wrap; }
        .key { width: 56px; height: 76px; borderRadius: 10px; border: 1.5px solid #dbe7f3; background: #fff; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 10px; gap: 2px; border-radius: 10px; }
        .key:hover { background: #E9F2FC; border-color: #225da3; }
        .key:active { transform: translateY(1px); }
        .key-name { font-weight: 700; font-size: 13px; color: #17302d; }
        .key-oct { font-size: 10.5px; color: #9ca3af; }
        .toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
        .toolbar button { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; }
        .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
        .staff { overflow-x: auto; min-height: 40px; }
        .empty { text-align: center; color: #9ca3af; padding: 20px; font-size: 13.5px; }
        .notes-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .note-pill { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; background: #f3f6f5; border-radius: 12px; padding: 8px 10px; font-size: 12.5px; font-weight: 600; color: #374151; min-width: 64px; }
        .note-pill .pill-top { display: flex; align-items: center; gap: 6px; }
        .note-pill button { border: none; background: #e5e7eb; color: #4b5563; border-radius: 50%; width: 16px; height: 16px; line-height: 1; cursor: pointer; font-size: 10px; }
        .lyric-input { width: 60px; padding: 3px 5px; border-radius: 6px; border: 1px solid #dbe7f3; font-size: 11.5px; text-align: center; font-family: inherit; }
        .error { color: #a3374a; font-size: 13.5px; background: #fdeef0; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; }
        .save-btn { width: 100%; padding: 14px; background: #225da3; color: #fff; border: none; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 3px 0 #184270; }
        .save-btn:disabled { background: #9ca3af; box-shadow: none; cursor: not-allowed; }
      `}</style>

      <Link href={`/teacher/music/units/${lesson.music_units.id}`} style={backLinkStyle}>← {lesson.music_units.title}</Link>
      <h1>
        {lesson.title}
        <span className={isSong ? 'kind-pill song' : 'kind-pill reading'}>{isSong ? '🎤 Bài hát' : '🎼 Bài đọc nhạc'}</span>
      </h1>
      <p className="sub-note">
        Chọn trường độ rồi bấm vào phím đàn để thêm nốt{isSong ? ', gõ lời ứng với từng nốt ngay bên dưới khuông nhạc' : ''}.
        Khuông nhạc và nút "Nghe thử" luôn đọc thẳng từ dữ liệu bạn vừa nhập.
      </p>

      {isSong && (
        <div className="card">
          <h2>Thông tin bài hát</h2>
          <div className="meta-row">
            <div><label className="field-label">Nhạc sĩ</label><input className="field" value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="VD: Nguyễn Văn Hiên" /></div>
            <div><label className="field-label">Lời thơ / tác giả lời</label><input className="field" value={lyricist} onChange={(e) => setLyricist(e.target.value)} placeholder="VD: Ý thơ Từ Nguyên Thạch" /></div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Trường độ đang chọn</h2>
        <div className="duration-row">
          {DURATIONS.map((d) => (
            <button key={d.key} className={selectedDuration === d.key ? 'dur-btn active' : 'dur-btn'} onClick={() => setSelectedDuration(d.key)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Bàn phím — bấm để thêm nốt</h2>
        <div className="keyboard">
          {KEYBOARD_PITCHES.map((p) => (
            <button key={p} className="key" onClick={() => addNote(p)}>
              <span className="key-name">{pitchToVietnamese(p)}</span>
              <span className="key-oct">{pitchOctave(p)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Khuông nhạc ({notes.length} nốt)</h2>
          <div className="toolbar">
            <button onClick={undoLast} disabled={notes.length === 0}>↩ Xoá nốt cuối</button>
            <button onClick={clearAll} disabled={notes.length === 0}>🗑 Xoá hết</button>
            <button onClick={playPreview} disabled={notes.length === 0 || playing}>{playing ? '🔊 Đang phát…' : '▶ Nghe thử'}</button>
          </div>
        </div>
        <div ref={staffRef} className="staff" />
        {notes.length === 0 && <p className="empty">Chưa có nốt nào — bấm vào phím đàn ở trên để bắt đầu.</p>}

        {notes.length > 0 && (
          <div className="notes-list">
            {notes.map((n, idx) => (
              <span key={idx} className="note-pill">
                <span className="pill-top">
                  {idx + 1}. {pitchToVietnamese(n.pitch)}{pitchOctave(n.pitch)}
                  <button onClick={() => removeNoteAt(idx)} title="Xoá nốt này">×</button>
                </span>
                {isSong && (
                  <input className="lyric-input" placeholder="lời…" value={n.lyric || ''} onChange={(e) => setLyricAt(idx, e.target.value)} />
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {errorMsg && <div className="error">{errorMsg}</div>}
      <button className="save-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu…' : '💾 Lưu bài học'}</button>
    </div>
  );
}
