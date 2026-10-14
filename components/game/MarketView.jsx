'use client';
// GAME (tách riêng): CHỢ MIỀN TÂY (có sông, có xuồng) dựng bằng code, đi từ bến xuồng của làng quê tới.
// Có ba cô bán hàng (ảnh pixel của thầy), rau củ bày trên các sạp, xuồng chở hàng trên sông, người mua đi lại (TẠM THỜI, sẽ thay sau),
// ngày đêm (12 phút sáng, 12 phút tối), mưa, nhiều bạn cùng một khu (tối đa 10), đổi khu vực.
// Xóa cùng thư mục components/game khi gỡ game.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { buildFrames } from '../../lib/game/sprites';
import { BUYER_OUTFITS, buildBuyerFrames } from '../../lib/game/marketBuyers';
import { clockLabel, dayTime, isNight, nightLevel, rainLevel } from '../../lib/game/clock';
import {
  CHAR_H, EXIT_Y, MH, MW, SPAWN, SPEED, STALLS, ZONE_MAX,
  depthScale, interactText, makeBuyers, marketBlocked, marketNearest, stepBuyer,
} from '../../lib/game/market';
import { makeMarketArt } from '../../lib/game/marketArt';
import { HERO } from '../../lib/game/marketHero';
import { NIGHT_TINT, drawBase, drawBirds, drawBoats, drawCloudShadows, drawLeaves, drawLights, makeProps } from '../../lib/game/marketRender';

const STRIDE = 12;
const BOB = [-1, 0, -1, 0];
const STICK_DEAD = 0.16;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

const outfitCache = new Map();   // khung hình đã dựng cho từng bộ đồ người mua
let carry = null;   // giữ vị trí khi đổi khu vực (màn hình được dựng lại)

