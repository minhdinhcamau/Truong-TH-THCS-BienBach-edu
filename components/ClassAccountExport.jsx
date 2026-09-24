'use client'

import { useMemo, useState } from 'react'
import styles from '@/app/admin/admin.module.css'
import { exportAccountsExcel } from '@/lib/exportAccountsExcel'

// Cong cu "Xuat tai khoan theo lop": chon lop -> tick hoc sinh -> he thong CAP
// LAI mat khau moi cho cac em da tick -> tai file Excel (ten dang nhap + mat khau).
//
// Vi sao phai cap lai? Supabase Auth chi luu ma bam (hash) cua mat khau nen
// khong the doc lai mat khau cu. Hoc sinh da tu doi mat khau (cot
// password_changed_at) mac dinh KHONG duoc tick de tranh ghi de mat khau cua em.
//
// Props:
//   users        - danh sach tai khoan da tai o trang admin (co role, class_id, password_changed_at)
//   classes      - danh sach lop
//   authedFetch  - ham fetch kem token cua trang admin
//   onDone       - goi lai sau khi cap mat khau xong (de tai lai danh sach tai khoan)

const BATCH_SIZE = 15 // chia lo de khong bi timeout va co thanh tien do

// Sap xep theo TEN (tu cuoi), roi den ho dem - cach xep danh sach lop pho bien o Viet Nam
function compareVietnameseName(a, b) {
  const split = (full) => {
    const parts = String(full || '').trim().split(/\s+/)
    return { given: parts[parts.length - 1] || '', rest: parts.slice(0, -1).join(' ') }
  }
  const ka = split(a.full_name)
  const kb = split(b.full_name)
  return ka.given.localeCompare(kb.given, 'vi') || ka.rest.localeCompare(kb.rest, 'vi')
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('vi-VN') : ''
}

