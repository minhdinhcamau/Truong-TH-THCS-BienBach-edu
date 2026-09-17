'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { compressImage } from '../../../lib/compressImage';
import { getRankTier, getInitials } from '../../../lib/rankTiers';
import { useStudent } from '../layout';

const DELETE_REASONS = ['Nội dung không phù hợp', 'Spam', 'Sai môn học', 'Khác'];
const REPORT_REASONS = [
  'Nội dung không phù hợp',
  'Bắt nạt hoặc xúc phạm người khác',
  'Ảnh/nội dung nhạy cảm',
  'Khác',
];
const MAX_PHOTOS = 8;

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

// ---------------------------------------------------------------------------
// LUOI ANH KIEU FACEBOOK - toi da 4 o, o thu 4 phu "+N" neu con nhieu hon.
//   1 anh : 1 khung full chieu rong
//   2 anh : 2 o BANG NHAU canh nhau
//   3 anh : 1 o LON ben trai (cao het khung) + 2 o nho xep chong ben phai
//   4 anh : luoi 2x2 BANG NHAU, o cuoi phu "+N" khi con anh chua hien
// Anh dung objectFit "cover" => anh duoc thu nho + cat vua khit o, KHONG BAO
// GIO con khoang trong xam. Muon xem nguyen anh thi bam vao de mo lightbox.
// objectPosition "50% 30%" uu tien phan tren khung hinh nen mat nguoi it bi
// cat hon khi anh dung (chan dung).
// Dung INLINE STYLE de khong bi CSS ben ngoai ghi de kich thuoc.
// ---------------------------------------------------------------------------
const GAP = 3;              // khe giua cac o, nho thoi cho lien mach
const RADIUS = 14;          // bo goc khung ngoai
const FRAME_BG = '#e7ebea'; // nen khung (chi thoang thay luc anh dang tai)