export default function MarketView({
  cfg, nick, userId, zone, homeZone, from, onBackHome, onEditCharacter, onChangeZone,
}) {
  const canvasRef = useRef(null);
  const viewRef = useRef(null);
  const stickRef = useRef(null);
  const knobRef = useRef(null);
  const [near, setNear] = useState(null);
  const [toast, setToast] = useState(null);
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shards, setShards] = useState(null);
  const [friendQ, setFriendQ] = useState('');
  const [friends, setFriends] = useState(null);
  const [hud, setHud] = useState({ time: '', night: false, rain: false, online: 1 });

  const S = useRef({
    pos: null, vel: { x: 0, y: 0 }, keys: new Set(), stick: { x: 0, y: 0 }, stickId: null,
    facing: 1, dir: 'back', phase: 0, frame: 0, clock: 0, nextBlink: 2, blinkUntil: 0,
    cam: null, dpr: 1, cw: 0, ch: 0, drops: [], art: null, frames: null, props: null, sellerImgs: {}, heroImgs: {}, buyers: null,
    remotes: new Map(), ch2: null, ready: false, sendT: 0, idleT: 0, lastSent: '',
    nearId: null, paused: false, fade: 1, leaving: false, left: false, capChecked: false,
  }).current;
  S.paused = panel;
  S.nick = nick;

  const say = useCallback((text) => setToast({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  // tranh pixel vẽ bằng code + ảnh ba cô bán hàng
  if (!S.art && typeof document !== 'undefined') {
    S.art = makeMarketArt((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
    for (const st of STALLS) if (st.seller) { const im = new Image(); im.src = `/game/cho/${st.seller}.png`; S.sellerImgs[st.seller] = im; }
    for (const [id, hd] of Object.entries(HERO)) {
      const ld = (src) => { const im = new Image(); im.src = src; return im; };
      S.heroImgs[id] = { base: ld(hd.base), body: ld(hd.body.src), head: ld(hd.head.src), blink: ld(hd.blink.src) };
    }
    S.props = makeProps(S.art, S.sellerImgs);
  }

  // người mua tạm thời: mặc đồ đi chợ theo ảnh mẫu (nón lá, mũ bảo hiểm, khẩu trang, áo hoa...); hoặc ảnh riêng nếu thầy đã thêm vào BUYER_IMAGES
  if (!S.buyers && typeof document !== 'undefined') {
    S.buyers = makeBuyers();
    for (const b of S.buyers) {
      if (b.img) { const im = new Image(); im.src = b.img.src; b.image = im; continue; }
      const base = BUYER_OUTFITS[b.id % BUYER_OUTFITS.length];
      const o = b.id >= BUYER_OUTFITS.length ? { ...base, skin: (base.skin + 1 + (b.id % 2)) % 3 } : base;   // vòng thứ hai đổi màu da cho khác người
      const key = `${o.id}-${o.skin}`;
      if (!outfitCache.has(key)) { try { outfitCache.set(key, buildBuyerFrames(o)); } catch (e) { outfitCache.set(key, null); } }
      b.frames = outfitCache.get(key);
    }
  }

  // vị trí xuất hiện: từ làng đi tới thì đứng ở bến cuối chợ, quay mặt vào chợ
  if (!S.pos) {
    if (carry) {
      S.pos = { x: carry.x, y: carry.y };
      S.dir = carry.dir; S.facing = carry.facing;
      S.fade = 0.4;
      carry = null;
    } else {
      S.pos = { x: SPAWN.x, y: SPAWN.y };
      S.dir = 'back';
      S.facing = 1;
    }
  }
  useEffect(() => { S.frames = buildFrames(cfg); }, [cfg, S]);

  const changeZone = useCallback((z) => {
    carry = { x: S.pos.x, y: S.pos.y, dir: S.dir, facing: S.facing };
    onChangeZone(z);
  }, [S, onChangeZone]);

  // ----- trực tuyến: thấy nhau trong cùng khu (kênh riêng của chợ) -----
  useEffect(() => {
    const ch = supabase.channel(`bb-cho-${zone}`, { config: { presence: { key: userId }, broadcast: { self: false } } });
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
          r = { x: m.x ?? 0, y: m.y ?? 0, tx: m.x ?? 0, ty: m.y ?? 0, dir: 'front', facing: 1, moving: false, phase: 0, frame: 0, frames: null, cfgKey: '' };
          S.remotes.set(key, r);
        }
        r.nick = m.n || 'Bạn nhỏ';
        const ck = JSON.stringify(m.c || {});
        if (ck !== r.cfgKey) { r.cfgKey = ck; try { r.frames = buildFrames(m.c); } catch (e) { r.frames = null; } }
      }
      for (const k of [...S.remotes.keys()]) if (!seen.has(k)) S.remotes.delete(k);
      setHud((h) => ({ ...h, online: seen.size + 1 }));
      // khu đã đủ 10 bạn thì về khu của mình (chủ khu luôn được vào)
      if (!S.capChecked) {
        S.capChecked = true;
        if (seen.size >= ZONE_MAX && zone !== homeZone) {
          say(`Khu ${zone} đã đủ ${ZONE_MAX} bạn. Em được đưa về khu ${homeZone}.`);
          setTimeout(() => changeZone(homeZone), 900);
        }
      }
    });
    ch.on('broadcast', { event: 'pos' }, ({ payload: p }) => {
      const r = p && S.remotes.get(p.u);
      if (!r) return;
      r.tx = p.x; r.ty = p.y; r.dir = p.d || 'front'; r.facing = p.f || 1; r.moving = !!p.m;
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

  // ----- tương tác -----
  const startLeave = useCallback(() => {
    if (S.leaving) return;
    S.leaving = true; S.keys.clear(); S.stick = { x: 0, y: 0 };
  }, [S]);

  const interact = useCallback(() => {
    if (S.paused || S.leaving) return;
    const it = marketNearest(S.pos.x, S.pos.y);
    if (!it) return;
    if (it.id === 've_lang') startLeave();
    else say(interactText(it));
  }, [S, say, startLeave]);

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
      if (!marketBlocked(nx, ny)) { S.pos.x = nx; S.pos.y = ny; return; }
      for (let off = 1; off <= 7; off++) {
        for (const sign of [1, -1]) {
          const tx = axis === 'x' ? nx : nx + sign * off;
          const ty = axis === 'x' ? ny + sign * off : ny;
          if (!marketBlocked(tx, ty)) {
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
      const locked = S.paused || S.leaving;

      let ix = locked ? 0 : (S.keys.has('r') ? 1 : 0) - (S.keys.has('l') ? 1 : 0) + S.stick.x;
      let iy = locked ? 0 : (S.keys.has('d') ? 1 : 0) - (S.keys.has('u') ? 1 : 0) + S.stick.y;
      if (S.leaving) {
        // tự bước xuống bến rồi tối dần để về làng
        ix = clampN((MW / 2 - S.pos.x) / 14, -0.8, 0.8);
        iy = 0.8;
        S.fade = Math.min(1, S.fade + dt / 0.8);
        if (S.fade >= 1 && !S.left) { S.left = true; onBackHome(); }
      } else if (!locked && S.pos.y >= EXIT_Y) {
        startLeave();
      }
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

      const it = locked ? null : marketNearest(S.pos.x, S.pos.y);
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

      // người mua đi lại giữa các sạp (tạm thời, chỉ chạy trên máy này)
      if (S.buyers) {
        for (const b of S.buyers) {
          stepBuyer(b, dt);
          if (b.walk) { b.phase += (b.speed * dt) / STRIDE; b.frame = Math.floor(b.phase) % 4; } else { b.phase = 0; b.frame = 0; }
        }
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
      const ds = depthScale(y);
      const K = (CHAR_H / frames.h) * ds;
      const set = frames[dir] || frames.front;
      let img;
      let bob = 0;
      if (walking) { img = set[frameIdx]; bob = BOB[frameIdx] * 0.6 * ds; }
      else if (blinking && dir !== 'back') img = dir === 'side' ? frames.blinkSide : frames.blinkFront;
      else img = set[0];
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(Math.round(x - 7 * ds), Math.round(y - 2), Math.round(14 * ds), 3);
      ctx.fillRect(Math.round(x - 5 * ds), Math.round(y + 1), Math.round(10 * ds), 1);
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y + bob));
      if (facing < 0 && dir === 'side') ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -frames.ax * K, -frames.h * K, frames.w * K, frames.h * K);
      ctx.restore();
    }

    // người mua dùng ảnh riêng (nếu thầy đã thêm): đứng yên một ảnh, nhún nhẹ khi đi
    function drawImagePerson(b) {
      const im = b.image;
      if (!im || !im.width) return;
      const h = b.img.h || 34;
      const w = (im.width / im.height) * h;
      const bob = b.walk ? BOB[b.frame] * 0.6 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(Math.round(b.x - 7), Math.round(b.y - 2), 14, 3);
      ctx.save();
      ctx.translate(Math.round(b.x), Math.round(b.y + bob));
      if (b.facing < 0) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(im, -w / 2, -h, w, h);
      ctx.restore();
    }

    function draw() {
      const art = S.art;
      if (!art) return;
      const cwp = canvas.width;
      const chp = canvas.height;
      if (!cwp || !chp) return;
      const sc = Math.max(1, Math.ceil(cwp / MW));              // phóng nguyên số lần để pixel luôn nét, khung nhìn không rộng hơn map
      const vw = cwp / sc;
      const vh = chp / sc;
      const tx = vw >= MW ? (MW - vw) / 2 : clampN(S.pos.x - vw / 2, 0, MW - vw);
      const ty = vh >= MH ? (MH - vh) / 2 : clampN(S.pos.y - vh * 0.6, 0, MH - vh);
      if (!S.cam) S.cam = { x: tx, y: ty };
      S.cam.x += (tx - S.cam.x) * 0.18;
      S.cam.y += (ty - S.cam.y) * 0.18;
      const cx = Math.round(S.cam.x * sc) / sc;
      const cy = Math.round(S.cam.y * sc) / sc;
      const now = Date.now();
      const t = dayTime(now);
      const night = nightLevel(t);
      const rain = rainLevel(now);
      const tm = now / 1000;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0a1020';
      ctx.fillRect(0, 0, cwp, chp);
      ctx.setTransform(sc, 0, 0, sc, -cx * sc, -cy * sc);
      ctx.imageSmoothingEnabled = false;

      // nền, nước, xuồng
      drawBase(ctx, art, tm, night);
      drawBoats(ctx, art, tm, S.heroImgs);

      // sạp, cột đèn và mọi người sắp theo độ sâu (y chân)
      const list = S.props ? S.props.map((p) => ({ key: p.key, prop: p })) : [];
      list.push({ key: S.pos.y, me: true });
      for (const r of S.remotes.values()) list.push({ key: r.y, r });
      if (S.buyers) for (const b of S.buyers) list.push({ key: b.y, b });
      list.sort((a, b) => a.key - b.key);
      const blink = S.clock < S.blinkUntil;
      const moving = Math.hypot(S.vel.x, S.vel.y) > 8;
      for (const e of list) {
        if (e.prop) e.prop.draw(ctx, tm);
        else if (e.me) drawPerson(S.frames, S.pos.x, S.pos.y, S.dir, S.facing, S.frame, moving, blink);
        else if (e.r) drawPerson(e.r.frames, e.r.x, e.r.y, e.r.dir, e.r.facing, e.r.frame || 0, e.r.walk, false);
        else if (e.b.image) drawImagePerson(e.b);
        else drawPerson(e.b.frames, e.b.x, e.b.y, e.b.dir, e.b.facing, e.b.frame, e.b.walk, false);
      }

      // bóng mây, lá bay theo gió, chim trên trời (vẽ trên cùng của thế giới, dưới lớp tối ban đêm)
      drawCloudShadows(ctx, tm, night);
      drawLeaves(ctx, tm);
      drawBirds(ctx, tm, night, rain);

      // ban đêm: tối dần, đèn sạp và đèn bến sáng ấm
      if (night > 0.02) {
        ctx.fillStyle = NIGHT_TINT(night);
        ctx.fillRect(cx, cy, vw, vh);
        drawLights(ctx, night, tm);
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
        const sx = (wx - cx) * sc;
        const sy = (wy - CHAR_H * depthScale(wy) - 3 - cy) * sc;
        ctx.lineWidth = 3 * S.dpr;
        ctx.strokeStyle = 'rgba(10,12,30,0.85)';
        ctx.strokeText(name, sx, sy);
        ctx.fillStyle = color;
        ctx.fillText(name, sx, sy);
      };
      for (const r of S.remotes.values()) tag(r.nick || 'Bạn nhỏ', r.x, r.y, '#ffffff');
      tag(S.nick || 'Em', S.pos.x, S.pos.y, '#ffe08a');
      ctx.textAlign = 'start';

      // chuyển cảnh: tối dần khi xuống bến về làng, sáng dần khi mới tới
      if (S.fade > 0.003) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, S.fade).toFixed(3)})`;
        ctx.fillRect(0, 0, cwp, chp);
      }
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

  return (
    <div className="gm-house gw-world" data-night={hud.night ? '1' : undefined}>
      <div className="gm-view gw-full" ref={viewRef}>
        <canvas ref={canvasRef} className="gm-room gw-canvas" style={{ touchAction: 'none' }} aria-label="Chợ miền Tây" />
        {toast && <div className="gm-toast" key={toast.id}>{toast.text}</div>}
      </div>

      <div className="gm-hud">
        <button type="button" className="gm-btn" onClick={openAreas} disabled={busy}>Khu vực {zone}</button>
        <button type="button" className="gm-btn main" onClick={startLeave}>Về làng quê</button>
        <button type="button" className="gm-btn" onClick={onEditCharacter}>Sửa nhân vật</button>
      </div>
      <div className="gw-clock" data-night={hud.night ? '1' : undefined}>
        <span className="gw-sun" aria-hidden="true" />
        <b>{hud.time}</b>
        <span>{hud.night ? 'Ban đêm' : 'Ban ngày'}{hud.rain ? ' · Trời mưa' : ''}</span>
        <span className="gw-online">{hud.online}/{ZONE_MAX} bạn</span>
      </div>
      {zone !== homeZone && <div className="gw-visit">Đang ở chợ khu {zone}</div>}

      <div className="gm-ctrl">
        <div className="gm-stick" ref={stickRef} aria-label="Cần điều khiển" {...stickProps}>
          <div className="gm-knob" ref={knobRef} />
        </div>
        <div className="gm-act">
          <button type="button" className="gm-btn main big" disabled={!near} onClick={interact}>
            {near ? near.label : 'Đi dạo chợ miền Tây'}
          </button>
          <div className="gm-hint">Lại gần sạp hoặc xuồng ở bến để hỏi mua hàng. Xuống hết chợ để về làng. Máy tính: phím mũi tên hoặc W A S D, phím E để dùng.</div>
        </div>
      </div>

      {panel && (
        <div className="gw-modal" onClick={() => setPanel(false)}>
          <div className="gw-card" onClick={(e) => e.stopPropagation()}>
            <div className="gw-card-t">Chọn khu vực</div>
            <div className="gm-hint">Mỗi khu có tối đa {ZONE_MAX} bạn ở chợ cùng lúc. Em đang ở khu {zone}. Chọn khu khác để gặp các bạn ở đó.</div>
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
              {shards && (shards.length ? shards : [{ shard: homeZone }]).map((s) => (
                <div className="gw-row" key={s.shard}>
                  <span><b>Khu {s.shard}</b>{s.shard === homeZone ? ' · khu nhà em' : ''}</span>
                  <button type="button" className="gm-btn" disabled={s.shard === zone} onClick={() => goZone(s.shard)}>{s.shard === zone ? 'Đang ở đây' : 'Đến khu này'}</button>
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
