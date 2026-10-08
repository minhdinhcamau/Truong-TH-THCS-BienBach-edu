'use client';
// GAME (tách riêng): cảnh trước cổng trường TH - THCS Biển Bạch, đi qua cầu tới cổng. Xóa cùng thư mục components/game khi gỡ game.
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildFrames } from '../../lib/game/sprites';
import {
  ARCH, ARCH_BASE_Y, GATE_BG, GATE_K, GATE_SPAWN, GATE_TEXT, GH, GVH, GVW, GW, SIGN_C, SIGN_TEXT,
  gateBlocked, gateNearest, gateScale,
} from '../../lib/game/gate';

const SPEED = 130;
const STRIDE = 12;
const BOB = [-1, 0, -1, 0];
const STICK_DEAD = 0.16;
const INTRO_HOLD = 1.4;   // giây giữ cận cảnh bảng tên
const INTRO_MOVE = 1.6;   // giây kéo camera về nhân vật
const INTRO_Z = 2.3;

let introShown = false;   // chỉ chiếu cận cảnh bảng tên một lần mỗi lần mở trang

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);

export default function GateView({ cfg, onBackHome, onEditCharacter }) {
  const canvasRef = useRef(null);
  const viewRef = useRef(null);
  const stickRef = useRef(null);
  const knobRef = useRef(null);
  const [near, setNear] = useState(null);
  const [toast, setToast] = useState(null);
  const [signOpen, setSignOpen] = useState(false);
  const [intro, setIntro] = useState(false);
  const S = useRef({
    pos: { x: GATE_SPAWN.x, y: GATE_SPAWN.y },
    vel: { x: 0, y: 0 },
    keys: new Set(),
    stick: { x: 0, y: 0 },
    stickId: null,
    facing: 1,
    dir: 'back',
    phase: 0,
    frame: 0,
    clock: 0,
    nextBlink: 2.2,
    blinkUntil: 0,
    parts: [],
    scale: 1,
    frames: null,
    bg: null,
    glints: [],
    cam: null,
    intro: { on: false, t: 0 },
    nearId: null,
    paused: false,
  }).current;

  const say = useCallback((text) => setToast({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    S.paused = signOpen;
    if (signOpen) {
      S.keys.clear();
      S.stick = { x: 0, y: 0 };
    }
  }, [signOpen, S]);

  useEffect(() => {
    S.frames = buildFrames(cfg);
  }, [cfg, S]);

  // chiếu cận cảnh bảng tên lần đầu
  useEffect(() => {
    if (!introShown) {
      introShown = true;
      S.intro = { on: true, t: 0 };
      setIntro(true);
    }
  }, [S]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      S.bg = img;
      // tìm các điểm nước trên kênh để làm gợn sáng
      try {
        const c = document.createElement('canvas');
        c.width = GW;
        c.height = GH;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0, GW, GH);
        const spots = [];
        for (let tries = 0; tries < 4000 && spots.length < 70; tries++) {
          const x = 10 + Math.floor(Math.random() * (GW - 20));
          const y = 715 + Math.floor(Math.random() * 200);
          const d = cx.getImageData(x, y, 1, 1).data;
          if (d[2] > d[0] + 40 && d[2] > d[1] + 10 && d[2] > 90) spots.push({ x, y, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 0.9 });
        }
        S.glints = spots;
      } catch (e) {
        S.glints = [];
      }
    };
    img.src = GATE_BG;
  }, [S]);

  const interact = useCallback(() => {
    if (S.paused || S.intro.on) return;
    const it = gateNearest(S.pos.x, S.pos.y);
    if (!it) return;
    if (it.id === 've_nha') onBackHome();
    else if (it.id === 'bang') setSignOpen(true);
    else say(GATE_TEXT[it.id]);
  }, [S, say, onBackHome]);

  const skipIntro = useCallback(() => {
    if (S.intro.on && S.intro.t < INTRO_HOLD) S.intro.t = INTRO_HOLD;
  }, [S]);

  useEffect(() => {
    const map = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
    const down = (e) => {
      if (e.key === 'Escape') {
        setSignOpen(false);
        return;
      }
      const k = map[e.key];
      if (k) {
        skipIntro();
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
  }, [S, interact, skipIntro]);

  useEffect(() => {
    const view = viewRef.current;
    const canvas = canvasRef.current;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const n = Math.max(1, Math.min(4, Math.round(((canvas.clientWidth || view.clientWidth) * dpr) / GVW)));
      if (n !== S.scale || canvas.width !== GVW * n) {
        S.scale = n;
        canvas.width = GVW * n;
        canvas.height = GVH * n;
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
      if (!gateBlocked(nx, ny)) {
        S.pos.x = nx;
        S.pos.y = ny;
        return;
      }
      for (let off = 1; off <= 8; off++) {
        for (const sign of [1, -1]) {
          const tx = axis === 'x' ? nx : nx + sign * off;
          const ty = axis === 'x' ? ny + sign * off : ny;
          if (!gateBlocked(tx, ty)) {
            const step = Math.min(off, 1.3);
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

    function targetCam() {
      return {
        x: clamp(S.pos.x - GVW / 2, 0, GW - GVW),
        y: clamp(S.pos.y - GVH * 0.68, 0, GH - GVH),
      };
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

      if (S.intro.on) {
        S.intro.t += dt;
        if (S.intro.t >= INTRO_HOLD + INTRO_MOVE) {
          S.intro.on = false;
          S.cam = targetCam();
          setIntro(false);
        }
      }
      const locked = S.intro.on || S.paused;

      let ix = locked ? 0 : (S.keys.has('r') ? 1 : 0) - (S.keys.has('l') ? 1 : 0) + S.stick.x;
      let iy = locked ? 0 : (S.keys.has('d') ? 1 : 0) - (S.keys.has('u') ? 1 : 0) + S.stick.y;
      const il = Math.hypot(ix, iy);
      if (il > 1) {
        ix /= il;
        iy /= il;
      }
      const has = il > 0.05;
      const k = 1 - Math.exp(-dt * (has ? 15 : 24));
      const sp = SPEED * (gateScale(S.pos.y) / GATE_K);
      S.vel.x += (ix * sp - S.vel.x) * k;
      S.vel.y += (iy * sp - S.vel.y) * k;
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

      // camera đi theo nhân vật, mượt
      const t = targetCam();
      if (!S.cam) S.cam = t;
      else {
        const kc = 1 - Math.exp(-dt * 9);
        S.cam.x += (t.x - S.cam.x) * kc;
        S.cam.y += (t.y - S.cam.y) * kc;
      }

      const it = locked ? null : gateNearest(S.pos.x, S.pos.y);
      const id = it ? it.id : null;
      if (id !== S.nearId) {
        S.nearId = id;
        setNear(it);
      }
    }

    function drawGlints() {
      for (const g of S.glints) {
        const a = 0.5 + 0.5 * Math.sin(S.clock * g.sp * 2 + g.ph);
        if (a < 0.55) continue;
        ctx.fillStyle = `rgba(225,245,255,${(0.55 * (a - 0.55) / 0.45).toFixed(2)})`;
        ctx.fillRect(Math.round(g.x), Math.round(g.y), 5, 1);
        ctx.fillRect(Math.round(g.x) + 2, Math.round(g.y) + 2, 3, 1);
      }
    }

    function drawCharacter(alpha = 1) {
      if (!S.frames) return;
      const px = Math.round(S.pos.x);
      const py = Math.round(S.pos.y);
      const K = gateScale(S.pos.y);
      const q = K / GATE_K;
      const speed = Math.hypot(S.vel.x, S.vel.y);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.fillRect(Math.round(px - 9 * q), py - 3, Math.round(18 * q), 4);
      ctx.fillRect(Math.round(px - 11 * q), py - 2, Math.round(22 * q), 2);
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
      ctx.translate(px, py + bob);
      if (S.facing < 0 && S.dir === 'side') ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -S.frames.ax * K, -S.frames.h * K, S.frames.w * K, S.frames.h * K);
      ctx.restore();
    }

    function draw() {
      const n = S.scale;
      let z = 1;
      let cx = S.cam ? S.cam.x : 0;
      let cy = S.cam ? S.cam.y : 0;
      if (S.intro.on) {
        const u = ease(clamp((S.intro.t - INTRO_HOLD) / INTRO_MOVE, 0, 1));
        z = INTRO_Z + (1 - INTRO_Z) * u;
        const t = targetCam();
        const mx = SIGN_C.x + (t.x + GVW / 2 - SIGN_C.x) * u;
        const my = SIGN_C.y + (t.y + GVH / 2 - SIGN_C.y) * u;
        cx = clamp(mx - GVW / z / 2, 0, GW - GVW / z);
        cy = clamp(my - GVH / z / 2, 0, GH - GVH / z);
      } else {
        cx = Math.round(cx);
        cy = Math.round(cy);
      }
      ctx.setTransform(n * z, 0, 0, n * z, 0, 0);
      ctx.fillStyle = '#2a4a2a';
      ctx.fillRect(0, 0, GW, GH);
      ctx.save();
      ctx.translate(-cx, -cy);
      ctx.imageSmoothingEnabled = z !== 1;
      if (S.bg) ctx.drawImage(S.bg, 0, 0, GW, GH);
      drawGlints();
      drawCharacter();
      for (const p of S.parts) {
        const a = 1 - p.life / p.max;
        ctx.fillStyle = `rgba(225,215,195,${(0.6 * a).toFixed(2)})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
      // mái cổng và bảng tên che nhân vật khi đi vào dưới cổng
      if (S.bg && S.pos.y < ARCH_BASE_Y) {
        ctx.imageSmoothingEnabled = z !== 1;
        ctx.drawImage(S.bg, ARCH.x, ARCH.y, ARCH.w, ARCH.h, ARCH.x, ARCH.y, ARCH.w, ARCH.h);
        // đi khuất sau mái cổng thì vẫn thấy bóng mờ của nhân vật
        if (S.pos.y > ARCH.y - 8 && S.pos.x > ARCH.x - 20 && S.pos.x < ARCH.x + ARCH.w + 20) drawCharacter(0.5);
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
      skipIntro();
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
        <button type="button" className="gm-btn main" onClick={onBackHome}>Về sân nhà</button>
        <button type="button" className="gm-btn" onClick={onEditCharacter}>Sửa nhân vật</button>
      </div>
      <div className="gm-view" ref={viewRef} style={{ '--ar': GVW / GVH }} onPointerDown={skipIntro}>
        <canvas ref={canvasRef} className="gm-room" width={GVW} height={GVH} style={{ touchAction: 'manipulation' }} aria-label="Trước cổng trường" />
        {intro && <div className="gm-intro">Trước cổng Trường TH - THCS Biển Bạch</div>}
        {toast && <div className="gm-toast" key={toast.id}>{toast.text}</div>}
        {signOpen && (
          <div className="gm-signpop" role="dialog" aria-label="Bảng tên trường" onClick={() => setSignOpen(false)}>
            <div className="gm-sign">
              <div className="gm-sign-in">{SIGN_TEXT}</div>
            </div>
            <div className="gm-sign-sub">Xã Biển Bạch, tỉnh Cà Mau</div>
            <div className="gm-sign-close">Chạm để đóng</div>
          </div>
        )}
      </div>
      <div className="gm-ctrl">
        <div className="gm-stick" ref={stickRef} aria-label="Cần điều khiển" {...stickProps}>
          <div className="gm-knob" ref={knobRef} />
        </div>
        <div className="gm-act">
          <button type="button" className="gm-btn main big" disabled={!near} onClick={interact}>
            {near ? near.label : 'Đi dạo trước cổng trường'}
          </button>
          <div className="gm-hint">Đi qua cầu, qua cổng để vào sân trường. Đứng trước cổng để đọc bảng tên. Cuối cầu là đường về nhà.</div>
        </div>
      </div>
    </div>
  );
}
