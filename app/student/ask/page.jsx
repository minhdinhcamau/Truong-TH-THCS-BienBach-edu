'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getRankTier, getInitials } from '../../../lib/rankTiers';
import { useStudent } from '../layout';

const DELETE_REASONS = ['Nội dung không phù hợp', 'Spam', 'Sai môn học', 'Khác'];

function Avatar({ name, totalXp, photoUrl, size = 38 }) {
  const tier = getRankTier(totalXp);
  const core = size - 8;
  return (
    <div className={`avatar-frame ${tier.className}`} style={{ width: size, height: size }}>
      <div className="core" style={{ width: core, height: core, fontSize: Math.max(10, size * 0.32) }}>
        {photoUrl ? <img src={photoUrl} alt="" /> : getInitials(name)}
      </div>
      {tier.badge && <div className="rank-badge">{tier.badge}</div>}
    </div>
  );
}

function ReasonPrompt({ onConfirm, onCancel }) {
  const [reason, setReason] = useState(DELETE_REASONS[0]);
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 360 }}>
        <h3 style={{ marginTop: 0 }}>Lý do xoá</h3>
        <select className="chip-btn" style={{ width: '100%', marginBottom: 14 }} value={reason} onChange={(e) => setReason(e.target.value)}>
          {DELETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="chip-btn" onClick={onCancel}>Huỷ</button>
          <button className="cta" style={{ background: '#D6467A' }} onClick={() => onConfirm(reason)}>Xoá</button>
        </div>
      </div>
    </div>
  );
}