function PhotoGrid({ photos, onOpen }) {
  if (!photos || photos.length === 0) return null;

  const shown = photos.slice(0, 4);
  const extra = photos.length - shown.length;
  const count = shown.length;

  // Ti le CA KHUNG cho tung bo cuc -> moi o ben trong deu ra gan vuong,
  // nhin can doi ca tren may tinh lan dien thoai.
  const ratio = count === 1 ? '4 / 3' : count === 2 ? '2 / 1' : count === 3 ? '3 / 2' : '1 / 1';
  const maxH = count === 1 ? 300 : count === 2 ? 340 : count === 3 ? 400 : 460;
  // 1 anh: gioi han them CHIEU RONG (khong tran het the bai viet) de anh don
  // le khong chiem ca man hinh. Nhieu anh thi van full chieu rong cho dep luoi.
  const maxW = count === 1 ? 400 : '100%';

  const frameStyle = {
    marginTop: 10,
    width: '100%',
    maxWidth: maxW,
    aspectRatio: ratio,
    maxHeight: maxH,
    borderRadius: RADIUS,
    overflow: 'hidden',
    background: FRAME_BG,
    display: 'grid',
    gap: GAP,
  };

  const imgStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: '50% 30%',
    display: 'block',
    background: FRAME_BG,
  };

  // Mot o anh: boc trong div de dat duoc lop phu "+N" va hieu ung hover.
  const Cell = ({ url, index, overlay, style }) => (
    <div
      onClick={() => onOpen(index)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'zoom-in',
        background: FRAME_BG,
        minWidth: 0,
        minHeight: 0,
        ...style,
      }}
    >
      <img src={url} alt="" style={imgStyle} />
      {overlay > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(12, 24, 22, 0.52)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 0.5,
            backdropFilter: 'blur(1px)',
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );

  // ---------- 1 anh: CAN GIUA, hien DU CA ANH (khong cat) ----------
  // Khong dat khung ti le cung: cho chinh tam anh quyet dinh kich thuoc, chi
  // chan chieu cao toi da 320px => anh dung/ngang deu vua man, khong bao gio
  // co vien xam vi khung om sat anh.
  if (count === 1) {
    return (
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', width: '100%' }}>
        <img
          src={shown[0]}
          alt=""
          onClick={() => onOpen(0)}
          style={{
            maxHeight: 320,
            maxWidth: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: RADIUS,
            cursor: 'zoom-in',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // ---------- 3 anh: cot trai 1 o lon, cot phai 2 o nho ----------
  if (count === 3) {
    return (
      <div style={{ ...frameStyle, gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr' }}>
        <Cell url={shown[0]} index={0} style={{ gridRow: '1 / 3' }} />
        <Cell url={shown[1]} index={1} />
        <Cell url={shown[2]} index={2} />
      </div>
    );
  }

  // ---------- 1 / 2 / 4 anh: cac o deu bang nhau ----------
  const cols = count === 1 ? '1fr' : count === 2 ? '1fr 1fr' : '1fr 1fr';
  const rows = count === 4 ? '1fr 1fr' : '1fr';

  return (
    <div style={{ ...frameStyle, gridTemplateColumns: cols, gridTemplateRows: rows }}>
      {shown.map((url, i) => (
        <Cell key={i} url={url} index={i} overlay={i === count - 1 ? extra : 0} />
      ))}
    </div>
  );
}

// Phong to anh toan man hinh, chuyen qua lai giua cac anh cung bai, tai ve may.
function Lightbox({ photos, index, onClose, onNav }) {
  if (index == null) return null;
  const url = photos[index];
  return (
    <div className="lb-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="lb-close" onClick={onClose}>✕</button>
      {photos.length > 1 && index > 0 && (
        <button type="button" className="lb-nav lb-prev" onClick={() => onNav(index - 1)}>‹</button>
      )}
      <img src={url} alt="" className="lb-img" />
      {photos.length > 1 && index < photos.length - 1 && (
        <button type="button" className="lb-nav lb-next" onClick={() => onNav(index + 1)}>›</button>
      )}
      <a href={url} download onClick={(e) => e.stopPropagation()} className="lb-download">Tải ảnh về</a>
      {photos.length > 1 && <div className="lb-counter">{index + 1}/{photos.length}</div>}
      <style jsx>{`
        .lb-bg {
          position: fixed;
          inset: 0;
          background: rgba(10, 20, 18, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 24px;
        }
        .lb-img {
          max-width: 100%;
          max-height: 78vh;
          object-fit: contain;
          border-radius: 8px;
        }
        .lb-close {
          position: absolute;
          top: 16px;
          right: 20px;
          background: none;
          border: none;
          color: #fff;
          font-size: 22px;
          cursor: pointer;
        }
        .lb-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: #fff;
          font-size: 28px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          cursor: pointer;
        }
        .lb-prev {
          left: 16px;
        }
        .lb-next {
          right: 16px;
        }
        .lb-download {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          color: #17302d;
          padding: 10px 20px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
        }
        .lb-counter {
          position: absolute;
          top: 18px;
          left: 20px;
          color: #fff;
          font-size: 13px;
          background: rgba(255, 255, 255, 0.15);
          padding: 4px 10px;
          border-radius: 999px;
        }
      `}</style>
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

// Bao cao bai viet: 4 ly do goi y + ly do khac bat buoc nhap ro, kem huong
// dan ngan cho hoc sinh biet khi nao nen bao cao.
function ReportPrompt({ onSubmit, onCancel }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const isOther = reason === 'Khác';

  function submit() {
    if (isOther && !details.trim()) return;
    onSubmit(reason, details.trim());
  }

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <h3 style={{ marginTop: 0 }}>Báo cáo bài viết</h3>
        <p className="section-sub" style={{ marginTop: -4 }}>
          Em hãy báo cáo khi bài viết có nội dung không phù hợp, xúc phạm bạn khác, spam hoặc chứa
          ảnh nhạy cảm. Thầy cô sẽ xem lại và xử lý sớm nhất.
        </p>
        {REPORT_REASONS.map((r) => (
          <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, margin: '8px 0' }}>
            <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
        {isOther && (
          <textarea
            placeholder="Mô tả lý do của em…"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            style={{ width: '100%', minHeight: 70, marginTop: 6, padding: 9, borderRadius: 10, border: '1.5px solid var(--line)', boxSizing: 'border-box' }}
          />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="chip-btn" onClick={onCancel}>Huỷ</button>
          <button className="cta" style={{ background: '#D6467A' }} onClick={submit} disabled={isOther && !details.trim()}>
            Gửi báo cáo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AskPage() {
  const { profile, stats } = useStudent();
  const isMod = profile.role === 'teacher' || profile.role === 'admin';

  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [classes, setClasses] = useState([]);
  const [text, setText] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [posting, setPosting] = useState(false);
  const [feed, setFeed] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [toast, setToast] = useState('');
  const [deletePrompt, setDeletePrompt] = useState(null); // { type: 'post'|'reply', id }
  const [reportPrompt, setReportPrompt] = useState(null); // postId
  const [lightbox, setLightbox] = useState(null); // { photos, index }
  const [classFilterId, setClassFilterId] = useState('');
  const [sortMode, setSortMode] = useState('newest'); // 'newest' | 'liked'

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  const classNameById = useMemo(() => {
    const map = {};
    classes.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [classes]);

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

    // Anh cua bai (nhieu anh/bai) - create_qa_post da ghi toan bo vao day,
    // sap theo sort_order. Bai cu chi co 1 anh (chua tung dung mang) se
    // khong co dong nao o day, fallback ve qa_posts.photo_url ben duoi.
    const { data: photoRows } = postIds.length
      ? await supabase
          .from('qa_post_photos')
          .select('post_id, photo_url, sort_order')
          .in('post_id', postIds)
          .order('sort_order', { ascending: true })
      : { data: [] };

    const peopleIds = new Set();
    (posts || []).forEach((p) => peopleIds.add(p.student_id));
    (replies || []).forEach((r) => peopleIds.add(r.author_id));

    const { data: people } = peopleIds.size
      ? await supabase.from('public_profiles').select('id, full_name, role, photo_url, class_id').in('id', Array.from(peopleIds))
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

    const photosByPost = {};
    (photoRows || []).forEach((r) => {
      if (!photosByPost[r.post_id]) photosByPost[r.post_id] = [];
      photosByPost[r.post_id].push(r.photo_url);
    });

    const assembled = (posts || []).map((p) => ({
      ...p,
      author: peopleMap[p.student_id],
      authorXp: xpMap[p.student_id] || 0,
      subjectName: subjects.find((s) => s.id === p.subject_id)?.name || '',
      replies: repliesByPost[p.id] || [],
      likerIds: likesByPost[p.id] || [],
      photos: photosByPost[p.id]?.length ? photosByPost[p.id] : (p.photo_url ? [p.photo_url] : []),
    }));

    setFeed(assembled);
  }

  useEffect(() => {
    async function init() {
      const { data: subjectsData } = await supabase.from('subjects').select('id, name').order('name');
      setSubjects(subjectsData || []);
      if (subjectsData?.length) setSubjectId(subjectsData[0].id);

      const { data: classesData } = await supabase.from('classes').select('id, name').order('name');
      setClasses(classesData || []);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (subjects.length >= 0) loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects]);

  function onPickPhotos(e) {
    let files = Array.from(e.target.files || []);
    if (files.length > MAX_PHOTOS) {
      alert(`Chỉ được đăng tối đa ${MAX_PHOTOS} ảnh cho mỗi bài.`);
      files = files.slice(0, MAX_PHOTOS);
    }
    setPhotoFiles(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  function removePickedPhoto(idx) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const photoUrls = [];
      for (const file of photoFiles) {
        const compressed = await compressImage(file);
        const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${compressed.name}`;
        const { error: uploadError } = await supabase.storage.from('qa-photos').upload(path, compressed);
        if (uploadError) throw uploadError;
        const url = supabase.storage.from('qa-photos').getPublicUrl(path).data.publicUrl;
        photoUrls.push(url);
      }

      const { error } = await supabase.rpc('create_qa_post', {
        p_subject_id: subjectId || null,
        p_content: text.trim(),
        p_photo_urls: photoUrls,
      });
      if (error) throw error;

      setText('');
      setPhotoFiles([]);
      setPhotoPreviews([]);
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

  // Hoc sinh tu xoa bai cua chinh minh - dung RPC student_delete_qa_post
  // (danh dau deleted_by_student = true), bai se bien mat khoi feed cong
  // khai va xuat hien trong "Kho luu tru" ben trang admin, KHONG mat han.
  async function handleDeleteOwnPost(postId) {
    if (
      !window.confirm(
        'Xoá bài này? Bài sẽ được ẩn khỏi mọi người, không mất hẳn ngay (nhà trường vẫn lưu trong kho lưu trữ một thời gian).'
      )
    ) {
      return;
    }
    const { error } = await supabase.rpc('student_delete_qa_post', { p_post_id: postId });
    if (error) { alert(error.message); return; }
    showToast('Đã xoá bài của em.');
    loadFeed();
  }

  async function submitReport(postId, reason, details) {
    const { error } = await supabase.rpc('report_qa_post', {
      p_post_id: postId,
      p_reason: reason,
      p_details: details || null,
    });
    setReportPrompt(null);
    if (error) { alert(error.message); return; }
    showToast('Đã gửi báo cáo, cảm ơn em!');
  }

  const displayedFeed = useMemo(() => {
    if (!feed) return feed;
    let list = feed;
    if (classFilterId) {
      list = list.filter((p) => p.author?.class_id === classFilterId);
    }
    const pinned = list.filter((p) => p.is_pinned);
    const rest = [...list.filter((p) => !p.is_pinned)];
    if (sortMode === 'liked') {
      rest.sort((a, b) => b.likerIds.length - a.likerIds.length || new Date(b.created_at) - new Date(a.created_at));
    } else {
      rest.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return [...pinned, ...rest];
  }, [feed, classFilterId, sortMode]);

  return (
    <div className="ask-page">
      <div>
        <h2 className="section-title">Hỏi bài</h2>
        <p className="section-sub">Chụp ảnh bài khó, đăng lên để thầy cô hoặc các bạn giúp em nhé. Trả lời giúp bạn được xác nhận hữu ích cũng sẽ cộng kinh nghiệm!</p>
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
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onPickPhotos} />
            </label>
            <select className="chip-btn" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}
            </select>
            {photoPreviews.length > 0 && (
              <span className="photo-preview">Đã chọn {photoPreviews.length} ảnh</span>
            )}
          </div>
          <button className="cta" onClick={handlePost} disabled={posting}>
            {posting ? 'Đang đăng…' : 'Đăng câu hỏi'}
          </button>
        </div>
        {photoPreviews.length > 0 && (
          <div className="compose-photo-row">
            {photoPreviews.map((url, i) => (
              <div key={i} className="compose-photo-thumb">
                <img src={url} alt="" />
                <button type="button" onClick={() => removePickedPhoto(i)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="qa-filters">
        <select value={classFilterId} onChange={(e) => setClassFilterId(e.target.value)}>
          <option value="">Tất cả lớp</option>
          {classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
        </select>
        <div className="qa-sort-tabs">
          <button
            type="button"
            className={sortMode === 'newest' ? 'active' : ''}
            onClick={() => setSortMode('newest')}
          >
            Mới nhất
          </button>
          <button
            type="button"
            className={sortMode === 'liked' ? 'active' : ''}
            onClick={() => setSortMode('liked')}
          >
            Nhiều like nhất
          </button>
        </div>
      </div>

      {displayedFeed === null && <div className="center-loading">Đang tải câu hỏi…</div>}
      {displayedFeed && displayedFeed.length === 0 && <div className="empty-note">Chưa có câu hỏi nào — hãy là người đăng đầu tiên!</div>}

      {displayedFeed && displayedFeed.map((p) => {
        const liked = p.likerIds.includes(profile.id);
        const authorClassName = classNameById[p.author?.class_id];
        const isOwnPost = p.student_id === profile.id;
        return (
          <div className="post" key={p.id}>
            {p.is_pinned && <div className="pin-badge">📌 Đã ghim</div>}
            <div className="post-head">
              <Avatar name={p.author?.full_name} totalXp={p.authorXp} photoUrl={p.author?.photo_url} size={38} />
              <div>
                <div className="post-author">{p.author?.full_name || 'Học sinh'}</div>
                <div className="post-meta">{new Date(p.created_at).toLocaleString('vi-VN')}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {authorClassName && <span className="post-subject" style={{ marginLeft: 0 }}>Lớp {authorClassName}</span>}
                {p.subjectName && <span className="post-subject" style={{ marginLeft: 0 }}>{p.subjectName}</span>}
                <button
                  type="button"
                  className="corner-report-btn"
                  onClick={() => setReportPrompt(p.id)}
                  title="Báo cáo bài viết"
                >
                  🚩
                </button>
              </div>
            </div>
            <div className="post-body">{p.content}</div>

            <PhotoGrid photos={p.photos} onOpen={(i) => setLightbox({ photos: p.photos, index: i })} />

            <div className="post-actions">
              <button className={`like-btn ${liked ? 'liked' : ''}`} onClick={() => handleToggleLike(p)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s-6.7-4.35-9.3-8.2C1.1 10.3 1.7 6.9 4.6 5.3c2.3-1.3 5-0.6 6.6 1.4l0.8 1 0.8-1c1.6-2 4.3-2.7 6.6-1.4 2.9 1.6 3.5 5 1.9 7.5C18.7 16.65 12 21 12 21z" />
                </svg>
                {p.likerIds.length > 0 ? p.likerIds.length : 'Thích'}
              </button>
              {isOwnPost && (
                <button className="useful-btn" style={{ color: '#D6467A' }} onClick={() => handleDeleteOwnPost(p.id)}>
                  Xoá bài của em
                </button>
              )}
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

      {reportPrompt && (
        <ReportPrompt
          onSubmit={(reason, details) => submitReport(reportPrompt, reason, details)}
          onCancel={() => setReportPrompt(null)}
        />
      )}

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNav={(i) => setLightbox((prev) => ({ ...prev, index: i }))}
        />
      )}

      <div className={`toast ${toast ? 'show' : ''}`}>
        <span>🎉 {toast}</span>
      </div>

      <style jsx>{`
        .compose-photo-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .compose-photo-thumb {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 10px;
          overflow: hidden;
        }
        .compose-photo-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .compose-photo-thumb button {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: none;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          font-size: 11px;
          cursor: pointer;
          line-height: 1;
        }
        .qa-filters {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          margin: 14px 0;
        }
        .qa-filters select {
          padding: 8px 12px;
          border-radius: 999px;
          border: 1.5px solid var(--line);
          font-size: 13px;
          background: #fff;
        }
        .qa-sort-tabs {
          display: flex;
          gap: 6px;
        }
        .qa-sort-tabs button {
          padding: 8px 14px;
          border-radius: 999px;
          border: 1.5px solid var(--line);
          background: #fff;
          font-size: 13px;
          font-weight: 600;
          color: #527169;
          cursor: pointer;
        }
        .qa-sort-tabs button.active {
          background: #225da3;
          border-color: #225da3;
          color: #fff;
        }
        .corner-report-btn {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: rgba(0, 0, 0, 0.05);
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0.7;
        }
        .corner-report-btn:hover {
          background: rgba(214, 70, 122, 0.12);
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
