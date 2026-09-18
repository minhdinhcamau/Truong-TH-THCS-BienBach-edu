'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const emptyForm = { word: '', meaning: '', example_sentence: '' };

export default function LessonVocabPage() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  useEffect(() => { load(); }, [lessonId]);

  async function load() {
    const { data: l } = await supabase.from('eng_lessons').select('*, eng_units(id, title, course_id)').eq('id', lessonId).single();
    setLesson(l);
    const { data: v } = await supabase.from('eng_vocab_items').select('*').eq('lesson_id', lessonId).order('order_index', { ascending: true });
    setItems(v || []);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!form.word.trim() || !form.meaning.trim()) return;
    await supabase.from('eng_vocab_items').insert({ ...form, lesson_id: lessonId, order_index: items.length });
    setForm(emptyForm);
    load();
  }

  function startEdit(it) {
    setEditingId(it.id);
    setEditForm({ word: it.word || '', meaning: it.meaning || '', example_sentence: it.example_sentence || '' });
  }
  async function saveEdit(id) {
    if (!editForm.word.trim() || !editForm.meaning.trim()) return;
    await supabase.from('eng_vocab_items').update(editForm).eq('id', id);
    setEditingId(null);
    load();
  }

  async function deleteItem(id) {
    await supabase.from('eng_vocab_items').delete().eq('id', id);
    load();
  }

  if (!lesson) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;

  const notEnough = items.length < 3;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 820px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .back-link { color: #225da3; font-weight: 600; font-size: 13.5px; text-decoration: none; }
        h1 { font-size: 22px; color: #17302d; margin: 14px 0 4px; }
        .count-note { font-size: 13.5px; margin: 0 0 20px; padding: 8px 14px; border-radius: 10px; display: inline-block; }
        .count-note.ok { color: #1a7f4e; background: #EAFBEA; }
        .count-note.warn { color: #b45309; background: #FEF3E2; }
        .vocab-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 26px; }
        .vocab-card { background: #fff; border: 1px solid #e5eeec; border-radius: 14px; padding: 16px; box-shadow: 0 1px 4px rgba(23,48,45,0.03); }
        .vocab-card:hover { box-shadow: 0 4px 12px rgba(23,48,45,0.07); }
        .vc-word { font-weight: 700; font-size: 17px; color: #17302d; }
        .vc-meaning { color: #225da3; font-weight: 600; font-size: 14px; margin-top: 2px; }
        .vc-example { color: #6b7f7a; font-size: 12.5px; margin-top: 8px; font-style: italic; line-height: 1.4; }
        .vc-actions { display: flex; gap: 8px; margin-top: 12px; }
        .link-btn { border: none; background: none; cursor: pointer; font-size: 12.5px; font-weight: 600; padding: 0; color: #225da3; }
        .link-btn.danger { color: #a3374a; }
        .edit-card { background: #fff; border: 2px solid #225da3; border-radius: 14px; padding: 14px; }
        input { width: 100%; padding: 9px 11px; border-radius: 9px; border: 1.5px solid #e2e8f0; font-size: 13.5px; font-family: inherit; box-sizing: border-box; margin-bottom: 8px; }
        input:focus { outline: none; border-color: #225da3; }
        .add-card { background: #fff; border-radius: 16px; padding: 22px; border: 1px solid #e5eeec; }
        .add-card h4 { margin: 0 0 16px; font-size: 15px; color: #17302d; }
        label { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 4px; margin-top: 12px; }
        label:first-of-type { margin-top: 0; }
        .add-input { width: 100%; padding: 11px 13px; border-radius: 11px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .add-input:focus { outline: none; border-color: #225da3; }
        .add-btn { width: 100%; margin-top: 18px; background: #225da3; color: #fff; border: none; border-radius: 11px; padding: 12px; font-weight: 700; cursor: pointer; }
        .tip { margin-top: 20px; font-size: 12.5px; color: #9ca3af; text-align: center; }
      `}</style>

      <Link href={`/teacher/english/units/${lesson.eng_units.id}`} className="back-link">← {lesson.eng_units.title}</Link>
      <h1>📝 {lesson.title}</h1>
      <span className={`count-note ${notEnough ? 'warn' : 'ok'}`}>
        {notEnough
          ? `⚠️ Mới có ${items.length} từ — cần tối thiểu 3 từ để tạo trắc nghiệm có đáp án nhiễu`
          : `✓ ${items.length} từ vựng — đủ để tạo trắc nghiệm`}
      </span>

      <div className="vocab-grid">
        {items.map((it) => (
          editingId === it.id ? (
            <div key={it.id} className="edit-card">
              <input value={editForm.word} onChange={(e) => setEditForm({ ...editForm, word: e.target.value })} placeholder="Từ tiếng Anh" autoFocus />
              <input value={editForm.meaning} onChange={(e) => setEditForm({ ...editForm, meaning: e.target.value })} placeholder="Nghĩa" />
              <input value={editForm.example_sentence} onChange={(e) => setEditForm({ ...editForm, example_sentence: e.target.value })} placeholder="Câu ví dụ" />
              <div className="vc-actions">
                <button className="link-btn" onClick={() => saveEdit(it.id)}>💾 Lưu</button>
                <button className="link-btn" onClick={() => setEditingId(null)}>Hủy</button>
              </div>
            </div>
          ) : (
            <div key={it.id} className="vocab-card">
              <div className="vc-word">{it.word}</div>
              <div className="vc-meaning">{it.meaning}</div>
              {it.example_sentence && <div className="vc-example">"{it.example_sentence}"</div>}
              <div className="vc-actions">
                <button className="link-btn" onClick={() => startEdit(it)}>✎ Sửa</button>
                <button className="link-btn danger" onClick={() => deleteItem(it.id)}>🗑 Xóa</button>
              </div>
            </div>
          )
        ))}
      </div>

      <div className="add-card">
        <h4>＋ Thêm từ vựng mới</h4>
        <form onSubmit={addItem}>
          <label>Từ tiếng Anh</label>
          <input className="add-input" placeholder="Ví dụ: mother" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} />
          <label>Nghĩa tiếng Việt</label>
          <input className="add-input" placeholder="Ví dụ: mẹ" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
          <label>Câu ví dụ (tùy chọn)</label>
          <input className="add-input" placeholder="Ví dụ: My mother is a teacher." value={form.example_sentence} onChange={(e) => setForm({ ...form, example_sentence: e.target.value })} />
          <button type="submit" className="add-btn">＋ Thêm từ</button>
        </form>
      </div>

      <p className="tip">Gợi ý nâng cấp sau: thêm nút "Import từ Excel/CSV" để dán nhiều từ cùng lúc thay vì nhập tay từng dòng.</p>
    </div>
  );
}
