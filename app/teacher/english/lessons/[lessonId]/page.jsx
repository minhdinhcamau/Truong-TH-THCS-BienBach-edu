'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const emptyForm = { word: '', part_of_speech: '', meaning: '', example_sentence: '', example_translation: '' };

export default function LessonVocabPage() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // --- Khu AI sắp xếp từ vựng ---
  const [pasteText, setPasteText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [draftItems, setDraftItems] = useState([]);
  const [savingDraft, setSavingDraft] = useState(false);

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
    setEditForm({
      word: it.word || '',
      part_of_speech: it.part_of_speech || '',
      meaning: it.meaning || '',
      example_sentence: it.example_sentence || '',
      example_translation: it.example_translation || '',
    });
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

  // --- Xử lý AI ---
  async function handleAiParse() {
    if (!pasteText.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/parse-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Có lỗi xảy ra, thử lại.');
        return;
      }
      if (!data.items || data.items.length === 0) {
        setAiError('AI không tách được từ vựng nào từ đoạn văn bản này. Thử dán lại rõ ràng hơn.');
        return;
      }
      setDraftItems(data.items.map((it) => ({
        word: it.word,
        part_of_speech: it.part_of_speech || '',
        meaning: it.meaning,
        example: it.example || '',
        example_translation: it.example_translation || '',
      })));
    } catch (e) {
      setAiError('Không kết nối được tới AI. Kiểm tra lại kết nối mạng.');
    } finally {
      setAiLoading(false);
    }
  }

  function updateDraft(idx, field, value) {
    setDraftItems((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  }
  function removeDraft(idx) {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function addDraftRow() {
    setDraftItems((prev) => [...prev, { word: '', part_of_speech: '', meaning: '', example: '', example_translation: '' }]);
  }

  async function saveDraftItems() {
    const valid = draftItems.filter((d) => d.word.trim() && d.meaning.trim());
    if (valid.length === 0) return;
    setSavingDraft(true);
    const rows = valid.map((d, i) => ({
      lesson_id: lessonId,
      word: d.word.trim(),
      part_of_speech: d.part_of_speech.trim(),
      meaning: d.meaning.trim(),
      example_sentence: d.example.trim(),
      example_translation: d.example_translation.trim(),
      order_index: items.length + i,
    }));
    await supabase.from('eng_vocab_items').insert(rows);
    setDraftItems([]);
    setPasteText('');
    setSavingDraft(false);
    load();
  }

  if (!lesson) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>;

  const notEnough = items.length < 3;

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 880px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        h1 { font-size: 22px; color: #17302d; margin: 14px 0 4px; }
        .count-note { font-size: 13.5px; margin: 0 0 24px; padding: 8px 14px; border-radius: 10px; display: inline-block; }
        .count-note.ok { color: #1a7f4e; background: #EAFBEA; }
        .count-note.warn { color: #b45309; background: #FEF3E2; }
        .vocab-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 26px; }
        .vocab-card { background: #fff; border: 1px solid #e5eeec; border-radius: 14px; padding: 16px; box-shadow: 0 1px 4px rgba(23,48,45,0.03); }
        .vocab-card:hover { box-shadow: 0 4px 12px rgba(23,48,45,0.07); }
        .vc-word { font-weight: 700; font-size: 17px; color: #17302d; }
        .pos-badge { display: inline-block; font-size: 11px; font-weight: 700; color: #6d3fd6; background: #F3F0FF;
          border-radius: 6px; padding: 2px 7px; margin-left: 7px; vertical-align: middle; text-transform: lowercase; }
        .vc-meaning { color: #225da3; font-weight: 600; font-size: 14px; margin-top: 2px; }
        .vc-example { color: #6b7f7a; font-size: 12.5px; margin-top: 8px; font-style: italic; line-height: 1.4; }
        .vc-translation { color: #9ca3af; font-size: 12px; margin-top: 2px; }
        .vc-actions { display: flex; gap: 8px; margin-top: 12px; }
        .link-btn { border: none; background: none; cursor: pointer; font-size: 12.5px; font-weight: 600; padding: 0; color: #225da3; }
        .link-btn.danger { color: #a3374a; }
        .edit-card { background: #fff; border: 2px solid #225da3; border-radius: 14px; padding: 14px; }
        input, textarea { width: 100%; padding: 9px 11px; border-radius: 9px; border: 1.5px solid #e2e8f0; font-size: 13.5px; font-family: inherit; box-sizing: border-box; margin-bottom: 8px; }
        input:focus, textarea:focus { outline: none; border-color: #225da3; }
        .add-card { background: #fff; border-radius: 16px; padding: 22px; border: 1px solid #e5eeec; margin-bottom: 20px; }
        .add-card h4 { margin: 0 0 16px; font-size: 15px; color: #17302d; }
        label { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 4px; margin-top: 12px; }
        label:first-of-type { margin-top: 0; }
        .add-input { width: 100%; padding: 11px 13px; border-radius: 11px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .add-input:focus { outline: none; border-color: #225da3; }
        .add-btn { width: 100%; margin-top: 18px; background: #225da3; color: #fff; border: none; border-radius: 11px; padding: 12px; font-weight: 700; cursor: pointer; }
        .add-btn:disabled { background: #9ca3af; cursor: not-allowed; }
        .tip { margin-top: 20px; font-size: 12.5px; color: #9ca3af; text-align: center; }

        .ai-card { background: linear-gradient(135deg,#F3F0FF,#EAF4FF); border: 1.5px solid #d9d1fb; border-radius: 16px; padding: 22px; margin-bottom: 20px; }
        .ai-card h4 { margin: 0 0 4px; font-size: 15px; color: #4c2f9e; }
        .ai-card .ai-sub { font-size: 12.5px; color: #6b7280; margin: 0 0 14px; }
        .ai-textarea { min-height: 100px; resize: vertical; }
        .ai-btn { background: #6d3fd6; color: #fff; border: none; border-radius: 11px; padding: 11px 20px; font-weight: 700;
          cursor: pointer; font-size: 13.5px; display: inline-flex; align-items: center; gap: 6px; }
        .ai-btn:disabled { background: #b7a9dd; cursor: not-allowed; }
        .ai-error { color: #a3374a; font-size: 13px; background: #fdeef0; padding: 10px 14px; border-radius: 10px; margin-top: 12px; white-space: pre-line; }

        .draft-section { background: #fff; border: 2px solid #6d3fd6; border-radius: 16px; padding: 20px; margin-bottom: 26px; }
        .draft-section h4 { margin: 0 0 4px; font-size: 15px; color: #17302d; }
        .draft-sub { font-size: 12.5px; color: #6b7f7a; margin: 0 0 14px; }
        .draft-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        .draft-card { background: #FAF8FF; border: 1.5px solid #e4dbfb; border-radius: 12px; padding: 12px; position: relative; }
        .draft-card input { margin-bottom: 6px; font-size: 13px; padding: 8px 10px; }
        .draft-card .field-label { font-size: 10.5px; color: #9ca3af; font-weight: 700; text-transform: uppercase; margin: 6px 0 2px; }
        .draft-card .field-label:first-child { margin-top: 0; }
        .draft-remove { position: absolute; top: 8px; right: 8px; border: none; background: #fdeef0; color: #a3374a; border-radius: 8px; width: 26px; height: 26px; cursor: pointer; font-size: 12px; }
        .draft-footer { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
        .add-row-btn { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 10px 16px; font-weight: 600; cursor: pointer; color: #374151; font-size: 13px; }
        .save-all-btn { background: #58CC02; color: #fff; border: none; border-radius: 10px; padding: 10px 20px; font-weight: 700; cursor: pointer; font-size: 13.5px; box-shadow: 0 3px 0 #48a802; }
        .save-all-btn:disabled { background: #9ca3af; box-shadow: none; cursor: not-allowed; }
      `}</style>

      <Link href={`/teacher/english/units/${lesson.eng_units.id}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
        border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
        textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
      }}>← {lesson.eng_units.title}</Link>
      <h1>{lesson.title}</h1>
      <span className={`count-note ${notEnough ? 'warn' : 'ok'}`}>
        {notEnough
          ? `⚠️ Mới có ${items.length} từ — cần tối thiểu 3 từ để tạo trắc nghiệm có đáp án nhiễu`
          : `✓ ${items.length} từ vựng — đủ để tạo trắc nghiệm`}
      </span>

      <div className="vocab-grid">
        {items.map((it) => (
          editingId === it.id ? (
            <div key={it.id} className="edit-card">
              <input value={editForm.word} onChange={(e) => setEditForm({ ...editForm, word: e.target.value })} placeholder="Từ tiếng Anh (không kèm loại từ)" autoFocus />
              <input value={editForm.part_of_speech} onChange={(e) => setEditForm({ ...editForm, part_of_speech: e.target.value })} placeholder="Loại từ (n / v / adj...) — tùy chọn" />
              <input value={editForm.meaning} onChange={(e) => setEditForm({ ...editForm, meaning: e.target.value })} placeholder="Nghĩa" />
              <input value={editForm.example_sentence} onChange={(e) => setEditForm({ ...editForm, example_sentence: e.target.value })} placeholder="Câu ví dụ (tiếng Anh)" />
              <input value={editForm.example_translation} onChange={(e) => setEditForm({ ...editForm, example_translation: e.target.value })} placeholder="Bản dịch câu ví dụ (tiếng Việt)" />
              <div className="vc-actions">
                <button className="link-btn" onClick={() => saveEdit(it.id)}>💾 Lưu</button>
                <button className="link-btn" onClick={() => setEditingId(null)}>Hủy</button>
              </div>
            </div>
          ) : (
            <div key={it.id} className="vocab-card">
              <div className="vc-word">
                {it.word}
                {it.part_of_speech && <span className="pos-badge">{it.part_of_speech}</span>}
              </div>
              <div className="vc-meaning">{it.meaning}</div>
              {it.example_sentence && <div className="vc-example">"{it.example_sentence}"</div>}
              {it.example_translation && <div className="vc-translation">{it.example_translation}</div>}
              <div className="vc-actions">
                <button className="link-btn" onClick={() => startEdit(it)}>✎ Sửa</button>
                <button className="link-btn danger" onClick={() => deleteItem(it.id)}>🗑 Xóa</button>
              </div>
            </div>
          )
        ))}
      </div>

      <div className="ai-card">
        <h4>✨ Dán từ vựng, để AI sắp xếp</h4>
        <p className="ai-sub">Dán một đoạn văn bản chứa danh sách từ (không cần đúng định dạng, có thể lộn xộn) — AI sẽ tự tách thành Từ / Nghĩa / Câu ví dụ / Bản dịch.</p>
        <textarea
          className="ai-textarea"
          placeholder={`Ví dụ dán vào đây:\nmother - mẹ\nfather: bố\nsister (chị/em gái)\n...`}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <button className="ai-btn" onClick={handleAiParse} disabled={aiLoading || !pasteText.trim()}>
          {aiLoading ? 'Đang xử lý...' : '✨ Dùng AI sắp xếp'}
        </button>
        {aiError && <div className="ai-error">{aiError}</div>}
      </div>

      {draftItems.length > 0 && (
        <div className="draft-section">
          <h4>Kết quả AI — kiểm tra và chỉnh sửa trước khi lưu</h4>
          <p className="draft-sub">Sửa lại nếu AI chưa đúng, xóa thẻ thừa, rồi bấm "Lưu tất cả" để thêm vào bài học.</p>
          <div className="draft-grid">
            {draftItems.map((d, i) => (
              <div key={i} className="draft-card">
                <button className="draft-remove" onClick={() => removeDraft(i)} title="Xóa">🗑</button>
                <div className="field-label">Từ</div>
                <input value={d.word} onChange={(e) => updateDraft(i, 'word', e.target.value)} placeholder="Từ tiếng Anh" />
                <div className="field-label">Loại từ</div>
                <input value={d.part_of_speech} onChange={(e) => updateDraft(i, 'part_of_speech', e.target.value)} placeholder="n / v / adj" />
                <div className="field-label">Nghĩa</div>
                <input value={d.meaning} onChange={(e) => updateDraft(i, 'meaning', e.target.value)} placeholder="Nghĩa tiếng Việt" />
                <div className="field-label">Câu ví dụ</div>
                <input value={d.example} onChange={(e) => updateDraft(i, 'example', e.target.value)} placeholder="Câu tiếng Anh" />
                <div className="field-label">Bản dịch câu</div>
                <input value={d.example_translation} onChange={(e) => updateDraft(i, 'example_translation', e.target.value)} placeholder="Dịch câu ra tiếng Việt" style={{ marginBottom: 0 }} />
              </div>
            ))}
          </div>
          <div className="draft-footer">
            <button className="add-row-btn" onClick={addDraftRow}>＋ Thêm thẻ trống</button>
            <button className="save-all-btn" onClick={saveDraftItems} disabled={savingDraft}>
              {savingDraft ? 'Đang lưu...' : `💾 Lưu tất cả (${draftItems.filter((d) => d.word.trim() && d.meaning.trim()).length} từ) vào bài học`}
            </button>
          </div>
        </div>
      )}

      <div className="add-card">
        <h4>＋ Thêm từng từ một cách thủ công</h4>
        <form onSubmit={addItem}>
          <label>Từ tiếng Anh</label>
          <input className="add-input" placeholder="Ví dụ: mother" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} />
          <label>Loại từ (tùy chọn)</label>
          <input className="add-input" placeholder="Ví dụ: n / v / adj" value={form.part_of_speech} onChange={(e) => setForm({ ...form, part_of_speech: e.target.value })} />
          <label>Nghĩa tiếng Việt</label>
          <input className="add-input" placeholder="Ví dụ: mẹ" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
          <label>Câu ví dụ (tùy chọn)</label>
          <input className="add-input" placeholder="Ví dụ: My mother is a teacher." value={form.example_sentence} onChange={(e) => setForm({ ...form, example_sentence: e.target.value })} />
          <label>Bản dịch câu ví dụ (tùy chọn — cần cho dạng bài "Dịch câu")</label>
          <input className="add-input" placeholder="Ví dụ: Mẹ tôi là giáo viên." value={form.example_translation} onChange={(e) => setForm({ ...form, example_translation: e.target.value })} />
          <button type="submit" className="add-btn">＋ Thêm từ</button>
        </form>
      </div>

      <p className="tip">Có thể tải file Excel mẫu để nhập hàng loạt: liên hệ quản trị viên nếu cần mẫu file.</p>
    </div>
  );
}
