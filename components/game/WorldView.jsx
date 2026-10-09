'use client';
// GAME (tách riêng): làng quê MIỀN TÂY dùng chung (map dựng bằng code, pixel nét). Mỗi khu 10 nhà, nhiều khu, có thể đi thăm bạn.
// Có ngày đêm (12 phút sáng, 12 phút tối), mưa ngẫu nhiên, đèn dầu ban đêm, đom đóm, cột điện cũ, chỗ nâng cấp nhà.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { buildFrames } from '../../lib/game/sprites';
import { clockLabel, dayTime, isNight, nightLevel, rainLevel } from '../../lib/game/clock';
import {
  CHAR_H, LEVELS, MAX_LEVEL, PLOTS_PER_SHARD, SCHOOL_SIGN, SCHOOL_SPAWN, SCHOOL_ZONE, SPEED, T, VIEW_W, VISITOR_SPAWN, WH, WW,
  getWorld, houseGeom, nearestFree, plotInfo, worldBlocked,
} from '../../lib/game/mekong';
import { makeArt } from '../../lib/game/mekongArt';
import { drawGround, drawStatic, drawWires, visibleObjects } from '../../lib/game/mekongRender';

const STRIDE = 12;
const BOB = [-1, 0, -1, 0];
const STICK_DEAD = 0.16;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

