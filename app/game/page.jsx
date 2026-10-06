'use client';
// GAME (tách riêng): trang /game. Xóa thư mục app/game khi gỡ game.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import CharacterCreator from '../../components/game/CharacterCreator';
import './game.css';

export default function GamePage() {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, cfg: null, error: null });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user) {
        router.push('/login');
        return;
      }
      const { data, error } = await supabase.rpc('game_get_character');
      if (!alive) return;
      if (error) {
        setState({ loading: false, cfg: null, error: 'Chưa tải được nhân vật. Thầy cô kiểm tra đã chạy file SQL của game chưa.' });
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      const cfg = row && typeof row === 'object' ? (row.cfg ?? row) : null;
      setState({ loading: false, cfg: cfg && Object.keys(cfg).length ? cfg : null, error: null });
    })();
    return () => { alive = false; };
  }, [router]);

  async function save(cfg) {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc('game_save_character', { p_cfg: cfg });
    setSaving(false);
    setMessage(error ? { type: 'err', text: 'Lưu chưa được, em thử lại nhé.' } : { type: 'ok', text: 'Đã lưu nhân vật của em.' });
  }

  return (
    <div className="gm-root">
      <div className="gm-top">
        <Link href="/student" className="gm-back">← Về trang học sinh</Link>
        <div className="gm-title">TẠO NHÂN VẬT</div>
      </div>
      {state.loading && <div className="gm-center">Đang tải…</div>}
      {!state.loading && state.error && <div className="gm-center">{state.error}</div>}
      {!state.loading && !state.error && (
        <CharacterCreator initial={state.cfg} saving={saving} message={message} onSave={save} />
      )}
    </div>
  );
}
