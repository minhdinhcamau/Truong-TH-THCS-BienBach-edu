'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { genreLabel, STATUS_META, formatDateTime } from '@/lib/litConfig';
import SubjectHeader from '@/components/SubjectHeader';

function dueInfo(due) {
  if (!due) return null;
  const ms = new Date(due) - Date.now();
  if (ms < 0) return { text: 'Đã quá hạn', color: '#a3374a' };
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return { text: `Còn ${days} ngày`, color: days <= 2 ? '#b45309' : '#6b7f7a' };
  return { text: `Còn ${Math.max(1, Math.floor(ms / 3600000))} giờ`, color: '#b45309' };
}

export default function StudentLitHome() {
  const [items, setItems] = useState(null);
  const [subs, setSubs] = useState({});     // assignment_id -> bài làm
  const [totals, setTotals] = useState({}); // submission_id -> điểm (chỉ bài đã công bố)

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: asg } = await supabase
      .from('lit_assignments')
      .select('id, title, genre, due_date, max_score, min_words, created_at')
      .order('created_at', { ascending: false });
    const { data: sb } = await supabase
      .from('lit_submissions').select('id, assignment_id, status').eq('student_id', user.id);
    const ids = (sb || []).map((s) => s.id);
    const { data: gr } = ids.length ? await supabase.from('lit_grades').select('submission_id, total') : { data: [] };

    setItems(asg || []);
    setSubs(Object.fromEntries((sb || []).map((s) => [s.assignment_id, s])));
    setTotals(Object.fromEntries((gr || []).map((g) => [g.submission_id, g.total])));
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap { padding: 0 0 40px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .list { display: grid; gap: 12px; }
        .item { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; background: #fff; border: 1px solid #e5eeec;
          border-left: 5px solid #0a52c7; border-radius: 14px; padding: 16px 20px; text-decoration: none; color: inherit; box-shadow: 0 1px 6px rgba(23,48,45,0.04); }
        .item:hover { box-shadow: 0 8px 20px rgba(34,93,163,0.12); }
        .title { font-size: 16.5px; font-weight: 700; color: #17302d; margin-bottom: 6px; }
        .meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: #6b7f7a; align-items: center; }
        .pill { font-weight: 600; padding: 3px 10px; border-radius: 999px; background: #f3f6f5; }
        .right { display: flex; align-items: center; gap: 12px; }
        .chip { font-size: 12px; font-weight: 700; padding: 4px 11px; border-radius: 999px; white-space: nowrap; }
        .cta { font-weight: 700; font-size: 13.5px; color: #225da3; white-space: nowrap; }
        .empty { text-align: center; padding: 48px 20px; color: #9ca3af; background: #fff; border-radius: 16px; border: 1px dashed #cfe2f7; }
      `}</style>

      <SubjectHeader slug="ngu-van" title="Ngữ văn" subtitle="Viết bài trực tiếp trên web. Sau khi nộp, AI đọc bài và thầy cô duyệt điểm cùng nhận xét chi tiết." />

      {items === null ? (
        <div className="empty">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="empty">Lớp em chưa có đề văn nào.</div>
      ) : (
        <div className="list">
          {items.map((it) => {
            const sb = subs[it.id];
            const key = sb?.status || 'none';
            const st = STATUS_META[key];
            const due = dueInfo(it.due_date);
            const total = sb ? totals[sb.id] : null;
            const cta = key === 'published' ? 'Xem điểm và nhận xét' : key === 'submitted' || key === 'ai_graded' ? 'Xem bài đã nộp' : key === 'draft' ? 'Tiếp tục viết' : 'Viết bài';
            return (
              <Link key={it.id} href={`/student/ngu-van/${it.id}`} className="item">
                <div>
                  <div className="title">{it.title}</div>
                  <div className="meta">
                    <span className="pill">{genreLabel(it.genre)}</span>
                    {it.min_words > 0 && <span>Từ {it.min_words} chữ</span>}
                    {it.due_date && <span>Hạn {formatDateTime(it.due_date)}</span>}
                    {due && key !== 'published' && <span style={{ color: due.color, fontWeight: 700 }}>{due.text}</span>}
                  </div>
                </div>
                <div className="right">
                  {key === 'published' && total != null && (
                    <span className="chip" style={{ color: '#1a7f4e', background: '#EAFBEA' }}>{total}/{it.max_score} điểm</span>
                  )}
                  {!(key === 'published' && total != null) && (
                    <span className="chip" style={{ color: st.color, background: st.bg }}>{key === 'ai_graded' ? STATUS_META.submitted.label : st.label}</span>
                  )}
                  <span className="cta">{cta}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