export default function WorldView({
  cfg, land, viewShard, userId, from, onEnterHouse, onEditCharacter, onGoSchool, onUpgrade, onVisit, onMoveHome,
}) {
  const canvasRef = useRef(null);
  const viewRef = useRef(null);
  const stickRef = useRef(null);
  const knobRef = useRef(null);
  const [near, setNear] = useState(null);
  const [toast, setToast] = useState(null);
  const [panel, setPanel] = useState(null);       // 'upgrade' | 'areas'
  const [busy, setBusy] = useState(false);
  const [hud, setHud] = useState({ time: '', night: false, rain: false, online: 1 });
  const [houses, setHouses] = useState([]);
  const [shards, setShards] = useState(null);
  const [friendQ, setFriendQ] = useState('');
  const [friends, setFriends] = useState(null);
  const isHome = viewShard === land.shard;

  const S = useRef({
    pos: null, vel: { x: 0, y: 0 }, keys: new Set(), stick: { x: 0, y: 0 }, stickId: null,
    facing: 1, dir: 'front', phase: 0, frame: 0, clock: 0, nextBlink: 2, blinkUntil: 0,
    cam: null, dpr: 1, cw: 0, ch: 0, lc: null, drops: [], flies: [], art: null, houseCv: [], houseImg: [],
    remotes: new Map(), ch2: null, ready: false, sendT: 0, idleT: 0, lastSent: '', frames: null,
    nearId: null, houses: [], panel: null,
  }).current;
  const own = isHome ? { plot: land.plot, level: land.level, nick: land.nick } : null;
  S.houses = houses.map((h) => (isHome && h.plot === land.plot ? { ...h, level: land.level, nick: land.nick } : h));
  if (isHome && !S.houses.some((h) => h.plot === land.plot)) S.houses.push(own);
  S.panel = panel;
  S.land = land;
  S.isHome = isHome;

  const say = useCallback((text) => setToast({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // tranh pixel vẽ bằng code + ảnh nhà (thu nhỏ đúng cỡ để cùng độ mịn với map)
  if (!S.art && typeof document !== 'undefined') S.art = makeArt((w, h) => document.createElement('canvas'));
  useEffect(() => {
    LEVELS.forEach((L, i) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(L.w); c.height = Math.round(L.w * L.ar);
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(im, 0, 0, c.width, c.height);
        S.houseCv[i] = c;
      };
      im.src = L.img;
      S.houseImg[i] = im;
    });
  }, [S]);

  // vị trí xuất hiện
  if (!S.pos) {
    let base;
    if (from === 'school') base = SCHOOL_SPAWN;
    else if (isHome) { const g = houseGeom(land.plot, land.level); base = { x: g.door.x, y: g.door.y + 14 }; }
    else base = VISITOR_SPAWN;
    S.pos = nearestFree(base.x, base.y, []);
    S.dir = from === 'school' ? 'side' : 'front';
    S.facing = from === 'school' ? -1 : 1;
  }
  useEffect(() => { S.frames = buildFrames(cfg); }, [cfg, S]);

  // ----- nhà của cả khu -----
  const refreshHouses = useCallback(async () => {
    const { data } = await supabase.rpc('game_world_state', { p_shard: viewShard });
    if (Array.isArray(data)) {
      setHouses(data.filter((r) => r && Number.isInteger(r.plot) && r.plot < PLOTS_PER_SHARD).map((r) => ({ plot: r.plot, level: r.level || 0, nick: r.nick || 'Bạn nhỏ' })));
    }
  }, [viewShard]);
  useEffect(() => {
    refreshHouses();
    const t = setInterval(refreshHouses, 25000);
    return () => clearInterval(t);
  }, [refreshHouses]);

  // ----- trực tuyến: thấy nhau trong cùng khu -----
  useEffect(() => {
    const ch = supabase.channel(`bb-nongthon-${viewShard}`, { config: { presence: { key: userId }, broadcast: { self: false } } });
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
        try { await ch.track({ n: land.nick, c: cfg, x: Math.round(S.pos.x), y: Math.round(S.pos.y) }); } catch (e) { /* bỏ qua */ }
      }
    });
    return () => {
      clearTimeout(timer);
      S.ready = false;
      S.ch2 = null;
      S.remotes.clear();
      supabase.removeChannel(ch);
    };
  }, [viewShard, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- tương tác -----
  const findNear = useCallback(() => {
    const p = S.pos;
    if (p.x > SCHOOL_ZONE.x0 && p.y > SCHOOL_ZONE.y0 && p.y < SCHOOL_ZONE.y1) return { id: 'truong', label: 'Đi tới trường' };
    if (dist(p, SCHOOL_SIGN) < 36) return { id: 'truong', label: 'Đi tới trường' };
    if (S.isHome) {
      const mine = S.houses.find((h) => h.plot === S.land.plot);
      if (mine) {
        const g = houseGeom(mine.plot, mine.level);
        if (dist(p, g.door) < 30) return { id: 'cua', label: 'Vào nhà' };
        const pi = plotInfo(mine.plot);
        if (dist(p, { x: (pi.x0 + 4) * T, y: (pi.y1 - 2) * T }) < 28) return { id: 'nang_cap', label: mine.level < MAX_LEVEL ? 'Nâng cấp nhà' : 'Xem nhà của em' };
      }
    }
    for (const h of S.houses) {
      if (S.isHome && h.plot === S.land.plot) continue;
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

  async function openAreas() {
    S.keys.clear(); S.stick = { x: 0, y: 0 };
    setPanel('areas');
    setFriends(null);
    const { data } = await supabase.rpc('game_list_shards');
    setShards(Array.isArray(data) ? data : []);
  }
  async function findFriend() {
    const q = friendQ.trim();
    if (q.length < 2) { say('Gõ ít nhất 2 chữ của tên bạn nhé.'); return; }
    const { data } = await supabase.rpc('game_find_friend', { p_name: q });
    setFriends(Array.isArray(data) ? data : []);
  }
  async function moveHere(shard) {
    setBusy(true);
    const ok = await onMoveHome(shard);
    setBusy(false);
    if (!ok) say('Chuyển nhà chưa được, khu đó có thể vừa đầy.');
  }

  // ----- bàn phím -----
  useEffect(() => {
    const map = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
    const down = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
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
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const cw = view.clientWidth;
      const ch = view.clientHeight;
      if (!cw || !ch) return;
      S.dpr = dpr; S.cw = cw; S.ch = ch;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
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
    const W = getWorld();
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

      S.sendT += dt;
      S.idleT += dt;
      const sig = `${Math.round(S.pos.x)},${Math.round(S.pos.y)},${S.dir},${S.facing},${moving ? 1 : 0}`;
      if (S.ready && S.ch2 && ((sig !== S.lastSent && S.sendT > 0.1) || S.idleT > 2)) {
        S.lastSent = sig; S.sendT = 0; S.idleT = 0;
        try { S.ch2.send({ type: 'broadcast', event: 'pos', payload: { u: userId, x: Math.round(S.pos.x * 10) / 10, y: Math.round(S.pos.y * 10) / 10, d: S.dir, f: S.facing, m: moving ? 1 : 0 } }); } catch (e) { /* bỏ qua */ }
      }

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
      ctx.translate(Math.round(x), Math.round(y + bob));
      if (facing < 0 && dir === 'side') ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -frames.ax * K, -frames.h * K, frames.w * K, frames.h * K);
      ctx.restore();
    }

    function draw() {
      const cwp = canvas.width;
      const chp = canvas.height;
      const sc = Math.max(1, Math.round(cwp / VIEW_W));       // phóng nguyên số lần để pixel luôn nét
      const vw = cwp / sc;
      const vh = chp / sc;
      const tx = clampN(S.pos.x - vw / 2, 0, Math.max(0, WW - vw));
      const ty = clampN(S.pos.y - 14 - vh / 2, 0, Math.max(0, WH - vh));
      if (!S.cam) S.cam = { x: tx, y: ty };
      S.cam.x += (tx - S.cam.x) * 0.18;
      S.cam.y += (ty - S.cam.y) * 0.18;
      const cx = Math.round(S.cam.x * sc) / sc;
      const cy = Math.round(S.cam.y * sc) / sc;
      const t = dayTime();
      const night = nightLevel(t);
      const rain = rainLevel();
      const wt = S.clock;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#10200f';
      ctx.fillRect(0, 0, cwp, chp);
      ctx.setTransform(sc, 0, 0, sc, -cx * sc, -cy * sc);
      ctx.imageSmoothingEnabled = false;
      drawGround(ctx, S.art, W, cx, cy, cx + vw, cy + vh, wt);

      // vật thể sắp theo độ sâu (y)
      const list = [];
      for (const o of visibleObjects(W, cx, cy, cx + vw, cy + vh)) list.push({ key: o.y, o });
      for (const h of S.houses) {
        const g = houseGeom(h.plot, h.level);
        if (g.x > cx + vw + 20 || g.x + g.w < cx - 20 || g.y > cy + vh + 20 || g.y + g.h < cy - 20) continue;
        list.push({ key: g.base, house: h, g });
      }
      if (S.isHome) {
        const pi = plotInfo(S.land.plot);
        list.push({ key: (pi.y1 - 2) * T, upgrade: { x: (pi.x0 + 4) * T, y: (pi.y1 - 2) * T }, lvl: S.land.level });
      }
      list.push({ key: S.pos.y, me: true });
      for (const [, r] of S.remotes) list.push({ key: r.y, r });
      list.sort((a, b) => a.key - b.key);
      const blink = S.clock < S.blinkUntil;
      const moving = Math.hypot(S.vel.x, S.vel.y) > 8;
      for (const e of list) {
        if (e.o) drawStatic(ctx, S.art, e.o, wt, null);
        else if (e.house) {
          const g = e.g;
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath(); ctx.ellipse(g.cx, g.base - 1, g.w * 0.46, 5, 0, 0, Math.PI * 2); ctx.fill();
          const cv = S.houseCv[e.house.level];
          if (cv) ctx.drawImage(cv, Math.round(g.x), Math.round(g.y));
        } else if (e.upgrade) {
          const u = e.upgrade;
          ctx.drawImage(S.art.signBoard('NÂNG CẤP', '#ffd45c'), Math.round(u.x - 23), Math.round(u.y - 35));
          ctx.fillStyle = '#1c1a26'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(e.lvl < MAX_LEVEL ? 'NÂNG CẤP' : 'NHÀ EM', u.x, u.y - 29);
          ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        } else if (e.me) drawPerson(S.frames, S.pos.x, S.pos.y, S.dir, S.facing, S.frame, moving, blink);
        else drawPerson(e.r.frames, e.r.x, e.r.y, e.r.dir, e.r.facing, e.r.frame || 0, e.r.walk, false);
      }
      drawWires(ctx, W, cx, cy, cx + vw, cy + vh, wt);

      // bảng tên nhà ở cổng, mũi tên chỉ nhà của mình
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      for (const h of S.houses) {
        const pi = plotInfo(h.plot);
        const lx = (pi.x0 + 12) * T;
        const ly = (pi.y1 + 1) * T + 9;
        if (lx < cx - 60 || lx > cx + vw + 60 || ly < cy - 20 || ly > cy + vh + 20) continue;
        const mine = S.isHome && h.plot === S.land.plot;
        ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(30,18,6,0.85)';
        ctx.strokeText(`Nhà ${h.nick}`, lx, ly);
        ctx.fillStyle = mine ? '#ffe08a' : '#ffffff';
        ctx.fillText(`Nhà ${h.nick}`, lx, ly);
      }
      ctx.textAlign = 'start';
      const mineH = S.isHome && S.houses.find((h) => h.plot === S.land.plot);
      if (mineH) {
        const g = houseGeom(mineH.plot, mineH.level);
        const by = g.y - 6 + Math.sin(S.clock * 4) * 1.5;
        ctx.fillStyle = '#ffd45c';
        ctx.beginPath(); ctx.moveTo(g.cx - 4, by - 8); ctx.lineTo(g.cx + 4, by - 8); ctx.lineTo(g.cx, by); ctx.closePath(); ctx.fill();
      }

      // ----- ban đêm: tối, đèn dầu leo lét, đèn cột điện, đom đóm -----
      const dark = Math.max(night, rain * 0.3);
      const psc = sc; // 1 đơn vị = sc điểm ảnh thiết bị
      if (dark > 0.02) {
        if (!S.lc) S.lc = document.createElement('canvas');
        const lc = S.lc;
        if (lc.width !== cwp || lc.height !== chp) { lc.width = cwp; lc.height = chp; }
        const lx = lc.getContext('2d');
        lx.setTransform(1, 0, 0, 1, 0, 0);
        lx.globalCompositeOperation = 'source-over';
        lx.clearRect(0, 0, cwp, chp);
        lx.fillStyle = `rgba(6,11,38,${(0.82 * dark).toFixed(3)})`;
        lx.fillRect(0, 0, cwp, chp);
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
              if (Math.sin(t * 1.9 + seed * 3) > 0.92) a *= 0.55;
            } else if (l.kind === 'oildim') {
              a = 0.36 + 0.12 * Math.sin(t * 5.2 + seed) + 0.08 * Math.sin(t * 12 + seed);
            } else a = 0.92 + 0.05 * Math.sin(t * 2 + seed);
            lights.push({ x: l.x, y: l.y, r: l.r, a: clampN(a, 0.2, 1), kind: l.kind });
          });
        }
        for (const l of W.lamps) {
          if (l.x < cx - 80 || l.x > cx + vw + 80 || l.y < cy - 80 || l.y > cy + vh + 80) continue;
          let a = l.a + 0.08 * Math.sin(t * 3 + l.seed);
          if (Math.sin(t * 0.7 + l.seed * 5) > 0.97) a *= 0.3;        // bóng đèn cũ chập chờn
          lights.push({ x: l.x, y: l.y, r: l.r, a: clampN(a, 0.15, 0.95), kind: 'pole' });
        }
        lights.push({ x: S.pos.x, y: S.pos.y - 14, r: 40, a: 0.38, kind: 'me' });
        for (const r of S.remotes.values()) lights.push({ x: r.x, y: r.y - 14, r: 30, a: 0.3, kind: 'me' });
        const cut = (l) => {
          const sx = (l.x - cx) * psc;
          const sy = (l.y - cy) * psc;
          const sr = l.r * psc * (0.9 + 0.1 * l.a);
          const g = lx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          g.addColorStop(0, `rgba(0,0,0,${l.a.toFixed(3)})`);
          g.addColorStop(0.5, `rgba(0,0,0,${(l.a * 0.55).toFixed(3)})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          lx.fillStyle = g;
          lx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
        };
        for (const l of lights) cut(l);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(lc, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        for (const l of lights) {
          if (l.kind === 'me') continue;
          const sx = (l.x - cx) * psc;
          const sy = (l.y - cy) * psc;
          const sr = l.r * 0.85 * psc;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          g.addColorStop(0, `rgba(255,150,50,${(0.26 * l.a * night).toFixed(3)})`);
          g.addColorStop(1, 'rgba(255,110,20,0)');
          ctx.fillStyle = g;
          ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
        }
        for (const l of lights) {
          if (l.kind !== 'oil') continue;
          const sx = Math.round((l.x - cx) * psc);
          const sy = Math.round((l.y - cy) * psc);
          const fl = 0.8 + 0.5 * Math.abs(Math.sin(t * 17 + l.x));
          ctx.fillStyle = `rgba(255,150,40,${(0.9 * night).toFixed(3)})`;
          ctx.fillRect(sx - psc, sy - Math.round(2 * psc * fl), 2 * psc, Math.round(4 * psc * fl));
          ctx.fillStyle = `rgba(255,240,170,${(0.95 * night).toFixed(3)})`;
          ctx.fillRect(sx - psc * 0.5, sy - Math.round(psc * fl), psc, Math.round(2 * psc * fl));
        }
        // đom đóm
        if (night > 0.4 && rain < 0.4) {
          while (S.flies.length < 34) S.flies.push({ x: cx + Math.random() * vw, y: cy + Math.random() * vh, ph: Math.random() * 6, sp: 0.6 + Math.random() });
          for (const f of S.flies) {
            if (f.x < cx - 30 || f.x > cx + vw + 30 || f.y < cy - 30 || f.y > cy + vh + 30) { f.x = cx + Math.random() * vw; f.y = cy + Math.random() * vh; }
            const fx = f.x + Math.sin(t * 0.9 * f.sp + f.ph) * 9;
            const fy = f.y + Math.cos(t * 0.7 * f.sp + f.ph * 1.3) * 6;
            const blinkA = Math.max(0, Math.sin(t * 2.2 * f.sp + f.ph)) * night;
            const sx = (fx - cx) * psc;
            const sy = (fy - cy) * psc;
            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6 * psc);
            g.addColorStop(0, `rgba(220,255,120,${(0.85 * blinkA).toFixed(3)})`);
            g.addColorStop(1, 'rgba(180,255,80,0)');
            ctx.fillStyle = g;
            ctx.fillRect(sx - 6 * psc, sy - 6 * psc, 12 * psc, 12 * psc);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      // ----- mưa -----
      if (rain > 0.02) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(52,70,96,${(0.22 * rain).toFixed(3)})`;
        ctx.fillRect(0, 0, cwp, chp);
        const want = Math.round(60 + 190 * rain);
        while (S.drops.length < want) S.drops.push({ x: Math.random() * cwp, y: Math.random() * chp, l: 10 + Math.random() * 14, v: 700 + Math.random() * 500 });
        if (S.drops.length > want) S.drops.length = want;
        const dpr = S.dpr;
        ctx.strokeStyle = `rgba(205,225,255,${(0.42 * rain + 0.1).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, dpr);
        ctx.beginPath();
        const dtD = 1 / 60;
        for (const d of S.drops) {
          d.y += d.v * dtD * dpr;
          d.x -= 150 * dtD * dpr;
          if (d.y > chp) { d.y = -20; d.x = Math.random() * (cwp + 200); }
          if (d.x < -20) d.x = cwp;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + 3.2 * dpr, d.y - d.l * dpr);
        }
        ctx.stroke();
      }

      // ----- tên người chơi -----
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${Math.round(11 * S.dpr)}px sans-serif`;
      ctx.lineJoin = 'round';
      const tag = (name, wx, wy, color) => {
        const sx = (wx - cx) * psc;
        const sy = (wy - CHAR_H - 3 - cy) * psc;
        ctx.lineWidth = 3 * S.dpr;
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
        <canvas ref={canvasRef} className="gm-room gw-canvas" style={{ touchAction: 'none' }} aria-label="Làng quê Miền Tây" />
        {toast && <div className="gm-toast" key={toast.id}>{toast.text}</div>}
      </div>

      <div className="gm-hud">
        <button type="button" className="gm-btn" onClick={openAreas}>Khu vực {viewShard}</button>
        {!isHome && <button type="button" className="gm-btn main" onClick={() => onVisit(land.shard)}>Về nhà mình</button>}
        <button type="button" className="gm-btn" onClick={onEditCharacter}>Sửa nhân vật</button>
      </div>
      <div className="gw-clock" data-night={hud.night ? '1' : undefined}>
        <span className="gw-sun" aria-hidden="true" />
        <b>{hud.time}</b>
        <span>{hud.night ? 'Ban đêm' : 'Ban ngày'}{hud.rain ? ' · Trời mưa' : ''}</span>
        <span className="gw-online">{hud.online} người</span>
      </div>
      {!isHome && <div className="gw-visit">Đang đi thăm khu {viewShard}</div>}

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
              <div className="gw-up-i"><img src={cur.img} alt={cur.name} /><b>{cur.name}</b><span>Nhà hiện tại</span></div>
              {nxt && <div className="gw-arrow" aria-hidden="true">➜</div>}
              {nxt && <div className="gw-up-i next"><img src={nxt.img} alt={nxt.name} /><b>{nxt.name}</b><span>{nxt.desc}</span></div>}
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

      {panel === 'areas' && (
        <div className="gw-modal" onClick={() => !busy && setPanel(null)}>
          <div className="gw-card" onClick={(e) => e.stopPropagation()}>
            <div className="gw-card-t">Chọn khu vực</div>
            <div className="gm-hint">Mỗi khu có tối đa {PLOTS_PER_SHARD} nhà. Càng nhiều bạn vào game, làng càng mở thêm khu mới. Em có thể đi thăm bạn ở khu khác, hoặc chuyển nhà đến ở chung với bạn.</div>
            <div className="gw-find">
              <input className="gw-input" value={friendQ} onChange={(e) => setFriendQ(e.target.value)} placeholder="Tìm bạn theo tên" maxLength={18} aria-label="Tìm bạn" />
              <button type="button" className="gm-btn" onClick={findFriend}>Tìm</button>
            </div>
            {friends && (
              <div className="gw-list">
                {friends.length === 0 && <div className="gm-hint">Chưa thấy bạn nào có tên này.</div>}
                {friends.map((f, i) => (
                  <div className="gw-row" key={`${f.nick}-${i}`}>
                    <span><b>{f.nick}</b> · khu {f.shard}</span>
                    <button type="button" className="gm-btn" disabled={busy || f.shard === viewShard} onClick={() => { setPanel(null); onVisit(f.shard); }}>{f.shard === viewShard ? 'Đang ở đây' : 'Đến thăm'}</button>
                  </div>
                ))}
              </div>
            )}
            <div className="gw-list">
              {!shards && <div className="gm-hint">Đang tải…</div>}
              {shards && shards.map((s) => (
                <div className="gw-row" key={s.shard}>
                  <span><b>Khu {s.shard}</b> · {s.count}/{PLOTS_PER_SHARD} nhà{s.shard === land.shard ? ' · nhà em ở đây' : ''}</span>
                  <span className="gw-row-b">
                    <button type="button" className="gm-btn" disabled={busy || s.shard === viewShard} onClick={() => { setPanel(null); onVisit(s.shard); }}>{s.shard === viewShard ? 'Đang ở đây' : 'Đến thăm'}</button>
                    {s.shard !== land.shard && s.count < PLOTS_PER_SHARD && (
                      <button type="button" className="gm-btn main" disabled={busy} onClick={() => moveHere(s.shard)}>Chuyển nhà đến đây</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="gm-actions"><button type="button" className="gm-btn" onClick={() => setPanel(null)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
