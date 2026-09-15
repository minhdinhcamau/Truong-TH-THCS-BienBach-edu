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

export default function QaPostDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const [post, setPost] = useState(null)
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ text: '', isError: false })
  const [lightboxUrl, setLightboxUrl] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [postRes, repliesRes] = await Promise.all([
        supabase.rpc('get_qa_post_detail', { p_post_id: id }),
        supabase.rpc('get_qa_post_replies', { p_post_id: id }),
      ])
      if (postRes.error) throw postRes.error
      if (repliesRes.error) throw repliesRes.error

      const rows = postRes.data || []
      if (rows.length === 0) {
        setLoadError('Không tìm thấy bài này (có thể đã bị xoá vĩnh viễn trước đó).')
        setPost(null)
      } else {
        setPost(rows[0])
      }
      setReplies(repliesRes.data || [])
    } catch (err) {
      setLoadError(err.message || 'Không tải được bài viết')
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
      const { error } = await supabase.rpc('admin_restore_qa_post', { p_post_id: id })
      if (error) throw error
      setMsg({ text: 'Đã phục hồi bài về lại bình thường.', isError: false })
      load()
    } catch (err) {
      setMsg({ text: err.message || 'Phục hồi thất bại', isError: true })
    } finally {
      setBusy(false)
    }
  }

  async function archivePost() {
    setBusy(true)
    setMsg({ text: '', isError: false })
    try {
      const { error } = await supabase.rpc('admin_delete_single_qa_post', {
        p_post_id: id,
        p_mode: 'archive',
      })
      if (error) throw error
      setMsg({ text: 'Đã chuyển bài vào kho lưu trữ.', isError: false })
      load()
    } catch (err) {
      setMsg({ text: err.message || 'Thao tác thất bại', isError: true })
    } finally {
      setBusy(false)
    }
  }

  async function deletePermanently() {
    if (!window.confirm('Xoá vĩnh viễn bài này (kèm toàn bộ ảnh và bình luận), không thể hoàn tác?')) return
    setBusy(true)
    setMsg({ text: '', isError: false })
    try {
      const { error } = await supabase.rpc('admin_delete_single_qa_post', {
        p_post_id: id,
        p_mode: 'permanent',
      })
      if (error) throw error
      router.push('/admin')
    } catch (err) {
      setMsg({ text: err.message || 'Xoá thất bại', isError: true })
      setBusy(false)
    }
  }

  async function deleteReply(replyId) {
    if (!window.confirm('Xoá bình luận này?')) return
    setBusy(true)
    setMsg({ text: '', isError: false })
    try {
      const { error } = await supabase.rpc('admin_delete_qa_reply', { p_reply_id: replyId })
      if (error) throw error
      setReplies((prev) => prev.filter((r) => r.reply_id !== replyId))
    } catch (err) {
      setMsg({ text: err.message || 'Xoá bình luận thất bại', isError: true })
    } finally {
      setBusy(false)
    }
  }

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
                    {post.student_name || '—'} · Lớp {post.class_name || '—'}
                  </div>
                  <div className={styles.sub}>
                    {post.subject_name || 'Chưa chọn môn'} · Đăng lúc {formatDateTime(post.created_at)}
                  </div>
                  {post.deleted_by_student && (
                    <div className={styles.badge}>
                      Đã bị ẩn (học sinh tự xoá lúc {formatDateTime(post.deleted_at)})
                    </div>
                  )}
                </div>
              </div>

              <p className={styles.content}>{post.content}</p>

              {post.photo_urls && post.photo_urls.length > 0 && (
                <div className={styles.photoGrid}>
                  {post.photo_urls.map((url, i) => (
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

              <div className={styles.actions}>
                {post.deleted_by_student ? (
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
                <div key={r.reply_id} className={styles.replyCard}>
                  <div className={styles.replyHead}>
                    <span className={styles.replyAuthor}>
                      {r.author_name || '—'}
                      {r.marked_useful && <span className={styles.usefulTag}>Hữu ích</span>}
                    </span>
                    <span className={styles.replyTime}>{formatDateTime(r.created_at)}</span>
                  </div>
                  <p className={styles.replyContent}>{r.content}</p>
                  <button
                    onClick={() => deleteReply(r.reply_id)}
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
