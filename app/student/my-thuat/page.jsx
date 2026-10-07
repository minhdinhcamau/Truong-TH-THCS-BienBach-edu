'use client';
// Trang Mỹ thuật của học sinh: xem bài thầy cô giao, yêu cầu, barem chấm và NỘP ẢNH BÀI VẼ.
// Nộp ảnh: chụp hoặc chọn ảnh -> bước kiểm tra ảnh (PhotoReview) -> gửi lên /api/art/submit.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import PhotoReview from '@/components/art/PhotoReview';

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

function fmtTime(t) {
  return new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export default function StudentArt() {
  const [items, setItems] = useState(null);
  const [subs, setSubs] = useState({});
  const [thumbs, setThumbs] = useState({});
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [toast, setToast] = useState('');
  const camRef = useRef(null);
  const fileRef = useRef(null);
  const targetRef = useRef(null);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setError('');
    const { data, error: err } = await supabase
      .from('art_assignments')
      .select('id, title, prompt, submit_mode, max_score, due_date, created_at, art_criteria(id, name, description, max_points, sort_order)')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    setItems(data || []);

    // Bài em đã nộp (chính sách chỉ cho đọc bài của mình)
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) return;
    const { data: rows, error: subErr } = await supabase
      .from('art_submissions')
      .select('id, assignment_id, image_path, quality, status, submitted_at, updated_at')
      .eq('student_id', uid);
    if (subErr) { setError((e) => e || `Chưa tải được bài đã nộp: ${subErr.message}`); return; }
    const map = {};
    (rows || []).forEach((r) => { map[r.assignment_id] = r; });
    setSubs(map);
    const paths = (rows || []).map((r) => r.image_path);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('art-submissions').createSignedUrls(paths, 3600);
      const byPath = {};
      (signed || []).forEach((s) => { if (s.signedUrl) byPath[s.path] = s.signedUrl; });
      const th = {};
      (rows || []).forEach((r) => { if (byPath[r.image_path]) th[r.assignment_id] = byPath[r.image_path]; });
      setThumbs(th);
    }
  }

  function pick(item, kind) {
    targetRef.current = item;
    (kind === 'cam' ? camRef : fileRef).current?.click();
  }

  function onPicked(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file && targetRef.current) setReviewing({ item: targetRef.current, file });
  }

  async function submitPhoto({ file, quality }) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn, em hãy đăng nhập lại.');
    const fd = new FormData();
    fd.append('assignmentId', reviewing.item.id);
    fd.append('image', file, 'bai-ve.jpg');
    fd.append('quality', JSON.stringify(quality));
    let res;
    try {
      res = await fetch('/api/art/submit', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    } catch (e) {
      throw new Error('Mất kết nối mạng, em thử gửi lại nhé.');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Không nộp được bài, em thử lại nhé.');
    setReviewing(null);
    setToast('Đã nộp bài thành công!');
    await load();
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
        .submit { margin-top: 12px; border-top: 1px solid #eef3f2; padding-top: 12px; display: grid; gap: 10px; }
        .btns { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn { padding: 11px 16px; border-radius: 999px; border: 1.5px solid #cfe3ea; background: #fff; color: #0f6a85; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: inherit; min-height: 44px; }
        .btn:hover { background: #e8f5f9; }
        .btn.main { background: #0f6a85; border-color: #0f6a85; color: #fff; }
        .btn.main:hover { background: #0c566c; }
        .btn:focus-visible { outline: 3px solid #f2c94c; outline-offset: 2px; }
        .done { display: flex; gap: 12px; align-items: center; }
        .done a { flex: none; line-height: 0; }
        .done img { width: 84px; height: 84px; object-fit: cover; border-radius: 12px; border: 1px solid #dcebf0; background: #f3f8fa; }
        .done .t { display: grid; gap: 3px; font-size: 13.5px; color: #374151; min-width: 0; }
        .done .t b { color: #17603a; font-size: 14px; }
        .done .t small { color: #6b7f7a; font-size: 12.5px; }
        .note { font-size: 13px; color: #6b7f7a; background: #f3f8fa; border-radius: 10px; padding: 8px 12px; }
        .note.late { background: #fdeef0; color: #a3374a; }
        .empty { text-align: center; padding: 48px 20px; color: #9ca3af; background: #fff; border-radius: 16px; border: 1px dashed #cfe3ea; }
        .error { color: #a3374a; font-size: 13.5px; background: #fdeef0; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; word-break: break-word; }
        .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: #17603a; color: #fff; padding: 12px 20px; border-radius: 999px; font-weight: 700; font-size: 14px; box-shadow: 0 6px 20px rgba(0,0,0,0.2); z-index: 1100; }
        .hid { display: none; }
      `}</style>

      <Link href="/student" className="back">← Học tập</Link>

      <div className="head">
        <img src="/mon-hoc/my-thuat.png" alt="" width="64" height="64" />
        <div>
          <h1>Mỹ thuật</h1>
          <p>Các bài vẽ thầy cô giao cho lớp em.</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {items === null ? (
        <div className="empty">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="empty">Lớp em chưa có bài Mỹ thuật nào.</div>
      ) : (
        <div className="list">
          {items.map((it) => {
            const due = dueInfo(it.due_date);
            const crit = [...(it.art_criteria || [])].sort((a, b) => a.sort_order - b.sort_order);
            const sub = subs[it.id];
            const canPhoto = it.submit_mode !== 'web_draw';
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

                <div className="submit">
                  {sub && (
                    <div className="done">
                      {thumbs[it.id] ? (
                        <a href={thumbs[it.id]} target="_blank" rel="noreferrer" aria-label="Xem ảnh đã nộp">
                          <img src={thumbs[it.id]} alt="Ảnh bài vẽ em đã nộp" />
                        </a>
                      ) : null}
                      <div className="t">
                        <b>{sub.status === 'graded' ? 'Bài đã được chấm' : 'Đã nộp bài'}</b>
                        <span>Nộp lúc {fmtTime(sub.submitted_at)}{sub.updated_at && sub.updated_at !== sub.submitted_at && new Date(sub.updated_at) - new Date(sub.submitted_at) > 60000 ? ` · sửa lúc ${fmtTime(sub.updated_at)}` : ''}</span>
                        {sub.quality && sub.quality.sentAnyway && <small>Ảnh gửi khi máy báo chưa thật rõ.</small>}
                      </div>
                    </div>
                  )}

                  {!canPhoto ? (
                    <div className="note">Bài này vẽ trên web, phần này chưa mở. Em chờ thầy cô thông báo nhé.</div>
                  ) : sub && sub.status === 'graded' ? (
                    <div className="note">Bài đã chấm nên không nộp lại được.</div>
                  ) : due.late ? (
                    !sub && <div className="note late">Đã hết hạn nộp bài này.</div>
                  ) : (
                    <div className="btns">
                      <button type="button" className={`btn ${sub ? '' : 'main'}`} onClick={() => pick(it, 'cam')}>
                        {sub ? 'Chụp lại bài vẽ' : 'Chụp ảnh bài vẽ'}
                      </button>
                      <button type="button" className="btn" onClick={() => pick(it, 'file')}>Chọn ảnh từ máy</button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hid" onChange={onPicked} />
      <input ref={fileRef} type="file" accept="image/*" className="hid" onChange={onPicked} />

      {reviewing && (
        <PhotoReview
          file={reviewing.file}
          title={reviewing.item.title}
          onCancel={() => setReviewing(null)}
          onSubmit={submitPhoto}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
