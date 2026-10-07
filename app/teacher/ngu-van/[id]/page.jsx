'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { litFetch } from '@/lib/litClient';
import { genreLabel, STATUS_META, round025, formatDateTime } from '@/lib/litConfig';
import { AnnotatedEssay, ScoreRing } from '@/components/lit/ResultView';
import AiWaiting from '@/components/AiWaiting';

const backBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};

const clamp = (v, max) => Math.min(max, Math.max(0, Number(v) || 0));
const lastName = (n) => (n || '').trim().split(/\s+/).pop() || '';
const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : null);

export default function TeacherLitDetail() {
  const { id } = useParams();
  const [a, setA] = useState(null); // null = đang tải, false = không tìm thấy
  const [criteria, setCriteria] = useState([]);
  const [students, setStudents] = useState([]);
  const [subs, setSubs] = useState({});     // student_id -> bài làm
  const [grades, setGrades] = useState({}); // submission_id -> điểm
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState('');
  const [batch, setBatch] = useState(null); // {i, n, name} khi AI đang chấm hàng loạt
  const [msg, setMsg] = useState(null);
  const [showRubric, setShowRubric] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load(keepSel = sel) {
    const { data: asg } = await supabase.from('lit_assignments').select('*, classes(name)').eq('id', id).maybeSingle();
    if (!asg) { setA(false); return; }

    const [{ data: cr }, { data: st }, { data: sb }] = await Promise.all([
      supabase.from('lit_criteria').select('*').eq('assignment_id', id).order('sort_order'),
      supabase.from('public_profiles').select('id, full_name').eq('class_id', asg.class_id).eq('role', 'student'),
      supabase.from('lit_submissions').select('*').eq('assignment_id', id),
    ]);
    const ids = (sb || []).map((s) => s.id);
    const { data: gr } = ids.length
      ? await supabase.from('lit_grades').select('*').in('submission_id', ids)
      : { data: [] };

    const subMap = Object.fromEntries((sb || []).map((s) => [s.student_id, s]));
    const gradeMap = Object.fromEntries((gr || []).map((g) => [g.submission_id, g]));
    const sorted = [...(st || [])].sort((x, y) => lastName(x.full_name).localeCompare(lastName(y.full_name), 'vi') || x.full_name.localeCompare(y.full_name, 'vi'));

    setA(asg); setCriteria(cr || []); setStudents(sorted); setSubs(subMap); setGrades(gradeMap);
    if (keepSel) {
      const s = subMap[keepSel];
      setDraft(clone(s && gradeMap[s.id]?.final_result));
    }
  }

  function pick(studentId) {
    setSel(studentId);
    setActive(null);
    setMsg(null);
    const s = subs[studentId];
    setDraft(clone(s && grades[s.id]?.final_result));
  }

  const sub = sel ? subs[sel] : null;
  const grade = sub ? grades[sub.id] : null;
  const draftTotal = draft ? round025(draft.criteria.reduce((s, c) => s + clamp(c.score, c.max_points), 0)) : 0;

  const setCrit = (i, patch) => setDraft((d) => ({ ...d, criteria: d.criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));

  async function run(label, fn) {
    setBusy(label); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ type: 'err', text: e.message || String(e) }); }
    setBusy('');
  }

  async function saveGrade() {
    const final = {
      ...draft, total: draftTotal,
      criteria: draft.criteria.map((c) => ({ ...c, score: round025(clamp(c.score, c.max_points)) })),
    };
    const { error } = await supabase.from('lit_grades')
      .update({ final_result: final, total: draftTotal, updated_at: new Date().toISOString() })
      .eq('submission_id', sub.id);
    if (error) throw new Error(error.message);
  }

  const onSave = () => run('save', async () => { await saveGrade(); await load(); setMsg({ type: 'ok', text: 'Đã lưu chỉnh sửa.' }); });

  const onPublish = () => run('publish', async () => {
    await saveGrade();
    const { error } = await supabase.rpc('lit_publish', { p_submission_id: sub.id, p_publish: true });
    if (error) throw new Error(error.message);
    await load();
    setMsg({ type: 'ok', text: 'Đã công bố. Học sinh có thể xem điểm và nhận xét.' });
  });

  const onUnpublish = () => run('publish', async () => {
    const { error } = await supabase.rpc('lit_publish', { p_submission_id: sub.id, p_publish: false });
    if (error) throw new Error(error.message);
    await load();
    setMsg({ type: 'ok', text: 'Đã hủy công bố. Học sinh không còn thấy điểm.' });
  });

  const onRegrade = () => {
    if (grade && !confirm('Chấm lại sẽ ghi đè các chỉnh sửa của thầy/cô. Tiếp tục?')) return;
    run('grade', async () => {
      await litFetch('/api/lit/grade', { submissionId: sub.id });
      await load();
      setMsg({ type: 'ok', text: 'AI đã chấm xong.' });
    });
  };

  const pending = students.filter((s) => subs[s.id]?.status === 'submitted');
  const reviewed = students.filter((s) => subs[s.id]?.status === 'ai_graded' && grades[subs[s.id].id]);

  async function gradeAll() {
    if (!confirm(`AI sẽ chấm ${pending.length} bài chưa chấm, mỗi bài mất khoảng 15-30 giây. Tiếp tục?`)) return;
    setBusy('all'); setMsg(null);
    let fail = 0;
    for (let i = 0; i < pending.length; i++) {
      setBatch({ i: i + 1, n: pending.length, name: pending[i].full_name });
      try { await litFetch('/api/lit/grade', { submissionId: subs[pending[i].id].id }); } catch { fail++; }
    }
    setBatch(null); await load(); setBusy('');
    setMsg({ type: fail ? 'err' : 'ok', text: fail ? `Có ${fail} bài AI chưa chấm được, hãy thử lại từng bài.` : 'AI đã chấm xong tất cả bài.' });
  }

  async function publishAll() {
    if (!confirm(`Công bố điểm cho ${reviewed.length} bài? Học sinh sẽ thấy điểm và nhận xét ngay.`)) return;
    setBusy('all'); setMsg(null);
    let fail = 0;
    for (const s of reviewed) {
      const { error } = await supabase.rpc('lit_publish', { p_submission_id: subs[s.id].id, p_publish: true });
      if (error) fail++;
    }
    await load(); setBusy('');
    setMsg({ type: fail ? 'err' : 'ok', text: fail ? `${fail} bài chưa công bố được.` : 'Đã công bố tất cả.' });
  }

  if (a === null) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;
  if (a === false) return <div style={{ padding: 40, textAlign: 'center' }}>Không tìm thấy đề này. <Link href="/teacher/ngu-van">Quay lại</Link></div>;

  const meta = (key) => STATUS_META[key] || STATUS_META.none;
  const disabled = !!busy;

  // Các câu chạy chữ khi chấm hàng loạt: nêu rõ đang chấm bài của bạn nào.
  const batchSteps = batch
    ? [
        `Bài ${batch.i}/${batch.n} (${batch.name}): AI đang đọc bài làm`,
        `Bài ${batch.i}/${batch.n} (${batch.name}): AI đang đối chiếu với barem`,
        `Bài ${batch.i}/${batch.n} (${batch.name}): AI đang viết nhận xét`,
        `Bài ${batch.i}/${batch.n} (${batch.name}): sắp xong, AI đang kiểm tra lại điểm`,
      ]
    : null;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 1180px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .head { margin: 16px 0 18px; }
        .head h1 { margin: 0 0 8px; font-size: 24px; color: #17302d; }
        .pills { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .pill { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: #f3f6f5; color: #4b5563; }
        .pill.cls { background: #E9F2FC; color: #225da3; }
        .linkbtn { border: none; background: none; color: #225da3; font-weight: 600; font-size: 13px; cursor: pointer; padding: 0 4px; }
        .rubric { background: #fff; border: 1px solid #e5eeec; border-radius: 14px; padding: 14px 18px; margin-bottom: 16px; display: grid; gap: 10px; font-size: 13.5px; }
        .rubric b { color: #17302d; }
        .rubric p { margin: 2px 0 0; color: #4b5563; line-height: 1.55; }
        .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
        .btn { border: 1.5px solid #dbe7f3; background: #fff; color: #225da3; font-weight: 700; font-size: 13.5px; border-radius: 999px; padding: 9px 16px; cursor: pointer; }
        .btn:hover:not(:disabled) { border-color: #225da3; }
        .btn.primary { background: #225da3; color: #fff; border-color: #225da3; box-shadow: 0 3px 0 #184270; }
        .btn.warn { color: #a3374a; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .msg { padding: 10px 14px; border-radius: 10px; font-size: 13.5px; margin-bottom: 14px; }
        .msg.ok { background: #EAFBEA; color: #1a7f4e; }
        .msg.err { background: #fdeef0; color: #a3374a; }
        .layout { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 18px; align-items: start; }
        .students { background: #fff; border: 1px solid #e5eeec; border-radius: 16px; padding: 8px; position: sticky; top: 12px; max-height: 80vh; overflow: auto; }
        .stu { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px; border: none; background: none; text-align: left; padding: 10px 12px; border-radius: 10px; cursor: pointer; font-family: inherit; }
        .stu:hover { background: #f5faff; }
        .stu.on { background: #E9F2FC; }
        .stu .nm { font-size: 14px; font-weight: 600; color: #17302d; }
        .chip { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
        .panel { display: grid; gap: 16px; }
        .card { background: #fff; border: 1px solid #e5eeec; border-radius: 16px; padding: 20px 22px; }
        .card h3 { margin: 0 0 12px; font-size: 16px; color: #17302d; }
        .empty { text-align: center; color: #9ca3af; padding: 50px 20px; background: #fff; border: 1px dashed #cfe2f7; border-radius: 16px; }
        .sumrow { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
        .crit { padding: 14px 0; border-top: 1px solid #eef3f2; display: grid; gap: 8px; }
        .crit:first-of-type { border-top: none; padding-top: 0; }
        .crit-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-weight: 700; font-size: 14.5px; }
        .score { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #6b7f7a; }
        .score input { width: 76px; text-align: center; font-weight: 700; }
        .ai-tag { background: #f3f6f5; padding: 3px 9px; border-radius: 999px; font-size: 12px; }
        label { font-size: 12.5px; font-weight: 600; color: #4b5563; display: block; margin-bottom: 4px; }
        input, textarea { width: 100%; padding: 9px 11px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; box-sizing: border-box; line-height: 1.55; }
        input:focus, textarea:focus { outline: none; border-color: #225da3; }
        .note { border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; font-size: 14px; line-height: 1.6; }
        .note.good { background: #EAFBEA; border: 1px solid #bdeccb; }
        .note.fix { background: #fff3f1; border: 1px solid #f3c4bd; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; position: sticky; bottom: 0; background: #ffffffee; padding: 12px 0; border-top: 1px solid #eef3f2; }
        @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .students { position: static; max-height: 280px; } }
      `}</style>

      <Link href="/teacher/ngu-van" style={backBtnStyle}>← Bài văn chấm bằng AI</Link>

      <div className="head">
        <h1>{a.title}</h1>
        <div className="pills">
          <span className="pill cls">Lớp {a.classes?.name}</span>
          <span className="pill">{genreLabel(a.genre)}</span>
          <span className="pill">Thang {a.max_score} điểm</span>
          {a.due_date && <span className="pill">Hạn {formatDateTime(a.due_date)}</span>}
          <button className="linkbtn" onClick={() => setShowRubric(!showRubric)}>{showRubric ? 'Ẩn barem' : 'Xem barem'}</button>
        </div>
      </div>

      {showRubric && (
        <div className="rubric">
          {criteria.map((c) => (
            <div key={c.id}><b>{c.name} ({c.max_points} điểm)</b><p>{c.description}</p></div>
          ))}
        </div>
      )}

      <div className="toolbar">
        <button className="btn primary" disabled={disabled || pending.length === 0} onClick={gradeAll}>✨ AI chấm {pending.length} bài chưa chấm</button>
        <button className="btn" disabled={disabled || reviewed.length === 0} onClick={publishAll}>Công bố {reviewed.length} bài đã chấm</button>
      </div>

      {/* Chấm hàng loạt: hiệu ứng chờ, đổi theo từng bài (key để đồng hồ chờ tính lại cho mỗi bài) */}
      {busy === 'all' && batch && <AiWaiting key={batch.i} kind="grade" steps={batchSteps} />}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div className="layout">
        <aside className="students">
          {students.length === 0 && <div className="empty" style={{ border: 'none' }}>Lớp chưa có học sinh.</div>}
          {students.map((s) => {
            const sb = subs[s.id];
            const st = meta(sb?.status || 'none');
            const g = sb && grades[sb.id];
            return (
              <button key={s.id} className={`stu ${sel === s.id ? 'on' : ''}`} onClick={() => pick(s.id)}>
                <span className="nm">{s.full_name}</span>
                <span className="chip" style={{ color: st.color, background: st.bg }}>
                  {g && sb.status !== 'submitted' ? `${g.total}/${a.max_score}` : st.label}
                </span>
              </button>
            );
          })}
        </aside>

        <section className="panel">
          {/* Chấm một bài (chấm lần đầu hoặc chấm lại): hiệu ứng chờ ở đầu khung bên phải */}
          {busy === 'grade' && <AiWaiting kind="grade" />}

          {!sel && <div className="empty">Chọn một học sinh bên trái để xem bài và nhận xét của AI.</div>}

          {sel && (!sub || sub.status === 'draft') && (
            <div className="empty">{sub ? 'Em này đang viết, chưa nộp bài.' : 'Em này chưa bắt đầu làm bài.'}</div>
          )}

          {sel && sub && sub.status !== 'draft' && !grade && (
            <div className="card">
              <h3>Bài đã nộp, chưa có điểm</h3>
              <p style={{ color: '#4b5563', fontSize: 14 }}>Lần chấm tự động chưa thành công hoặc chưa chạy. Bấm để AI chấm theo barem.</p>
              <button className="btn primary" disabled={disabled} onClick={onRegrade}>{busy === 'grade' ? 'AI đang chấm...' : '✨ Chấm bằng AI'}</button>
            </div>
          )}

          {sel && sub && grade && draft && (
            <>
              <div className="card">
                <div className="sumrow">
                  <ScoreRing score={draftTotal} max={Number(a.max_score)} size={112} />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <label>Nhận xét chung (học sinh sẽ đọc)</label>
                    <textarea rows={4} value={draft.overall} onChange={(e) => setDraft({ ...draft, overall: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Điểm và nhận xét theo tiêu chí</h3>
                {draft.criteria.map((c, i) => {
                  const aiScore = grade.ai_result?.criteria?.[i]?.score;
                  return (
                    <div className="crit" key={c.criterion_id || i}>
                      <div className="crit-top">
                        <span>{c.name}</span>
                        <span className="score">
                          {aiScore != null && <span className="ai-tag">AI chấm: {aiScore}</span>}
                          <input type="number" step="0.25" min="0" max={c.max_points} value={c.score}
                            onChange={(e) => setCrit(i, { score: e.target.value })}
                            onBlur={() => setCrit(i, { score: round025(clamp(c.score, c.max_points)) })} />
                          / {c.max_points}
                        </span>
                      </div>
                      <div>
                        <label>Nhận xét</label>
                        <textarea rows={3} value={c.comment} onChange={(e) => setCrit(i, { comment: e.target.value })} />
                      </div>
                      <div>
                        <label>Cách sửa</label>
                        <textarea rows={2} value={c.suggestion} onChange={(e) => setCrit(i, { suggestion: e.target.value })} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <h3>Bài làm ({sub.word_count} chữ) và các đoạn AI đánh dấu</h3>
                {active != null && draft.highlights?.[active] && (
                  <div className={`note ${draft.highlights[active].type}`}>
                    {draft.highlights[active].note || '(AI không ghi chú)'}
                  </div>
                )}
                <AnnotatedEssay content={sub.content} highlights={draft.highlights || []} activeIdx={active}
                  onPick={(i) => setActive(active === i ? null : i)} fontSize={16} />
              </div>

              <div className="actions">
                <button className="btn" disabled={disabled} onClick={onSave}>{busy === 'save' ? 'Đang lưu...' : 'Lưu chỉnh sửa'}</button>
                <button className="btn primary" disabled={disabled} onClick={onPublish}>
                  {busy === 'publish' ? 'Đang công bố...' : grade.published ? 'Lưu và cập nhật cho học sinh' : 'Công bố cho học sinh'}
                </button>
                {grade.published && <button className="btn warn" disabled={disabled} onClick={onUnpublish}>Hủy công bố</button>}
                {!grade.published && <button className="btn" disabled={disabled} onClick={onRegrade}>{busy === 'grade' ? 'AI đang chấm...' : 'Chấm lại bằng AI'}</button>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
