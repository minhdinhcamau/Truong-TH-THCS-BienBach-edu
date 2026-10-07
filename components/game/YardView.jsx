'use client';
// GAME (tách riêng): sân nhà miền Tây, đi lại ngoài trời. Xóa cùng thư mục components/game khi gỡ game.
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildFrames } from '../../lib/game/sprites';
import { POND, VH, YARD_BG, YARD_K, YARD_SPAWN, YARD_TEXT, YH, YW, yardBlocked, yardNearest } from '../../lib/game/yard';

const SPEED = 100;
const STRIDE = 10;
const BOB = [-1, 0, -1, 0];
const STICK_DEAD = 0.16;
const FISH = [
  { a: 0.0, sp: 0.5, rx: 62, ry: 32, c: '#f08a2c' },
  { a: 2.1, sp: -0.38, rx: 48, ry: 24, c: '#f4f0e6' },
  { a: 4.0, sp: 0.62, rx: 70, ry: 36, c: '#e8602a' },
  { a: 5.2, sp: -0.45, rx: 36, ry: 18, c: '#f6c24a' },
];

export default function YardView({ cfg, onEnterHouse, onEditCharacter, from }) {
  const canvasRef = useRef(null);
  const viewRef = useRef(null);
  const stickRef = useRef(null);
  const knobRef = useRef(null);
  const [near, setNear] = useState(null);
  const [toast, setToast] = useState(null);
  const S = useRef({
    pos: { x: YARD_SPAWN.x, y: YARD_SPAWN.y },
    vel: { x: 0, y: 0 },
    keys: new Set(),
    stick: { x: 0, y: 0 },
    stickId: null,
    facing: 1,
    dir: 'front',
    phase: 0,
    frame: 0,
    clock: 0,
    nextBlink: 2.2,
    blinkUntil: 0,
    parts: [],
    scale: 1,
    frames: null,
    bg: null,
    nearId: null,
  }).current;

  const say = useCallback((text) => setToast({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    S.frames = buildFrames(cfg);
  }, [cfg, S]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { S.bg = img; };
    img.src = YARD_BG;
  }, [S]);

  const interact = useCallback(() => {
    const it = yardNearest(S.pos.x, S.pos.y);
    if (!it) return;
    if (it.id === 'cua') onEnterHouse();
    else say(YARD_TEXT[it.id]);
  }, [S, say, onEnterHouse]);

  useEffect(() => {
    const map = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
    const down = (e) => {
      const k = map[e.key];
      if (k) {
        S.keys.add(k);
        e.preventDefault();
      } else if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && !e.repeat) {
        interact();
      }
    };
    const up = (e) => {
      const k = map[e.key];
      if (k) S.keys.delete(k);
    };
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

  useEffect(() => {
    const view = viewRef.current;
    const canvas = canvasRef.current;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const n = Math.max(1, Math.min(4, Math.round((view.clientWidth * dpr) / YW)));
      if (n !== S.scale || canvas.width !== YW * n) {
        S.scale = n;
        canvas.width = YW * n;
        canvas.height = VH * n;
      }
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(view);
    window.addEventListener('resize', fit);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [S]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let last = performance.now();

    function moveAxis(axis, d) {
      if (d === 0) return;
      const nx = axis === 'x' ? S.pos.x + d : S.pos.x;
      const ny = axis === 'y' ? S.pos.y + d : S.pos.y;
      if (!yardBlocked(nx, ny)) {
        S.pos.x = nx;
        S.pos.y = ny;
        return;
      }
      for (let off = 1; off <= 8; off++) {
        for (const sign of [1, -1]) {
          const tx = axis === 'x' ? nx : nx + sign * off;
          const ty = axis === 'x' ? ny + sign * off : ny;
          if (!yardBlocked(tx, ty)) {
            const step = Math.min(off, 1.1);
            if (axis === 'x') S.pos.y += sign * step;
            else S.pos.x += sign * step;
            return;
          }
        }
      }
      if (axis === 'x') S.vel.x = 0;
      else S.vel.y = 0;
    }

    function spawnDust(n) {
      for (let i = 0; i < n; i++) {
        S.parts.push({ x: S.pos.x + (Math.random() - 0.5) * 10, y: S.pos.y - 1, vx: (Math.random() - 0.5) * 12, vy: -5 - Math.random() * 7, life: 0, max: 0.3 + Math.random() * 0.15 });
      }
      if (S.parts.length > 30) S.parts.splice(0, S.parts.length - 30);
    }

    function update(dt) {
      S.clock += dt;
      for (const p of S.parts) {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 24 * dt;
      }
      S.parts = S.parts.filter((p) => p.life < p.max);

      let ix = (S.keys.has('r') ? 1 : 0) - (S.keys.has('l') ? 1 : 0) + S.stick.x;
      let iy = (S.keys.has('d') ? 1 : 0) - (S.keys.has('u') ? 1 : 0) + S.stick.y;
      const il = Math.hypot(ix, iy);
      if (il > 1) {
        ix /= il;
        iy /= il;
      }
      const has = il > 0.05;
      const k = 1 - Math.exp(-dt * (has ? 15 : 24));
      S.vel.x += (ix * SPEED - S.vel.x) * k;
      S.vel.y += (iy * SPEED - S.vel.y) * k;
      if (!has && Math.hypot(S.vel.x, S.vel.y) < 4) {
        S.vel.x = 0;
        S.vel.y = 0;
      }
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
        if (f !== S.frame) {
          S.frame = f;
          if (f === 1 || f === 3) spawnDust(1);
        }
      } else {
        S.phase = 0;
        S.frame = 0;
      }
      if (!moving && S.clock >= S.nextBlink) {
        S.blinkUntil = S.clock + 0.13;
        S.nextBlink = S.clock + 2.4 + Math.random() * 3;
      }
      const it = yardNearest(S.pos.x, S.pos.y);
      const id = it ? it.id : null;
      if (id !== S.nearId) {
        S.nearId = id;
        setNear(it);
      }
    }

    function drawFish() {
      for (const f of FISH) {
        const a = f.a + S.clock * f.sp;
        const x = POND.cx + Math.cos(a) * f.rx;
        const y = POND.cy + Math.sin(a) * f.ry;
        const dx = -Math.sin(a) * f.sp;
        const dir = dx >= 0 ? 1 : -1;
        ctx.fillStyle = 'rgba(20,60,80,0.35)';
        ctx.fillRect(Math.round(x - 4 * dir - 1), Math.round(y + 2), 8, 2);
        ctx.fillStyle = f.c;
        ctx.fillRect(Math.round(x - 3), Math.round(y - 1), 6, 3);
        ctx.fillRect(Math.round(x - 3 * dir - (dir > 0 ? 2 : -0)), Math.round(y - 2 + (Math.floor(S.clock * 6) % 2)), 2, 4);
        ctx.fillStyle = '#1c1a26';
        ctx.fillRect(Math.round(x + 2 * dir), Math.round(y - 1), 1, 1);
      }
      // gợn nước
      const r = (S.clock * 14) % 24;
      ctx.strokeStyle = `rgba(255,255,255,${(0.35 * (1 - r / 24)).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(POND.cx + 26, POND.cy - 8, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawCharacter() {
      if (!S.frames) return;
      const px = Math.round(S.pos.x);
      const py = Math.round(S.pos.y);
      const speed = Math.hypot(S.vel.x, S.vel.y);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(px - 8, py - 3, 16, 4);
      ctx.fillRect(px - 10, py - 2, 20, 2);
      const set = S.frames[S.dir] || S.frames.front;
      let img;
      let bob = 0;
      if (speed > 8) {
        img = set[S.frame];
        bob = BOB[S.frame];
      } else if (S.dir !== 'back' && S.clock < S.blinkUntil) {
        img = S.dir === 'side' ? S.frames.blinkSide : S.frames.blinkFront;
      } else {
        img = set[0];
      }
      const K = YARD_K;
      ctx.save();
      ctx.translate(px, py + bob);
      if (S.facing < 0 && S.dir === 'side') ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -S.frames.ax * K, -S.frames.h * K, S.frames.w * K, S.frames.h * K);
      ctx.restore();
    }

    function draw() {
      const n = S.scale;
      const camY = Math.max(0, Math.min(YH - VH, S.pos.y - VH * 0.62));
      ctx.setTransform(n, 0, 0, n, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#3a5a2a';
      ctx.fillRect(0, 0, YW, VH);
      ctx.save();
      ctx.translate(0, -Math.round(camY));
      if (S.bg) ctx.drawImage(S.bg, 0, 0, YW, YH);
      drawFish();
      drawCharacter();
      for (const p of S.parts) {
        const a = 1 - p.life / p.max;
        ctx.fillStyle = `rgba(230,200,150,${(0.6 * a).toFixed(2)})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
      ctx.restore();
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
  }, [S]);

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
    const len = Math.hypot(vx, vy) || 1;
    const clamped = Math.min(len, maxR);
    vx = (vx / len) * clamped;
    vy = (vy / len) * clamped;
    knob.style.transform = `translate(${vx}px, ${vy}px)`;
    const mag = clamped / maxR;
    if (mag < STICK_DEAD) {
      S.stick = { x: 0, y: 0 };
    } else {
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
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      S.stickId = e.pointerId;
      stickUpdate(e);
    },
    onPointerMove: (e) => {
      if (S.stickId === e.pointerId) stickUpdate(e);
    },
    onPointerUp: stickEnd,
    onPointerCancel: stickEnd,
    onLostPointerCapture: stickEnd,
    onContextMenu: (e) => e.preventDefault(),
  };

  return (
    <div className="gm-house">
      <div className="gm-hud">
        <button type="button" className="gm-btn main" onClick={onEnterHouse}>Vào nhà</button>
        <button type="button" className="gm-btn" onClick={onEditCharacter}>Sửa nhân vật</button>
      </div>
      <div className="gm-view" ref={viewRef}>
        <canvas ref={canvasRef} className="gm-room" width={YW} height={VH} style={{ touchAction: 'manipulation' }} aria-label="Sân nhà em" />
        {toast && <div className="gm-toast" key={toast.id}>{toast.text}</div>}
      </div>
      <div className="gm-ctrl">
        <div className="gm-stick" ref={stickRef} aria-label="Cần điều khiển" {...stickProps}>
          <div className="gm-knob" ref={knobRef} />
        </div>
        <div className="gm-act">
          <button type="button" className="gm-btn main big" disabled={!near} onClick={interact}>
            {near ? near.label : 'Đi dạo quanh sân'}
          </button>
          <div className="gm-hint">Phía sau là sông, bên trái là vườn rau, bên phải là ao cá. Đi thẳng ra cổng sẽ tới con đường đất.</div>
        </div>
      </div>
    </div>
  );
}
