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
          {/* ---------------- CÀI ĐẶT SỐ NGÀY LƯU TRỮ / XOÁ TỰ ĐỘNG ---------------- */}
          <p style={{ fontSize: 13, color: '#5b6b66', margin: '0 0 10px' }}>
            Áp dụng cho TOÀN BỘ bài Hỏi bài trong trường. Chỉ chỉnh được ở đây (trang quản trị) —
            trang Hỏi bài của giáo viên/học sinh không có cài đặt này.
          </p>
          {loadingSettings ? (
            <p className={adminStyles.muted}>Đang tải cài đặt…</p>
          ) : (
            <div className={adminStyles.form} style={{ marginBottom: 12 }}>
              <div className={adminStyles.passwordRow}>
                <label className={adminStyles.field} style={{ flex: '1 1 160px' }}>
                  <span>Sau bao nhiêu ngày thì vào kho lưu trữ</span>
                  <input
                    type="number"
                    min={1}
                    value={archiveDaysInput}
                    onChange={(e) => setArchiveDaysInput(e.target.value)}
                  />
                </label>
                <label className={adminStyles.field} style={{ flex: '1 1 160px' }}>
                  <span>Sau bao nhiêu ngày thì xoá vĩnh viễn</span>
                  <input
                    type="number"
                    min={1}
                    value={deleteDaysInput}
                    onChange={(e) => setDeleteDaysInput(e.target.value)}
                  />
                </label>
              </div>
              <p style={{ fontSize: 12, color: '#8aa39c', margin: 0 }}>
                Số ngày xoá vĩnh viễn phải lớn hơn số ngày lưu trữ (tính từ lúc bài được đăng).
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
                <p className={settingsMsg.isError ? adminStyles.error : adminStyles.rowOk}>
                  {settingsMsg.text}
                </p>
              )}
              {settings?.updated_at && (
                <p style={{ fontSize: 12, color: '#8aa39c', margin: 0 }}>
                  Cập nhật lần cuối: {formatDateTime(settings.updated_at)}
                </p>
              )}
            </div>
          )}

          <hr className={adminStyles.sectionDivider} />

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
          {/* ---------------- KHO LƯU TRỮ (CHỈ ADMIN/GIÁO VIÊN XEM) ---------------- */}
          <p style={{ fontSize: 13, color: '#5b6b66', margin: '0 0 10px' }}>
            Các bài này đã ẩn khỏi học sinh. Theo cài đặt hiện tại, bài vào kho lưu trữ sau{' '}
            <strong>{currentArchiveDays} ngày</strong> và bị xoá vĩnh viễn sau{' '}
            <strong>{currentDeleteDays} ngày</strong> (tức còn ở trong kho tối đa{' '}
            {currentDeleteDays - currentArchiveDays} ngày) — bạn cũng có thể xoá sớm bằng các nút
            bên dưới.
          </p>
          <div className={styles.toolbar}>
            <button
              className={styles.dayBtn}
              onClick={() =>
                askConfirm('đã lưu trữ từ 1 ngày trở lên', currentArchiveDays + 1)
              }
              disabled={busy}
            >
              Xoá đã lưu trữ ≥ 1 ngày
            </button>
            <button
              className={styles.dayBtn}
              onClick={() =>
                askConfirm('đã lưu trữ từ 2 ngày trở lên', currentArchiveDays + 2)
              }
              disabled={busy}
            >
              Xoá đã lưu trữ ≥ 2 ngày
            </button>
            <button
              className={styles.allBtn}
              onClick={() => askConfirm('toàn bộ kho lưu trữ', currentArchiveDays)}
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
