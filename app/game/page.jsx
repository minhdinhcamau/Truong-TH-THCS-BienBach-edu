'use client';
// GAME (tách riêng): trang /game. Tạo nhân vật lần đầu, sau đó vào nhà. Xóa thư mục app/game khi gỡ game.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import CharacterCreator from '../../components/game/CharacterCreator';
import HouseView from '../../components/game/HouseView';
import './game.css';

function unwrap(data, key) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const v = key in row && Object.keys(row).length <= 3 ? row[key] : row;
  return v && typeof v === 'object' && Object.keys(v).length ? v : null;
}

export default function GamePage() {
  const router = useRouter();
  const [phase, setPhase] = useState('loading'); // loading | create | house | error
  const [cfg, setCfg] = useState(null);
  const [house, setHouse] = useState(null);
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
      const { data: c, error } = await supabase.rpc('game_get_character');
      if (!alive) return;
      if (error) {
        setPhase('error');
        return;
      }
      const saved = unwrap(c, 'cfg');
      // nhà: nếu chưa chạy SQL gói G2 thì dùng nhà mặc định, nút lưu sẽ báo chưa lưu được
      const { data: h } = await supabase.rpc('game_get_house');
      if (!alive) return;
      setHouse(unwrap(h, 'state'));
      setCfg(saved);
      setPhase(saved ? 'house' : 'create');
    })();
    return () => { alive = false; };
  }, [router]);

  async function saveCharacter(next) {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc('game_save_character', { p_cfg: next });
    setSaving(false);
    if (error) {
      setMessage({ type: 'err', text: 'Lưu chưa được, em thử lại nhé.' });
      return;
    }
    setCfg(next);
    setPhase('house');
  }

  async function saveHouse(state) {
    const { error } = await supabase.rpc('game_save_house', { p_state: state });
    return !error;
  }

  const title = phase === 'house' ? 'NHÀ CỦA EM' : 'TẠO NHÂN VẬT';
  return (
    <div className="gm-root">
      <div className="gm-top">
        <Link href="/student" className="gm-back">← Về trang học sinh</Link>
        <div className="gm-title">{title}</div>
      </div>
      {phase === 'loading' && <div className="gm-center">Đang tải…</div>}
      {phase === 'error' && <div className="gm-center">Game chưa sẵn sàng. Nhờ thầy cô kiểm tra file SQL của game.</div>}
      {phase === 'create' && (
        <CharacterCreator
          initial={cfg}
          saving={saving}
          message={message}
          onSave={saveCharacter}
          onCancel={cfg ? () => { setMessage(null); setPhase('house'); } : null}
        />
      )}
      {phase === 'house' && (
        <HouseView cfg={cfg} initialHouse={house} onSaveHouse={saveHouse} onEditCharacter={() => { setMessage(null); setPhase('create'); }} />
      )}
    </div>
  );
}
