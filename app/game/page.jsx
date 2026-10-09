'use client';
// GAME (tách riêng): trang /game. Bấm vào là tự toàn màn hình + xoay ngang, vào làng quê chung, nhà riêng trên mảnh đất ngẫu nhiên.
// Xóa thư mục app/game khi gỡ game.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import CharacterCreator from '../../components/game/CharacterCreator';
import HouseView from '../../components/game/HouseView';
import CourtyardView from '../../components/game/CourtyardView';
import GateView from '../../components/game/GateView';
import WorldView from '../../components/game/WorldView';
import './game.css';
import './world.css';

function one(data) {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === 'object' ? row : null;
}
function unwrap(data, key) {
  const row = one(data);
  if (!row) return null;
  const v = key in row && Object.keys(row).length <= 3 ? row[key] : row;
  return v && typeof v === 'object' && Object.keys(v).length ? v : null;
}
function readLand(data) {
  let row = one(data);
  if (row && row.game_join_world) row = row.game_join_world;
  if (row && row.game_upgrade_house) row = row.game_upgrade_house;
  if (row && row.game_set_nick) row = row.game_set_nick;
  if (row && row.game_move_home) row = row.game_move_home;
  if (!row || !Number.isInteger(row.plot)) return null;
  return { shard: row.shard, plot: row.plot, level: row.level || 0, nick: row.nick || '' };
}

const SCENES = ['world', 'house', 'gate', 'yard'];

