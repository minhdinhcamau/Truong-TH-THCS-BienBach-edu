'use client';
// Trang Mỹ thuật của học sinh: xem các bài vẽ thầy cô đã giao cho lớp, yêu cầu và barem chấm.
// (Phần nộp bài bằng ảnh sẽ có ở gói tiếp theo.)
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const MODE_LABEL = { photo: 'Chụp ảnh bài vẽ giấy', web_draw: 'Vẽ trên web', both: 'Ảnh giấy hoặc vẽ web' };

function dueInfo(due) {
  if (!due) return { text: 'Không giới hạn hạn nộp', late: false };
  const d = new Date(due);
  const ms = d - Date.now();
  const when = d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  if (ms < 0) return { text: `Đã hết hạn · ${when}`, late: true };
  const days = Math.floor(ms / 86400000);
  return { text: days >= 1 ? `Còn ${days} ngày · ${when}` : `Còn ${Math.max(1, Math.floor(ms / 3600000))} giờ · ${when}`, late: false };
}

export default function StudentArt() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error: err } = await supabase
      .from('art_assignments')
      .select('id, title, prompt, submit_mode, max_score, due_date, created_at, art_criteria(id, name, description, max_points, sort_order)')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    setItems(data || []);
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { max-width: 760px; margin: 0 auto; padding: 20px 16px 64px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .back { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 1.5px solid #cfe3ea; background: #fff; color: #0f6a85; font-weight: 600; font-size: 13.5px; text-decoration: none; }
        .head { display: flex; align-items: center; gap: 14px; margin: 18px 0 20px; }
        .head img { width: 64px; height: 64px; object-fit: contain; flex: none; background: radial-gradient(circle at 30% 25%, #fff, #e0f1f7 72%); border-radius: 18px; padding: 5px; }
        .head h1 { margin: 0; font-size: 24px; color: #17302d; }
        .head p { margin: 4px 0 0; color: #6b7f7a; font-size: 13.5px; }
        .list { display: grid; gap: 12px; }
        .item { background: #fff; border: 1px solid #dcebf0; border-radius: 16px; padding: 16px 18px; box-shadow: 0 1px 6px rgba(23,48,45,0.04); }
        .title { font-size: 17px; font-weight: 700; color: #17302d; margin-bottom: 8px; }
        .meta { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .pill { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: #f3f6f5; color: #4b5563; }
        .pill.due { background: #e0f4f8; color: #0f6a85; }
        .pill.late { background: #fdeef0; color: #a3374a; }
        .prompt { font-size: 14px; color: #374151; line-height: 1.55; margin: 0 0 10px; white-space: pre-wrap; }
        details { border-top: 1px solid #eef3f2; padding-top: 10px; }
        summary { cursor: pointer; font-weight: 700; font-size: 13.5px; color: #0f6a85; }
        .crit { margin-top: 10px; display: grid; gap: 8px; }
        .c { background: #f6fbfc; border-radius: 10px; padding: 10px 12px; }
        .c b { color: #17302d; font-size: 14px; }
        .c span { float: right; font-weight: 700; color: #0f6a85; font-size: 13px; }
        .c p { margin: 4px 0 0; font-size: 13px; color: #4b5563; line-height: 1.5; clear: both; }
        .soon { margin-top: 12px; font-size: 13px; color: #6b7f7a; background: #f3f8fa; border-radius: 10px; padding: 8px 12px; }
        .empty { text-align: center; padding: 48px 20px; color: #9ca3af; background: #fff; border-radius: 16px; border: 1px dashed #cfe3ea; }
        .error { color: #a3374a; font-size: 13.5px; background: #fdeef0; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; word-break: break-word; }
      `}</style>

      <Link href="/student" className="back">← Học tập</Link>

      <div className="head">
        <img src="/mon-hoc/my-thuat.png" alt="" width="64" height="64" />
        <div>
          <h1>Mỹ thuật</h1>
          <p>Các bài vẽ thầy cô giao cho lớp em.</p>
        </div>
      </div>

      {error && <div className="error">Không tải được danh sách bài: {error}</div>}

      {items === null ? (
        <div className="empty">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="empty">Lớp em chưa có bài Mỹ thuật nào.</div>
      ) : (
        <div className="list">
          {items.map((it) => {
            const due = dueInfo(it.due_date);
            const crit = [...(it.art_criteria || [])].sort((a, b) => a.sort_order - b.sort_order);
            return (
              <article key={it.id} className="item">
                <div className="title">{it.title}</div>
                <div className="meta">
                  <span className={`pill ${due.late ? 'late' : 'due'}`}>{due.text}</span>
                  <span className="pill">{MODE_LABEL[it.submit_mode] || it.submit_mode}</span>
                  <span className="pill">Thang {it.max_score} điểm</span>
                </div>
                {it.prompt && <p className="prompt">{it.prompt}</p>}
                {crit.length > 0 && (
                  <details>
                    <summary>Xem barem chấm ({crit.length} tiêu chí)</summary>
                    <div className="crit">
                      {crit.map((c) => (
                        <div key={c.id} className="c">
                          <b>{c.name}</b><span>{c.max_points} điểm</span>
                          {c.description && <p>{c.description}</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <div className="soon">Phần nộp bài bằng ảnh sẽ có trong lần cập nhật tới.</div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
