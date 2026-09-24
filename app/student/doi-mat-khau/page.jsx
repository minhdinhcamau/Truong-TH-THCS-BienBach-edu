'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ChangePasswordForm from '@/components/ChangePasswordForm'

// Trang /student/doi-mat-khau - hoc sinh tu doi mat khau.
export default function StudentChangePasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else setReady(true)
    })
  }, [router])

  if (!ready) return <p style={{ padding: 24 }}>Đang tải…</p>

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <Link href="/student" style={{ fontSize: 14, color: '#2563eb', textDecoration: 'none' }}>
        ← Quay lại trang học sinh
      </Link>
      <div style={{ marginTop: 16 }}>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
