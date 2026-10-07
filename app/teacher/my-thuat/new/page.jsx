'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { litFetch } from '@/lib/litClient';
import { round025 } from '@/lib/litConfig';
import RubricEditor, { newCriterion } from '@/components/lit/RubricEditor';
import AiWaiting from '@/components/AiWaiting';

const MODES = [
  { value: 'photo', label: 'Chụp ảnh bài vẽ giấy' },
  { value: 'web_draw', label: 'Vẽ trên web (công cụ vẽ làm sau)' },
  { value: 'both', label: 'Học sinh chọn một trong hai' },
];

const backBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};

export default function NewArtAssignment() {
  const router = useRouter();
  const [classes, setClasses] = useState([]);
  const [taught, setTaught] = useState(new Set());
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({ title: '', prompt: '', mode: 'photo', maxScore: 10, dueDate: '' });
  const [criteria, setCriteria] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { loadClasses(); }, []);

  async function loadClasses() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: all } = await supabase.from('classes').select('id, name, grade').order('name');
    const { data: ta } = await supabase
      .from('teacher_assignments')
      .select('class_id, subjects(name)')
      .eq('teacher_id', user.id);
    const mine = new Set((ta || []).filter((r) => /mỹ thuật/i.test(r.subjects?.name || '')).map((r) => r.class_id));
    const list = [...(all || [])].sort((a, b) => (a.grade || 99) - (b.grade || 99) || a.name.localeCompare(b.name, 'vi', { numeric: true }));
    setClasses(list);
    setTaught(mine);
  }

  const grades = useMemo(() => [...new Set(classes.map((c) => c.grade))].sort((a, b) => (a || 99) - (b || 99)), [classes]);
  const idsOfGrade = (g) => classes.filter((c) => c.grade === g).map((c) => c.id);
  const toggleClass = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleGrade = (g) => {
    const ids = idsOfGrade(g);
    const allOn = ids.every((id) => selected.includes(id));
    setSelected((s) => (allOn ? s.filter((id) => !ids.includes(id)) : [...new Set([...s, ...ids])]));
  };

  async function aiRubric() {
    setError('');
    if (!form.title.trim()) { setError('Hãy nhập tên bài vẽ trước khi nhờ AI soạn barem.'); return; }
    if (criteria.length > 0 && !confirm('AI sẽ thay toàn bộ barem hiện tại. Tiếp tục?')) return;
    setAiBusy(true);
    try {
      const cls = classes.find((c) => c.id === selected[0]);
      const { criteria: list } = await litFetch('/api/art/rubric', {
        title: form.title, prompt: form.prompt, mode: form.mode,
        grade: cls?.grade, maxScore: Number(form.maxScore) || 10,
      });
      setCriteria(list.map((c) => newCriterion(c)));
    } catch (e) {
      setError(e.message);
    }
    setAiBusy(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    const maxScore = Number(form.maxScore);
    const clean = criteria.filter((c) => c.name.trim());
    const sum = round025(clean.reduce((s, c) => s + (Number(c.max_points) || 0), 0));

    if (!form.title.trim()) return setError('Hãy nhập tên bài vẽ.');
    if (selected.length === 0) return setError('Hãy chọn ít nhất một lớp để giao.');
    if (!(maxScore > 0)) return setError('Thang điểm không hợp lệ.');
    if (clean.length === 0) return setError('Cần có ít nhất một tiêu chí trong barem.');
    if (sum !== maxScore) return setError(`Tổng điểm barem là ${sum}, cần bằng thang điểm ${maxScore}.`);

    const { data: { user } } = await supabase.auth.getUser();
    let done = 0;

    for (let i = 0; i < selected.length; i++) {
      const classId = selected[i];
      const cname = classes.find((c) => c.id === classId)?.name || '';
      setSaving(`Đang giao bài cho lớp ${cname} (${i + 1}/${selected.length})...`);

      const { data: a, error: aErr } = await supabase
        .from('art_assignments')
        .insert({
          teacher_id: user.id,
          class_id: classId,
          title: form.title.trim(),
          prompt: form.prompt.trim(),
          submit_mode: form.mode,
          max_score: maxScore,
          due_date: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        })
        .select('id')
        .single();
      if (aErr) { setSaving(''); return setError(`Lớp ${cname}: ${aErr.message}${done ? ` (đã giao xong ${done} lớp trước đó)` : ''}`); }

      const { error: cErr } = await supabase.from('art_criteria').insert(
        clean.map((c, k) => ({
          assignment_id: a.id, name: c.name.trim(), description: c.description.trim(),
          max_points: Number(c.max_points), sort_order: k,
        }))
      );
      if (cErr) {
        await supabase.from('art_assignments').delete().eq('id', a.id);
        setSaving('');
        return setError(`Lớp ${cname}: ${cErr.message}${done ? ` (đã giao xong ${done} lớp trước đó)` : ''}`);
      }
      done++;
    }

    setSaving('');
    router.push('/teacher/my-thuat');
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 760px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .card { background: #fff; border-radius: 20px; padding: 26px; margin-top: 16px; box-shadow: 0 2px 10px rgba(23,48,45,0.05); border: 1px solid #e5eeec; }
        h1 { margin: 0 0 4px; font-size: 22px; color: #17302d; }
        h2 { margin: 0; font-size: 18px; color: #17302d; }
        .sub { color: #6b7f7a; font-size: 13.5px; margin: 0 0 20px; }
        label.f { display: block; font-size: 13.5px; font-weight: 600; color: #374151; margin: 16px 0 6px; }
        .card > label.f:first-of-type { margin-top: 0; }
        input, textarea, select { width: 100%; padding: 11px 13px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-size: 14.5px; font-family: inherit; box-sizing: border-box; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: #225da3; }
        .grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .quick { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .q { border: 1.5px solid #dbe7f3; background: #f5faff; color: #225da3; font-weight: 700; font-size: 13px; border-radius: 999px; padding: 7px 14px; cursor: pointer; font-family: inherit; }
        .q.ghost { background: #fff; color: #6b7f7a; }
        .grp { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-top: 1px solid #eef3f2; }
        .gl { width: 62px; flex-shrink: 0; font-size: 13px; font-weight: 700; color: #6b7f7a; padding-top: 7px; }
        .chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .cls { position: relative; display: inline-flex; align-items: center; gap: 6px; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 7px 14px; font-size: 14px; font-weight: 600; color: #374151; cursor: pointer; background: #fff; user-select: none; }
        .cls input { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
        .cls.on { border-color: #225da3; background: #E9F2FC; color: #225da3; }
        .cls:focus-within { outline: 2px solid #225da3; outline-offset: 2px; }
        .star { color: #b45309; font-size: 12px; }
        .picked { font-size: 13px; color: #225da3; font-weight: 700; margin-top: 10px; }
        .rb-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .ai-btn { background: linear-gradient(135deg, #225da3, #3b82f6); color: #fff; border: none; border-radius: 999px; padding: 10px 20px; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 3px 0 #184270; font-family: inherit; }
        .ai-btn:disabled { background: #9ca3af; box-shadow: none; cursor: wait; }
        .error { color: #a3374a; font-size: 13.5px; background: #fdeef0; padding: 10px 14px; border-radius: 10px; margin-top: 16px; word-break: break-word; }
        .submit { width: 100%; margin-top: 20px; padding: 14px; background: #225da3; color: #fff; border: none; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 3px 0 #184270; font-family: inherit; }
        .submit:disabled { background: #9ca3af; box-shadow: none; cursor: not-allowed; }
        @media (max-width: 600px) { .grid2 { grid-template-columns: 1fr; } .grp { flex-direction: column; gap: 4px; } .gl { padding-top: 0; } }
      `}</style>

      <Link href="/teacher/my-thuat" style={backBtnStyle}>← Mỹ thuật</Link>

      <form onSubmit={handleSave}>
        <div className="card">
          <h1>Giao bài vẽ mới</h1>
          <p className="sub">Học sinh nộp bài, thầy cô chấm theo barem bên dưới. AI chỉ giúp soạn barem, không xem bài vẽ.</p>

          <label className="f">Tên bài vẽ</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ví dụ: Vẽ tranh phong cảnh quê em" />

          <label className="f">Yêu cầu chi tiết (tùy chọn)</label>
          <textarea rows={4} value={form.prompt} onChange={(e) => set('prompt', e.target.value)}
            placeholder="Chất liệu (màu nước, chì màu...), có những gì trong tranh, khổ giấy... AI dùng phần này để soạn barem sát đề hơn." />

          <label className="f">Lớp được giao</label>
          <div className="quick">
            {taught.size > 0 && (
              <button type="button" className="q" onClick={() => setSelected([...taught])}>★ Các lớp tôi dạy Mỹ thuật</button>
            )}
            {grades.filter((g) => g != null).map((g) => (
              <button type="button" className="q" key={g} onClick={() => toggleGrade(g)}>Khối {g}</button>
            ))}
            <button type="button" className="q" onClick={() => setSelected(classes.map((c) => c.id))}>Tất cả</button>
            <button type="button" className="q ghost" onClick={() => setSelected([])}>Bỏ chọn</button>
          </div>
          {grades.map((g) => (
            <div className="grp" key={String(g)}>
              <span className="gl">{g != null ? `Khối ${g}` : 'Khác'}</span>
              <div className="chips">
                {classes.filter((c) => c.grade === g).map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <label key={c.id} className={`cls ${on ? 'on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleClass(c.id)} />
                      {c.name}{taught.has(c.id) && <span className="star" title="Lớp thầy/cô dạy Mỹ thuật">★</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="picked">Đã chọn {selected.length} lớp</div>

          <label className="f">Hình thức nộp bài</label>
          <select value={form.mode} onChange={(e) => set('mode', e.target.value)}>
            {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          <div className="grid2">
            <div>
              <label className="f">Thang điểm</label>
              <input type="number" min="1" step="1" value={form.maxScore} onChange={(e) => set('maxScore', e.target.value)} />
            </div>
            <div>
              <label className="f">Hạn nộp (tùy chọn)</label>
              <input type="datetime-local" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="rb-head">
            <div>
              <h2>Barem chấm điểm</h2>
              <p className="sub" style={{ margin: '4px 0 0' }}>Thầy cô dựa vào barem này để chấm từng tiêu chí. Có thể sửa mọi thứ. Barem dùng chung cho tất cả lớp đã chọn.</p>
            </div>
            <button type="button" className="ai-btn" onClick={aiRubric} disabled={aiBusy}>
              {aiBusy ? 'AI đang soạn...' : '✨ AI soạn barem'}
            </button>
          </div>
          {aiBusy && <AiWaiting kind="rubric" />}
          <div style={aiBusy ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
            <RubricEditor criteria={criteria} onChange={setCriteria} maxScore={Number(form.maxScore) || 10} />
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        <button type="submit" className="submit" disabled={!!saving || aiBusy}>
          {saving || (selected.length > 1 ? `Giao bài cho ${selected.length} lớp` : 'Giao bài cho lớp')}
        </button>
      </form>
    </div>
  );
}
