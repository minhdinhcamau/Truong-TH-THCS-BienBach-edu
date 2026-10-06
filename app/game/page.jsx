'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import CharacterCreator from '@/components/game/CharacterCreator'

export default function GamePage() {
  const [state, setState] = useState('loading') // loading | noauth | ready
  const [cfg, setCfg] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!alive) return
      if (!data?.user) { setState('noauth'); return }
      const res = await supabase.rpc('game_get_character')
      if (!alive) return
      setCfg(res.data && Object.keys(res.data).length ? res.data : null)
      setState('ready')
    })()
    return () => { alive = false }
  }, [])

  async function save(next) {
    const { error } = await supabase.rpc('game_save_character', { p_cfg: next })
    if (error) throw error
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f4f8fc' }}>
      <div style={{ padding: '12px 16px' }}>
        <Link href="/student" style={{ color: '#1a6fd4', fontSize: 14 }}>← Về trang học sinh</Link>
      </div>
      {state === 'loading' && <p style={{ textAlign: 'center' }}>Đang tải...</p>}
      {state === 'noauth' && <p style={{ textAlign: 'center' }}>Hãy đăng nhập vào web trước rồi mở lại trang này.</p>}
      {state === 'ready' && <CharacterCreator initial={cfg} onSave={save} />}
    </main>
  )
}
