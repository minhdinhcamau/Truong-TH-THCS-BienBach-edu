'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import adminStyles from './admin.module.css'
import styles from './qaArchivePanel.module.css'

const TABS = [
  { key: 'manage', label: 'Cài đặt & xoá nhanh' },
  { key: 'archive', label: 'Kho lưu trữ' },
]

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN')
}

export default function QaArchivePanel() {
  const [activeTab, setActiveTab] = useState('manage')

  // ---- Cai dat so ngay luu tru / xoa tu dong ----
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [archiveDaysInput, setArchiveDaysInput] = useState('')
  const [deleteDaysInput, setDeleteDaysInput] = useState('')
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState({ text: '', isError: false })

  // ---- Xoa nhanh hang loat theo so ngay ke tu luc dang (ap dung cho MOI
  // bai, ke ca bai chua vao kho luu tru) ----
  const [quickCustomDays, setQuickCustomDays] = useState('')
  const [pendingAction, setPendingAction] = useState(null) // { label, minAgeDays }
  const [busy, setBusy] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // ---- Kho luu tru ----
  const [archive, setArchive] = useState(null)
  const [loadingArchive, setLoadingArchive] = useState(true)
  const [archiveError, setArchiveError] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [archiveCustomDays, setArchiveCustomDays] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const authedFetch = useCallback(async (url, options = {}) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Có lỗi xảy ra')
    return body
  }, [])

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true)
    setSettingsMsg({ text: '', isError: false })
    try {
      const data = await authedFetch('/api/admin/qa-settings')
      setSettings(data.settings)
      setArchiveDaysInput(String(data.settings.archive_after_days))
      setDeleteDaysInput(String(data.settings.delete_after_days))
    } catch (err) {
      setSettingsMsg({ text: err.message, isError: true })
    } finally {
      setLoadingSettings(false)
    }
  }, [authedFetch])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  async function saveSettings() {
    setSettingsBusy(true)
    setSettingsMsg({ text: '', isError: false })
    try {
      const data = await authedFetch('/api/admin/qa-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          archiveAfterDays: archiveDaysInput,
          deleteAfterDays: deleteDaysInput,
        }),
      })
      setSettings(data.settings)
      setSettingsMsg({ text: 'Đã lưu cài đặt.', isError: false })
    } catch (err) {
      setSettingsMsg({ text: err.message, isError: true })
    } finally {
      setSettingsBusy(false)
    }
  }

  const loadArchive = useCallback(async () => {
    setLoadingArchive(true)
    setArchiveError('')
    try {
      const { data, error } = await supabase.rpc('get_qa_archive')
      if (error) throw error
      setArchive(data || [])
      setSelectedIds(new Set())
    } catch (err) {
      setArchiveError(err.message || 'Không tải được kho lưu trữ')
    } finally {
      setLoadingArchive(false)
    }
  }, [])

  useEffect(() => {
    loadArchive()
  }, [loadArchive])

  // ---- Xoa nhanh hang loat (khong can vao kho luu tru) ----
  // Van dung RPC admin_delete_qa_posts vi ham nay VAN CON TON TAI (khong bi
  // xoa trong migration don dep), khong can doi sang route API.
  function askQuickDelete(days) {
    setResultMsg('')
    setErrorMsg('')
    const label =
      days === null
        ? 'TẤT CẢ bài Hỏi bài trong hệ thống'
        : `mọi bài đã đăng từ ${days} ngày trước trở lên (kể cả chưa vào kho lưu trữ)`
    setPendingAction({ label, minAgeDays: days })
  }

  async function runQuickDelete() {
    if (!pendingAction) return
    setBusy(true)
    setErrorMsg('')
    setResultMsg('')
    try {
      const { data, error } = await supabase.rpc('admin_delete_qa_posts', {
        p_min_age_days: pendingAction.minAgeDays,
      })
      if (error) throw error
      setResultMsg(`Đã xoá vĩnh viễn ${data ?? 0} bài (kèm bình luận và ảnh).`)
      setPendingAction(null)
      loadArchive()
    } catch (err) {
      setErrorMsg(err.message || 'Xoá thất bại')
    } finally {
      setBusy(false)
    }
  }

  // ---- Cac thao tac tren 1 bai trong kho luu tru ----
  // Doi tu RPC admin_restore_qa_post (da bi xoa) sang goi route API moi.
  async function restorePost(postId) {
    setBusy(true)
    setErrorMsg('')
    setResultMsg('')
    try {
      await authedFetch(`/api/admin/qa/posts/${postId}`, { method: 'PATCH' })
      setResultMsg('Đã phục hồi bài về lại bình thường.')
      loadArchive()
    } catch (err) {
      setErrorMsg(err.message || 'Phục hồi thất bại')
    } finally {
      setBusy(false)
    }
  }

  // Doi tu RPC admin_delete_single_qa_post (da bi xoa) sang goi route API
  // moi. Luu y: route dung chu "purge" cho xoa vinh vien, khac voi "permanent"
  // ma RPC cu dung.
  async function deletePostPermanently(postId) {
    setBusy(true)
    setErrorMsg('')
    setResultMsg('')
    try {
      await authedFetch(`/api/admin/qa/posts/${postId}`, {
        method: 'DELETE',
        body: JSON.stringify({ mode: 'purge' }),
      })
      setResultMsg('Đã xoá vĩnh viễn bài này.')
      loadArchive()
    } catch (err) {
      setErrorMsg(err.message || 'Xoá thất bại')
    } finally {
      setBusy(false)
    }
  }

  // ---- Chon nhieu: xoa hoac phuc hoi hang loat ----
  function toggleSelect(postId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  function toggleSelectAll() {
    if (!archive) return
    setSelectedIds((prev) => (prev.size === archive.length ? new Set() : new Set(archive.map((p) => p.post_id))))
  }

  async function bulkAction(mode) {
    if (selectedIds.size === 0) return
    const confirmText =
      mode === 'permanent'
        ? `Xoá vĩnh viễn ${selectedIds.size} bài đã chọn (không thể hoàn tác)?`
        : `Phục hồi ${selectedIds.size} bài đã chọn?`
    if (!window.confirm(confirmText)) return

    setBusy(true)
    setErrorMsg('')
    setResultMsg('')
    let okCount = 0
    for (const postId of selectedIds) {
      try {
        if (mode === 'permanent') {
          await authedFetch(`/api/admin/qa/posts/${postId}`, {
            method: 'DELETE',
            body: JSON.stringify({ mode: 'purge' }),
          })
        } else {
          await authedFetch(`/api/admin/qa/posts/${postId}`, { method: 'PATCH' })
        }
        okCount += 1
      } catch (err) {
        setErrorMsg(err.message || 'Có mục xử lý thất bại')
      }
    }
    setResultMsg(mode === 'permanent' ? `Đã xoá vĩnh viễn ${okCount} bài.` : `Đã phục hồi ${okCount} bài.`)
    setBusy(false)
    loadArchive()
  }

  async function deleteWholeArchive() {
    if (!archive || archive.length === 0) return
    if (!window.confirm(`Xoá vĩnh viễn TOÀN BỘ ${archive.length} bài trong kho lưu trữ (không thể hoàn tác)?`)) return
    setBusy(true)
    setErrorMsg('')
    setResultMsg('')
    let okCount = 0
    for (const p of archive) {
      try {
        await authedFetch(`/api/admin/qa/posts/${p.post_id}`, {
          method: 'DELETE',
          body: JSON.stringify({ mode: 'purge' }),
        })
        okCount += 1
      } catch (err) {
        setErrorMsg(err.message || 'Có bài xoá thất bại')
      }
    }
    setResultMsg(`Đã xoá vĩnh viễn ${okCount} bài trong kho lưu trữ.`)
    setBusy(false)
    loadArchive()
  }

  async function deleteByCustomDays() {
    const days = Number(archiveCustomDays)
    if (!Number.isInteger(days) || days < 0) {
      setErrorMsg('Nhập số ngày hợp lệ (số nguyên, từ 0 trở lên).')
      return
    }
    if (!window.confirm(`Xoá vĩnh viễn mọi bài đã nằm trong kho lưu trữ từ ${days} ngày trở lên?`)) return
    setBusy(true)
    setErrorMsg('')
    setResultMsg('')
    try {
      const currentArchiveDays = settings?.archive_after_days ?? 5
      const { data, error } = await supabase.rpc('admin_delete_qa_posts', {
        p_min_age_days: currentArchiveDays + days,
      })
      if (error) throw error
      setResultMsg(`Đã xoá vĩnh viễn ${data ?? 0} bài.`)
      loadArchive()
    } catch (err) {
      setErrorMsg(err.message || 'Xoá thất bại')
    } finally {
      setBusy(false)
    }
  }

  const allSelected = archive && archive.length > 0 && selectedIds.size === archive.length

  return (
    <section className={adminStyles.listCard}>
      <div className={adminStyles.sectionHeader}>
        <h2>Quản lý Hỏi bài</h2>
      </div>

      <div className={styles.tabStrip}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={activeTab === t.key ? `${styles.tabBtn} ${styles.tabBtnActive}` : styles.tabBtn}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.key === 'archive' && archive && <span className={styles.tabCount}>({archive.length})</span>}
          </button>
        ))}
      </div>

      {activeTab === 'manage' && (
        <>
          {/* ---------------- CÀI ĐẶT SỐ NGÀY ---------------- */}
          <p style={{ fontSize: 13, color: '#5b6b66', margin: '0 0 10px' }}>
            Áp dụng cho toàn bộ bài Hỏi bài trong trường. Chỉ chỉnh được ở đây (trang quản trị).
          </p>
          {loadingSettings ? (
            <p className={adminStyles.muted}>Đang tải cài đặt…</p>
          ) : (
            <div className={adminStyles.form} style={{ marginBottom: 12 }}>
              <div className={adminStyles.passwordRow}>
                <label className={adminStyles.field} style={{ flex: '1 1 200px' }}>
                  <span>Bao nhiêu ngày sau khi đăng thì ẩn bài (chuyển vào kho lưu trữ)</span>
                  <input
                    type="number"
                    min={1}
                    value={archiveDaysInput}
                    onChange={(e) => setArchiveDaysInput(e.target.value)}
                  />
                </label>
                <label className={adminStyles.field} style={{ flex: '1 1 200px' }}>
                  <span>Bao nhiêu ngày sau khi đăng thì xoá vĩnh viễn</span>
                  <input
                    type="number"
                    min={1}
                    value={deleteDaysInput}
                    onChange={(e) => setDeleteDaysInput(e.target.value)}
                  />
                </label>
              </div>
              <p style={{ fontSize: 12, color: '#8aa39c', margin: 0 }}>
                Số ngày xoá vĩnh viễn phải lớn hơn số ngày ẩn bài.
              </p>
              <button
                type="button"
                className={adminStyles.genButton}
                style={{ alignSelf: 'flex-start' }}
                onClick={saveSettings}
                disabled={settingsBusy}
              >
                {settingsBusy ? 'Đang lưu…' : 'Lưu cài đặt'}
              </button>
              {settingsMsg.text && (
                <p className={settingsMsg.isError ? adminStyles.error : adminStyles.rowOk}>{settingsMsg.text}</p>
              )}
              {settings?.updated_at && (
                <p style={{ fontSize: 12, color: '#8aa39c', margin: 0 }}>
                  Cập nhật lần cuối: {formatDateTime(settings.updated_at)}
                </p>
              )}
            </div>
          )}

          <hr className={adminStyles.sectionDivider} />

          {/* ---------------- XOÁ NHANH HÀNG LOẠT ---------------- */}
          <p style={{ fontSize: 13, color: '#5b6b66', margin: '0 0 10px' }}>
            Xoá vĩnh viễn ngay lập tức những bài <strong>đã đăng từ số ngày dưới đây trở lên</strong> —
            áp dụng cho MỌI bài, kể cả bài chưa bị ẩn/chưa vào kho lưu trữ. Dùng khi cần dọn dẹp gấp,
            không cần đợi tự động.
          </p>
          <div className={styles.toolbar}>
            <span className={styles.toolbarLabel}>Xoá bài đã đăng từ:</span>
            {[1, 2, 3, 4, 5].map((d) => (
              <button key={d} className={styles.dayBtn} onClick={() => askQuickDelete(d)} disabled={busy}>
                {d} ngày trước
              </button>
            ))}
          </div>
          <div className={styles.toolbar}>
            <input
              type="number"
              min={0}
              placeholder="Số ngày khác…"
              className={adminStyles.inlineInput}
              value={quickCustomDays}
              onChange={(e) => setQuickCustomDays(e.target.value)}
            />
            <button
              className={styles.dayBtn}
              disabled={busy || quickCustomDays === ''}
              onClick={() => {
                const d = Number(quickCustomDays)
                if (!Number.isInteger(d) || d < 0) {
                  setErrorMsg('Nhập số ngày hợp lệ.')
                  return
                }
                askQuickDelete(d)
              }}
            >
              Xoá theo số ngày này
            </button>
            <button className={styles.allBtn} onClick={() => askQuickDelete(null)} disabled={busy}>
              Xoá tất cả mọi bài
            </button>
          </div>

          {pendingAction && (
            <div className={styles.confirmBox}>
              <span>Xác nhận xoá vĩnh viễn {pendingAction.label} (không thể hoàn tác)?</span>
              <button onClick={runQuickDelete} disabled={busy} className={styles.confirmYes}>
                {busy ? 'Đang xoá…' : 'Xác nhận xoá'}
              </button>
              <button onClick={() => setPendingAction(null)} disabled={busy}>
                Huỷ
              </button>
            </div>
          )}

          {resultMsg && <p className={adminStyles.rowOk}>{resultMsg}</p>}
          {errorMsg && <p className={adminStyles.error}>{errorMsg}</p>}
        </>
      )}

      {activeTab === 'archive' && (
        <>
          <p style={{ fontSize: 13, color: '#5b6b66', margin: '0 0 10px' }}>
            Đây là các bài đã bị <strong>ẩn khỏi học sinh</strong> — hoặc do đăng quá lâu, hoặc do
            chính học sinh tự xoá. Bấm "Xem đầy đủ" để xem trọn nội dung + ảnh, hoặc chọn nhiều bài
            để xử lý hàng loạt.
          </p>

          <div className={styles.toolbar}>
            <input
              type="number"
              min={0}
              placeholder="Số ngày…"
              className={adminStyles.inlineInput}
              value={archiveCustomDays}
              onChange={(e) => setArchiveCustomDays(e.target.value)}
            />
            <button className={styles.dayBtn} onClick={deleteByCustomDays} disabled={busy}>
              Xoá bài đã lưu trữ từ số ngày này trở lên
            </button>
            <button className={styles.allBtn} onClick={deleteWholeArchive} disabled={busy || !archive?.length}>
              Xoá toàn bộ kho lưu trữ
            </button>
            <button className={adminStyles.linkBtn} onClick={loadArchive} disabled={loadingArchive}>
              Làm mới
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className={styles.confirmBox} style={{ background: '#eef5f2', border: '1px solid #bcdbd0' }}>
              <span>Đã chọn {selectedIds.size} bài</span>
              <button onClick={() => bulkAction('restore')} disabled={busy}>
                Phục hồi mục đã chọn
              </button>
              <button onClick={() => bulkAction('permanent')} disabled={busy} className={styles.confirmYes}>
                Xoá vĩnh viễn mục đã chọn
              </button>
              <button onClick={() => setSelectedIds(new Set())} disabled={busy}>
                Bỏ chọn
              </button>
            </div>
          )}

          {resultMsg && <p className={adminStyles.rowOk}>{resultMsg}</p>}
          {errorMsg && <p className={adminStyles.error}>{errorMsg}</p>}
          {archiveError && <p className={adminStyles.error}>{archiveError}</p>}

          {loadingArchive ? (
            <p className={adminStyles.muted}>Đang tải kho lưu trữ…</p>
          ) : !archive || archive.length === 0 ? (
            <p className={adminStyles.muted}>Kho lưu trữ hiện đang trống.</p>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, margin: '10px 0' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                Chọn tất cả ({archive.length})
              </label>

              <div className={styles.archiveList}>
                {archive.map((p) => {
                  const isExpanded = expandedId === p.post_id
                  return (
                    <div key={p.post_id} className={styles.archiveCard}>
                      <div className={styles.archiveCardHead}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.post_id)}
                          onChange={() => toggleSelect(p.post_id)}
                        />
                        {p.photo_url ? (
                          <img src={p.photo_url} alt="" className={styles.photoThumb} />
                        ) : (
                          <div className={styles.photoThumb} style={{ background: '#f5f7f6' }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                            {p.student_name || '—'} · Lớp {p.class_name || '—'}
                          </div>
                          <div style={{ fontSize: 12, color: '#5b6b66' }}>
                            {p.subject_name || 'Chưa chọn môn'} · Đăng lúc {formatDateTime(p.created_at)}
                          </div>
                          <div style={{ fontSize: 12, color: '#5b6b66', marginTop: 2 }}>
                            {p.deleted_by_student ? 'Học sinh tự xoá' : 'Tự động ẩn do đăng quá lâu'} ·{' '}
                            {p.reply_count} bình luận
                          </div>
                        </div>
                        <button
                          className={adminStyles.linkBtn}
                          onClick={() => setExpandedId(isExpanded ? null : p.post_id)}
                        >
                          {isExpanded ? 'Thu gọn' : 'Xem đầy đủ'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className={styles.archiveCardBody}>
                          <p style={{ whiteSpace: 'pre-wrap', margin: '10px 0' }}>{p.content}</p>
                          {p.photo_url && <img src={p.photo_url} alt="" className={styles.photoFull} />}
                        </div>
                      )}

                      <div className={styles.archiveCardActions}>
                        <Link href={`/admin/qa-post/${p.post_id}`} className={adminStyles.linkBtn}>
                          Mở trang chi tiết (kèm bình luận)
                        </Link>
                        <button onClick={() => restorePost(p.post_id)} disabled={busy} className={adminStyles.linkBtn}>
                          Phục hồi
                        </button>
                        <button
                          onClick={() => deletePostPermanently(p.post_id)}
                          disabled={busy}
                          className={adminStyles.dangerBtn}
                        >
                          Xoá vĩnh viễn
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
