'use client';
// GAME (tách riêng): map NÔNG THÔN dùng chung. Nhiều người chơi cùng thấy nhau (Supabase Realtime),
// có ngày đêm (12 phút sáng, 12 phút tối), mưa ngẫu nhiên, nhà lá sáng đèn dầu ban đêm, chỗ nâng cấp nhà.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { buildFrames } from '../../lib/game/sprites';
import { clockLabel, dayTime, isNight, nightLevel, rainLevel } from '../../lib/game/clock';
import {
  CHAR_H, LEVELS, MAX_LEVEL, SCHOOL_SIGN, SPEED, VIEW_W, WORLD_BG, WH, WW,
  houseGeom, nearestFree, signPos, worldBlocked,
} from '../../lib/game/world';

const STRIDE = 12;
const BOB = [-1, 0, -1, 0];
const STICK_DEAD = 0.16;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

function useImage(src) {
  const ref = useRef(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => { ref.current = img; };
    img.src = src;
  }, [src]);
  return ref;
}

export default function WorldView({ cfg, land, userId, from, onEnterHouse, onEditCharacter, onGoSchool, onUpgrade }) {
  const canvasRef = useRef(null);
  const viewRef = useRef(null);
  const stickRef = useRef(null);
  const knobRef = useRef(null);
  const [near, setNear] = useState(null);
  const [toast, setToast] = useState(null);
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hud, setHud] = useState({ time: '', night: false, rain: false, online: 1 });
  const [houses, setHouses] = useState([{ plot: land.plot, level: land.level, nick: land.nick }]);
  const bg = useImage(WORLD_BG);
  const imgs = [useImage(LEVELS[0].img), useImage(LEVELS[1].img), useImage(LEVELS[2].img)];

  const S = useRef({
    pos: null, vel: { x: 0, y: 0 }, keys: new Set(), stick: { x: 0, y: 0 }, stickId: null,
    facing: 1, dir: 'front', phase: 0, frame: 0, clock: 0, nextBlink: 2, blinkUntil: 0,
    cam: null, z: 1, dpr: 1, cw: 0, ch: 0, lc: null, drops: [], parts: [],
    remotes: new Map(), ch2: null, ready: false, sendT: 0, idleT: 0, lastSent: '', frames: null,
    nearId: null, houses: [], panel: null,
  }).current;
  S.houses = houses.map((h) => (h.plot === land.plot ? { ...h, level: land.level, nick: land.nick } : h));
  S.panel = panel;
  S.land = land;
  S.cfgK = cfg;

  const say = useCallback((text) => setToast({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // vị trí xuất hiện: về từ nhà thì đứng trước cửa, từ trường thì ở biển chỉ đường
  if (!S.pos) {
    const g = houseGeom(land.plot, land.level);
    const base = from === 'school' ? { x: SCHOOL_SIGN.x - 18, y: SCHOOL_SIGN.y + 10 } : { x: g.door.x, y: g.door.y + 14 };
    S.pos = nearestFree(base.x, base.y, []);
    S.dir = from === 'school' ? 'side' : 'front';
  }

  useEffect(() => { S.frames = buildFrames(cfg); }, [cfg, S]);

  // ----- danh sách nhà của cả khu -----
  const refreshHouses = useCallback(async () => {
    const { data } = await supabase.rpc('game_world_state', { p_shard: land.shard });
    if (Array.isArray(data)) {
      const list = data.filter((r) => r && Number.isInteger(r.plot)).map((r) => ({ plot: r.plot, level: r.level || 0, nick: r.nick || 'Bạn nhỏ' }));
      if (!list.some((h) => h.plot === land.plot)) list.push({ plot: land.plot, level: land.level, nick: land.nick });
      setHouses(list);
    }
  }, [land.shard, land.plot, land.level, land.nick]);

  useEffect(() => {
    refreshHouses();
    const t = setInterval(refreshHouses, 25000);
    return () => clearInterval(t);
  }, [refreshHouses]);

  // ----- trực tuyến: thấy nhau trong cùng khu -----
  useEffect(() => {
    const ch = supabase.channel(`bb-nongthon-${land.shard}`, { config: { presence: { key: userId }, broadcast: { self: false } } });
    S.ch2 = ch;
    let timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(refreshHouses, 1200); };
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState();
      const seen = new Set();
      for (const key of Object.keys(st)) {
        if (key === userId) continue;
        const m = st[key] && st[key][0];
        if (!m) continue;
        seen.add(key);
        let r = S.remotes.get(key);
        if (!r) {
          r = { x: m.x ?? 0, y: m.y ?? 0, tx: m.x ?? 0, ty: m.y ?? 0, dir: 'front', facing: 1, moving: false, phase: 0, frame: 0, frames: null, cfgKey: '' };
          S.remotes.set(key, r);
        }
        r.nick = m.n || 'Bạn nhỏ';
        const ck = JSON.stringify(m.c || {});
        if (ck !== r.cfgKey) { r.cfgKey = ck; try { r.frames = buildFrames(m.c); } catch (e) { r.frames = null; } }
      }
      for (const k of [...S.remotes.keys()]) if (!seen.has(k)) S.remotes.delete(k);
      setHud((h) => ({ ...h, online: seen.size + 1 }));
      soon();
    });
    ch.on('broadcast', { event: 'pos' }, ({ payload: p }) => {
      const r = p && S.remotes.get(p.u);
      if (!r) return;
      r.tx = p.x; r.ty = p.y; r.dir = p.d || 'front'; r.facing = p.f || 1; r.moving = !!p.m;
    });
    ch.on('broadcast', { event: 'upgrade' }, soon);
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        S.ready = true;
        try { await ch.track({ n: land.nick, c: cfg, p: land.plot, x: Math.round(S.pos.x), y: Math.round(S.pos.y) }); } catch (e) { /* bỏ qua */ }
      }
    });
    return () => {
      clearTimeout(timer);
      S.ready = false;
      S.ch2 = null;
      S.remotes.clear();
      supabase.removeChannel(ch);
    };
  }, [land.shard, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- tương tác -----
  const findNear = useCallback(() => {
    const p = S.pos;
    const own = S.houses.find((h) => h.plot === S.land.plot);
    if (own) {
      const g = houseGeom(own.plot, own.level);
      if (dist(p, g.door) < 30) return { id: 'cua', label: 'Vào nhà' };
      if (dist(p, signPos(own.plot)) < 28) return { id: 'nang_cap', label: own.level < MAX_LEVEL ? 'Nâng cấp nhà' : 'Xem nhà của em' };
    }
    if (dist(p, SCHOOL_SIGN) < 40) return { id: 'truong', label: 'Đi tới trường' };
    for (const h of S.houses) {
      if (h.plot === S.land.plot) continue;
      if (dist(p, houseGeom(h.plot, h.level).door) < 30) return { id: 'nha_khac', label: `Nhà của ${h.nick}`, nick: h.nick };
    }
    return null;
  }, [S]);

  const interact = useCallback(() => {
    const it = findNear();
    if (!it) return;
    if (it.id === 'cua') onEnterHouse();
    else if (it.id === 'nang_cap') { S.keys.clear(); S.stick = { x: 0, y: 0 }; setPanel('upgrade'); }
    else if (it.id === 'truong') onGoSchool && onGoSchool();
    else say(`Đây là nhà của ${it.nick}. Nhà riêng nên em chưa vào được, chào hàng xóm nhé!`);
  }, [findNear, onEnterHouse, onGoSchool, say, S]);

  async function doUpgrade() {
    setBusy(true);
    const ok = await onUpgrade();
    setBusy(false);
    if (ok) {
      setPanel(null);
      say('Nhà em đã được nâng cấp!');
      try { S.ch2 && S.ch2.send({ type: 'broadcast', event: 'upgrade', payload: { u: userId } }); } catch (e) { /* bỏ qua */ }
    } else say('Nâng cấp chưa được, em thử lại nhé.');
  }

  // ----- bàn phím -----
  useEffect(() => {
    const map = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
    const down = (e) => {
      if (e.key === 'Escape') { setPanel(null); return; }
      if (S.panel) return;
      const k = map[e.key];
      if (k) { S.keys.add(k); e.preventDefault(); }
      else if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && !e.repeat) interact();
    };
    const up = (e) => { const k = map[e.key]; if (k) S.keys.delete(k); };
    const blur = () => S.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [S, interact]);

  // ----- kích thước canvas phủ kín -----
  useEffect(() => {
    const view = viewRef.current;
    const canvas = canvasRef.current;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = view.clientWidth;
      const ch = view.clientHeight;
      if (!cw || !ch) return;
      S.dpr = dpr; S.cw = cw; S.ch = ch;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      S.z = Math.max(cw / VIEW_W, cw / WW, ch / WH);
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(view);
    window.addEventListener('resize', fit);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [S]);

  // ----- vòng lặp -----
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let last = performance.now();
    let hudT = 0;

    function moveAxis(axis, d) {
      if (d === 0) return;
      const nx = axis === 'x' ? S.pos.x + d : S.pos.x;
      const ny = axis === 'y' ? S.pos.y + d : S.pos.y;
      if (!worldBlocked(nx, ny, S.houses)) { S.pos.x = nx; S.pos.y = ny; return; }
      for (let off = 1; off <= 7; off++) {
        for (const sign of [1, -1]) {
          const tx = axis === 'x' ? nx : nx + sign * off;
          const ty = axis === 'x' ? ny + sign * off : ny;
          if (!worldBlocked(tx, ty, S.houses)) {
            const step = Math.min(off, 1.1);
            if (axis === 'x') S.pos.y += sign * step; else S.pos.x += sign * step;
            return;
          }
        }
      }
      if (axis === 'x') S.vel.x = 0; else S.vel.y = 0;
    }

    function update(dt) {
      S.clock += dt;
      for (const p of S.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 24 * dt; }
      S.parts = S.parts.filter((p) => p.life < p.max);

      const locked = !!S.panel;
      let ix = locked ? 0 : (S.keys.has('r') ? 1 : 0) - (S.keys.has('l') ? 1 : 0) + S.stick.x;
      let iy = locked ? 0 : (S.keys.has('d') ? 1 : 0) - (S.keys.has('u') ? 1 : 0) + S.stick.y;
      const il = Math.hypot(ix, iy);
      if (il > 1) { ix /= il; iy /= il; }
      const has = il > 0.05;
      const k = 1 - Math.exp(-dt * (has ? 15 : 24));
      S.vel.x += (ix * SPEED - S.vel.x) * k;
      S.vel.y += (iy * SPEED - S.vel.y) * k;
      if (!has && Math.hypot(S.vel.x, S.vel.y) < 4) { S.vel.x = 0; S.vel.y = 0; }
      moveAxis('x', S.vel.x * dt);
      moveAxis('y', S.vel.y * dt);
      const speed = Math.hypot(S.vel.x, S.vel.y);
      const moving = speed > 8;
      if (has) {
        if (Math.abs(ix) > 0.2) S.facing = ix > 0 ? 1 : -1;
        if (Math.abs(ix) > 0.2 && Math.abs(ix) >= Math.abs(iy) * 0.8) S.dir = 'side';
        else S.dir = iy < 0 ? 'back' : 'front';
      }
      if (moving) {
        S.phase += (speed * dt) / STRIDE;
        const f = Math.floor(S.phase) % 4;
        if (f !== S.frame) S.frame = f;
      } else { S.phase = 0; S.frame = 0; }
      if (!moving && S.clock >= S.nextBlink) { S.blinkUntil = S.clock + 0.13; S.nextBlink = S.clock + 2.4 + Math.random() * 3; }

      const it = findNear();
      const id = it ? `${it.id}:${it.label}` : null;
      if (id !== S.nearId) { S.nearId = id; setNear(it); }

      // gửi vị trí cho người khác
      S.sendT += dt;
      S.idleT += dt;
      const sig = `${Math.round(S.pos.x)},${Math.round(S.pos.y)},${S.dir},${S.facing},${moving ? 1 : 0}`;
      if (S.ready && S.ch2 && ((sig !== S.lastSent && S.sendT > 0.1) || S.idleT > 2)) {
        S.lastSent = sig; S.sendT = 0; S.idleT = 0;
        try { S.ch2.send({ type: 'broadcast', event: 'pos', payload: { u: userId, x: Math.round(S.pos.x * 10) / 10, y: Math.round(S.pos.y * 10) / 10, d: S.dir, f: S.facing, m: moving ? 1 : 0 } }); } catch (e) { /* bỏ qua */ }
      }

      // người khác: trượt mượt về vị trí mới
      for (const r of S.remotes.values()) {
        const k2 = 1 - Math.exp(-dt * 9);
        const ox = r.x; const oy = r.y;
        r.x += (r.tx - r.x) * k2;
        r.y += (r.ty - r.y) * k2;
        const sp = Math.hypot(r.x - ox, r.y - oy) / Math.max(dt, 0.001);
        r.walk = sp > 8;
        if (r.walk) { r.phase += (sp * dt) / STRIDE; r.frame = Math.floor(r.phase) % 4; } else { r.phase = 0; r.frame = 0; }
      }

      hudT += dt;
      if (hudT > 0.5) {
        hudT = 0;
        const t = dayTime();
        const rn = rainLevel();
        setHud((h) => {
          const next = { ...h, time: clockLabel(t), night: isNight(t), rain: rn > 0.08 };
          return (h.time === next.time && h.night === next.night && h.rain === next.rain) ? h : next;
        });
      }
    }

    function drawPerson(frames, x, y, dir, facing, frameIdx, walking, blinking) {
      if (!frames) return;
      const K = CHAR_H / frames.h;
      const set = frames[dir] || frames.front;
      let img;
      let bob = 0;
      if (walking) { img = set[frameIdx]; bob = BOB[frameIdx] * 0.6; }
      else if (blinking && dir !== 'back') img = dir === 'side' ? frames.blinkSide : frames.blinkFront;
      else img = set[0];
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y - 0.5, 7, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y + bob);
      if (facing < 0 && dir === 'side') ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -frames.ax * K, -frames.h * K, frames.w * K, frames.h * K);
      ctx.restore();
    }

    function drawSign(x, y, label, color) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 5, y - 1, 12, 2);
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(x - 1, y - 15, 2.4, 15);
      ctx.fillStyle = '#2b1a0c';
      ctx.fillRect(x - 13, y - 25, 26, 11);
      ctx.fillStyle = color;
      ctx.fillRect(x - 12, y - 24, 24, 9);
      ctx.fillStyle = '#1c1a26';
      ctx.font = 'bold 5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y - 19.5);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function draw() {
      const W = canvas.width;
      const Hh = canvas.height;
      const dpr = S.dpr;
      const z = S.z;
      const vw = S.cw / z;
      const vh = S.ch / z;
      // camera
      const tx = clampN(S.pos.x - vw / 2, 0, Math.max(0, WW - vw));
      const ty = clampN(S.pos.y - 16 - vh / 2, 0, Math.max(0, WH - vh));
      if (!S.cam) S.cam = { x: tx, y: ty };
      S.cam.x += (tx - S.cam.x) * 0.16;
      S.cam.y += (ty - S.cam.y) * 0.16;
      const cx = S.cam.x;
      const cy = S.cam.y;
      const sc = z * dpr;
      const t = dayTime();
      const night = nightLevel(t);
      const rain = rainLevel();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#10200f';
      ctx.fillRect(0, 0, W, Hh);
      ctx.setTransform(sc, 0, 0, sc, -cx * sc, -cy * sc);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (bg.current) ctx.drawImage(bg.current, 0, 0, WW, WH);

      // các vật thể sắp theo độ sâu (y)
      const list = [];
      for (const h of S.houses) {
        const g = houseGeom(h.plot, h.level);
        list.push({ key: g.base, kind: 'house', h, g });
        if (h.plot === S.land.plot) {
          const sp = signPos(h.plot);
          list.push({ key: sp.y, kind: 'sign', sp, lvl: h.level });
        }
      }
      list.push({ key: SCHOOL_SIGN.y, kind: 'school' });
      list.push({ key: S.pos.y, kind: 'me' });
      for (const [id, r] of S.remotes) list.push({ key: r.y, kind: 'other', r, id });
      list.sort((a, b) => a.key - b.key);
      const blink = S.clock < S.blinkUntil;
      const moving = Math.hypot(S.vel.x, S.vel.y) > 8;
      for (const e of list) {
        if (e.kind === 'house') {
          const { g, h } = e;
          if (g.x > cx + vw + 20 || g.x + g.w < cx - 20 || g.y > cy + vh + 20 || g.y + g.h < cy - 20) continue;
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath();
          ctx.ellipse(g.cx, g.base - 1, g.w * 0.46, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          const im = imgs[h.level] && imgs[h.level].current;
          ctx.imageSmoothingEnabled = true;
          if (im) ctx.drawImage(im, g.x, g.y, g.w, g.h);
        } else if (e.kind === 'sign') {
          drawSign(e.sp.x, e.sp.y, e.lvl < MAX_LEVEL ? 'NÂNG CẤP' : 'NHÀ EM', '#ffd45c');
        } else if (e.kind === 'school') {
          drawSign(SCHOOL_SIGN.x, SCHOOL_SIGN.y, 'ĐẾN TRƯỜNG', '#5aa0ff');
        } else if (e.kind === 'me') {
          drawPerson(S.frames, S.pos.x, S.pos.y, S.dir, S.facing, S.frame, moving, blink);
        } else {
          const r = e.r;
          drawPerson(r.frames, r.x, r.y, r.dir, r.facing, r.frame || 0, r.walk, false);
        }
      }
      ctx.imageSmoothingEnabled = true;

      // nhãn "Nhà của em" và mũi tên chỉ cửa
      const own = S.houses.find((h) => h.plot === S.land.plot);
      if (own) {
        const g = houseGeom(own.plot, own.level);
        const by = g.y - 6 + Math.sin(S.clock * 4) * 1.5;
        ctx.fillStyle = '#ffd45c';
        ctx.beginPath();
        ctx.moveTo(g.cx - 4, by - 8); ctx.lineTo(g.cx + 4, by - 8); ctx.lineTo(g.cx, by);
        ctx.closePath(); ctx.fill();
      }

      // ----- ban đêm: tối, đèn dầu leo lét, cửa sổ sáng -----
      const dark = Math.max(night, rain * 0.3);
      if (dark > 0.02) {
        if (!S.lc) S.lc = document.createElement('canvas');
        const lc = S.lc;
        if (lc.width !== W || lc.height !== Hh) { lc.width = W; lc.height = Hh; }
        const lx = lc.getContext('2d');
        lx.setTransform(1, 0, 0, 1, 0, 0);
        lx.globalCompositeOperation = 'source-over';
        lx.clearRect(0, 0, W, Hh);
        lx.fillStyle = `rgba(7,12,40,${(0.8 * dark).toFixed(3)})`;
        lx.fillRect(0, 0, W, Hh);
        lx.globalCompositeOperation = 'destination-out';
        const lights = [];
        for (const h of S.houses) {
          const g = houseGeom(h.plot, h.level);
          if (g.x > cx + vw + 100 || g.x + g.w < cx - 100 || g.y > cy + vh + 100 || g.y + g.h < cy - 100) continue;
          g.lights.forEach((l, i) => {
            const seed = h.plot * 7.3 + i * 3.1;
            let a;
            if (l.kind === 'oil') {
              a = 0.66 + 0.17 * Math.sin(t * 6.1 + seed) + 0.11 * Math.sin(t * 14.3 + seed * 1.7);
              if (Math.sin(t * 1.9 + seed * 3) > 0.92) a *= 0.55;   // thoi thóp như sắp tắt
            } else if (l.kind === 'oildim') {
              a = 0.36 + 0.12 * Math.sin(t * 5.2 + seed) + 0.08 * Math.sin(t * 12 + seed);
            } else a = 0.92 + 0.05 * Math.sin(t * 2 + seed);
            lights.push({ x: l.x, y: l.y, r: l.r, a: clampN(a, 0.2, 1), kind: l.kind });
          });
        }
        lights.push({ x: S.pos.x, y: S.pos.y - 14, r: 40, a: 0.38, kind: 'me' });
        for (const r of S.remotes.values()) lights.push({ x: r.x, y: r.y - 14, r: 30, a: 0.3, kind: 'me' });
        const cut = (l, k) => {
          const sx = (l.x - cx) * sc;
          const sy = (l.y - cy) * sc;
          const sr = l.r * sc * (0.9 + 0.1 * l.a) * k;
          const g = lx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          g.addColorStop(0, `rgba(0,0,0,${l.a.toFixed(3)})`);
          g.addColorStop(0.5, `rgba(0,0,0,${(l.a * 0.55).toFixed(3)})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          lx.fillStyle = g;
          lx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
        };
        for (const l of lights) cut(l, 1);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(lc, 0, 0);
        // ánh vàng ấm quanh đèn
        ctx.globalCompositeOperation = 'lighter';
        for (const l of lights) {
          if (l.kind === 'me') continue;
          const sx = (l.x - cx) * sc;
          const sy = (l.y - cy) * sc;
          const sr = l.r * 0.85 * sc;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          g.addColorStop(0, `rgba(255,150,50,${(0.26 * l.a * night).toFixed(3)})`);
          g.addColorStop(1, 'rgba(255,110,20,0)');
          ctx.fillStyle = g;
          ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
        }
        // ngọn lửa đèn dầu
        for (const l of lights) {
          if (l.kind !== 'oil') continue;
          const sx = (l.x - cx) * sc;
          const sy = (l.y - cy) * sc;
          const fl = 0.8 + 0.5 * Math.abs(Math.sin(t * 17 + l.x));
          ctx.fillStyle = `rgba(255,150,40,${(0.9 * night).toFixed(3)})`;
          ctx.beginPath(); ctx.ellipse(sx, sy, 1.9 * sc, 3.2 * sc * fl, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,240,170,${(0.95 * night).toFixed(3)})`;
          ctx.beginPath(); ctx.ellipse(sx, sy + 0.6 * sc, 0.9 * sc, 1.7 * sc * fl, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      // ----- mưa -----
      if (rain > 0.02) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(52,70,96,${(0.22 * rain).toFixed(3)})`;
        ctx.fillRect(0, 0, W, Hh);
        const want = Math.round(60 + 190 * rain);
        while (S.drops.length < want) S.drops.push({ x: Math.random() * W, y: Math.random() * Hh, l: 10 + Math.random() * 14, v: 700 + Math.random() * 500 });
        if (S.drops.length > want) S.drops.length = want;
        ctx.strokeStyle = `rgba(205,225,255,${(0.42 * rain + 0.1).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, dpr);
        ctx.beginPath();
        const dtD = 1 / 60;
        for (const d of S.drops) {
          d.y += d.v * dtD * dpr;
          d.x -= 150 * dtD * dpr;
          if (d.y > Hh) { d.y = -20; d.x = Math.random() * (W + 200); }
          if (d.x < -20) d.x = W;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + 3.2 * dpr, d.y - d.l * dpr);
        }
        ctx.stroke();
      }

      // ----- tên người chơi -----
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${Math.round(11 * dpr)}px sans-serif`;
      ctx.lineJoin = 'round';
      const tag = (name, wx, wy, color) => {
        const sx = (wx - cx) * sc;
        const sy = (wy - CHAR_H - 3 - cy) * sc;
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = 'rgba(10,12,30,0.85)';
        ctx.strokeText(name, sx, sy);
        ctx.fillStyle = color;
        ctx.fillText(name, sx, sy);
      };
      for (const r of S.remotes.values()) tag(r.nick || 'Bạn nhỏ', r.x, r.y, '#ffffff');
      tag(S.land.nick || 'Em', S.pos.x, S.pos.y, '#ffe08a');
      ctx.textAlign = 'start';
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [S]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- cần điều khiển -----
  function stickUpdate(e) {
    const base = stickRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const maxR = r.width * 0.34;
    let vx = e.clientX - cx;
    let vy = e.clientY - cy;
    if (document.querySelector('.gm-root[data-rot="1"]')) { const t0 = vx; vx = vy; vy = -t0; }
    const len = Math.hypot(vx, vy) || 1;
    const clamped = Math.min(len, maxR);
    vx = (vx / len) * clamped;
    vy = (vy / len) * clamped;
    knob.style.transform = `translate(${vx}px, ${vy}px)`;
    const mag = clamped / maxR;
    if (mag < STICK_DEAD) S.stick = { x: 0, y: 0 };
    else {
      const sc = (mag - STICK_DEAD) / (1 - STICK_DEAD);
      S.stick = { x: (vx / clamped) * sc, y: (vy / clamped) * sc };
    }
  }
  function stickEnd() {
    S.stick = { x: 0, y: 0 };
    S.stickId = null;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
  }
  const stickProps = {
    onPointerDown: (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); S.stickId = e.pointerId; stickUpdate(e); },
    onPointerMove: (e) => { if (S.stickId === e.pointerId) stickUpdate(e); },
    onPointerUp: stickEnd,
    onPointerCancel: stickEnd,
    onLostPointerCapture: stickEnd,
    onContextMenu: (e) => e.preventDefault(),
  };

  const cur = LEVELS[Math.min(land.level, MAX_LEVEL)];
  const nxt = land.level < MAX_LEVEL ? LEVELS[land.level + 1] : null;

  return (
    <div className="gm-house gw-world" data-night={hud.night ? '1' : undefined}>
      <div className="gm-view gw-full" ref={viewRef}>
        <canvas ref={canvasRef} className="gm-room gw-canvas" style={{ touchAction: 'none' }} aria-label="Làng quê" />
        {toast && <div className="gm-toast" key={toast.id}>{toast.text}</div>}
      </div>

      <div className="gm-hud">
        {onGoSchool && <button type="button" className="gm-btn" onClick={onGoSchool}>Đi tới trường</button>}
        <button type="button" className="gm-btn" onClick={onEditCharacter}>Sửa nhân vật</button>
      </div>
      <div className="gw-clock" data-night={hud.night ? '1' : undefined}>
        <span className="gw-sun" aria-hidden="true" />
        <b>{hud.time}</b>
        <span>{hud.night ? 'Ban đêm' : 'Ban ngày'}{hud.rain ? ' · Trời mưa' : ''}</span>
        <span className="gw-online">{hud.online} người</span>
      </div>

      <div className="gm-ctrl">
        <div className="gm-stick" ref={stickRef} aria-label="Cần điều khiển" {...stickProps}>
          <div className="gm-knob" ref={knobRef} />
        </div>
        <div className="gm-act">
          <button type="button" className="gm-btn main big" disabled={!near} onClick={interact}>
            {near ? near.label : 'Đi dạo trong làng'}
          </button>
          <div className="gm-hint">Máy tính: phím mũi tên hoặc W A S D, phím E để dùng.</div>
        </div>
      </div>

      {panel === 'upgrade' && (
        <div className="gw-modal" onClick={() => !busy && setPanel(null)}>
          <div className="gw-card" onClick={(e) => e.stopPropagation()}>
            <div className="gw-card-t">Chỗ nâng cấp nhà</div>
            <div className="gw-up">
              <div className="gw-up-i">
                <img src={cur.img} alt={cur.name} />
                <b>{cur.name}</b>
                <span>Nhà hiện tại</span>
              </div>
              {nxt && <div className="gw-arrow" aria-hidden="true">➜</div>}
              {nxt && (
                <div className="gw-up-i next">
                  <img src={nxt.img} alt={nxt.name} />
                  <b>{nxt.name}</b>
                  <span>{nxt.desc}</span>
                </div>
              )}
            </div>
            {nxt ? (
              <>
                <div className="gm-hint">Bản thử nghiệm: nâng cấp miễn phí. Sau này sẽ cần vật liệu và tiền.</div>
                <div className="gm-actions">
                  <button type="button" className="gm-btn main" disabled={busy} onClick={doUpgrade}>{busy ? 'Đang xây…' : `Nâng cấp lên ${nxt.name}`}</button>
                  <button type="button" className="gm-btn" disabled={busy} onClick={() => setPanel(null)}>Để sau</button>
                </div>
              </>
            ) : (
              <>
                <div className="gm-hint">Nhà của em đã ở cấp cao nhất hiện có.</div>
                <div className="gm-actions"><button type="button" className="gm-btn main" onClick={() => setPanel(null)}>Đóng</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
