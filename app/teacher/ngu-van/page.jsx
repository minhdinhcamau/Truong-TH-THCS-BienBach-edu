'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { genreLabel, formatDateTime } from '@/lib/litConfig';

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

export default function TeacherLitHome() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('lit_assignments')
      .select('id, title, genre, due_date, max_score, created_at, classes(name), lit_submissions(id, status)')
      .order('created_at', { ascending: false });
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
        .item { display: block; background: #fff; border: 1px solid #e5eeec; border-radius: 16px; padding: 18px 20px; text-decoration: none; color: inherit;
          box-shadow: 0 1px 6px rgba(23,48,45,0.04); transition: box-shadow 0.15s, border-color 0.15s; }
        .item:hover { box-shadow: 0 8px 20px rgba(34,93,163,0.12); border-color: #b9d4ee; }
        .title { font-size: 17px; font-weight: 700; color: #17302d; margin-bottom: 8px; }
        .meta { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .pill { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: #f3f6f5; color: #4b5563; }
        .pill.cls { background: #E9F2FC; color: #225da3; }
        .stats { display: flex; gap: 18px; flex-wrap: wrap; font-size: 13.5px; color: #4b5563; }
        .stats b { color: #17302d; }
        .stats .wait b { color: #b45309; }
        .empty { text-align: center; padding: 48px 20px; color: #9ca3af; background: #fff; border-radius: 16px; border: 1px dashed #cfe2f7; }
      `}</style>

      <Link href="/teacher" style={backBtnStyle}>← Trang giáo viên</Link>

      <div className="head">
        <div>
          <h1>Bài văn chấm bằng AI</h1>
          <p>Giao đề, soạn barem cùng AI. Học sinh viết trên web, AI chấm theo barem, thầy cô duyệt rồi công bố điểm.</p>
        </div>
        <Link href="/teacher/ngu-van/new" style={newBtnStyle}>＋ Giao đề mới</Link>
      </div>

      {loading ? (
        <div className="empty">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="empty">Chưa có đề nào. Bấm “Giao đề mới” để bắt đầu.</div>
      ) : (
        <div className="list">
          {items.map((it) => {
            const subs = it.lit_submissions || [];
            const submitted = subs.filter((s) => s.status !== 'draft').length;
            const waiting = subs.filter((s) => s.status === 'submitted' || s.status === 'ai_graded').length;
            const published = subs.filter((s) => s.status === 'published').length;
            return (
              <Link key={it.id} href={`/teacher/ngu-van/${it.id}`} className="item">
                <div className="title">{it.title}</div>
                <div className="meta">
                  <span className="pill cls">Lớp {it.classes?.name || '—'}</span>
                  <span className="pill">{genreLabel(it.genre)}</span>
                  <span className="pill">Thang {it.max_score} điểm</span>
                  {it.due_date && <span className="pill">Hạn {formatDateTime(it.due_date)}</span>}
                </div>
                <div className="stats">
                  <span>Đã nộp: <b>{submitted}</b></span>
                  <span className="wait">Chờ duyệt: <b>{waiting}</b></span>
                  <span>Đã công bố: <b>{published}</b></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
