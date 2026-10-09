'use client';
// GAME (tách riêng): cảnh SÂN TRƯỜNG TH - THCS Biển Bạch (dựng theo hai ảnh mẫu ngày và đêm của thầy).
// Đi từ cổng vào, dạo trong sân, ra lại cổng trường ở mép dưới.
// Ngày đêm theo giờ game (12 phút sáng, 12 phút tối) chuyển mượt: ảnh ngày mờ sang ảnh đêm, đèn bật dần theo từng khu.
// Chiều sâu: nhân vật to nhỏ và đi nhanh chậm theo độ xa, đi sau cột và dưới mái xanh, có bóng mái che ban ngày, quầng đèn ban đêm.
// Ghế đá: ngồi được, mỗi ghế 2 chỗ, đồng bộ cho các bạn cùng khu (trường s trong gói vị trí).
// Nhiều người cùng một khu (kênh Realtime bb-san-<khu>). Xóa cùng thư mục components/game khi gỡ game.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { buildFrames } from '../../lib/game/sprites';
import { clockLabel, dayTime, isNight, nightLevel, rainLevel } from '../../lib/game/clock';
import {
  CHAR_H, EXIT_Y, SH, SIT_DROP, SPEED, SW, YARD_TEXT, ZONE_MAX,
  benchSeats, canopyShade, depthScale, litAt, yardBlocked, yardNearest, yardSpawn,
} from '../../lib/game/courtyard';
import { COLUMNS, drawYardBackdrop, drawYardColumn, drawYardRoof, makeYardArt } from '../../lib/game/courtyardRender';

const STRIDE = 12;
const BOB = [-1, 0, -1, 0];
const STICK_DEAD = 0.16;
const Y_SQUASH = 0.72;      // đi dọc (xa gần) chậm hơn đi ngang vì mặt sân nhìn nghiêng
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp01 = (v, a, b) => clampN((v - a) / (b - a), 0, 1);

let carry = null;   // giữ vị trí khi đổi khu vực (màn hình được dựng lại)

