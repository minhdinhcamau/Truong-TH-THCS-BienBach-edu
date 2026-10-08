'use client';
// GAME (tách riêng): trang /game. Tạo nhân vật lần đầu, sau đó vào nhà. Xóa thư mục app/game khi gỡ game.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import CharacterCreator from '../../components/game/CharacterCreator';
import HouseView from '../../components/game/HouseView';
import YardView from '../../components/game/YardView';
import GateView from '../../components/game/GateView';
import './game.css';

function unwrap(data, key) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const v = key in row && Object.keys(row).length <= 3 ? row[key] : row;
  return v && typeof v === 'object' && Object.keys(v).length ? v : null;
}

const SCENES = ['house', 'yard', 'gate'];

export default function GamePage() {
  const router = useRouter();
  const [phase, setPhase] = useState('loading'); // loading | create | house | yard | gate | error
  const [cfg, setCfg] = useState(null);
  const [house, setHouse] = useState(null);
  const [yardFrom, setYardFrom] = useState('house'); // house | school: nơi nhân vật đến sân
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const rootRef = useRef(null);
  const [fsMode, setFsMode] = useState('off'); // off | real (toàn màn hình thật) | pseudo (phóng kín trang, cho iPhone)
  const [landscapePhone, setLandscapePhone] = useState(false);
  const [portraitPhone, setPortraitPhone] = useState(false);
  const [hintOff, setHintOff] = useState(false);

  // điện thoại xoay ngang / xoay dọc
  useEffect(() => {
    const mqL = window.matchMedia('(orientation: landscape) and (max-height: 560px)');
    const mqP = window.matchMedia('(orientation: portrait) and (max-width: 700px)');
    const upd = () => { setLandscapePhone(mqL.matches); setPortraitPhone(mqP.matches); };
    upd();
    const sub = (mq) => (mq.addEventListener ? mq.addEventListener('change', upd) : mq.addListener(upd));
    const unsub = (mq) => (mq.removeEventListener ? mq.removeEventListener('change', upd) : mq.removeListener(upd));
    sub(mqL);
    sub(mqP);
    return () => { unsub(mqL); unsub(mqP); };
  }, []);

  // thoát toàn màn hình bằng phím Esc thì cập nhật lại trạng thái
  useEffect(() => {
    const onFs = () => {
      const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!fs) setFsMode((m) => (m === 'real' ? 'off' : m));
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
    };
  }, []);

  const toggleFull = useCallback(async () => {
    if (fsMode !== 'off') {
      const d = document;
      if (d.fullscreenElement || d.webkitFullscreenElement) {
        try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) { /* bỏ qua */ }
      }
      try { window.screen.orientation?.unlock?.(); } catch (e) { /* bỏ qua */ }
      setFsMode('off');
      return;
    }
    const el = rootRef.current;
    const req = el && (el.requestFullscreen || el.webkitRequestFullscreen);
    if (req) {
      try {
        await req.call(el);
        setFsMode('real');
        try { await window.screen.orientation?.lock?.('landscape'); } catch (e) { /* máy tính hoặc iPhone không khóa được */ }
        return;
      } catch (e) { /* rơi xuống chế độ phóng kín trang */ }
    }
    setFsMode('pseudo');
  }, [fsMode]);

  // phím F: bật/tắt toàn màn hình
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'f' || e.key === 'F') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (SCENES.includes(phase)) toggleFull();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFull, phase]);

  const inScene = SCENES.includes(phase);
  const wide = inScene && (fsMode !== 'off' || landscapePhone);

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

  const title = phase === 'house' ? 'NHÀ CỦA EM' : phase === 'yard' ? 'SÂN NHÀ EM' : phase === 'gate' ? 'TRƯỚC CỔNG TRƯỜNG' : 'TẠO NHÂN VẬT';
  return (
    <div className="gm-root" ref={rootRef} data-fs={fsMode} data-wide={wide ? '1' : undefined}>
      <div className="gm-top">
        <Link href="/student" className="gm-back">← Về trang học sinh</Link>
        <div className="gm-title">{title}</div>
        <button type="button" className="gm-fs" onClick={toggleFull}>{fsMode !== 'off' ? 'Thoát toàn màn hình' : '⛶ Toàn màn hình'}</button>
      </div>
      {portraitPhone && inScene && !hintOff && fsMode === 'off' && (
        <div className="gm-rotate">
          <span>📱 Xoay ngang điện thoại để chơi cho rộng nhé.</span>
          <button type="button" onClick={() => setHintOff(true)}>Đóng</button>
        </div>
      )}
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
        <HouseView cfg={cfg} initialHouse={house} onSaveHouse={saveHouse} onEditCharacter={() => { setMessage(null); setPhase('create'); }} onExit={() => { setYardFrom('house'); setPhase('yard'); }} />
      )}
      {phase === 'yard' && (
        <YardView cfg={cfg} from={yardFrom} onEnterHouse={() => setPhase('house')} onGoSchool={() => setPhase('gate')} onEditCharacter={() => { setMessage(null); setPhase('create'); }} />
      )}
      {phase === 'gate' && (
        <GateView cfg={cfg} onBackHome={() => { setYardFrom('school'); setPhase('yard'); }} onEditCharacter={() => { setMessage(null); setPhase('create'); }} />
      )}
    </div>
  );
}
