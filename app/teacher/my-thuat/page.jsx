'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { formatDateTime } from '@/lib/litConfig';

const MODE_LABEL = { photo: 'Chụp ảnh bài giấy', web_draw: 'Vẽ trên web', both: 'Ảnh giấy hoặc vẽ web' };

const backBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1.5px solid #dbe7f3', background: '#fff', color: '#225da3', fontWeight: 600, fontSize: 13.5,
  textDecoration: 'none', boxShadow: '0 1px 3px rgba(23,48,45,0.04)',
};
const newBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', background: '#225da3', color: '#fff',
  border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 0 #184270',
  textDecoration: 'none',
};

export default function TeacherArtHome() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('art_assignments')
      .select('id, title, submit_mode, due_date, max_score, created_at, classes(name), art_criteria(id)')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    setItems(data || []);
    setLoading(false);
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 900px; margin: 0 auto; padding: 28px 24px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .head { display: flex; justify-content: space-between; align-items: flex-end; margin: 18px 0 26px; flex-wrap: wrap; gap: 14px; }
        .head h1 { margin: 0; font-size: 26px; color: #17302d; }
        .head p { margin: 6px 0 0; color: #6b7f7a; font-size: 14px; max-width: 520px; }
        .list { display: grid; gap: 12px; }
        .item { background: #fff; border: 1px solid #e5eeec; border-radius: 16px; padding: 18px 20px; color: inherit; box-shadow: 0 1px 6px rgba(23,48,45,0.04); }
        .title { font-size: 17px; font-weight: 700; color: #17302d; margin-bottom: 8px; }
        .meta { display: flex; gap: 8px; flex-wrap: wrap; }
        .pill { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: #f3f6f5; color: #4b5563; }
        .pill.cls { background: #E9F2FC; color: #225da3; }
        .empty { text-align: center; padding: 48px 20px; color: #9ca3af; background: #fff; border-radius: 16px; border: 1px dashed #cfe2f7; }
        .error { color: #a3374a; font-size: 13.5px; background: #fdeef0; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; word-break: break-word; }
      `}</style>

      <Link href="/teacher" style={backBtnStyle}>← Trang giáo viên</Link>

      <div className="head">
        <div>
          <h1>🎨 Mỹ thuật</h1>
          <p>Giao bài vẽ, soạn barem cùng AI. Thầy cô tự chấm theo barem và nhận xét trên ảnh bài làm.</p>
        </div>
        <Link href="/teacher/my-thuat/new" style={newBtnStyle}>＋ Giao bài mới</Link>
      </div>

      {error && <div className="error">Không tải được danh sách bài: {error}</div>}

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="empty">Chưa có bài nào. Bấm “Giao bài mới” để bắt đầu.</div>
      ) : (
        <div className="list">
          {items.map((it) => (
            <div key={it.id} className="item">
              <div className="title">{it.title}</div>
              <div className="meta">
                <span className="pill cls">Lớp {it.classes?.name || '—'}</span>
                <span className="pill">{MODE_LABEL[it.submit_mode] || it.submit_mode}</span>
                <span className="pill">Thang {it.max_score} điểm</span>
                <span className="pill">{(it.art_criteria || []).length} tiêu chí</span>
                {it.due_date && <span className="pill">Hạn {formatDateTime(it.due_date)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