export default function AskPage() {
  const { profile, stats } = useStudent();
  const isMod = profile.role === 'teacher' || profile.role === 'admin';
  const isAdmin = profile.role === 'admin';

  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [text, setText] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [posting, setPosting] = useState(false);
  const [feed, setFeed] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [toast, setToast] = useState('');
  const [deletePrompt, setDeletePrompt] = useState(null); // { type: 'post'|'reply', id }
  const [settings, setSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  async function loadSettings() {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'qa_auto_archive').maybeSingle();
    setSettings(data?.value || { enabled: false, days: 30 });
  }

  async function loadFeed() {
    const { data: posts, error } = await supabase
      .from('qa_posts')
      .select('id, student_id, subject_id, content, photo_url, is_pinned, created_at')
      .is('deleted_at', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error(error);
      setFeed([]);
      return;
    }

    const postIds = (posts || []).map((p) => p.id);
    const { data: replies } = postIds.length
      ? await supabase
          .from('qa_replies')
          .select('id, post_id, author_id, content, marked_useful, created_at')
          .in('post_id', postIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
      : { data: [] };

    const { data: likes } = postIds.length
      ? await supabase.from('qa_likes').select('post_id, student_id').in('post_id', postIds)
      : { data: [] };

    const peopleIds = new Set();
    (posts || []).forEach((p) => peopleIds.add(p.student_id));
    (replies || []).forEach((r) => peopleIds.add(r.author_id));

    const { data: people } = peopleIds.size
      ? await supabase.from('public_profiles').select('id, full_name, role, photo_url').in('id', Array.from(peopleIds))
      : { data: [] };

    const { data: statsRows } = peopleIds.size
      ? await supabase.from('student_stats').select('student_id, total_xp').in('student_id', Array.from(peopleIds))
      : { data: [] };

    const peopleMap = {};
    (people || []).forEach((p) => { peopleMap[p.id] = p; });
    const xpMap = {};
    (statsRows || []).forEach((s) => { xpMap[s.student_id] = s.total_xp; });

    const repliesByPost = {};
    (replies || []).forEach((r) => {
      if (!repliesByPost[r.post_id]) repliesByPost[r.post_id] = [];
      repliesByPost[r.post_id].push({ ...r, author: peopleMap[r.author_id], authorXp: xpMap[r.author_id] || 0 });
    });

    const likesByPost = {};
    (likes || []).forEach((l) => {
      if (!likesByPost[l.post_id]) likesByPost[l.post_id] = [];
      likesByPost[l.post_id].push(l.student_id);
    });

    const assembled = (posts || []).map((p) => ({
      ...p,
      author: peopleMap[p.student_id],
      authorXp: xpMap[p.student_id] || 0,
      subjectName: subjects.find((s) => s.id === p.subject_id)?.name || '',
      replies: repliesByPost[p.id] || [],
      likerIds: likesByPost[p.id] || [],
    }));

    setFeed(assembled);
  }

  useEffect(() => {
    async function init() {
      const { data: subjectsData } = await supabase.from('subjects').select('id, name').order('name');
      setSubjects(subjectsData || []);
      if (subjectsData?.length) setSubjectId(subjectsData[0].id);
      loadSettings();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (subjects.length >= 0) loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects]);

  function onPickPhoto(e) {
    const file = e.target.files[0];
    setPhotoFile(file || null);
    setPhotoPreview(file ? URL.createObjectURL(file) : '');
  }

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      let photoUrl = null;
      let photoPath = null;
      if (photoFile) {
        photoPath = `${profile.id}/${Date.now()}-${photoFile.name}`;
        const { error: uploadError } = await supabase.storage.from('qa-photos').upload(photoPath, photoFile);
        if (uploadError) throw uploadError;
        photoUrl = supabase.storage.from('qa-photos').getPublicUrl(photoPath).data.publicUrl;
      }

      const { error } = await supabase.rpc('create_qa_post', {
        p_subject_id: subjectId || null,
        p_content: text.trim(),
        p_photo_url: photoUrl,
        p_photo_path: photoPath,
      });
      if (error) throw error;

      setText('');
      setPhotoFile(null);
      setPhotoPreview('');
      await loadFeed();
      showToast('Đã đăng câu hỏi của em! +2 KN');
    } catch (err) {
      alert(err.message || 'Có lỗi khi đăng câu hỏi');
    } finally {
      setPosting(false);
    }
  }

  async function handleReply(postId) {
    const val = (replyDrafts[postId] || '').trim();
    if (!val) return;
    const { error } = await supabase.from('qa_replies').insert({
      post_id: postId,
      author_id: profile.id,
      content: val,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setReplyDrafts({ ...replyDrafts, [postId]: '' });
    loadFeed();
  }

  async function handleMarkUseful(replyId) {
    const { error } = await supabase.rpc('mark_reply_useful', { p_reply_id: replyId });
    if (error) {
      alert(error.message);
      return;
    }
    await loadFeed();
    showToast('Đã ghi nhận câu trả lời hữu ích! +5 KN');
  }

  async function handleToggleLike(post) {
    const liked = post.likerIds.includes(profile.id);
    if (liked) {
      await supabase.from('qa_likes').delete().eq('post_id', post.id).eq('student_id', profile.id);
    } else {
      await supabase.from('qa_likes').insert({ post_id: post.id, student_id: profile.id });
    }
    loadFeed();
  }

  async function handleTogglePin(postId) {
    const { error } = await supabase.rpc('toggle_pin_qa_post', { p_post_id: postId });
    if (error) { alert(error.message); return; }
    loadFeed();
  }

  async function confirmDelete(reason) {
    if (!deletePrompt) return;
    const rpcName = deletePrompt.type === 'post' ? 'moderate_delete_qa_post' : 'moderate_delete_qa_reply';
    const paramName = deletePrompt.type === 'post' ? 'p_post_id' : 'p_reply_id';
    const { error } = await supabase.rpc(rpcName, { [paramName]: deletePrompt.id, p_reason: reason });
    setDeletePrompt(null);
    if (error) { alert(error.message); return; }
    showToast('Đã xoá.');
    loadFeed();
  }

  async function saveSettings(enabled, days) {
    const { error } = await supabase.rpc('set_qa_auto_archive', { p_enabled: enabled, p_days: days });
    if (error) { alert(error.message); return; }
    setSettings({ enabled, days });
    showToast('Đã lưu cài đặt.');
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 className="section-title">Hỏi bài</h2>
          <p className="section-sub">Chụp ảnh bài khó, đăng lên để thầy cô hoặc các bạn giúp em nhé. Trả lời giúp bạn được xác nhận hữu ích cũng sẽ cộng kinh nghiệm!</p>
        </div>
        {isAdmin && (
          <button className="chip-btn" onClick={() => setShowSettings(true)} style={{ flex: 'none' }}>⚙️ Cài đặt lưu trữ</button>
        )}
      </div>

      <div className="compose">
        <div className="compose-top">
          <Avatar name={profile.full_name} totalXp={stats.total_xp} photoUrl={profile.photo_url} size={38} />
          <textarea
            placeholder="Em đang vướng câu hỏi nào? Mô tả ngắn gọn để mọi người dễ giúp…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="compose-bottom">
          <div className="compose-left">
            <label className="chip-btn" style={{ margin: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
              Thêm ảnh
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickPhoto} />
            </label>
            <select className="chip-btn" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}
            </select>
            {photoPreview && (
              <span className="photo-preview"><img src={photoPreview} alt="" /> Đã chọn ảnh</span>
            )}
          </div>
          <button className="cta" onClick={handlePost} disabled={posting}>
            {posting ? 'Đang đăng…' : 'Đăng câu hỏi'}
          </button>
        </div>
      </div>

      {feed === null && <div className="center-loading">Đang tải câu hỏi…</div>}
      {feed && feed.length === 0 && <div className="empty-note">Chưa có câu hỏi nào — hãy là người đăng đầu tiên!</div>}

      {feed && feed.map((p) => {
        const liked = p.likerIds.includes(profile.id);
        return (
          <div className="post" key={p.id}>
            {p.is_pinned && <div className="pin-badge">📌 Đã ghim</div>}
            <div className="post-head">
              <Avatar name={p.author?.full_name} totalXp={p.authorXp} photoUrl={p.author?.photo_url} size={38} />
              <div>
                <div className="post-author">{p.author?.full_name || 'Học sinh'}</div>
                <div className="post-meta">{new Date(p.created_at).toLocaleString('vi-VN')}</div>
              </div>
              {p.subjectName && <span className="post-subject">{p.subjectName}</span>}
            </div>
            <div className="post-body">{p.content}</div>
            {p.photo_url && (
              <div className="post-photo">
                <img src={p.photo_url} alt="Ảnh bài tập" />
              </div>
            )}

            <div className="post-actions">
              <button className={`like-btn ${liked ? 'liked' : ''}`} onClick={() => handleToggleLike(p)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s-6.7-4.35-9.3-8.2C1.1 10.3 1.7 6.9 4.6 5.3c2.3-1.3 5-0.6 6.6 1.4l0.8 1 0.8-1c1.6-2 4.3-2.7 6.6-1.4 2.9 1.6 3.5 5 1.9 7.5C18.7 16.65 12 21 12 21z" />
                </svg>
                {p.likerIds.length > 0 ? p.likerIds.length : 'Thích'}
              </button>
              {isMod && (
                <div className="mod-actions">
                  <button className="mod-btn" onClick={() => handleTogglePin(p.id)}>{p.is_pinned ? 'Bỏ ghim' : 'Ghim'}</button>
                  <button className="mod-btn danger" onClick={() => setDeletePrompt({ type: 'post', id: p.id })}>Xoá bài</button>
                </div>
              )}
            </div>

            <div className="replies">
              {p.replies.map((r) => {
                const isTeacher = r.author?.role === 'teacher';
                return (
                  <div className={`reply ${isTeacher ? 'teacher' : ''}`} key={r.id}>
                    <Avatar name={r.author?.full_name} totalXp={r.authorXp} photoUrl={r.author?.photo_url} size={30} />
                    <div style={{ flex: 1 }}>
                      <div className="reply-bubble">
                        <div className="reply-author">
                          {r.author?.full_name || '—'} {isTeacher && <span className="teacher-tag">GIÁO VIÊN</span>}
                        </div>
                        <div className="reply-text">{r.content}</div>
                      </div>
                      <div className="reply-foot">
                        {r.marked_useful ? (
                          <span className="best-tag">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                            Câu trả lời hữu ích
                          </span>
                        ) : (p.student_id === profile.id && r.author_id !== profile.id) ? (
                          <button className="useful-btn" onClick={() => handleMarkUseful(r.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-1 6H4v9h13a2 2 0 0 0 2-1.7l1.3-8A2 2 0 0 0 18.3 5H14z" /></svg>
                            Đánh dấu hữu ích
                          </button>
                        ) : null}
                        {isMod && (
                          <button className="useful-btn" style={{ color: '#D6467A' }} onClick={() => setDeletePrompt({ type: 'reply', id: r.id })}>Xoá</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="reply-input">
                <input
                  type="text"
                  placeholder="Viết câu trả lời để giúp bạn…"
                  value={replyDrafts[p.id] || ''}
                  onChange={(e) => setReplyDrafts({ ...replyDrafts, [p.id]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleReply(p.id)}
                />
                <button onClick={() => handleReply(p.id)}>Gửi</button>
              </div>
            </div>
          </div>
        );
      })}

      {deletePrompt && (
        <ReasonPrompt onConfirm={confirmDelete} onCancel={() => setDeletePrompt(null)} />
      )}

      {showSettings && settings && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <button className="modal-close" onClick={() => setShowSettings(false)}>✕</button>
            <h3>Tự động lưu trữ bài cũ</h3>
            <p className="modal-sub">Khi bật, các bài chưa được thầy cô ghim sẽ tự chuyển vào lưu trữ sau số ngày bên dưới để đỡ tốn dung lượng. Bài đã lưu trữ được xoá vĩnh viễn sau 30 ngày.</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontWeight: 600, fontSize: 14 }}>
              <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
              Bật tự động lưu trữ
            </label>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Số ngày trước khi lưu trữ</label>
            <input
              type="number"
              min={1}
              value={settings.days}
              onChange={(e) => setSettings({ ...settings, days: Number(e.target.value) })}
              style={{ width: '100%', padding: 9, borderRadius: 10, border: '1.5px solid var(--line)', marginBottom: 16 }}
            />
            <button className="cta" style={{ width: '100%' }} onClick={() => saveSettings(settings.enabled, settings.days)}>Lưu cài đặt</button>
          </div>
        </div>
      )}

      <div className={`toast ${toast ? 'show' : ''}`}>
        <span>🎉 {toast}</span>
      </div>
    </>
  );
}
