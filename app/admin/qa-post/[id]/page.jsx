'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'
import styles from './qaPostDetail.module.css'

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN')
}

// Goi mot route API admin, tu dinh kem token dang nhap hien tai vao header
// Authorization — cung mau voi cach cac trang admin khac trong du an lay
// token (qua supabase.auth.getSession()), de requireAdmin() o server doc duoc.
async function callAdminApi(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
      ...options.headers,
    },
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || 'Có lỗi xảy ra')
  }
  return json
}

export default function QaPostDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const [post, setPost] = useState(null)
  const [photos, setPhotos] = useState([])
  const [replies, setReplies] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ text: '', isError: false })
  const [lightboxUrl, setLightboxUrl] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await callAdminApi(`/api/admin/qa/posts/${id}`)
      setPost(data.post)
      setPhotos(data.photos || [])
      setReplies(data.replies || [])
      setReports(data.reports || [])
    } catch (err) {
      setLoadError(err.message || 'Không tải được bài viết')
      setPost(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function restorePost() {
    setBusy(true)
    setMsg({ text: '', isError: false })
    try {
      await callAdminApi(`/api/admin/qa/posts/${id}`, { method: 'PATCH' })
      setMsg({ text: 'Đã phục hồi bài về lại bình thường.', isError: false })
      load()
    } catch (err) {
      setMsg({ text: err.message, isError: true })
    } finally {
      setBusy(false)
    }
  }

  async function archivePost() {
    setBusy(true)
    setMsg({ text: '', isError: false })
    try {
      await callAdminApi(`/api/admin/qa/posts/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ mode: 'archive' }),
      })
      setMsg({ text: 'Đã chuyển bài vào kho lưu trữ.', isError: false })
      load()
    } catch (err) {
      setMsg({ text: err.message, isError: true })
    } finally {
      setBusy(false)
    }
  }

  async function deletePermanently() {
    if (!window.confirm('Xoá vĩnh viễn bài này (kèm toàn bộ ảnh và bình luận), không thể hoàn tác?')) return
    setBusy(true)
    setMsg({ text: '', isError: false })
    try {
      await callAdminApi(`/api/admin/qa/posts/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ mode: 'purge' }),
      })
      router.push('/admin')
    } catch (err) {
      setMsg({ text: err.message, isError: true })
      setBusy(false)
    }
  }

  async function deleteReply(replyId) {
    if (!window.confirm('Xoá bình luận này?')) return
    setBusy(true)
    setMsg({ text: '', isError: false })
    try {
      await callAdminApi(`/api/admin/qa/replies/${replyId}`, { method: 'DELETE' })
      setReplies((prev) => prev.filter((r) => r.id !== replyId))
    } catch (err) {
      setMsg({ text: err.message, isError: true })
    } finally {
      setBusy(false)
    }
  }

  // Gom photo_url cu (bai 1 anh, kieu cu) + qa_post_photos (bai nhieu anh,
  // kieu moi) thanh 1 danh sach de hien thi chung, tranh bo sot bai cu.
  const allPhotoUrls = [
    ...(post?.photoUrl ? [post.photoUrl] : []),
    ...photos.map((p) => p.url),
  ].filter((url, idx, arr) => arr.indexOf(url) === idx)

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/admin" className={styles.backLink}>
          ← Quay lại trang quản trị
        </Link>

        {loading && <p className={styles.muted}>Đang tải…</p>}
        {loadError && <p className={styles.error}>{loadError}</p>}

        {!loading && post && (
          <>
            <div className={styles.card}>
              <div className={styles.headRow}>
                <div>
                  <div className={styles.title}>
                    {post.studentName || '—'} · Lớp {post.className || '—'}
                  </div>
                  <div className={styles.sub}>
                    {post.subjectName || 'Chưa chọn môn'} · Đăng lúc {formatDateTime(post.createdAt)}
                  </div>
                  {post.deletedByStudent && (
                    <div className={styles.badge}>
                      Đã bị ẩn (chuyển vào kho lưu trữ lúc {formatDateTime(post.deletedAt)})
                    </div>
                  )}
                </div>
              </div>

              <p className={styles.content}>{post.content}</p>

              {allPhotoUrls.length > 0 && (
                <div className={styles.photoGrid}>
                  {allPhotoUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className={styles.photo}
                      onClick={() => setLightboxUrl(url)}
                    />
                  ))}
                </div>
              )}

              {reports.length > 0 && (
                <div className={styles.reportsBox}>
                  <b>Báo cáo ({reports.length})</b>
                  {reports.map((r) => (
                    <div key={r.id} className={styles.reportRow}>
                      <span className={styles.reportReason}>{r.reason}</span>
                      {r.details && <span className={styles.reportDetails}> — {r.details}</span>}
                      <span className={styles.reportMeta}>
                        {' '}
                        · {r.reporterName} · {formatDateTime(r.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.actions}>
                {post.deletedByStudent ? (
                  <button onClick={restorePost} disabled={busy} className={styles.btnGhost}>
                    Phục hồi bài (hiện lại cho học sinh)
                  </button>
                ) : (
                  <button onClick={archivePost} disabled={busy} className={styles.btnGhost}>
                    Chuyển vào kho lưu trữ
                  </button>
                )}
                <button onClick={deletePermanently} disabled={busy} className={styles.btnDanger}>
                  Xoá vĩnh viễn
                </button>
              </div>

              {msg.text && (
                <p className={msg.isError ? styles.error : styles.ok}>{msg.text}</p>
              )}
            </div>

            <h3 className={styles.repliesTitle}>Bình luận ({replies.length})</h3>
            {replies.length === 0 && <p className={styles.muted}>Chưa có bình luận nào.</p>}
            <div className={styles.repliesList}>
              {replies.map((r) => (
                <div key={r.id} className={styles.replyCard}>
                  <div className={styles.replyHead}>
                    <span className={styles.replyAuthor}>
                      {r.authorName || '—'}
                      {r.markedUseful && <span className={styles.usefulTag}>Hữu ích</span>}
                    </span>
                    <span className={styles.replyTime}>{formatDateTime(r.createdAt)}</span>
                  </div>
                  <p className={styles.replyContent}>{r.content}</p>
                  <button
                    onClick={() => deleteReply(r.id)}
                    disabled={busy}
                    className={styles.btnDangerSmall}
                  >
                    Xoá bình luận
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {lightboxUrl && (
        <div className={styles.lightboxBg} onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className={styles.lightboxImg} />
          <a
            href={lightboxUrl}
            download
            onClick={(e) => e.stopPropagation()}
            className={styles.lightboxDownload}
          >
            Tải ảnh về
          </a>
        </div>
      )}
    </div>
  )
}
