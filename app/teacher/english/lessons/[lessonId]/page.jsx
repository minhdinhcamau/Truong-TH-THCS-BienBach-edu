'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const emptyForm = { word: '', phonetic: '', meaning: '', example_sentence: '' };

export default function LessonVocabPage() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    load();
  }, [lessonId]);

  async function load() {
    const { data: l } = await supabase
      .from('eng_lessons')
      .select('*, eng_units(id, title, course_id)')
      .eq('id', lessonId)
      .single();
    setLesson(l);
    const { data: v } = await supabase
      .from('eng_vocab_items')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true });
    setItems(v || []);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!form.word.trim() || !form.meaning.trim()) return;
    await supabase.from('eng_vocab_items').insert({ ...form, lesson_id: lessonId, order_index: items.length });
    setForm(emptyForm);
    load();
  }

  async function deleteItem(id) {
    await supabase.from('eng_vocab_items').delete().eq('id', id);
    load();
  }

  if (!lesson) return <p style={{ padding: 24 }}>Đang tải...</p>;

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <Link href={`/teacher/english/units/${lesson.eng_units.id}`}>← {lesson.eng_units.title}</Link>
      <h1>{lesson.title}</h1>
      <p style={{ color: '#666' }}>{items.length} từ vựng — cần tối thiểu 3 từ để tạo trắc nghiệm có đáp án nhiễu</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
            <th>Từ</th><th>Phiên âm</th><th>Nghĩa</th><th>Câu ví dụ</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td>{it.word}</td>
              <td>{it.phonetic}</td>
              <td>{it.meaning}</td>
              <td>{it.example_sentence}</td>
              <td><button onClick={() => deleteItem(it.id)} style={{ color: 'crimson', border: 0, background: 'none', cursor: 'pointer' }}>Xóa</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={addItem} style={{ marginTop: 20, display: 'grid', gap: 8, maxWidth: 420 }}>
        <h4>+ Thêm từ vựng</h4>
        <input placeholder="Từ (vd: mother)" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} style={input} />
        <input placeholder="Phiên âm (vd: /ˈmʌðər/)" value={form.phonetic} onChange={(e) => setForm({ ...form, phonetic: e.target.value })} style={input} />
        <input placeholder="Nghĩa (vd: mẹ)" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} style={input} />
        <input placeholder="Câu ví dụ (vd: My mother is a teacher.)" value={form.example_sentence} onChange={(e) => setForm({ ...form, example_sentence: e.target.value })} style={input} />
        <button type="submit" style={btnPrimary}>Thêm từ</button>
      </form>

      <p style={{ marginTop: 24, fontSize: 13, color: '#999' }}>
        Gợi ý nâng cấp sau: thêm nút "Import từ Excel/CSV" để dán nhiều từ cùng lúc thay vì nhập tay từng dòng.
      </p>
    </div>
  );
}

const input = { display: 'block', width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' };
const btnPrimary = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', cursor: 'pointer' };