export default function ClassAccountExport({ users, classes, authedFetch, onDone }) {
  const [classId, setClassId] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [failed, setFailed] = useState([])
  const [lastBatch, setLastBatch] = useState(null) // { className, rows } - giu lai de tai lai file neu can

  const sortedClasses = useMemo(
    () =>
      [...classes].sort(
        (a, b) =>
          (a.grade || 99) - (b.grade || 99) || String(a.name).localeCompare(String(b.name), 'vi', { numeric: true })
      ),
    [classes]
  )

  const className = classes.find((c) => c.id === classId)?.name || ''

  const students = useMemo(
    () => users.filter((u) => u.role === 'student' && u.class_id === classId).sort(compareVietnameseName),
    [users, classId]
  )

  const changedCount = students.filter((s) => s.password_changed_at).length
  const selectedCount = students.filter((s) => selected.has(s.id)).length
  const allSelected = students.length > 0 && selectedCount === students.length

  function handleSelectClass(id) {
    setClassId(id)
    setError('')
    setFailed([])
    setLastBatch(null)
    // Mac dinh chi tick nhung em CHUA tu doi mat khau
    setSelected(
      new Set(
        users
          .filter((u) => u.role === 'student' && u.class_id === id && !u.password_changed_at)
          .map((u) => u.id)
      )
    )
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(students.map((s) => s.id)))
  }
  function selectNone() {
    setSelected(new Set())
  }
  function selectNotChanged() {
    setSelected(new Set(students.filter((s) => !s.password_changed_at).map((s) => s.id)))
  }

  async function downloadFile(batch) {
    try {
      await exportAccountsExcel({ className: batch.className, rows: batch.rows })
    } catch (err) {
      setError(`Không tạo được file Excel: ${err.message}. Bấm "Tải lại file Excel" để thử lại.`)
    }
  }

  async function handleResetAndExport() {
    const chosen = students.filter((s) => selected.has(s.id))
    if (chosen.length === 0) return

    const alreadyChanged = chosen.filter((s) => s.password_changed_at).length
    const message =
      `Cấp mật khẩu MỚI cho ${chosen.length} học sinh lớp ${className}?\n\n` +
      'Mật khẩu hiện tại của các em này sẽ bị thay thế, các em phải dùng mật khẩu mới trong file Excel để đăng nhập.' +
      (alreadyChanged > 0
        ? `\n\nLưu ý: ${alreadyChanged} em trong danh sách đã tự đổi mật khẩu — mật khẩu do các em tự đặt cũng sẽ bị thay.`
        : '')
    if (!window.confirm(message)) return

    setBusy(true)
    setError('')
    setFailed([])
    setLastBatch(null)
    setProgress({ done: 0, total: chosen.length })

    const okRows = []
    const failedRows = []

    for (let i = 0; i < chosen.length; i += BATCH_SIZE) {
      const chunk = chosen.slice(i, i + BATCH_SIZE)
      try {
        const data = await authedFetch('/api/admin/bulk-reset-passwords', {
          method: 'POST',
          body: JSON.stringify({ userIds: chunk.map((s) => s.id) }),
        })
        for (const r of data.results || []) {
          if (r.success) {
            okRows.push({ fullName: r.fullName, studentCode: r.studentCode, password: r.password })
          } else {
            failedRows.push({ name: r.fullName || r.studentCode || r.userId, error: r.error })
          }
        }
      } catch (err) {
        // Ca lo loi (mat mang, het thoi gian...): mot so em co the da bi doi mat khau
        // ma ta khong nhan duoc mat khau moi -> yeu cau chay lai cho cac em nay.
        for (const s of chunk) {
          failedRows.push({ name: s.full_name, error: `${err.message} (hãy cấp lại cho em này)` })
        }
      }
      setProgress({ done: Math.min(i + BATCH_SIZE, chosen.length), total: chosen.length })
    }

    setFailed(failedRows)
    setBusy(false)

    if (okRows.length > 0) {
      const batch = { className, rows: okRows }
      setLastBatch(batch)
      await downloadFile(batch)
    }
    if (onDone) onDone()
  }

  return (
    <div>
      <h2>Xuất tài khoản theo lớp</h2>
      <p style={{ fontSize: 12, color: '#5b6b66', margin: '0 0 10px' }}>
        Chọn lớp và tick các học sinh cần lấy tài khoản. Hệ thống sẽ cấp mật khẩu mới cho các em đã tick rồi
        tải file Excel (tên đăng nhập + mật khẩu) để in phát cho học sinh. Mật khẩu cũ không thể xem lại nên
        phải cấp mới mỗi lần xuất.
      </p>

      <div className={styles.passwordRow} style={{ marginBottom: 10 }}>
        <select value={classId} onChange={(e) => handleSelectClass(e.target.value)} disabled={busy}>
          <option value="">-- Chọn lớp --</option>
          {sortedClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade ? `Khối ${c.grade} · ` : ''}
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {classId && students.length === 0 && <p className={styles.muted}>Lớp này chưa có học sinh nào.</p>}

      {classId && students.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#37423e' }}>
              Đã chọn {selectedCount}/{students.length} học sinh
              {changedCount > 0 ? ` · ${changedCount} em đã tự đổi mật khẩu` : ''}
            </span>
            <button type="button" className={styles.linkBtn} onClick={selectAll} disabled={busy}>
              Chọn tất cả
            </button>
            <button type="button" className={styles.linkBtn} onClick={selectNotChanged} disabled={busy}>
              Chỉ em chưa đổi mật khẩu
            </button>
            <button type="button" className={styles.linkBtn} onClick={selectNone} disabled={busy}>
              Bỏ chọn
            </button>
          </div>

          <div className={styles.tableWrap} style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 28 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => (allSelected ? selectNone() : selectAll())}
                      disabled={busy}
                      title="Chọn / bỏ chọn tất cả"
                    />
                  </th>
                  <th style={{ width: 40 }}>STT</th>
                  <th>Họ tên</th>
                  <th>Mã học sinh</th>
                  <th>Mật khẩu</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        disabled={busy}
                      />
                    </td>
                    <td>{i + 1}</td>
                    <td>{s.full_name || '—'}</td>
                    <td>{s.student_code || '—'}</td>
                    <td>
                      {s.password_changed_at ? (
                        <span
                          title={`Tự đổi ngày ${formatDate(s.password_changed_at)}`}
                          style={{ color: '#9a5b00', fontSize: 12, fontWeight: 600 }}
                        >
                          Đã tự đổi
                        </span>
                      ) : (
                        <span style={{ color: '#5b6b66', fontSize: 12 }}>Mật khẩu ban đầu</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className={styles.submit}
            style={{ marginTop: 12 }}
            onClick={handleResetAndExport}
            disabled={busy || selectedCount === 0}
          >
            {busy
              ? `Đang cấp mật khẩu… ${progress.done}/${progress.total}`
              : `Cấp mật khẩu mới & xuất Excel (${selectedCount} học sinh)`}
          </button>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {lastBatch && (
        <div className={styles.successBox} style={{ marginTop: 12 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}
          >
            <p style={{ margin: 0 }}>
              <strong>
                Đã cấp mật khẩu mới cho {lastBatch.rows.length} học sinh lớp {lastBatch.className}.
              </strong>
            </p>
            <button type="button" className={styles.genButton} onClick={() => downloadFile(lastBatch)}>
              📥 Tải lại file Excel
            </button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>
            Mật khẩu chỉ còn trong file vừa tải. Rời khỏi trang này là không xem lại được nữa.
          </p>
        </div>
      )}

      {failed.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p className={styles.error} style={{ marginBottom: 4 }}>
            Có {failed.length} tài khoản chưa cấp được:
          </p>
          {failed.map((f, i) => (
            <p key={i} className={styles.rowError} style={{ margin: '2px 0' }}>
              ❌ {f.name}: {f.error}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
