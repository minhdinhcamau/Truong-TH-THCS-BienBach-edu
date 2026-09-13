'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { studentCodeToEmail, looksLikeStudentCode } from '../../lib/generateStudentCode'
import styles from './login.module.css'

// Trang dang nhap: chap nhan CA email that (giao vien/quan tri) LAN ma hoc
// sinh (HS26xxxx). Neu chuoi go vao dung dang ma hoc sinh, tu quy doi sang
// email noi bo truoc khi goi Supabase Auth - hoc sinh khong bao gio can
// biet den email that phia sau.
export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    const trimmed = identifier.trim()
    const email = looksLikeStudentCode(trimmed) ? studentCodeToEmail(trimmed) : trimmed

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMsg('Tài khoản hoặc mật khẩu không đúng.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    setLoading(false)

    if (profileError || !profile) {
      setErrorMsg('Không tìm thấy hồ sơ tài khoản. Liên hệ quản trị viên.')
      return
    }

    if (profile.role === 'admin') router.push('/admin')
    else if (profile.role === 'teacher') router.push('/teacher')
    else router.push('/student')
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Đăng nhập</h1>
        <p className={styles.subtitle}>
          Học sinh dùng mã học sinh (VD: HS260001). Giáo viên / quản trị viên dùng email.
        </p>

        <label className={styles.field}>
          <span>Email hoặc mã học sinh</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus
            autoCapitalize="none"
          />
        </label>

        <label className={styles.field}>
          <span>Mật khẩu</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {errorMsg && <p className={styles.error}>{errorMsg}</p>}

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>

        <p className={styles.hint}>Chưa có tài khoản? Liên hệ quản trị viên nhà trường.</p>
      </form>
    </div>
  )
}
