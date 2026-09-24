'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// Form doi mat khau cho nguoi dung dang dang nhap (hoc sinh dung la chinh).
// Viec kiem tra mat khau hien tai + doi mat khau lam o server
// (/api/account/change-password), khong lam tren trinh duyet.

const MIN_LENGTH = 8

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const tooShort = next.length > 0 && next.length < MIN_LENGTH
  const sameAsOld = next.length > 0 && next === current
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit =
    !busy && current && next.length >= MIN_LENGTH && next === confirm && next !== current

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError('')
    setSuccess(false)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.')

      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Không đổi được mật khẩu, hãy thử lại.')

      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const inputType = show ? 'text' : 'password'

  return (
    <form onSubmit={handleSubmit} style={card}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Đổi mật khẩu</h2>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6b7280' }}>
        Nên đổi mật khẩu do nhà trường cấp thành mật khẩu của riêng em, và không chia sẻ cho bạn khác.
      </p>

      <label htmlFor="cp-current" style={label}>Mật khẩu hiện tại</label>
      <input
        id="cp-current"
        type={inputType}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        required
        style={input}
      />

      <label htmlFor="cp-new" style={label}>Mật khẩu mới</label>
      <input
        id="cp-new"
        type={inputType}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        required
        minLength={MIN_LENGTH}
        style={input}
      />
      <p style={hint(tooShort || sameAsOld)}>
        {sameAsOld
          ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
          : `Ít nhất ${MIN_LENGTH} ký tự.`}
      </p>

      <label htmlFor="cp-confirm" style={label}>Nhập lại mật khẩu mới</label>
      <input
        id="cp-confirm"
        type={inputType}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        required
        style={input}
      />
      {mismatch && <p style={hint(true)}>Hai mật khẩu chưa giống nhau.</p>}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '14px 0' }}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Hiện mật khẩu
      </label>

      {error && (
        <p role="alert" style={{ ...banner, background: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' }}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" style={{ ...banner, background: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' }}>
          Đã đổi mật khẩu. Lần đăng nhập sau hãy dùng mật khẩu mới.
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          width: '100%',
          padding: '11px 14px',
          border: 'none',
          borderRadius: 8,
          background: canSubmit ? '#2563eb' : '#9CB4F0',
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
      </button>
    </form>
  )
}

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 24,
  maxWidth: 420,
  width: '100%',
  boxSizing: 'border-box',
}

const label = { display: 'block', fontSize: 13, fontWeight: 600, margin: '12px 0 6px', color: '#374151' }

const input = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 15,
}

const hint = (isError) => ({
  margin: '4px 0 0',
  fontSize: 12,
  color: isError ? '#B91C1C' : '#6b7280',
})

const banner = {
  margin: '0 0 14px',
  padding: '10px 12px',
  border: '1px solid',
  borderRadius: 8,
  fontSize: 13,
}
