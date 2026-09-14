'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import adminStyles from './admin.module.css'
import styles from './qaArchivePanel.module.css'

// Cac muc "tuoi bai" dung chung cho ca 2 khu vuc (xoa nhanh + kho luu tru).
const QUICK_DELETE_DAYS = [1, 2, 3, 4, 5]

const TABS = [
  { key: 'manage', label: 'Quản lý Hỏi bài' },
  { key: 'archive', label: 'Kho lưu trữ' },
]

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN')
}

// pendingAction: { label, minAgeDays } | null
// minAgeDays: null nghia la xoa TAT CA
function confirmLabel(pendingAction) {
  if (!pendingAction) return ''
  if (pendingAction.minAgeDays === null) {
    return 'Xác nhận xoá TẤT CẢ bài Hỏi bài (không thể hoàn tác)?'
  }
  return `Xác nhận xoá vĩnh viễn các bài cũ hơn ${pendingAction.minAgeDays} ngày (không thể hoàn tác)?`
}

export default function QaArchivePanel() {
  // Tab dang mo: "manage" (xoa nhanh theo tuoi bai, ap dung cho MOI bai kể
  // cả bài chưa vào lưu trữ) hoac "archive" (bang kho luu tru, chi bai da
  // qua 5 ngay - chi admin/giao vien xem duoc).
  const [activeTab, setActiveTab] = useState('manage')

  const [archive, setArchive] = useState(null)
  const [loadingArchive, setLoadingArchive] = useState(true)
  const [archiveError, setArchiveError] = useState('')

  const [pendingAction, setPendingAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const loadArchive = useCallback(async () => {
    setLoadingArchive(true)
    setArchiveError('')
    try {
      const { data, error } = await supabase.rpc('get_qa_archive')
      if (error) throw error
      setArchive(data || [])
    } catch (err) {
      setArchiveError(err.message || 'Không tải được kho lưu trữ')
    } finally {
      setLoadingArchive(false)
    }
  }, [])

  useEffect(() => {
    loadArchive()
  }, [loadArchive])

  // Buoc 1: bam nut -> chi hien hop xac nhan, CHUA xoa ngay.
  function askConfirm(label, minAgeDays) {
    setResultMsg('')
    setErrorMsg('')
    setPendingAction({ label, minAgeDays })
  }

  // Buoc 2: bam "Xác nhận xoá" trong hop xac nhan -> goi RPC that su.
  async function runPendingAction() {
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

  return (
    <section className={adminStyles.listCard}>
      <div className={adminStyles.sectionHeader}>
        <h2>Quản lý Hỏi bài</h2>
      </div>

      {/* ---------------- THANH TRƯỢT NGANG CHỌN TAB ---------------- */}
      <div className={styles.tabStrip}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={activeTab === t.key ? `${styles.tabBtn} ${styles.tabBtnActive}` : styles.tabBtn}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.key === 'archive' && archive && (
              <span className={styles.tabCount}>({archive.length})</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'manage' && (
        <>
          {/* ---------------- XOÁ NHANH THEO TUỔI BÀI (KHÔNG CẦN VÀO LƯU TRỮ) ---------------- */}
          <p style={{ fontSize: 13, color: '#5b6b66', margin: '0 0 10px' }}>
            Xoá vĩnh viễn ngay lập tức, áp dụng cho MỌI bài (kể cả bài chưa vào kho lưu trữ) —
            không cần mở tab "Kho lưu trữ".
          </p>
          <div className={styles.toolbar}>
            <span className={styles.toolbarLabel}>Xoá bài cũ hơn:</span>
            {QUICK_DELETE_DAYS.map((d) => (
              <button
                key={d}
                className={styles.dayBtn}
                onClick={() => askConfirm(`cũ hơn ${d} ngày`, d)}
                disabled={busy}
              >
                {d} ngày
              </button>
            ))}
            <button
              className={styles.allBtn}
              onClick={() => askConfirm('tất cả', null)}
              disabled={busy}
            >
              Xoá tất cả
            </button>
          </div>

          {pendingAction && (
            <div className={styles.confirmBox}>
              <span>{confirmLabel(pendingAction)}</span>
              <button onClick={runPendingAction} disabled={busy} className={styles.confirmYes}>
                {busy ? 'Đang xoá…' : 'Xác nhận xoá'}
              </button>
              <button onClick={() => setPendingAction(null)} disabled={busy}>
                Huỷ
              </button>
            </div>
          )}

          {resultMsg && <p className={adminStyles.rowOk}>{resultMsg}</p>}
          {errorMsg && <p className={adminStyles.error}>{errorMsg}</p>}

          <hr className={adminStyles.sectionDivider} />

          {/* ---------------- LUU Y VE CAC BAI DANG HOAT DONG ---------------- */}
          <p style={{ fontSize: 13, color: '#5b6b66', margin: 0 }}>
            Danh sách chi tiết từng bài đang hoạt động (để xoá riêng lẻ từng bài hoặc từng bình
            luận) cần một hàm dữ liệu riêng chưa có trong hệ thống hiện tại — phần này sẽ được bổ
            sung sau. Hiện tại có thể xoá hàng loạt theo tuổi bài ở trên, hoặc xem/xoá các bài đã
            vào kho lưu trữ ở tab bên cạnh.
          </p>
        </>
      )}

      {activeTab === 'archive' && (
        <>
          {/* ---------------- KHO LƯU TRỮ (5-7 NGÀY, CHỈ ADMIN XEM) ---------------- */}
          <p style={{ fontSize: 13, color: '#5b6b66', margin: '0 0 10px' }}>
            Các bài này đã ẩn khỏi học sinh và giáo viên. Sau 7 ngày (2 ngày trong kho) hệ thống sẽ
            tự động xoá — bạn cũng có thể xoá sớm bằng các nút bên dưới.
          </p>
          <div className={styles.toolbar}>
            <button
              className={styles.dayBtn}
              onClick={() => askConfirm('đã lưu trữ từ 1 ngày trở lên', 6)}
              disabled={busy}
            >
              Xoá đã lưu trữ ≥ 1 ngày
            </button>
            <button
              className={styles.dayBtn}
              onClick={() => askConfirm('đã lưu trữ từ 2 ngày trở lên', 7)}
              disabled={busy}
            >
              Xoá đã lưu trữ ≥ 2 ngày
            </button>
            <button
              className={styles.allBtn}
              onClick={() => askConfirm('toàn bộ kho lưu trữ', 5)}
              disabled={busy}
            >
              Xoá toàn bộ kho lưu trữ
            </button>
            <button className={adminStyles.linkBtn} onClick={loadArchive} disabled={loadingArchive}>
              Làm mới
            </button>
          </div>

          {pendingAction && (
            <div className={styles.confirmBox}>
              <span>{confirmLabel(pendingAction)}</span>
              <button onClick={runPendingAction} disabled={busy} className={styles.confirmYes}>
                {busy ? 'Đang xoá…' : 'Xác nhận xoá'}
              </button>
              <button onClick={() => setPendingAction(null)} disabled={busy}>
                Huỷ
              </button>
            </div>
          )}

          {resultMsg && <p className={adminStyles.rowOk}>{resultMsg}</p>}
          {errorMsg && <p className={adminStyles.error}>{errorMsg}</p>}
          {archiveError && <p className={adminStyles.error}>{archiveError}</p>}

          {loadingArchive ? (
            <p className={adminStyles.muted}>Đang tải kho lưu trữ…</p>
          ) : (
            <div className={adminStyles.tableWrap}>
              <table className={adminStyles.table}>
                <thead>
                  <tr>
                    <th>Ảnh</th>
                    <th>Học sinh</th>
                    <th>Lớp</th>
                    <th>Môn</th>
                    <th>Nội dung</th>
                    <th>Đăng lúc</th>
                    <th>Đã lưu trữ</th>
                    <th>Bình luận</th>
                  </tr>
                </thead>
                <tbody>
                  {(archive || []).map((p) => (
                    <tr key={p.post_id}>
                      <td>
                        {p.photo_url ? (
                          <img src={p.photo_url} alt="" className={styles.photoThumb} />
                        ) : (
                          <span style={{ color: '#8aa39c', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td>{p.student_name || '—'}</td>
                      <td>{p.class_name || '—'}</td>
                      <td>{p.subject_name || '—'}</td>
                      <td className={styles.contentCell} title={p.content}>{p.content}</td>
                      <td>{formatDateTime(p.created_at)}</td>
                      <td>{p.archived_days} ngày</td>
                      <td>{p.reply_count}</td>
                    </tr>
                  ))}
                  {(!archive || archive.length === 0) && (
                    <tr>
                      <td colSpan={8} className={adminStyles.muted}>
                        Kho lưu trữ hiện đang trống.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
