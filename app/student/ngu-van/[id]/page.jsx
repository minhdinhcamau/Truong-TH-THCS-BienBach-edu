'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { litFetch } from '@/lib/litClient';
import { countWords, genreLabel, formatDateTime, MAX_ESSAY_CHARS } from '@/lib/litConfig';
import ResultView, { AnnotatedEssay } from '@/components/lit/ResultView';

const backStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13,
  textDecoration: 'none',
};

export default function StudentLitPage() {
  const { id } = useParams();
  const [a, setA] = useState(null); // null = đang tải, false = không có
  const [criteria, setCriteria] = useState([]);
  const [sub, setSub] = useState(null);
  const [grade, setGrade] = useState(null);
  const [userId, setUserId] = useState(null);

  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState('saved'); // saved | dirty | saving | error
  const [savedAt, setSavedAt] = useState(null);
  const [fontSize, setFontSize] = useState(18);
  const [focus, setFocus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const lastSaved = useRef('');
  const timer = useRef(null);

  useEffect(() => { load(); return () => clearTimeout(timer.current); }, [id]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user.id);
    const { data: asg } = await supabase.from('lit_assignments').select('*').eq('id', id).maybeSingle();
    if (!asg) { setA(false); return; }
    const { data: cr } = await supabase.from('lit_criteria').select('*').eq('assignment_id', id).order('sort_order');
    const { data: sb } = await supabase.from('lit_submissions').select('*').eq('assignment_id', id).eq('student_id', user.id).maybeSingle();
    let g = null;
    if (sb?.status === 'published') {
      const { data } = await supabase.from('lit_grades').select('final_result, total').eq('submission_id', sb.id).maybeSingle();
      g = data;
    }
    setA(asg); setCriteria(cr || []); setSub(sb); setGrade(g);
    setContent(sb?.content || '');
    lastSaved.current = sb?.content || '';
    setSaveState('saved');
  }

  async function save(text) {
    if (text === lastSaved.current) { setSaveState('saved'); return true; }
    setSaveState('saving');
    const { error: err } = await supabase.from('lit_submissions').upsert(
      {
        assignment_id: id, student_id: userId, content: text,
        word_count: countWords(text), status: 'draft', updated_at: new Date().toISOString(),
      },
      { onConflict: 'assignment_id,student_id' }
    );
    if (err) { setSaveState('error'); return false; }
    lastSaved.current = text;
    setSavedAt(new Date());
    setSaveState('saved');
    return true;
  }

  function onChange(e) {
    const v = e.target.value;
    setContent(v);
    setSaveState('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v), 1500);
  }

  // Cảnh báo khi đóng tab lúc chưa lưu xong
  useEffect(() => {
    const h = (e) => { if (saveState === 'dirty' || saveState === 'saving' || saveState === 'error') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saveState]);

  async function submit() {
    setError('');
    const words = countWords(content);
    if (a.min_words && words < a.min_words) { setError(`Bài mới có ${words} chữ, cần ít nhất ${a.min_words} chữ.`); return; }
    if (!confirm('Nộp bài? Sau khi nộp em không sửa được nữa.')) return;
    clearTimeout(timer.current);
    setSubmitting(true);
    const ok = await save(content);
    if (!ok) { setSubmitting(false); setError('Chưa lưu được bài, em kiểm tra mạng rồi thử lại.'); return; }
    try {
      await litFetch('/api/lit/submit', { assignmentId: id, content });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(false);
  }

  if (a === null) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;
  if (a === false) return <div style={{ padding: 40, textAlign: 'center' }}>Không tìm thấy bài này. <Link href="/student/ngu-van">Quay lại</Link></div>;

  const status = sub?.status || 'none';
  const head = (
    <div style={{ marginBottom: 14 }}>
      <Link href="/student/ngu-van" style={backStyle}>← Bài văn của em</Link>
      <h1 style={{ margin: '14px 0 6px', fontSize: 23, color: '#17302d', fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" }}>{a.title}</h1>
    </div>
  );

  // 1. Đã có điểm
  if (status === 'published' && grade?.final_result) {
    return <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>{head}<ResultView result={grade.final_result} content={sub.content} /></div>;
  }

  // 2. Đã nộp, chờ thầy cô duyệt
  if (status === 'submitted' || status === 'ai_graded' || status === 'published') {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 40, fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" }}>
        {head}
        <div style={{ background: '#E9F2FC', border: '1px solid #cfe2f7', borderRadius: 14, padding: '16px 20px', marginBottom: 16, color: '#1b3a63', lineHeight: 1.6 }}>
          <b>Em đã nộp bài{sub.submitted_at ? ` lúc ${formatDateTime(sub.submitted_at)}` : ''}.</b><br />
          Thầy cô đang xem lại kết quả chấm. Khi có điểm, em sẽ nhận được thông báo và đọc được nhận xét chi tiết tại đây.
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5eeec', borderRadius: 16, padding: '22px 26px' }}>
          <AnnotatedEssay content={sub.content} highlights={[]} fontSize={17} />
        </div>
      </div>
    );
  }

  // 3. Đang viết
  const words = countWords(content);
  const chars = content.length;
  const paragraphs = content.split(/\n+/).filter((p) => p.trim()).length;
  const overdue = a.due_date && new Date(a.due_date) < new Date();
  const lh = fontSize * 2;
  const pct = a.min_words ? Math.min(100, Math.round((words / a.min_words) * 100)) : 100;
  const enough = !a.min_words || words >= a.min_words;
  const tooLong = a.max_words && words > a.max_words;
  const stateText = { saved: savedAt ? `Đã lưu lúc ${savedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Đã lưu', dirty: 'Chưa lưu...', saving: 'Đang lưu...', error: 'Lưu lỗi, kiểm tra mạng' }[saveState];

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 1180px; margin: 0 auto; padding-bottom: 40px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .layout { display: grid; grid-template-columns: ${focus ? '1fr' : 'minmax(0, 1fr) 320px'}; gap: 18px; align-items: start; }
        .paper { background: #fff; border: 1px solid #e5eeec; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 10px rgba(23,48,45,0.05); }
        .bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 16px; border-bottom: 1px solid #eef3f2; background: #fafcfd; font-size: 13px; color: #4b5563; }
        .tools { display: flex; gap: 6px; align-items: center; }
        .tbtn { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 8px; padding: 4px 10px; font-weight: 700; font-size: 13px; cursor: pointer; color: #374151; }
        .tbtn.on { border-color: #225da3; color: #225da3; background: #f5faff; }
        .state { font-weight: 600; }
        .state.error { color: #a3374a; }
        .state.dirty, .state.saving { color: #b45309; }
        textarea { display: block; width: 100%; box-sizing: border-box; border: none; outline: none; resize: vertical; min-height: 62vh;
          font-family: 'Noto Serif', Georgia, 'Times New Roman', serif; color: #1f2937; padding: 0 28px 0 76px;
          background-color: #fff; background-attachment: local; }
        .foot { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 12px 16px; border-top: 1px solid #eef3f2; background: #fafcfd; font-size: 13px; }
        .count b { color: #17302d; }
        .meter { flex: 1; min-width: 160px; max-width: 280px; height: 8px; background: #eef3f2; border-radius: 999px; overflow: hidden; }
        .meter i { display: block; height: 100%; border-radius: 999px; transition: width 0.2s; }
        .submit { background: #c0392b; color: #fff; border: none; border-radius: 999px; padding: 11px 26px; font-weight: 800; font-size: 14.5px; cursor: pointer; box-shadow: 0 3px 0 #8e2a20; }
        .submit:disabled { background: #9ca3af; box-shadow: none; cursor: not-allowed; }
        .side { display: grid; gap: 14px; position: sticky; top: 12px; }
        .card { background: #fff; border: 1px solid #e5eeec; border-radius: 14px; padding: 16px 18px; }
        .card h3 { margin: 0 0 8px; font-size: 14.5px; color: #17302d; }
        .card p { margin: 0; font-size: 14px; line-height: 1.65; color: #374151; white-space: pre-wrap; }
        .meta { font-size: 12.5px; color: #6b7f7a; margin-top: 8px; }
        details { border-top: 1px solid #eef3f2; padding: 8px 0; font-size: 13.5px; }
        details:first-of-type { border-top: none; }
        summary { cursor: pointer; font-weight: 600; color: #17302d; display: flex; justify-content: space-between; gap: 8px; }
        details p { margin-top: 6px; font-size: 13px; color: #4b5563; }
        .error { color: #a3374a; background: #fdeef0; padding: 10px 14px; border-radius: 10px; font-size: 13.5px; margin-bottom: 12px; }
        .warn { color: #b45309; background: #FFF4E0; padding: 10px 14px; border-radius: 10px; font-size: 13.5px; margin-bottom: 12px; }
        .overlay { position: fixed; inset: 0; background: rgba(23,48,45,0.55); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
        .modal { background: #fff; border-radius: 18px; padding: 28px 32px; max-width: 380px; text-align: center; line-height: 1.6; }
        .spin { width: 36px; height: 36px; border: 4px solid #dbe7f3; border-top-color: #225da3; border-radius: 50%; margin: 0 auto 14px; animation: sp 0.9s linear infinite; }
        @keyframes sp { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
        @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .side { position: static; } textarea { padding-left: 52px; } }
      `}</style>

      {head}
      {overdue && <div className="warn">Đề này đã quá hạn nộp ({formatDateTime(a.due_date)}). Em hãy hỏi thầy cô nếu cần nộp bù.</div>}
      {error && <div className="error">{error}</div>}

      <div className="layout">
        <div className="paper">
          <div className="bar">
            <span className={`state ${saveState}`}>{stateText}</span>
            <div className="tools">
              <button type="button" className="tbtn" onClick={() => setFontSize((s) => Math.max(15, s - 1))} aria-label="Giảm cỡ chữ">A−</button>
              <button type="button" className="tbtn" onClick={() => setFontSize((s) => Math.min(24, s + 1))} aria-label="Tăng cỡ chữ">A+</button>
              <button type="button" className={`tbtn ${focus ? 'on' : ''}`} onClick={() => setFocus(!focus)}>{focus ? 'Hiện đề bài' : 'Tập trung'}</button>
            </div>
          </div>

          <textarea
            lang="vi" spellCheck="true" value={content} onChange={onChange} onBlur={() => { clearTimeout(timer.current); save(content); }}
            placeholder="Em bắt đầu viết bài ở đây..." maxLength={MAX_ESSAY_CHARS}
            style={{
              fontSize, lineHeight: `${lh}px`,
              backgroundImage: `linear-gradient(90deg, transparent 56px, #e7a9a3 56px, #e7a9a3 58px, transparent 58px), repeating-linear-gradient(transparent, transparent ${lh - 1}px, #d3e3f3 ${lh - 1}px, #d3e3f3 ${lh}px)`,
            }}
          />

          <div className="foot">
            <div className="count">
              <b>{words}</b> chữ · {chars} ký tự · {paragraphs} đoạn
              {a.min_words > 0 && <> · tối thiểu {a.min_words}</>}
              {tooLong && <span style={{ color: '#b45309', fontWeight: 700 }}> · vượt gợi ý {a.max_words} chữ</span>}
            </div>
            {a.min_words > 0 && <div className="meter"><i style={{ width: `${pct}%`, background: enough ? '#1a7f4e' : '#225da3' }} /></div>}
            <button className="submit" disabled={submitting || overdue || words === 0} onClick={submit}>Nộp bài</button>
          </div>
        </div>

        {!focus && (
          <aside className="side">
            <div className="card">
              <h3>Đề bài</h3>
              <p>{a.prompt || a.title}</p>
              <div className="meta">
                {genreLabel(a.genre)}{a.due_date ? ` · Hạn ${formatDateTime(a.due_date)}` : ''}
              </div>
            </div>
            <div className="card">
              <h3>Cách thầy cô chấm ({a.max_score} điểm)</h3>
              {criteria.map((c) => (
                <details key={c.id}>
                  <summary><span>{c.name}</span><span>{c.max_points}</span></summary>
                  {c.description && <p>{c.description}</p>}
                </details>
              ))}
            </div>
          </aside>
        )}
      </div>

      {submitting && (
        <div className="overlay" role="alert">
          <div className="modal">
            <div className="spin" />
            <b>AI đang đọc bài của em</b><br />
            Việc này mất khoảng nửa phút. Em đừng đóng trang nhé.
          </div>
        </div>
      )}
    </div>
  );
}