export default function CourtyardView({
  cfg, nick, userId, zone, homeZone, onBack, onEditCharacter, onChangeZone,
}) {
  const canvasRef = useRef(null);
  const viewRef = useRef(null);
  const stickRef = useRef(null);
  const knobRef = useRef(null);
  const [near, setNear] = useState(null);
  const [toast, setToast] = useState(null);
  const [hud, setHud] = useState({ time: '', night: false, rain: false, online: 1 });
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shards, setShards] = useState(null);
  const [friendQ, setFriendQ] = useState('');
  const [friends, setFriends] = useState(null);

  const S = useRef({
    pos: null, vel: { x: 0, y: 0 }, keys: new Set(), stick: { x: 0, y: 0 }, stickId: null,
    facing: 1, dir: 'back', phase: 0, frame: 0, clock: 0, nextBlink: 2, blinkUntil: 0,
    cam: null, dpr: 1, cw: 0, ch: 0, drops: [], art: null, frames: null, tmp: null,
    remotes: new Map(), ch2: null, ready: false, sendT: 0, idleT: 0, lastSent: '',
    nearId: null, paused: false, fade: 1, leaving: false, left: false,
    seat: null, standPos: null,
  }).current;
  S.nick = nick;
  S.paused = panel;
  S.uid = userId;

  const say = useCallback((text) => setToast({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  if (!S.art && typeof document !== 'undefined') S.art = makeYardArt();
  if (!S.tmp && typeof document !== 'undefined') { S.tmp = document.createElement('canvas'); S.tmp.width = 160; S.tmp.height = 160; }
  if (!S.pos) {
    if (carry) {
      S.pos = { x: carry.x, y: carry.y };
      S.dir = carry.dir; S.facing = carry.facing;
      S.fade = 0.4;
      carry = null;
    } else { S.pos = yardSpawn(); S.dir = 'back'; S.facing = 1; }
  }
  useEffect(() => { S.frames = buildFrames(cfg); }, [cfg, S]);

  // ----- trực tuyến: thấy nhau trong cùng khu (kênh riêng của sân trường) -----
  useEffect(() => {
    const ch = supabase.channel(`bb-san-${zone}`, { config: { presence: { key: userId }, broadcast: { self: false } } });
    S.ch2 = ch;
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
          r = { uid: key, seat: null, x: m.x ?? 0, y: m.y ?? 0, tx: m.x ?? 0, ty: m.y ?? 0, dir: 'front', facing: 1, moving: false, phase: 0, frame: 0, frames: null, cfgKey: '' };
          S.remotes.set(key, r);
        }
        r.nick = m.n || 'Bạn nhỏ';
        const ck = JSON.stringify(m.c || {});
        if (ck !== r.cfgKey) { r.cfgKey = ck; try { r.frames = buildFrames(m.c); } catch (e) { r.frames = null; } }
      }
      for (const k of [...S.remotes.keys()]) if (!seen.has(k)) S.remotes.delete(k);
      setHud((h) => ({ ...h, online: seen.size + 1 }));
    });
    ch.on('broadcast', { event: 'pos' }, ({ payload: p }) => {
      const r = p && S.remotes.get(p.u);
      if (!r) return;
      r.tx = p.x; r.ty = p.y; r.dir = p.d || 'front'; r.facing = p.f || 1; r.moving = !!p.m; r.seat = p.s || null;
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        S.ready = true;
        try { await ch.track({ n: S.nick, c: cfg, x: Math.round(S.pos.x), y: Math.round(S.pos.y) }); } catch (e) { /* bỏ qua */ }
      }
    });
    return () => {
      S.ready = false;
      S.ch2 = null;
      S.remotes.clear();
      supabase.removeChannel(ch);
    };
  }, [zone, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- ghế đá: ngồi xuống / đứng dậy (mỗi ghế 2 chỗ) -----
  const stand = useCallback(() => {
    if (!S.seat) return;
    const sp = S.standPos;
    S.seat = null; S.standPos = null;
    if (sp) S.pos = { x: sp.x, y: sp.y };
    S.vel.x = 0; S.vel.y = 0;
  }, [S]);

  const sitAt = useCallback((bench) => {
    const taken = new Set();
    for (const r of S.remotes.values()) if (r.seat) taken.add(r.seat);
    const free = benchSeats(bench).filter((s) => !taken.has(s.id));
    if (!free.length) { say('Ghế này đã đủ 2 bạn ngồi rồi. Em chọn ghế khác nhé.'); return; }
    free.sort((a, b) => Math.hypot(a.x - S.pos.x, a.y - S.pos.y) - Math.hypot(b.x - S.pos.x, b.y - S.pos.y));
    const s = free[0];
    S.standPos = { x: S.pos.x, y: S.pos.y };
    S.seat = s.id;
    S.pos = { x: s.x, y: s.y };
    S.vel.x = 0; S.vel.y = 0;
    S.dir = 'side'; S.facing = s.face;
    S.keys.clear(); S.stick = { x: 0, y: 0 };
  }, [S, say]);

  // ----- tương tác -----
  const leave = useCallback(() => {
    if (S.leaving) return;
    stand();
    S.leaving = true; S.keys.clear(); S.stick = { x: 0, y: 0 };
  }, [S, stand]);

  const interact = useCallback(() => {
    if (S.paused || S.leaving) return;
    if (S.seat) { stand(); return; }
    const it = yardNearest(S.pos.x, S.pos.y);
    if (!it) return;
    if (it.id === 'ra') leave();
    else if (it.id === 'ghe') sitAt(it.bench);
    else say(YARD_TEXT[it.id]);
  }, [S, say, leave, stand, sitAt]);

  // ----- đổi khu vực -----
  const changeZone = useCallback((z) => {
    const sp = S.seat && S.standPos ? S.standPos : S.pos;
    carry = { x: sp.x, y: sp.y, dir: S.dir, facing: S.facing };
    onChangeZone(z);
  }, [S, onChangeZone]);
  async function openAreas() {
    S.keys.clear(); S.stick = { x: 0, y: 0 };
    setPanel(true);
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
  function goZone(z) {
    setBusy(true);
    setPanel(false);
    changeZone(z);
  }

  // ----- bàn phím -----
  useEffect(() => {
    const map = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
    const down = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') { setPanel(false); return; }
      if (S.paused) return;
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
    let raf = 0;
    let last = performance.now();
    let hudT = 0;

    function moveAxis(axis, d) {
      if (d === 0) return;
      const nx = axis === 'x' ? S.pos.x + d : S.pos.x;
      const ny = axis === 'y' ? S.pos.y + d : S.pos.y;
      if (!yardBlocked(nx, ny)) { S.pos.x = nx; S.pos.y = ny; return; }
      for (let off = 1; off <= 7; off++) {          // trượt dọc theo vật cản thay vì dính cứng
        for (const sign of [1, -1]) {
          const tx = axis === 'x' ? nx : nx + sign * off;
          const ty = axis === 'x' ? ny + sign * off : ny;
          if (!yardBlocked(tx, ty)) {
            const step = Math.min(off, 1.2);
            if (axis === 'x') S.pos.y += sign * step; else S.pos.x += sign * step;
            return;
          }
        }
      }
      if (axis === 'x') S.vel.x = 0; else S.vel.y = 0;
    }

    function update(dt) {
      S.clock += dt;
      if (S.fade > 0 && !S.leaving) S.fade = Math.max(0, S.fade - dt / 0.9);   // sáng dần khi mới vào
      let ix = (S.keys.has('r') ? 1 : 0) - (S.keys.has('l') ? 1 : 0) + S.stick.x;
      let iy = (S.keys.has('d') ? 1 : 0) - (S.keys.has('u') ? 1 : 0) + S.stick.y;
      if (S.paused) { ix = 0; iy = 0; }
      if (S.seat && !S.leaving) {
        if (Math.hypot(ix, iy) > 0.3) stand();          // đẩy cần / bấm phím di chuyển thì đứng dậy
        else { ix = 0; iy = 0; S.vel.x = 0; S.vel.y = 0; }
        for (const r of S.remotes.values()) {            // hai bạn cùng ngồi một chỗ trong cùng giây: bạn có mã lớn hơn nhường chỗ
          if (S.seat && r.seat === S.seat && String(r.uid) < String(S.uid)) {
            stand();
            say('Chỗ này vừa có bạn khác ngồi trước. Em chọn chỗ khác nhé.');
          }
        }
      }
      if (S.leaving) {
        ix = 0; iy = 0.8;                            // tự bước xuống mép dưới rồi tối dần để ra cổng
        S.fade = Math.min(1, S.fade + dt / 0.7);
        if (S.fade >= 1 && !S.left) { S.left = true; onBack(); }
      } else if (S.pos.y >= EXIT_Y) leave();
      const il = Math.hypot(ix, iy);
      if (il > 1) { ix /= il; iy /= il; }
      const has = il > 0.05;
      const k = 1 - Math.exp(-dt * (has ? 15 : 24));
      const ds = depthScale(S.pos.y);                // xa thì bước ngắn lại, gần thì dài ra
      S.vel.x += (ix * SPEED * ds - S.vel.x) * k;
      S.vel.y += (iy * SPEED * ds * Y_SQUASH - S.vel.y) * k;
      if (!has && Math.hypot(S.vel.x, S.vel.y) < 4) { S.vel.x = 0; S.vel.y = 0; }
      moveAxis('x', S.vel.x * dt);
      moveAxis('y', S.vel.y * dt);
      const speed = Math.hypot(S.vel.x, S.vel.y);
      const moving = speed > 6;
      if (has) {
        if (Math.abs(ix) > 0.2) S.facing = ix > 0 ? 1 : -1;
        if (Math.abs(ix) > 0.2 && Math.abs(ix) >= Math.abs(iy) * 0.8) S.dir = 'side';
        else S.dir = iy < 0 ? 'back' : 'front';
      }
      if (moving) {
        S.phase += (speed * dt) / (STRIDE * ds);
        const f = Math.floor(S.phase) % 4;
        if (f !== S.frame) S.frame = f;
      } else { S.phase = 0; S.frame = 0; }
      if (!moving && S.clock >= S.nextBlink) { S.blinkUntil = S.clock + 0.13; S.nextBlink = S.clock + 2.4 + Math.random() * 3; }

      let it = (S.paused || S.leaving) ? null : (S.seat ? { id: 'dung', label: 'Đứng dậy' } : yardNearest(S.pos.x, S.pos.y));
      if (it && it.id === 'ghe') {
        const taken = new Set();
        for (const r of S.remotes.values()) if (r.seat) taken.add(r.seat);
        const left = benchSeats(it.bench).filter((s) => !taken.has(s.id)).length;
        it = { ...it, label: left > 0 ? `Ngồi ghế đá (còn ${left}/2 chỗ)` : 'Ghế đá đã đủ 2 bạn' };
      }
      const id = it ? `${it.id}:${it.label}` : null;
      if (id !== S.nearId) { S.nearId = id; setNear(it); }

      S.sendT += dt;
      S.idleT += dt;
      const sig = `${Math.round(S.pos.x)},${Math.round(S.pos.y)},${S.dir},${S.facing},${moving ? 1 : 0},${S.seat || 0}`;
      if (S.ready && S.ch2 && ((sig !== S.lastSent && S.sendT > 0.1) || S.idleT > 2)) {
        S.lastSent = sig; S.sendT = 0; S.idleT = 0;
        try { S.ch2.send({ type: 'broadcast', event: 'pos', payload: { u: userId, x: Math.round(S.pos.x * 10) / 10, y: Math.round(S.pos.y * 10) / 10, d: S.dir, f: S.facing, m: moving ? 1 : 0, s: S.seat || 0 } }); } catch (e) { /* bỏ qua */ }
      }

      for (const r of S.remotes.values()) {
        const k2 = r.seat ? 1 : 1 - Math.exp(-dt * 9);
        const ox = r.x; const oy = r.y;
        r.x += (r.tx - r.x) * k2;
        r.y += (r.ty - r.y) * k2;
        const sp = Math.hypot(r.x - ox, r.y - oy) / Math.max(dt, 0.001);
        r.walk = !r.seat && sp > 6;
        if (r.walk) { r.phase += (sp * dt) / (STRIDE * depthScale(r.y)); r.frame = Math.floor(r.phase) % 4; } else { r.phase = 0; r.frame = 0; }
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

    // nhân vật: to nhỏ theo độ sâu, bóng mái che ban ngày, quầng đèn ban đêm, hơi mờ xa
    function drawPerson(frames, x, y, dir, facing, frameIdx, walking, blinking, night, sit) {
      if (!frames) return;
      const ds = depthScale(y);
      const K = (CHAR_H / frames.h) * ds;
      if (sit) { dir = 'side'; walking = false; }
      const set = frames[dir] || frames.front;
      let img;
      let bob = 0;
      if (walking) { img = set[frameIdx]; bob = BOB[frameIdx] * 0.6 * ds; }
      else if (blinking && dir !== 'back') img = dir === 'side' ? frames.blinkSide : frames.blinkFront;
      else img = set[0];
      const lit = litAt(x, y);
      const shade = canopyShade(x, y);
      ctx.fillStyle = `rgba(0,0,0,${(0.3 * (1 - 0.35 * night * (1 - lit))).toFixed(3)})`;
      ctx.fillRect(Math.round(x - 7 * ds), Math.round(y - 2), Math.round(14 * ds), 3);
      ctx.fillRect(Math.round(x - 5 * ds), Math.round(y + 1), Math.round(10 * ds), 1);
      const tw = Math.max(1, Math.round(frames.w * K));
      const th = Math.max(1, Math.round(frames.h * K));
      const t = S.tmp;
      const tc = t.getContext('2d');
      tc.clearRect(0, 0, t.width, t.height);
      tc.imageSmoothingEnabled = false;
      tc.globalCompositeOperation = 'source-over';
      tc.drawImage(img, 0, 0, tw, th);
      tc.globalCompositeOperation = 'source-atop';
      const overlay = (r, g, b, a) => {
        if (a < 0.01) return;
        tc.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
        tc.fillRect(0, 0, tw, th);
      };
      overlay(30, 42, 100, 0.26 * shade * (1 - night));                                   // bóng mái che ban ngày
      overlay(205, 220, 245, 0.11 * ramp01(214 - y, 0, 50) * (1 - 0.6 * night));          // xa thì hơi mờ trắng
      overlay(10, 18, 58, 0.36 * night * (1 - lit));                                      // ban đêm chỗ tối
      overlay(255, 172, 80, 0.22 * night * lit);                                          // ban đêm chỗ có đèn
      tc.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y + bob));
      if (facing < 0 && dir === 'side') ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      if (sit) {
        // ngồi: thân hạ thấp xuống mặt ghế, phần chân (từ hông xuống) ép ngắn lại và đưa ra phía trước
        const drop = Math.round(SIT_DROP * ds);
        const cut = Math.round(th * 0.58);
        const legH = Math.max(2, (th - cut) - drop);
        const ax0 = -Math.round(frames.ax * K);
        ctx.drawImage(t, 0, 0, tw, cut, ax0, -th + drop, tw, cut);
        ctx.drawImage(t, 0, cut, tw, th - cut, ax0 + Math.round(4 * ds), -legH, tw, legH);
      } else {
        ctx.drawImage(t, 0, 0, tw, th, -Math.round(frames.ax * K), -th, tw, th);
      }
      ctx.restore();
    }

    function draw() {
      const art = S.art;
      if (!art) return;
      const cwp = canvas.width;
      const chp = canvas.height;
      if (!cwp || !chp) return;
      const sc = Math.max(1, Math.ceil(cwp / SW));              // phóng nguyên số lần, khung nhìn không rộng hơn map
      const vw = cwp / sc;
      const vh = chp / sc;
      const tx = vw >= SW ? (SW - vw) / 2 : clampN(S.pos.x - vw / 2, 0, SW - vw);
      const ty = vh >= SH ? (SH - vh) / 2 : clampN(S.pos.y - 14 - vh * 0.62, 0, SH - vh);
      if (!S.cam) S.cam = { x: tx, y: ty };
      S.cam.x += (tx - S.cam.x) * 0.16;
      S.cam.y += (ty - S.cam.y) * 0.16;
      const cx = Math.round(S.cam.x * sc) / sc;
      const cy = Math.round(S.cam.y * sc) / sc;
      const now = Date.now();
      const t = dayTime(now);
      const night = nightLevel(t);
      const rain = rainLevel(now);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0a1020';
      ctx.fillRect(0, 0, cwp, chp);
      ctx.setTransform(sc, 0, 0, sc, -cx * sc, -cy * sc);

      if (!drawYardBackdrop(ctx, art, night)) {
        ctx.fillStyle = '#e8eefc';
        ctx.font = '10px sans-serif';
        ctx.fillText('Đang tải sân trường…', cx + 12, cy + 24);
      }

      // người và 4 cột sắp theo độ sâu (chân y): đi trước cột thì che cột, đi sau cột thì bị cột che
      const list = COLUMNS.map((c) => ({ key: c.foot, col: c }));
      list.push({ key: S.pos.y, me: true });
      for (const r of S.remotes.values()) list.push({ key: r.y, r });
      list.sort((a, b) => a.key - b.key);
      const blink = S.clock < S.blinkUntil;
      const moving = Math.hypot(S.vel.x, S.vel.y) > 6;
      for (const e of list) {
        if (e.col) drawYardColumn(ctx, art, night, e.col);
        else if (e.me) drawPerson(S.frames, S.pos.x, S.pos.y, S.dir, S.facing, S.frame, moving, blink, night, !!S.seat);
        else drawPerson(e.r.frames, e.r.x, e.r.y, e.r.dir, e.r.facing, e.r.frame || 0, e.r.walk, false, night, !!e.r.seat);
      }
      drawYardRoof(ctx, art, night);                 // mái xanh luôn nằm trên đầu nhân vật

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

      // ----- tên người chơi (nhỏ dần khi ở xa) -----
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      const tag = (name, wx, wy, color, sit) => {
        const ds = depthScale(wy);
        const sx = (wx - cx) * sc;
        const sy = (wy - CHAR_H * ds - 3 + (sit ? SIT_DROP * ds : 0) - cy) * sc;
        ctx.font = `700 ${Math.round(11 * S.dpr * (0.88 + 0.12 * ds))}px sans-serif`;
        ctx.lineWidth = 3 * S.dpr;
        ctx.strokeStyle = 'rgba(10,12,30,0.85)';
        ctx.strokeText(name, sx, sy);
        ctx.fillStyle = color;
        ctx.fillText(name, sx, sy);
      };
      for (const r of S.remotes.values()) tag(r.nick || 'Bạn nhỏ', r.x, r.y, '#ffffff', !!r.seat);
      tag(S.nick || 'Em', S.pos.x, S.pos.y, '#ffe08a', !!S.seat);
      ctx.textAlign = 'start';

      // chuyển cảnh: sáng dần khi mới vào, tối dần khi ra cổng
      if (S.fade > 0.003) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, S.fade).toFixed(3)})`;
        ctx.fillRect(0, 0, cwp, chp);
      }
    }

    function frame(nowT) {
      const dt = Math.min(0.05, (nowT - last) / 1000);
      last = nowT;
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

  return (
    <div className="gm-house gw-world" data-night={hud.night ? '1' : undefined}>
      <div className="gm-view gw-full" ref={viewRef}>
        <canvas ref={canvasRef} className="gm-room gw-canvas" style={{ touchAction: 'none' }} aria-label="Sân trường" />
        {toast && <div className="gm-toast" key={toast.id}>{toast.text}</div>}
      </div>

      <div className="gm-hud">
        <button type="button" className="gm-btn" onClick={openAreas} disabled={busy}>Khu vực {zone}</button>
        <button type="button" className="gm-btn main" onClick={leave}>Ra cổng trường</button>
        <button type="button" className="gm-btn" onClick={onEditCharacter}>Sửa nhân vật</button>
      </div>
      <div className="gw-clock" data-night={hud.night ? '1' : undefined}>
        <span className="gw-sun" aria-hidden="true" />
        <b>{hud.time}</b>
        <span>{hud.night ? 'Ban đêm' : 'Ban ngày'}{hud.rain ? ' · Trời mưa' : ''}</span>
        <span className="gw-online">{hud.online}/{ZONE_MAX} bạn</span>
      </div>
      {zone !== homeZone && <div className="gw-visit">Đang ở trường khu {zone}</div>}

      <div className="gm-ctrl">
        <div className="gm-stick" ref={stickRef} aria-label="Cần điều khiển" {...stickProps}>
          <div className="gm-knob" ref={knobRef} />
        </div>
        <div className="gm-act">
          <button type="button" className="gm-btn main big" disabled={!near} onClick={interact}>
            {near ? near.label : 'Đi dạo sân trường'}
          </button>
          <div className="gm-hint">Đi xuống mép dưới để ra cổng trường. Lại gần ghế đá để ngồi (mỗi ghế 2 bạn), đẩy cần để đứng dậy. Máy tính: phím mũi tên hoặc W A S D, phím E để dùng.</div>
        </div>
      </div>

      {panel && (
        <div className="gw-modal" onClick={() => setPanel(false)}>
          <div className="gw-card" onClick={(e) => e.stopPropagation()}>
            <div className="gw-card-t">Chọn khu vực</div>
            <div className="gm-hint">Mỗi khu có tối đa {ZONE_MAX} bạn cùng lúc. Em đang ở khu {zone}. Chọn khu khác để gặp các bạn ở đó.</div>
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
                    <button type="button" className="gm-btn" disabled={f.shard === zone} onClick={() => goZone(f.shard)}>{f.shard === zone ? 'Đang ở đây' : 'Đến khu này'}</button>
                  </div>
                ))}
              </div>
            )}
            <div className="gw-list">
              {!shards && <div className="gm-hint">Đang tải…</div>}
              {shards && (shards.length ? shards : [{ shard: homeZone }]).map((sh) => (
                <div className="gw-row" key={sh.shard}>
                  <span><b>Khu {sh.shard}</b>{sh.shard === homeZone ? ' · khu nhà em' : ''}</span>
                  <button type="button" className="gm-btn" disabled={sh.shard === zone} onClick={() => goZone(sh.shard)}>{sh.shard === zone ? 'Đang ở đây' : 'Đến khu này'}</button>
                </div>
              ))}
            </div>
            <div className="gm-actions"><button type="button" className="gm-btn" onClick={() => setPanel(false)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
