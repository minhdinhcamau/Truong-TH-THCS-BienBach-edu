'use client';
import { useEffect, useState } from 'react';
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
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({
    title: '', prompt: '', classId: '', genre: 'nghi_luan_xh',
    minWords: 300, maxWords: '', maxScore: 10, dueDate: '',
  });
  const [criteria, setCriteria] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { loadClasses(); }, []);

  async function loadClasses() {
    // Ưu tiên các lớp thầy/cô được phân công dạy môn Ngữ văn; không có thì hiện tất cả lớp
    const { data: { user } } = await supabase.auth.getUser();
    const { data: ta } = await supabase
      .from('teacher_assignments')
      .select('class_id, classes(id, name, grade), subjects(name)')
      .eq('teacher_id', user.id);

    const map = new Map();
    (ta || [])
      .filter((r) => /văn/i.test(r.subjects?.name || '') && r.classes)
      .forEach((r) => map.set(r.classes.id, r.classes));

    let list = [...map.values()];
    if (list.length === 0) {
      const { data } = await supabase.from('classes').select('id, name, grade').order('name');
      list = data || [];
    }
    list.sort((a, b) => (a.grade || 0) - (b.grade || 0) || a.name.localeCompare(b.name, 'vi'));
    setClasses(list);
  }

  async function aiRubric() {
    setError('');
    if (!form.title.trim()) { setError('Hãy nhập đề bài trước khi nhờ AI soạn barem.'); return; }
    if (criteria.length > 0 && !confirm('AI sẽ thay toàn bộ barem hiện tại. Tiếp tục?')) return;
    setAiBusy(true);
    try {
      const cls = classes.find((c) => c.id === form.classId);
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
    if (!form.classId) return setError('Hãy chọn lớp được giao.');
    if (!(maxScore > 0)) return setError('Thang điểm không hợp lệ.');
    if (clean.length === 0) return setError('Cần có ít nhất một tiêu chí trong barem.');
    if (sum !== maxScore) return setError(`Tổng điểm barem là ${sum}, cần bằng thang điểm ${maxScore}.`);
    if (form.maxWords && Number(form.maxWords) < Number(form.minWords || 0)) {
      return setError('Số chữ tối đa phải lớn hơn số chữ tối thiểu.');
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: a, error: aErr } = await supabase
      .from('lit_assignments')
      .insert({
        teacher_id: user.id,
        class_id: form.classId,
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
    if (aErr) { setSaving(false); return setError(aErr.message); }

    const { error: cErr } = await supabase.from('lit_criteria').insert(
      clean.map((c, i) => ({
        assignment_id: a.id, name: c.name.trim(), description: c.description.trim(),
        max_points: Number(c.max_points), sort_order: i,
      }))
    );
    if (cErr) {
      await supabase.from('lit_assignments').delete().eq('id', a.id);
      setSaving(false);
      return setError(cErr.message);
    }
    router.push(`/teacher/ngu-van/${a.id}`);
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 760px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .card { background: #fff; border-radius: 20px; padding: 26px; margin-top: 16px; box-shadow: 0 2px 10px rgba(23,48,45,0.05); border: 1px solid #e5eeec; }
        h1 { margin: 0 0 4px; font-size: 22px; color: #17302d; }
        h2 { margin: 0; font-size: 18px; color: #17302d; }
        .sub { color: #6b7f7a; font-size: 13.5px; margin: 0 0 20px; }
        label { display: block; font-size: 13.5px; font-weight: 600; color: #374151; margin: 16px 0 6px; }
        .card > label:first-of-type { margin-top: 0; }
        input, textarea, select { width: 100%; padding: 11px 13px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-size: 14.5px; font-family: inherit; box-sizing: border-box; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: #225da3; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .rb-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .ai-btn { background: linear-gradient(135deg, #225da3, #3b82f6); color: #fff; border: none; border-radius: 999px; padding: 10px 20px; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 3px 0 #184270; }
        .ai-btn:disabled { background: #9ca3af; box-shadow: none; cursor: wait; }
        .error { color: #a3374a; font-size: 13.5px; background: #fdeef0; padding: 10px 14px; border-radius: 10px; margin-top: 16px; }
        .submit { width: 100%; margin-top: 20px; padding: 14px; background: #225da3; color: #fff; border: none; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 3px 0 #184270; }
        .submit:disabled { background: #9ca3af; box-shadow: none; cursor: not-allowed; }
        @media (max-width: 600px) { .grid2, .grid3 { grid-template-columns: 1fr; } }
      `}</style>

      <Link href="/teacher/ngu-van" style={backBtnStyle}>← Bài văn chấm bằng AI</Link>

      <form onSubmit={handleSave}>
        <div className="card">
          <h1>Giao đề văn mới</h1>
          <p className="sub">Học sinh viết bài trực tiếp trên web. Barem bên dưới là căn cứ để AI chấm.</p>

          <label>Đề bài</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ví dụ: Suy nghĩ của em về lòng biết ơn" />

          <label>Yêu cầu chi tiết (tùy chọn)</label>
          <textarea rows={4} value={form.prompt} onChange={(e) => set('prompt', e.target.value)}
            placeholder="Gợi ý, phạm vi, yêu cầu về dẫn chứng... AI sẽ dùng phần này để chấm sát đề hơn." />

          <div className="grid2">
            <div>
              <label>Lớp được giao</label>
              <select value={form.classId} onChange={(e) => set('classId', e.target.value)}>
                <option value="">-- Chọn lớp --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
              </select>
            </div>
            <div>
              <label>Thể loại</label>
              <select value={form.genre} onChange={(e) => set('genre', e.target.value)}>
                {GENRES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid3">
            <div>
              <label>Số chữ tối thiểu</label>
              <input type="number" min="0" value={form.minWords} onChange={(e) => set('minWords', e.target.value)} />
            </div>
            <div>
              <label>Số chữ gợi ý tối đa</label>
              <input type="number" min="0" value={form.maxWords} onChange={(e) => set('maxWords', e.target.value)} placeholder="Không giới hạn" />
            </div>
            <div>
              <label>Thang điểm</label>
              <input type="number" min="1" step="1" value={form.maxScore} onChange={(e) => set('maxScore', e.target.value)} />
            </div>
          </div>

          <label>Hạn nộp (tùy chọn)</label>
          <input type="datetime-local" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </div>

        <div className="card">
          <div className="rb-head">
            <div>
              <h2>Barem chấm điểm</h2>
              <p className="sub" style={{ margin: '4px 0 0' }}>AI chấm từng tiêu chí dưới đây. Thầy cô có thể sửa mọi thứ.</p>
            </div>
            <button type="button" className="ai-btn" onClick={aiRubric} disabled={aiBusy}>
              {aiBusy ? 'AI đang soạn...' : '✨ AI soạn barem'}
            </button>
          </div>
          <RubricEditor criteria={criteria} onChange={setCriteria} maxScore={Number(form.maxScore) || 10} />
        </div>

        {error && <div className="error">{error}</div>}
        <button type="submit" className="submit" disabled={saving}>{saving ? 'Đang giao đề...' : 'Giao đề cho lớp'}</button>
      </form>
    </div>
  );
}
