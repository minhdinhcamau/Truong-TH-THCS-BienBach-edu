'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import adminStyles from './admin.module.css'
import styles from './qaArchivePanel.module.css'

// Cac muc "tuoi bai" dung chung cho ca 2 khu vuc (xoa nhanh + kho luu tru).
const QUICK_DELETE_DAYS = [1, 2, 3, 4, 5]

const TABS = [
  {
    key: 'manage',
    label: 'Quản lý Hỏi bài',
    icon: (
      <path d="M10.5 3.5a5 5 0 1 0 3.06 8.94l4 4a1 1 0 0 0 1.42-1.42l-4-4A5 5 0 0 0 10.5 3.5Z" />
    ),
  },
  {
    key: 'archive',
    label: 'Kho lưu trữ',
    icon: (
      <>
        <rect x="3.5" y="4.5" width="17" height="4" rx="1.2" />
        <path d="M5 9v8.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V9M10 12.5h4" />
      </>
    ),
  },
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
    return 'Bạn sắp xoá vĩnh viễn TẤT CẢ bài Hỏi bài trong hệ thống. Hành động này không thể hoàn tác.'
  }
  return `Bạn sắp xoá vĩnh viễn các bài cũ hơn ${pendingAction.minAgeDays} ngày. Hành động này không thể hoàn tác.`
}

function IconWarning() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .35 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.35 1.7 1.7 0 0 0-1.05 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.87.35l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.55-1.05H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.35-1.87l-.06-.06A2 2 0 1 1 7.06 4.24l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1.05-1.55V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.87-.35l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9a1.7 1.7 0 0 0 1.55 1.05H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" />
    </svg>
  )
}