export default function GamePage() {
  const router = useRouter();
  const rootRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState('loading'); // loading | create | nick | world | house | gate | yard | error
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [nickDefault, setNickDefault] = useState('');
  const [cfg, setCfg] = useState(null);
  const [house, setHouse] = useState(null);
  const [land, setLand] = useState(null);
  const [viewShard, setViewShard] = useState(null);
  const [from, setFrom] = useState('house');
  const [schoolZone, setSchoolZone] = useState(null);   // khu vực đang đứng ở cổng trường
  const [schoolFrom, setSchoolFrom] = useState('village'); // 'village' (từ cầu đi lên) | 'yard' (từ sân trường ra)
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [errText, setErrText] = useState('');
  const [fs, setFs] = useState(false);
  const [rot, setRot] = useState(false);
  const [nick, setNick] = useState('');
  const [dim, setDim] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const upd = () => setDim({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener('resize', upd);
    window.addEventListener('orientationchange', upd);
    return () => { window.removeEventListener('resize', upd); window.removeEventListener('orientationchange', upd); };
  }, []);

  // điện thoại đang cầm dọc thì xoay giao diện game thành ngang (khi máy không tự khóa ngang được, ví dụ iPhone)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 900px)');
    const upd = () => setRot(mq.matches);
    upd();
    if (mq.addEventListener) mq.addEventListener('change', upd); else mq.addListener(upd);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', upd); else mq.removeListener(upd); };
  }, []);

  useEffect(() => {
    const onFs = () => setFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
    };
  }, []);

  const enterFull = useCallback(async () => {
    const el = rootRef.current;
    const req = el && (el.requestFullscreen || el.webkitRequestFullscreen);
    if (req) {
      try { await req.call(el, { navigationUI: 'hide' }); } catch (e) { /* iPhone không hỗ trợ: dùng chế độ phủ kín trang */ }
    }
    try { await window.screen.orientation?.lock?.('landscape'); } catch (e) { /* không khóa được thì dùng xoay giao diện */ }
  }, []);

  const toggleFull = useCallback(async () => {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) { /* bỏ qua */ }
      try { window.screen.orientation?.unlock?.(); } catch (e) { /* bỏ qua */ }
    } else enterFull();
  }, [enterFull]);

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

  // tải dữ liệu
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const u = userRes?.user;
      if (!u) { router.push('/login'); return; }
      if (!alive) return;
      setUserId(u.id);
      const md = u.user_metadata || {};
      setNickDefault(String(md.full_name || md.name || '').trim().slice(0, 18));
      const { data: c, error } = await supabase.rpc('game_get_character');
      if (!alive) return;
      if (error) { setErrText('Game chưa sẵn sàng. Nhờ thầy cô kiểm tra file SQL của game.'); setPhase('error'); setReady(true); return; }
      const saved = unwrap(c, 'cfg');
      const { data: h } = await supabase.rpc('game_get_house');
      if (!alive) return;
      setHouse(unwrap(h, 'state'));
      setCfg(saved);
      const { data: l, error: le } = await supabase.rpc('game_join_world', { p_nick: null });
      if (!alive) return;
      const ld = le ? null : readLand(l);
      if (!ld) { setErrText('Chưa có khu đất để chia. Nhờ thầy cô chạy file game_nong_thon.sql trong Supabase.'); setPhase('error'); setReady(true); return; }
      setLand(ld);
      setViewShard(ld.shard);
      setPhase(!saved ? 'create' : !ld.nick ? 'nick' : 'world');
      setReady(true);
    })();
    return () => { alive = false; };
  }, [router]);

  async function saveCharacter(next) {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc('game_save_character', { p_cfg: next });
    setSaving(false);
    if (error) { setMessage({ type: 'err', text: 'Lưu chưa được, em thử lại nhé.' }); return; }
    setCfg(next);
    setPhase(land && land.nick ? 'world' : 'nick');
  }

  async function saveHouse(state) {
    const { error } = await supabase.rpc('game_save_house', { p_state: state });
    return !error;
  }

  async function saveNick() {
    const v = (nick || nickDefault).trim().slice(0, 18);
    if (v.length < 2) { setMessage({ type: 'err', text: 'Tên cần ít nhất 2 chữ cái.' }); return; }
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('game_set_nick', { p_nick: v });
    setSaving(false);
    const ld = error ? null : readLand(data);
    if (!ld) { setMessage({ type: 'err', text: 'Lưu tên chưa được, em thử lại nhé.' }); return; }
    setLand(ld);
    setPhase('world');
  }

  async function upgradeHouse() {
    const { data, error } = await supabase.rpc('game_upgrade_house');
    const ld = error ? null : readLand(data);
    if (!ld) return false;
    setLand(ld);
    return true;
  }

  async function moveHome(shard) {
    const { data, error } = await supabase.rpc('game_move_home', { p_shard: shard });
    const ld = error ? null : readLand(data);
    if (!ld) return false;
    setLand(ld);
    setFrom('house');
    setViewShard(ld.shard);
    return true;
  }

  async function start() {
    setStarted(true);
    await enterFull();
  }

  const inScene = started && SCENES.includes(phase);
  const title = phase === 'create' ? 'TẠO NHÂN VẬT' : phase === 'nick' ? 'ĐẶT TÊN' : 'LÀNG QUÊ';
  const goCreate = () => { setMessage(null); setPhase('create'); };

  return (
    <div className="gm-root" ref={rootRef} data-play={started ? '1' : undefined} data-wide={inScene ? '1' : undefined} data-rot={started && rot ? '1' : undefined}
      style={dim.w ? { '--gw': `${started && rot ? dim.h : dim.w}px`, '--gh': `${started && rot ? dim.w : dim.h}px` } : undefined}
    >
      {!started && (
        <div className="gw-start">
          <div className="gw-start-card">
            <div className="gw-start-t">LÀNG QUÊ BIỂN BẠCH</div>
            <div className="gw-start-s">Chạm để vào game. Điện thoại sẽ tự phóng to toàn màn hình và xoay ngang.</div>
            <button type="button" className="gm-btn main big" onClick={start}>{ready ? 'Chạm để vào game' : 'Chạm để vào game (đang tải…)'}</button>
            <Link href="/student" className="gm-back" style={{ display: 'inline-block', marginTop: 14 }}>← Về trang học sinh</Link>
          </div>
        </div>
      )}

      {started && (
        <>
          <div className="gm-top">
            <Link href="/student" className="gm-back">← Về trang học sinh</Link>
            {!inScene && <div className="gm-title">{title}</div>}
            <button type="button" className="gm-fs" onClick={toggleFull}>{fs ? 'Thoát toàn màn hình' : '⛶ Toàn màn hình'}</button>
          </div>
          {!ready && <div className="gm-center">Đang tải…</div>}
          {ready && phase === 'error' && <div className="gm-center">{errText}</div>}
          {ready && phase === 'create' && (
            <CharacterCreator
              initial={cfg}
              saving={saving}
              message={message}
              onSave={saveCharacter}
              onCancel={cfg ? () => { setMessage(null); setPhase('world'); } : null}
            />
          )}
          {ready && phase === 'nick' && (
            <div className="gm-done">
              <div className="gm-panel">
                <div className="gm-lbl">Tên hiển thị trong làng</div>
                <input
                  className="gw-input"
                  value={nick || nickDefault}
                  onChange={(e) => setNick(e.target.value)}
                  maxLength={18}
                  placeholder="Ví dụ: Minh Anh"
                  aria-label="Tên hiển thị"
                />
                <div className="gm-hint">Mọi người trong làng sẽ thấy tên này trên đầu nhân vật. Hãy dùng tên lịch sự nhé.</div>
                {message && <div className={`gm-msg ${message.type}`}>{message.text}</div>}
                <div className="gm-actions">
                  <button
                    type="button"
                    className="gm-btn main"
                    disabled={saving}
                    onClick={saveNick}
                  >
                    {saving ? 'Đang lưu…' : 'Vào làng'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {ready && phase === 'world' && land && cfg && (
            <WorldView
              key={`w-${viewShard || land.shard}`}
              cfg={cfg}
              land={land}
              viewShard={viewShard || land.shard}
              userId={userId}
              from={from}
              onVisit={(sh) => { setFrom('visit'); setViewShard(sh); }}
              onMoveHome={moveHome}
              onEnterHouse={() => setPhase('house')}
              onEditCharacter={goCreate}
              onGoSchool={() => { setSchoolFrom('village'); setSchoolZone(viewShard || land.shard); setPhase('gate'); }}
              onUpgrade={upgradeHouse}
            />
          )}
          {ready && phase === 'house' && cfg && (
            <HouseView
              cfg={cfg}
              initialHouse={house}
              onSaveHouse={saveHouse}
              onEditCharacter={goCreate}
              onExit={() => { setFrom('house'); setViewShard(land.shard); setPhase('world'); }}
            />
          )}
          {ready && phase === 'gate' && cfg && land && schoolZone && (
            <GateView
              key={`g-${schoolZone}`}
              cfg={cfg}
              nick={land.nick}
              userId={userId}
              zone={schoolZone}
              homeZone={land.shard}
              from={schoolFrom}
              onBackHome={() => { setFrom('school'); setViewShard(schoolZone); setPhase('world'); }}
              onEnterYard={() => setPhase('yard')}
              onEditCharacter={goCreate}
              onChangeZone={(z) => setSchoolZone(z)}
            />
          )}
          {ready && phase === 'yard' && cfg && land && schoolZone && (
            <CourtyardView
              key={`y-${schoolZone}`}
              cfg={cfg}
              nick={land.nick}
              userId={userId}
              zone={schoolZone}
              homeZone={land.shard}
              onBack={() => { setSchoolFrom('yard'); setPhase('gate'); }}
              onEditCharacter={goCreate}
              onChangeZone={(z) => setSchoolZone(z)}
            />
          )}
        </>
      )}
    </div>
  );
}
