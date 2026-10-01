'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { litFetch } from '@/lib/litClient';
import { GENRES, round025 } from '@/lib/litConfig';
import RubricEditor, { newCriterion } from '@/components/lit/RubricEditor';

const backBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};

export default function NewLitAssignment() {
  const router = useRouter();
  const [classes, setClasses] = useState([]);       // tất cả lớp trong trường
  const [taught, setTaught] = useState(new Set());  // lớp thầy/cô được phân công dạy Ngữ văn
  const [selected, setSelected] = useState([]);     // id các lớp được chọn
  const [form, setForm] = useState({
    title: '', prompt: '', genre: 'nghi_luan_xh',
    minWords: 300, maxWords: '', maxScore: 10, dueDate: '',
  });
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

    const mine = new Set((ta || []).filter((r) => /văn/i.test(r.subjects?.name || '')).map((r) => r.class_id));
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
    if (!form.title.trim()) { setError('Hãy nhập đề bài trước khi nhờ AI soạn barem.'); return; }
    if (criteria.length > 0 && !confirm('AI sẽ thay toàn bộ barem hiện tại. Tiếp tục?')) return;
    setAiBusy(true);
    try {
      const cls = classes.find((c) => c.id === selected[0]);
      const { criteria: list } = await litFetch('/api/lit/rubric', {
        title: form.title, prompt: form.prompt, genre: form.genre,
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

    if (!form.title.trim()) return setError('Hãy nhập đề bài.');
    if (selected.length === 0) return setError('Hãy chọn ít nhất một lớp để giao.');
    if (!(maxScore > 0)) return setError('Thang điểm không hợp lệ.');
    if (clean.length === 0) return setError('Cần có ít nhất một tiêu chí trong barem.');
    if (sum !== maxScore) return setError(`Tổng điểm barem là ${sum}, cần bằng thang điểm ${maxScore}.`);
    if (form.maxWords && Number(form.maxWords) < Number(form.minWords || 0)) {
      return setError('Số chữ tối đa phải lớn hơn số chữ tối thiểu.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    const createdIds = [];

    // Mỗi lớp là một đề riêng (cùng nội dung và barem) để điểm từng lớp tách bạch
    for (let i = 0; i < selected.length; i++) {
      const classId = selected[i];
      const cname = classes.find((c) => c.id === classId)?.name || '';
      setSaving(`Đang giao đề cho lớp ${cname} (${i + 1}/${selected.length})...`);

      const { data: a, error: aErr } = await supabase
        .from('lit_assignments')
        .insert({
          teacher_id: user.id,
          class_id: classId,
          title: form.title.trim(),
          prompt: form.prompt.trim(),
          genre: form.genre,
          min_words: Number(form.minWords) || 0,
          max_words: form.maxWords ? Number(form.maxWords) : null,
          max_score: maxScore,
          due_date: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        })
        .select('id')
        .single();
      if (aErr) { setSaving(''); return setError(`Lớp ${cname}: ${aErr.message}${createdIds.length ? ` (đã giao xong ${createdIds.length} lớp trước đó)` : ''}`); }

      const { error: cErr } = await supabase.from('lit_criteria').insert(
        clean.map((c, k) => ({
          assignment_id: a.id, name: c.name.trim(), description: c.description.trim(),
          max_points: Number(c.max_points), sort_order: k,
        }))
      );
      if (cErr) {
        await supabase.from('lit_assignments').delete().eq('id', a.id);
        setSaving('');
        return setError(`Lớp ${cname}: ${cErr.message}${createdIds.length ? ` (đã giao xong ${createdIds.length} lớp trước đó)` : ''}`);
      }
      createdIds.push(a.id);
    }

    setSaving('');
    router.push(createdIds.length === 1 ? `/teacher/ngu-van/${createdIds[0]}` : '/teacher/ngu-van');
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
        .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .quick { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .q { border: 1.5px solid #dbe7f3; background: #f5faff; color: #225da3; font-weight: 700; font-size: 13px; border-radius: 999px; padding: 7px 14px; cursor: pointer; font-family: inherit; }
        .q:hover { border-color: #225da3; }
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
        @media (max-width: 600px) { .grid3 { grid-template-columns: 1fr; } .grp { flex-direction: column; gap: 4px; } .gl { padding-top: 0; } }
      `}</style>

      <Link href="/teacher/ngu-van" style={backBtnStyle}>← Bài văn chấm bằng AI</Link>

      <form onSubmit={handleSave}>
        <div className="card">
          <h1>Giao đề văn mới</h1>
          <p className="sub">Học sinh viết bài trực tiếp trên web. Barem bên dưới là căn cứ để AI chấm.</p>

          <label className="f">Đề bài</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ví dụ: Suy nghĩ của em về lòng biết ơn" />

          <label className="f">Yêu cầu chi tiết (tùy chọn)</label>
          <textarea rows={4} value={form.prompt} onChange={(e) => set('prompt', e.target.value)}
            placeholder="Gợi ý, phạm vi, yêu cầu về dẫn chứng... AI sẽ dùng phần này để chấm sát đề hơn." />

          <label className="f">Lớp được giao</label>
          <div className="quick">
            {taught.size > 0 && (
              <button type="button" className="q" onClick={() => setSelected([...taught])}>★ Các lớp tôi dạy Ngữ văn</button>
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
                      {c.name}{taught.has(c.id) && <span className="star" title="Lớp thầy/cô dạy Ngữ văn">★</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="picked">Đã chọn {selected.length} lớp</div>

          <label className="f">Thể loại</label>
          <select value={form.genre} onChange={(e) => set('genre', e.target.value)}>
            {GENRES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>

          <div className="grid3">
            <div>
              <label className="f">Số chữ tối thiểu</label>
              <input type="number" min="0" value={form.minWords} onChange={(e) => set('minWords', e.target.value)} />
            </div>
            <div>
              <label className="f">Số chữ gợi ý tối đa</label>
              <input type="number" min="0" value={form.maxWords} onChange={(e) => set('maxWords', e.target.value)} placeholder="Không giới hạn" />
            </div>
            <div>
              <label className="f">Thang điểm</label>
              <input type="number" min="1" step="1" value={form.maxScore} onChange={(e) => set('maxScore', e.target.value)} />
            </div>
          </div>

          <label className="f">Hạn nộp (tùy chọn)</label>
          <input type="datetime-local" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </div>

        <div className="card">
          <div className="rb-head">
            <div>
              <h2>Barem chấm điểm</h2>
              <p className="sub" style={{ margin: '4px 0 0' }}>AI chấm từng tiêu chí dưới đây. Thầy cô có thể sửa mọi thứ. Barem này dùng chung cho tất cả các lớp đã chọn.</p>
            </div>
            <button type="button" className="ai-btn" onClick={aiRubric} disabled={aiBusy}>
              {aiBusy ? 'AI đang soạn...' : '✨ AI soạn barem'}
            </button>
          </div>
          <RubricEditor criteria={criteria} onChange={setCriteria} maxScore={Number(form.maxScore) || 10} />
        </div>

        {error && <div className="error">{error}</div>}
        <button type="submit" className="submit" disabled={!!saving}>
          {saving || (selected.length > 1 ? `Giao đề cho ${selected.length} lớp` : 'Giao đề cho lớp')}
        </button>
      </form>
    </div>
  );
}
