'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { generateStrongPassword } from '../../lib/generatePassword'
import * as XLSX from 'xlsx'
import styles from './admin.module.css'

const ROLE_LABEL = { admin: 'Quản trị viên', teacher: 'Giáo viên', student: 'Học sinh' }
const GRADE_OPTIONS = [6, 7, 8, 9]

function currentSchoolYear() {
  const now = new Date()
  const y = now.getFullYear()
  // Thang 8 tro di tinh la nam hoc moi bat dau
  const startYear = now.getMonth() >= 7 ? y : y - 1
  return `${startYear}-${startYear + 1}`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN')
}

function isExpiringSoon(iso) {
  if (!iso) return false
  const days = (new Date(iso) - new Date()) / (1000 * 60 * 60 * 24)
  return days > 0 && days < 90
}

export default function AdminPage() {
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [listError, setListError] = useState('')

  // ---- Lớp ----
  const [classes, setClasses] = useState([])
  const [newClassName, setNewClassName] = useState('')
  const [newClassGrade, setNewClassGrade] = useState('6')
  const [classError, setClassError] = useState('')
  const [editingClassId, setEditingClassId] = useState(null)
  const [editClassName, setEditClassName] = useState('')
  const [editClassGrade, setEditClassGrade] = useState('')
  const [classBusyId, setClassBusyId] = useState(null)
  const [collapsedGrades, setCollapsedGrades] = useState({})

  // ---- Môn học ----
  const [subjects, setSubjects] = useState([])
  const [newSubjectName, setNewSubjectName] = useState('')
  const [subjectError, setSubjectError] = useState('')
  const [editingSubjectId, setEditingSubjectId] = useState(null)
  const [editSubjectName, setEditSubjectName] = useState('')
  const [subjectBusyId, setSubjectBusyId] = useState(null)

  // ---- Phân công giảng dạy ----
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [newAssignmentSubject, setNewAssignmentSubject] = useState('')
  const [newAssignmentClass, setNewAssignmentClass] = useState('')
  const [newAssignmentYear, setNewAssignmentYear] = useState(currentSchoolYear())
  const [assignmentBusy, setAssignmentBusy] = useState(false)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'student',
    classId: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [lastCreated, setLastCreated] = useState(null)

  const [resetRowId, setResetRowId] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [rowBusyId, setRowBusyId] = useState(null)
  const [rowMsg, setRowMsg] = useState({ id: null, text: '', isError: false })

  // ---- Nhập danh sách học sinh hàng loạt ----
  const [rosterClassId, setRosterClassId] = useState('')
  const [rosterResults, setRosterResults] = useState(null)
  const [rosterBusy, setRosterBusy] = useState(false)
  const [rosterError, setRosterError] = useState('')

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }, [])

  const authedFetch = useCallback(
    async (url, options = {}) => {
      const token = await getToken()
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra')
      return data
    },
    [getToken]
  )

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setListError('')
    try {
      const data = await authedFetch('/api/admin/list-users')
      setUsers(data.users || [])
    } catch (err) {
      setListError(err.message)
    } finally {
      setLoadingUsers(false)
    }
  }, [authedFetch])

  const loadClasses = useCallback(async () => {
    setClassError('')
    try {
      const data = await authedFetch('/api/admin/classes')
      setClasses(data.classes || [])
    } catch (err) {
      setClassError(err.message)
    }
  }, [authedFetch])

  const loadSubjects = useCallback(async () => {
    setSubjectError('')
    try {
      const data = await authedFetch('/api/admin/subjects')
      setSubjects(data.subjects || [])
    } catch (err) {
      setSubjectError(err.message)
    }
  }, [authedFetch])

  const loadTeacherAssignments = useCallback(
    async (teacherId) => {
      if (!teacherId) {
        setTeacherAssignments([])
        return
      }
      setLoadingAssignments(true)
      setAssignmentError('')
      try {
        const data = await authedFetch(`/api/admin/teacher-assignments?teacherId=${teacherId}`)
        setTeacherAssignments(data.assignments || [])
      } catch (err) {
        setAssignmentError(err.message)
      } finally {
        setLoadingAssignments(false)
      }
    },
    [authedFetch]
  )

  useEffect(() => {
    async function checkAccess() {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session

      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.replace(profile?.role === 'teacher' ? '/teacher' : '/student')
        return
      }

      setCheckingAuth(false)
      loadUsers()
      loadClasses()
      loadSubjects()
    }
    checkAccess()
  }, [router, loadUsers, loadClasses, loadSubjects])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // ---------- Lớp ----------
  function toggleGrade(gradeKey) {
    setCollapsedGrades((prev) => ({ ...prev, [gradeKey]: !prev[gradeKey] }))
  }

  async function handleCreateClass() {
    if (!newClassName.trim()) return
    setClassError('')
    try {
      await authedFetch('/api/admin/classes', {
        method: 'POST',
        body: JSON.stringify({ name: newClassName.trim(), grade: newClassGrade }),
      })
      setNewClassName('')
      loadClasses()
    } catch (err) {
      setClassError(err.message)
    }
  }

  function startEditClass(cls) {
    setEditingClassId(cls.id)
    setEditClassName(cls.name)
    setEditClassGrade(cls.grade ? String(cls.grade) : '')
    setClassError('')
  }

  function cancelEditClass() {
    setEditingClassId(null)
  }

  async function saveEditClass(cls) {
    setClassBusyId(cls.id)
    setClassError('')
    try {
      await authedFetch(`/api/admin/classes/${cls.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editClassName, grade: editClassGrade }),
      })
      setEditingClassId(null)
      loadClasses()
    } catch (err) {
      setClassError(err.message)
    } finally {
      setClassBusyId(null)
    }
  }

  async function deleteClass(cls) {
    const confirmed = window.confirm(
      `Xoá lớp "${cls.name}"? Học sinh trong lớp sẽ không bị xoá, chỉ bị gỡ khỏi lớp này.`
    )
    if (!confirmed) return

    setClassBusyId(cls.id)
    setClassError('')
    try {
      await authedFetch(`/api/admin/classes/${cls.id}`, { method: 'DELETE' })
      setClasses((prev) => prev.filter((c) => c.id !== cls.id))
      loadUsers()
    } catch (err) {
      setClassError(err.message)
    } finally {
      setClassBusyId(null)
    }
  }

  const classesByGrade = useMemo(() => {
    const map = {}
    classes.forEach((c) => {
      const key = c.grade || 'other'
      if (!map[key]) map[key] = []
      map[key].push(c)
    })
    return map
  }, [classes])

  const sortedGradeKeys = useMemo(() => {
    const keys = Object.keys(classesByGrade)
    return keys.sort((a, b) => {
      if (a === 'other') return 1
      if (b === 'other') return -1
      return Number(a) - Number(b)
    })
  }, [classesByGrade])

  const classNameById = useMemo(() => {
    const map = {}
    classes.forEach((c) => { map[c.id] = c.name })
    return map
  }, [classes])

  // ---------- Môn học ----------
  async function handleCreateSubject() {
    if (!newSubjectName.trim()) return
    setSubjectError('')
    try {
      await authedFetch('/api/admin/subjects', {
        method: 'POST',
        body: JSON.stringify({ name: newSubjectName.trim() }),
      })
      setNewSubjectName('')
      loadSubjects()
    } catch (err) {
      setSubjectError(err.message)
    }
  }

  function startEditSubject(s) {
    setEditingSubjectId(s.id)
    setEditSubjectName(s.name)
    setSubjectError('')
  }

  async function saveEditSubject(s) {
    setSubjectBusyId(s.id)
    setSubjectError('')
    try {
      await authedFetch(`/api/admin/subjects/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editSubjectName }),
      })
      setEditingSubjectId(null)
      loadSubjects()
    } catch (err) {
      setSubjectError(err.message)
    } finally {
      setSubjectBusyId(null)
    }
  }

  async function deleteSubject(s) {
    const confirmed = window.confirm(`Xoá môn "${s.name}"?`)
    if (!confirmed) return
    setSubjectBusyId(s.id)
    setSubjectError('')
    try {
      await authedFetch(`/api/admin/subjects/${s.id}`, { method: 'DELETE' })
      setSubjects((prev) => prev.filter((x) => x.id !== s.id))
    } catch (err) {
      setSubjectError(err.message)
    } finally {
      setSubjectBusyId(null)
    }
  }

  // ---------- Phân công giảng dạy ----------
  const teachers = useMemo(() => users.filter((u) => u.role === 'teacher'), [users])

  function handleSelectTeacher(id) {
    setSelectedTeacherId(id)
    loadTeacherAssignments(id)
  }

  async function handleAddAssignment() {
    if (!selectedTeacherId || !newAssignmentSubject || !newAssignmentClass || !newAssignmentYear.trim()) {
      setAssignmentError('Chọn đủ môn, lớp và năm học.')
      return
    }
    setAssignmentBusy(true)
    setAssignmentError('')
    try {
      await authedFetch('/api/admin/teacher-assignments', {
        method: 'POST',
        body: JSON.stringify({
          teacherId: selectedTeacherId,
          classId: newAssignmentClass,
          subjectId: newAssignmentSubject,
          schoolYear: newAssignmentYear.trim(),
        }),
      })
      setNewAssignmentSubject('')
      setNewAssignmentClass('')
      loadTeacherAssignments(selectedTeacherId)
    } catch (err) {
      setAssignmentError(err.message)
    } finally {
      setAssignmentBusy(false)
    }
  }

  async function deleteAssignment(a) {
    setAssignmentBusy(true)
    setAssignmentError('')
    try {
      await authedFetch(`/api/admin/teacher-assignments/${a.id}`, { method: 'DELETE' })
      setTeacherAssignments((prev) => prev.filter((x) => x.id !== a.id))
    } catch (err) {
      setAssignmentError(err.message)
    } finally {
      setAssignmentBusy(false)
    }
  }

  // ---------- Tài khoản ----------
  async function handleCreate(e) {
    e.preventDefault()
    setCreateError('')

    if (form.role === 'admin') {
      const confirmed = window.confirm(
        `Xác nhận cấp quyền QUẢN TRỊ VIÊN cho "${form.fullName}"${form.email ? ' (' + form.email + ')' : ''}? Tài khoản này sẽ có toàn quyền tạo/xoá tài khoản khác.`
      )
      if (!confirmed) return
    }

    if (form.role === 'student' && !form.classId) {
      setCreateError('Vui lòng chọn lớp cho học sinh.')
      return
    }

    setCreating(true)
    setLastCreated(null)

    try {
      const payload =
        form.role === 'student'
          ? { fullName: form.fullName, password: form.password, role: form.role, classId: form.classId }
          : form

      const data = await authedFetch('/api/admin/create-user', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setLastCreated({
        email: form.role === 'student' ? null : form.email,
        password: form.password,
        studentCode: data.studentCode,
      })
      setForm({ fullName: '', email: '', password: '', role: 'student', classId: '' })
      loadUsers()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(user) {
    const confirmed = window.confirm(
      `Xoá tài khoản "${user.full_name}"${user.email ? ' (' + user.email + ')' : ''}? Hành động này không thể hoàn tác.`
    )
    if (!confirmed) return

    setRowBusyId(user.id)
    try {
      await authedFetch('/api/admin/delete-user', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
      })
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      if (selectedTeacherId === user.id) {
        setSelectedTeacherId('')
        setTeacherAssignments([])
      }
    } catch (err) {
      setRowMsg({ id: user.id, text: err.message, isError: true })
    } finally {
      setRowBusyId(null)
    }
  }

  function openReset(user) {
    setResetRowId(user.id)
    setResetPassword('')
    setRowMsg({ id: null, text: '', isError: false })
  }

  async function submitReset(user) {
    if (!resetPassword) return
    setRowBusyId(user.id)
    try {
      await authedFetch('/api/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, newPassword: resetPassword }),
      })
      setRowMsg({ id: user.id, text: `Đã đặt mật khẩu mới: ${resetPassword}`, isError: false })
      setResetRowId(null)
    } catch (err) {
      setRowMsg({ id: user.id, text: err.message, isError: true })
    } finally {
      setRowBusyId(null)
    }
  }

  async function handleExtend(user) {
    setRowBusyId(user.id)
    try {
      const data = await authedFetch('/api/admin/extend-student', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, extraYears: 1 }),
      })
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, expires_at: data.newExpiresAt, is_retained: true } : u
        )
      )
      setRowMsg({ id: user.id, text: 'Đã gia hạn thêm 1 năm.', isError: false })
    } catch (err) {
      setRowMsg({ id: user.id, text: err.message, isError: true })
    } finally {
      setRowBusyId(null)
    }
  }

  // ---------- Nhập danh sách học sinh hàng loạt ----------
  // Đọc thẳng file sổ điểm / sổ điểm danh sẵn có của giáo viên (không cần file mẫu riêng).
  // File dạng này luôn có vài dòng tiêu đề rác phía trên, rồi tới dòng header thật chứa
  // "Mã học sinh" và "Họ và tên" (họ tên bị tách làm 2 cột liền nhau do merge cell).
  function parseRosterSheet(sheet) {
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })

    let headerRowIdx = -1
    let codeColIdx = -1
    let nameColIdx = -1

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i]
      const idx = row.findIndex((c) => String(c).trim() === 'Mã học sinh')
      if (idx !== -1) {
        headerRowIdx = i
        codeColIdx = idx
        nameColIdx = row.findIndex((c) => String(c).trim() === 'Họ và tên')
        break
      }
    }

    if (headerRowIdx === -1 || nameColIdx === -1) {
      return { error: 'Không tìm thấy cột "Mã học sinh" và "Họ và tên" trong file. Kiểm tra lại file đã chọn.' }
    }

    const students = raw
      .slice(headerRowIdx + 1)
      .map((row) => {
        const studentCode = String(row[codeColIdx] || '').trim()
        const hoDem = String(row[nameColIdx] || '').trim()
        const ten = String(row[nameColIdx + 1] || '').trim()
        const fullName = [hoDem, ten].filter(Boolean).join(' ')
        return { studentCode, fullName }
      })
      .filter((r) => r.studentCode && r.fullName)

    return { students }
  }

  async function handleRosterUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!rosterClassId) {
      setRosterError('Vui lòng chọn lớp trước khi tải file lên.')
      return
    }

    setRosterBusy(true)
    setRosterError('')
    setRosterResults(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const { students, error } = parseRosterSheet(sheet)

      if (error) {
        setRosterError(error)
        setRosterBusy(false)
        return
      }
      if (students.length === 0) {
        setRosterError('Không đọc được dòng học sinh nào có đủ mã học sinh và họ tên trong file.')
        setRosterBusy(false)
        return
      }

      const data = await authedFetch('/api/admin/bulk-create-students', {
        method: 'POST',
        body: JSON.stringify({ classId: rosterClassId, students }),
      })
      setRosterResults(data.results || [])
      loadUsers()
    } catch (err) {
      setRosterError(err.message)
    } finally {
      setRosterBusy(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.student_code?.toLowerCase().includes(q)
      )
    })
  }, [users, search, roleFilter])

  if (checkingAuth) {
    return <div className={styles.loadingScreen}>Đang kiểm tra quyền truy cập…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Quản trị tài khoản</h1>
        <button className={styles.logout} onClick={handleLogout}>
          Đăng xuất
        </button>
      </header>

      <div className={styles.layout}>
        <section className={styles.createCard}>
          {/* ---------------- QUẢN LÝ LỚP ---------------- */}
          <h2>Quản lý lớp</h2>

          <div className={styles.form} style={{ marginBottom: 16 }}>
            <div className={styles.passwordRow}>
              <select
                value={newClassGrade}
                onChange={(e) => setNewClassGrade(e.target.value)}
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>Khối {g}</option>
                ))}
              </select>
              <input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Tên lớp, VD: 6A1"
              />
              <button type="button" className={styles.genButton} onClick={handleCreateClass}>
                Thêm lớp
              </button>
            </div>
            {classError && <p className={styles.error}>{classError}</p>}
          </div>

          {sortedGradeKeys.length === 0 && (
            <p className={styles.muted}>Chưa có lớp nào. Thêm lớp ở trên để bắt đầu.</p>
          )}

          {sortedGradeKeys.map((gradeKey) => {
            const isOpen = !collapsedGrades[gradeKey]
            return (
              <div key={gradeKey} className={styles.gradeGroup}>
                <button
                  type="button"
                  className={styles.gradeGroupHeader}
                  onClick={() => toggleGrade(gradeKey)}
                >
                  <span>
                    <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>▶</span>
                    {' '}
                    {gradeKey === 'other' ? 'Chưa xếp khối' : `Khối ${gradeKey}`}
                    {' '}({classesByGrade[gradeKey].length} lớp)
                  </span>
                  <span>{isOpen ? 'Ẩn lớp học' : 'Hiện lớp học'}</span>
                </button>

                {isOpen && (
                  <div className={styles.gradeGroupBody}>
                    {classesByGrade[gradeKey].map((cls) => (
                      <div key={cls.id} className={styles.classRow}>
                        {editingClassId === cls.id ? (
                          <>
                            <select
                              value={editClassGrade}
                              onChange={(e) => setEditClassGrade(e.target.value)}
                            >
                              <option value="">Chưa xếp</option>
                              {GRADE_OPTIONS.map((g) => (
                                <option key={g} value={g}>Khối {g}</option>
                              ))}
                            </select>
                            <input
                              className={styles.inlineInput}
                              value={editClassName}
                              onChange={(e) => setEditClassName(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button
                              className={styles.smallConfirm}
                              onClick={() => saveEditClass(cls)}
                              disabled={classBusyId === cls.id}
                            >
                              Lưu
                            </button>
                            <button className={styles.smallCancel} onClick={cancelEditClass}>
                              Huỷ
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, fontSize: 14 }}>{cls.name}</span>
                            <button className={styles.linkBtn} onClick={() => startEditClass(cls)}>
                              Sửa
                            </button>
                            <button
                              className={styles.dangerBtn}
                              onClick={() => deleteClass(cls)}
                              disabled={classBusyId === cls.id}
                            >
                              Xoá
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <hr className={styles.sectionDivider} />

          {/* ---------------- QUẢN LÝ MÔN HỌC ---------------- */}
          <h2>Quản lý môn học</h2>
          <div className={styles.form} style={{ marginBottom: 16 }}>
            <div className={styles.passwordRow}>
              <input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Tên môn, VD: Vật lí"
              />
              <button type="button" className={styles.genButton} onClick={handleCreateSubject}>
                Thêm môn
              </button>
            </div>
            {subjectError && <p className={styles.error}>{subjectError}</p>}
          </div>

          {subjects.length === 0 && <p className={styles.muted}>Chưa có môn học nào.</p>}

          {subjects.map((s) => (
            <div key={s.id} className={styles.classRow}>
              {editingSubjectId === s.id ? (
                <>
                  <input
                    className={styles.inlineInput}
                    value={editSubjectName}
                    onChange={(e) => setEditSubjectName(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className={styles.smallConfirm}
                    onClick={() => saveEditSubject(s)}
                    disabled={subjectBusyId === s.id}
                  >
                    Lưu
                  </button>
                  <button className={styles.smallCancel} onClick={() => setEditingSubjectId(null)}>
                    Huỷ
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 14 }}>{s.name}</span>
                  <button className={styles.linkBtn} onClick={() => startEditSubject(s)}>
                    Sửa
                  </button>
                  <button
                    className={styles.dangerBtn}
                    onClick={() => deleteSubject(s)}
                    disabled={subjectBusyId === s.id}
                  >
                    Xoá
                  </button>
                </>
              )}
            </div>
          ))}

          <hr className={styles.sectionDivider} />

          {/* ---------------- PHÂN CÔNG GIẢNG DẠY ---------------- */}
          <h2>Phân công giảng dạy</h2>
          <div className={styles.form} style={{ marginBottom: 12 }}>
            <label className={styles.field}>
              <span>Chọn giáo viên</span>
              <select
                value={selectedTeacherId}
                onChange={(e) => handleSelectTeacher(e.target.value)}
              >
                <option value="">-- Chọn giáo viên --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                ))}
              </select>
            </label>
          </div>

          {selectedTeacherId && (
            <>
              <div className={styles.passwordRow} style={{ marginBottom: 8 }}>
                <select value={newAssignmentSubject} onChange={(e) => setNewAssignmentSubject(e.target.value)}>
                  <option value="">-- Môn --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select value={newAssignmentClass} onChange={(e) => setNewAssignmentClass(e.target.value)}>
                  <option value="">-- Lớp --</option>
                  {sortedGradeKeys.map((gradeKey) => (
                    <optgroup key={gradeKey} label={gradeKey === 'other' ? 'Chưa xếp khối' : `Khối ${gradeKey}`}>
                      {classesByGrade[gradeKey].map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className={styles.passwordRow} style={{ marginBottom: 12 }}>
                <input
                  value={newAssignmentYear}
                  onChange={(e) => setNewAssignmentYear(e.target.value)}
                  placeholder="Năm học, VD: 2026-2027"
                />
                <button
                  type="button"
                  className={styles.genButton}
                  onClick={handleAddAssignment}
                  disabled={assignmentBusy}
                >
                  Thêm phân công
                </button>
              </div>

              {assignmentError && <p className={styles.error}>{assignmentError}</p>}

              {loadingAssignments ? (
                <p className={styles.muted}>Đang tải…</p>
              ) : teacherAssignments.length === 0 ? (
                <p className={styles.muted}>Giáo viên này chưa được phân công dạy lớp/môn nào.</p>
              ) : (
                teacherAssignments.map((a) => (
                  <div key={a.id} className={styles.classRow}>
                    <span style={{ flex: 1, fontSize: 14 }}>
                      {a.subjectName} · {a.className} · {a.schoolYear}
                    </span>
                    <button
                      className={styles.dangerBtn}
                      onClick={() => deleteAssignment(a)}
                      disabled={assignmentBusy}
                    >
                      Xoá
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          <hr className={styles.sectionDivider} />

          {/* ---------------- TẠO TÀI KHOẢN ---------------- */}
          <h2>Tạo tài khoản mới</h2>

          <form onSubmit={handleCreate} className={styles.form}>
            <label className={styles.field}>
              <span>Họ và tên</span>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Vai trò</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value, classId: '', email: '' })}
              >
                <option value="student">Học sinh</option>
                <option value="teacher">Giáo viên</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </label>

            {form.role === 'student' ? (
              <>
                <label className={styles.field}>
                  <span>Lớp</span>
                  <select
                    value={form.classId}
                    onChange={(e) => setForm({ ...form, classId: e.target.value })}
                    required
                  >
                    <option value="" disabled>-- Chọn lớp --</option>
                    {sortedGradeKeys.map((gradeKey) => (
                      <optgroup
                        key={gradeKey}
                        label={gradeKey === 'other' ? 'Chưa xếp khối' : `Khối ${gradeKey}`}
                      >
                        {classesByGrade[gradeKey].map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <p style={{ fontSize: 12, color: '#5b6b66', margin: '-6px 0 0' }}>
                  Học sinh không cần email — hệ thống tự sinh mã học sinh, đăng nhập bằng mã đó.
                </p>
              </>
            ) : (
              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </label>
            )}

            {form.role === 'teacher' && (
              <p style={{ fontSize: 12, color: '#5b6b66', margin: '-6px 0 0' }}>
                Sau khi tạo xong, kéo xuống mục "Phân công giảng dạy" ở trên để gán môn và lớp giáo viên này dạy.
              </p>
            )}

            <label className={styles.field}>
              <span>Mật khẩu</span>
              <div className={styles.passwordRow}>
                <input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className={styles.genButton}
                  onClick={() => setForm({ ...form, password: generateStrongPassword(12) })}
                >
                  Tạo mật khẩu mạnh
                </button>
              </div>
            </label>

            {createError && <p className={styles.error}>{createError}</p>}

            <button type="submit" className={styles.submit} disabled={creating}>
              {creating ? 'Đang tạo…' : 'Tạo tài khoản'}
            </button>
          </form>

          {lastCreated && (
            <div className={styles.successBox}>
              <p><strong>Đã tạo tài khoản.</strong> Lưu lại thông tin này ngay — mật khẩu sẽ không hiển thị lại được:</p>
              {lastCreated.studentCode ? (
                <>
                  <p>Đăng nhập bằng mã học sinh: <code>{lastCreated.studentCode}</code></p>
                  <p>Mật khẩu: <code>{lastCreated.password}</code></p>
                </>
              ) : (
                <>
                  <p>Email: <code>{lastCreated.email}</code></p>
                  <p>Mật khẩu: <code>{lastCreated.password}</code></p>
                </>
              )}
            </div>
          )}

          <hr className={styles.sectionDivider} />

          {/* ---------------- NHẬP DANH SÁCH HỌC SINH HÀNG LOẠT ---------------- */}
          <h2>Nhập danh sách học sinh hàng loạt</h2>
          <p style={{ fontSize: 12, color: '#5b6b66', margin: '0 0 10px' }}>
            Chọn lớp, sau đó tải thẳng file sổ điểm hoặc sổ điểm danh sẵn có của giáo viên lên (không cần điền file
            mẫu riêng). Hệ thống tự đọc cột "Mã học sinh" và "Họ và tên" trong file, dùng luôn mã học sinh có sẵn
            để tạo tài khoản.
          </p>
          <div className={styles.passwordRow} style={{ marginBottom: 10 }}>
            <select value={rosterClassId} onChange={(e) => setRosterClassId(e.target.value)}>
              <option value="">-- Chọn lớp --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label
              className={styles.genButton}
              style={{
                cursor: rosterBusy || !rosterClassId ? 'default' : 'pointer',
                textAlign: 'center',
                opacity: rosterBusy || !rosterClassId ? 0.6 : 1,
              }}
            >
              {rosterBusy ? 'Đang xử lý…' : 'Tải file danh sách lên'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleRosterUpload}
                disabled={rosterBusy || !rosterClassId}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          {rosterError && <p className={styles.error}>{rosterError}</p>}

          {rosterResults && (
            <div className={styles.successBox}>
              <p>
                <strong>
                  Đã tạo {rosterResults.filter((r) => r.success).length}/{rosterResults.length} tài khoản.
                </strong>
              </p>
              {rosterResults.map((r, i) => (
                <p key={i} style={{ margin: '4px 0' }}>
                  {r.success ? (
                    <>✅ {r.fullName} — <code>{r.studentCode}</code> / <code>{r.password}</code></>
                  ) : (
                    <span className={styles.rowError}>❌ {r.fullName || '(dòng lỗi)'}: {r.error}</span>
                  )}
                </p>
              ))}
            </div>
          )}
        </section>

        <section className={styles.listCard}>
          <div className={styles.listHeader}>
            <h2>Danh sách tài khoản</h2>
            <div className={styles.listControls}>
              <input
                className={styles.search}
                placeholder="Tìm theo tên, email, mã học sinh…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className={styles.filterTabs}>
                {['all', 'admin', 'teacher', 'student'].map((r) => (
                  <button
                    key={r}
                    className={r === roleFilter ? styles.filterActive : styles.filterTab}
                    onClick={() => setRoleFilter(r)}
                  >
                    {r === 'all' ? 'Tất cả' : ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {listError && <p className={styles.error}>{listError}</p>}

          {loadingUsers ? (
            <p className={styles.muted}>Đang tải danh sách…</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Ảnh</th>
                    <th>Họ tên</th>
                    <th>Đăng nhập bằng</th>
                    <th>Vai trò</th>
                    <th>Lớp</th>
                    <th>Hết hạn</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.photo_url ? (
                          <img
                            src={u.photo_url}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <span style={{ color: '#8aa39c', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td>{u.full_name || '—'}</td>
                      <td>{u.role === 'student' ? (u.student_code || '—') : u.email}</td>
                      <td>{ROLE_LABEL[u.role] || u.role}</td>
                      <td>{u.role === 'student' ? (classNameById[u.class_id] || '—') : '—'}</td>
                      <td>
                        {u.role === 'student' ? (
                          <span className={isExpiringSoon(u.expires_at) ? styles.expiring : ''}>
                            {formatDate(u.expires_at)}
                            {u.is_retained ? ' (đã gia hạn)' : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          {resetRowId === u.id ? (
                            <>
                              <input
                                className={styles.inlineInput}
                                placeholder="Mật khẩu mới"
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                              />
                              <button
                                className={styles.smallGen}
                                type="button"
                                onClick={() => setResetPassword(generateStrongPassword(12))}
                              >
                                Sinh
                              </button>
                              <button
                                className={styles.smallConfirm}
                                onClick={() => submitReset(u)}
                                disabled={rowBusyId === u.id || !resetPassword}
                              >
                                Lưu
                              </button>
                              <button className={styles.smallCancel} onClick={() => setResetRowId(null)}>
                                Huỷ
                              </button>
                            </>
                          ) : (
                            <>
                              <button className={styles.linkBtn} onClick={() => openReset(u)}>
                                Đặt lại mật khẩu
                              </button>
                              {u.role === 'student' && (
                                <button
                                  className={styles.linkBtn}
                                  onClick={() => handleExtend(u)}
                                  disabled={rowBusyId === u.id}
                                >
                                  Gia hạn 1 năm
                                </button>
                              )}
                              <button
                                className={styles.dangerBtn}
                                onClick={() => handleDelete(u)}
                                disabled={rowBusyId === u.id}
                              >
                                Xoá
                              </button>
                            </>
                          )}
                        </div>
                        {rowMsg.id === u.id && (
                          <p className={rowMsg.isError ? styles.rowError : styles.rowOk}>{rowMsg.text}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.muted}>
                        Không có tài khoản nào khớp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