export default function QaArchivePanel() {
  // Tab dang mo: "manage" (cai dat so ngay + xoa nhanh theo tuoi bai) hoac
  // "archive" (bang kho luu tru, chi bai da qua han - chi admin/giao vien
  // xem duoc).
  const [activeTab, setActiveTab] = useState('manage')

  const [archive, setArchive] = useState(null)
  const [loadingArchive, setLoadingArchive] = useState(true)
  const [archiveError, setArchiveError] = useState('')

  const [pendingAction, setPendingAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // ---- Cai dat so ngay luu tru / xoa tu dong (chi chinh duoc o day, trang
  // admin - KHONG bat cai dat nay o trang Hoi bai cua hoc sinh/giao vien) ----
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [archiveDaysInput, setArchiveDaysInput] = useState('')
  const [deleteDaysInput, setDeleteDaysInput] = useState('')
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState({ text: '', isError: false })

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

  // Gia tri dang dung de tinh cac nut xoa nhanh trong tab "Kho luu tru" -
  // LAY TU CAU HINH DA LUU (khong phai o input chua bam Luu), fallback 5/7
  // trong luc dang tai lan dau de UI khong bi vo.
  const currentArchiveDays = settings?.archive_after_days ?? 5
  const currentDeleteDays = settings?.delete_after_days ?? 7
  const archiveWindowDays = currentDeleteDays - currentArchiveDays

  const archiveCount = archive?.length ?? 0
  const oldestArchivedDays = archive && archive.length > 0
    ? Math.max(...archive.map((p) => p.archived_days ?? 0))
    : 0

  return (
    <section className={`${adminStyles.listCard} ${styles.panel}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Quản lý Hỏi bài</h2>
        <p className={styles.panelSubtitle}>
          Cấu hình thời gian lưu trữ và dọn dẹp toàn bộ bài đăng trong tính năng Hỏi bài của trường.
        </p>
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
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {t.icon}
            </svg>
            {t.label}
            {t.key === 'archive' && archive && (
              <span className={styles.tabCount}>{archive.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'manage' && (
        <div className={styles.tabPanel}>
          {/* ---------------- CÀI ĐẶT SỐ NGÀY LƯU TRỮ / XOÁ TỰ ĐỘNG ---------------- */}
          <div className={styles.card}>
            <div className={styles.cardHeadRow}>
              <span className={styles.cardIcon}><IconSettings /></span>
              <div>
                <h3 className={styles.cardTitle}>Thời gian lưu trữ &amp; xoá tự động</h3>
                <p className={styles.cardDesc}>
                  Áp dụng cho toàn bộ bài Hỏi bài trong trường. Chỉ chỉnh được ở đây — trang Hỏi bài
                  của giáo viên/học sinh không có cài đặt này.
                </p>
              </div>
            </div>

            {loadingSettings ? (
              <p className={styles.skeletonText}>Đang tải cài đặt…</p>
            ) : (
              <div className={styles.settingsBody}>
                <div className={styles.settingsGrid}>
                  <label className={styles.numberField}>
                    <span className={styles.numberFieldLabel}>Vào kho lưu trữ sau</span>
                    <div className={styles.numberInputWrap}>
                      <input
                        type="number"
                        min={1}
                        value={archiveDaysInput}
                        onChange={(e) => setArchiveDaysInput(e.target.value)}
                      />
                      <span className={styles.numberUnit}>ngày</span>
                    </div>
                  </label>
                  <div className={styles.settingsArrow}>→</div>
                  <label className={styles.numberField}>
                    <span className={styles.numberFieldLabel}>Xoá vĩnh viễn sau</span>
                    <div className={styles.numberInputWrap}>
                      <input
                        type="number"
                        min={1}
                        value={deleteDaysInput}
                        onChange={(e) => setDeleteDaysInput(e.target.value)}
                      />
                      <span className={styles.numberUnit}>ngày</span>
                    </div>
                  </label>
                </div>

                <p className={styles.helperText}>
                  Số ngày xoá vĩnh viễn phải lớn hơn số ngày lưu trữ (tính từ lúc bài được đăng).
                </p>

                <div className={styles.settingsFooter}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={saveSettings}
                    disabled={settingsBusy}
                  >
                    {settingsBusy ? 'Đang lưu…' : 'Lưu cài đặt'}
                  </button>
                  {settings?.updated_at && (
                    <span className={styles.updatedAt}>
                      Cập nhật lần cuối: {formatDateTime(settings.updated_at)}
                    </span>
                  )}
                </div>

                {settingsMsg.text && (
                  <p className={settingsMsg.isError ? styles.inlineError : styles.inlineSuccess}>
                    {settingsMsg.text}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ---------------- XOÁ NHANH THEO TUỔI BÀI ---------------- */}
          <div className={`${styles.card} ${styles.dangerCard}`}>
            <div className={styles.cardHeadRow}>
              <span className={`${styles.cardIcon} ${styles.cardIconDanger}`}><IconWarning /></span>
              <div>
                <h3 className={styles.cardTitle}>Xoá nhanh theo tuổi bài</h3>
                <p className={styles.cardDesc}>
                  Xoá vĩnh viễn ngay lập tức, áp dụng cho MỌI bài — kể cả bài chưa vào kho lưu trữ.
                  Không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className={styles.chipRow}>
              {QUICK_DELETE_DAYS.map((d) => (
                <button
                  key={d}
                  className={styles.dayBtn}
                  onClick={() => askConfirm(`cũ hơn ${d} ngày`, d)}
                  disabled={busy}
                >
                  Cũ hơn {d} ngày
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

            {resultMsg && <p className={styles.inlineSuccess}>{resultMsg}</p>}
            {errorMsg && <p className={styles.inlineError}>{errorMsg}</p>}
          </div>

          {/* ---------------- GHI CHÚ ---------------- */}
          <div className={styles.noteCard}>
            <span className={styles.cardIcon}><IconInfo /></span>
            <p>
              Danh sách chi tiết từng bài đang hoạt động (để xoá riêng lẻ từng bài hoặc từng bình
              luận) sẽ được bổ sung sau. Hiện tại có thể xoá hàng loạt theo tuổi bài ở trên, hoặc
              xem/xoá các bài đã vào kho lưu trữ ở tab bên cạnh.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'archive' && (
        <div className={styles.tabPanel}>
          {/* ---------------- DẢI THỐNG KÊ NHANH ---------------- */}
          <div className={styles.statRow}>
            <div className={styles.statPill}>
              <span className={styles.statValue}>{archiveCount}</span>
              <span className={styles.statLabel}>bài trong kho</span>
            </div>
            <div className={styles.statPill}>
              <span className={styles.statValue}>{oldestArchivedDays}</span>
              <span className={styles.statLabel}>ngày — bài cũ nhất</span>
            </div>
            <div className={styles.statPill}>
              <span className={styles.statValue}>{archiveWindowDays}</span>
              <span className={styles.statLabel}>ngày lưu tối đa trong kho</span>
            </div>
          </div>

          <p className={styles.helperText} style={{ margin: '0 0 14px' }}>
            Các bài này đã ẩn khỏi học sinh. Theo cài đặt hiện tại, bài vào kho sau{' '}
            <strong>{currentArchiveDays} ngày</strong> và bị xoá vĩnh viễn sau{' '}
            <strong>{currentDeleteDays} ngày</strong> kể từ lúc đăng.
          </p>

          <div className={styles.toolbar}>
            <span className={styles.toolbarLabel}>Xoá bài đã lưu trữ:</span>
            <button
              className={styles.dayBtn}
              onClick={() => askConfirm('đã lưu trữ từ 1 ngày trở lên', currentArchiveDays + 1)}
              disabled={busy}
            >
              ≥ 1 ngày
            </button>
            <button
              className={styles.dayBtn}
              onClick={() => askConfirm('đã lưu trữ từ 2 ngày trở lên', currentArchiveDays + 2)}
              disabled={busy}
            >
              ≥ 2 ngày
            </button>
            <button
              className={styles.allBtn}
              onClick={() => askConfirm('toàn bộ kho lưu trữ', currentArchiveDays)}
              disabled={busy}
            >
              Xoá toàn bộ kho
            </button>
            <button className={styles.refreshBtn} onClick={loadArchive} disabled={loadingArchive}>
              <IconRefresh /> Làm mới
            </button>
          </div>

          {resultMsg && <p className={styles.inlineSuccess}>{resultMsg}</p>}
          {errorMsg && <p className={styles.inlineError}>{errorMsg}</p>}
          {archiveError && <p className={styles.inlineError}>{archiveError}</p>}

          {loadingArchive ? (
            <div className={styles.emptyState}>
              <p>Đang tải kho lưu trữ…</p>
            </div>
          ) : archive && archive.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.archiveTable}>
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
                  {archive.map((p) => (
                    <tr key={p.post_id}>
                      <td>
                        {p.photo_url ? (
                          <img src={p.photo_url} alt="" className={styles.photoThumb} />
                        ) : (
                          <div className={styles.noPhoto}>—</div>
                        )}
                      </td>
                      <td className={styles.strongCell}>{p.student_name || '—'}</td>
                      <td>{p.class_name || '—'}</td>
                      <td>{p.subject_name || '—'}</td>
                      <td className={styles.contentCell} title={p.content}>{p.content}</td>
                      <td className={styles.mutedCell}>{formatDateTime(p.created_at)}</td>
                      <td>
                        <span className={styles.daysBadge}>{p.archived_days} ngày</span>
                      </td>
                      <td className={styles.mutedCell}>{p.reply_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3.5" y="4.5" width="17" height="4" rx="1.2" />
                <path d="M5 9v8.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V9M10 12.5h4" />
              </svg>
              <p>Kho lưu trữ hiện đang trống.</p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- MODAL XÁC NHẬN XOÁ ---------------- */}
      {pendingAction && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && !busy && setPendingAction(null)}>
          <div className={styles.modalBox}>
            <span className={styles.modalIcon}><IconWarning /></span>
            <h4 className={styles.modalTitle}>Xác nhận xoá vĩnh viễn</h4>
            <p className={styles.modalText}>{confirmLabel(pendingAction)}</p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setPendingAction(null)} disabled={busy}>
                Huỷ
              </button>
              <button className={styles.modalConfirm} onClick={runPendingAction} disabled={busy}>
                {busy ? 'Đang xoá…' : 'Xác nhận xoá'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
