'use client';
// GAME (tách riêng): căn nhà, đi lại, sắp xếp đồ và kho. Xóa cùng thư mục components/game khi gỡ game.
import { useCallback, useEffect, useRef, useState } from 'react';
import { WALK_POSES, renderCharacter } from '../../lib/game/sprites';
import {
  ACT_TEXT, CATALOG, CH, COLS, CW, ROWS, SPAWN, TILE, WALL_H,
  canPlace, findFreeSpot, footBlocked, freePoint, getItemCanvas, getRoomCanvas,
  itemRect, nearestInteract, sanitizeHouse,
} from '../../lib/game/house';

const SPEED = 128;      // tốc độ tối đa, điểm ảnh mỗi giây
const STRIDE = 12;      // quãng đường cho mỗi nhịp bước chân
const BOB = [-1, 0, -1, 0];
const STICK_DEAD = 0.16;

function ItemThumb({ type }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    const src = getItemCanvas(type);
    if (!cv || !src) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    const k = Math.min(cv.width / src.width, cv.height / src.height);
    const w = Math.round(src.width * k);
    const h = Math.round(src.height * k);
    ctx.drawImage(src, Math.floor((cv.width - w) / 2), Math.floor((cv.height - h) / 2), w, h);
  }, [type]);
  return <canvas ref={ref} width={64} height={64} className="gm-thumb" />;
}

export default function HouseView({ cfg, initialHouse, onSaveHouse, onEditCharacter }) {
  const [house, setHouse] = useState(() => sanitizeHouse(initialHouse));
  const [mode, setMode] = useState('play');
  const [selected, setSelected] = useState(null);
  const [near, setNear] = useState(null);
  const [toast, setToast] = useState(null);
  const [saveState, setSaveState] = useState('saved');
  const canvasRef = useRef(null);
  const viewRef = useRef(null);
  const stickRef = useRef(null);
  const knobRef = useRef(null);
  const S = useRef({
    pos: { x: SPAWN.x, y: SPAWN.y },
    vel: { x: 0, y: 0 },
    keys: new Set(),
    stick: { x: 0, y: 0 },
    stickId: null,
    drag: null,
    ghost: null,
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
    nearUid: null,
    dirty: false,
    first: true,
  }).current;
  // bản sao mới nhất cho vòng lặp vẽ
  S.house = house;
  S.mode = mode;
  S.selected = selected;

  const say = useCallback((text) => {
    setToast({ text, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // các khung hình của nhân vật: đứng, bước, nhìn từ sau, chớp mắt
  useEffect(() => {
    const mk = (pose) => {
      const cv = document.createElement('canvas');
      renderCharacter(cv, cfg, 1, pose);
      return cv;
    };
    const front = WALK_POSES.map((p) => mk(p));
    front[2] = front[0];
    const back = WALK_POSES.map((p) => mk({ ...p, back: true }));
    back[2] = back[0];
    S.frames = { front, back, blink: mk({ blink: true }) };
  }, [cfg, S]);

  // lưu tự động sau 0,7 giây kể từ lần đổi cuối
  useEffect(() => {
    if (S.first) {
      S.first = false;
      return undefined;
    }
    S.dirty = true;
    setSaveState('dirty');
    const t = setTimeout(async () => {
      setSaveState('saving');
      const ok = await onSaveHouse(house);
      if (ok) S.dirty = false;
      setSaveState(ok ? 'saved' : 'error');
    }, 700);
    return () => clearTimeout(t);
  }, [house]); // eslint-disable-line react-hooks/exhaustive-deps
  // rời trang khi còn thay đổi chưa lưu thì lưu nốt
  useEffect(() => () => {
    if (S.dirty) onSaveHouse(S.house);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // đồ mới đặt đè lên nhân vật thì đưa nhân vật ra chỗ trống
  useEffect(() => {
    if (footBlocked(S.pos.x, S.pos.y, house.placed)) {
      const p = freePoint(S.pos.x, S.pos.y, house.placed);
      S.pos.x = p.x;
      S.pos.y = p.y;
      S.vel.x = 0;
      S.vel.y = 0;
    }
  }, [house, S]);

  const interact = useCallback(() => {
    const it = nearestInteract(S.pos.x, S.pos.y, S.house.placed);
    if (it) say(ACT_TEXT[it.type] || CATALOG[it.type].act);
  }, [S, say]);

  // bàn phím
  useEffect(() => {
    const map = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
    const down = (e) => {
      if (S.mode !== 'play') return;
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

  // độ phân giải của canvas theo cỡ màn hình, để hình luôn nét và không nhấp nháy khi di chuyển
  useEffect(() => {
    const view = viewRef.current;
    const canvas = canvasRef.current;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const n = Math.max(1, Math.min(4, Math.round((view.clientWidth * dpr) / CW)));
      if (n !== S.scale || canvas.width !== CW * n) {
        S.scale = n;
        canvas.width = CW * n;
        canvas.height = CH * n;
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

  // vòng lặp cập nhật và vẽ
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let last = performance.now();

    // thử đi theo một trục; nếu vướng góc đồ thì trượt nhẹ để lọt qua khe và cửa
    function moveAxis(axis, d, assist) {
      if (d === 0) return;
      const placed = S.house.placed;
      const nx = axis === 'x' ? S.pos.x + d : S.pos.x;
      const ny = axis === 'y' ? S.pos.y + d : S.pos.y;
      if (!footBlocked(nx, ny, placed)) {
        S.pos.x = nx;
        S.pos.y = ny;
        return;
      }
      if (assist) {
        for (let off = 1; off <= 9; off++) {
          for (const sign of [1, -1]) {
            const tx = axis === 'x' ? nx : nx + sign * off;
            const ty = axis === 'x' ? ny + sign * off : ny;
            if (!footBlocked(tx, ty, placed)) {
              const step = Math.min(off, 1.2);
              if (axis === 'x') S.pos.y += sign * step;
              else S.pos.x += sign * step;
              return;
            }
          }
        }
      }
      if (axis === 'x') S.vel.x = 0;
      else S.vel.y = 0;
    }

    function spawnDust(n) {
      for (let i = 0; i < n; i++) {
        S.parts.push({
          x: S.pos.x + (Math.random() - 0.5) * 12,
          y: S.pos.y - 1,
          vx: (Math.random() - 0.5) * 14,
          vy: -6 - Math.random() * 8,
          life: 0,
          max: 0.32 + Math.random() * 0.15,
        });
      }
      if (S.parts.length > 40) S.parts.splice(0, S.parts.length - 40);
    }

    function update(dt) {
      S.clock += dt;
      // bụi
      for (const p of S.parts) {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 24 * dt;
      }
      S.parts = S.parts.filter((p) => p.life < p.max);

      if (S.mode !== 'play') {
        S.vel.x = 0;
        S.vel.y = 0;
        S.frame = 0;
        S.phase = 0;
        if (S.nearUid) {
          S.nearUid = null;
          setNear(null);
        }
        return;
      }

      // hướng điều khiển: bàn phím (đủ lực) hoặc cần điều khiển cảm ứng (nhẹ hoặc mạnh)
      let ix = (S.keys.has('r') ? 1 : 0) - (S.keys.has('l') ? 1 : 0) + S.stick.x;
      let iy = (S.keys.has('d') ? 1 : 0) - (S.keys.has('u') ? 1 : 0) + S.stick.y;
      const il = Math.hypot(ix, iy);
      if (il > 1) {
        ix /= il;
        iy /= il;
      }
      const has = il > 0.05;

      // tăng tốc và giảm tốc êm, không giật
      const tx = ix * SPEED;
      const ty = iy * SPEED;
      const k = 1 - Math.exp(-dt * (has ? 15 : 24));
      S.vel.x += (tx - S.vel.x) * k;
      S.vel.y += (ty - S.vel.y) * k;
      if (!has && Math.hypot(S.vel.x, S.vel.y) < 4) {
        S.vel.x = 0;
        S.vel.y = 0;
      }

      const sx = S.vel.x * dt;
      const sy = S.vel.y * dt;
      moveAxis('x', sx, Math.abs(iy) < 0.25);
      moveAxis('y', sy, Math.abs(ix) < 0.25);

      const speed = Math.hypot(S.vel.x, S.vel.y);
      const moving = speed > 8;
      if (has) {
        if (Math.abs(ix) > 0.2) S.facing = ix > 0 ? 1 : -1;
        S.dir = iy < 0 && -iy >= Math.abs(ix) * 0.8 ? 'back' : 'front';
      }
      if (moving) {
        S.phase += (speed * dt) / STRIDE;
        const f = Math.floor(S.phase) % 4;
        if (f !== S.frame) {
          S.frame = f;
          if (f === 1 || f === 3) spawnDust(speed > 70 ? 2 : 1);
        }
      } else {
        S.phase = 0;
        S.frame = 0;
      }

      // chớp mắt khi đứng yên
      if (!moving && S.clock >= S.nextBlink) {
        S.blinkUntil = S.clock + 0.13;
        S.nextBlink = S.clock + 2.4 + Math.random() * 3;
      }

      const it = nearestInteract(S.pos.x, S.pos.y, S.house.placed);
      const uid = it ? it.uid : null;
      if (uid !== S.nearUid) {
        S.nearUid = uid;
        setNear(it ? { uid: it.uid, type: it.type } : null);
      }
    }

    function drawCharacter() {
      const n = S.scale;
      const px = Math.round(S.pos.x * n) / n;
      const py = Math.round(S.pos.y * n) / n;
      const speed = Math.hypot(S.vel.x, S.vel.y);
      // bóng dưới chân
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.fillRect(px - 9, py - 3, 18, 4);
      ctx.fillRect(px - 12, py - 2, 24, 2);
      if (!S.frames) return;
      let img;
      let bob = 0;
      if (speed > 8) {
        img = (S.dir === 'back' ? S.frames.back : S.frames.front)[S.frame];
        bob = BOB[S.frame];
      } else if (S.dir === 'front' && S.clock < S.blinkUntil) {
        img = S.frames.blink;
      } else {
        img = (S.dir === 'back' ? S.frames.back : S.frames.front)[0];
      }
      ctx.save();
      ctx.translate(px, py + bob);
      if (S.facing < 0 && S.dir === 'front') ctx.scale(-1, 1);
      ctx.drawImage(img, -14, -80);
      ctx.restore();
    }

    function drawDust() {
      for (const p of S.parts) {
        const a = 1 - p.life / p.max;
        const s = a > 0.55 ? 3 : 2;
        ctx.fillStyle = `rgba(255,255,255,${(0.55 * a).toFixed(2)})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      }
    }

    function draw() {
      const n = S.scale;
      ctx.setTransform(n, 0, 0, n, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const room = getRoomCanvas();
      if (room) ctx.drawImage(room, 0, 0);
      ctx.save();
      ctx.translate(0, WALL_H);

      if (S.mode === 'edit') {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        for (let x = 0; x <= COLS; x++) ctx.fillRect(x * TILE, 0, 1, ROWS * TILE);
        for (let y = 0; y <= ROWS; y++) ctx.fillRect(0, y * TILE, CW, 1);
      }

      const drag = S.drag;
      const at = (it) => (drag && drag.uid === it.uid && S.ghost ? S.ghost : it);
      const rugs = [];
      const list = [];
      for (const it of S.house.placed) {
        const d = CATALOG[it.type];
        const p = at(it);
        const entry = { it, p, d, key: (p.y + d.h) * TILE + (drag && drag.uid === it.uid ? 1000 : 0) };
        if (d.layer === 'rug') rugs.push(entry);
        else list.push(entry);
      }
      const drawItem = (e) => {
        const cv = getItemCanvas(e.it.type);
        if (!cv) return;
        ctx.drawImage(cv, e.p.x * TILE, e.p.y * TILE);
      };
      rugs.sort((a, b) => a.key - b.key).forEach(drawItem);
      list.push({ char: true, key: S.pos.y });
      list.push({ fx: true, key: S.pos.y - 0.5 });
      list.sort((a, b) => a.key - b.key);
      for (const e of list) {
        if (e.char) drawCharacter();
        else if (e.fx) drawDust();
        else drawItem(e);
      }

      // mũi tên nhấp nhô báo món có thể dùng
      if (S.mode === 'play' && S.nearUid) {
        const it = S.house.placed.find((p) => p.uid === S.nearUid);
        if (it) {
          const r = itemRect(it.type, it.x, it.y);
          const bx = Math.round(r.x + r.w / 2);
          const by = Math.round(r.y - 6 + Math.sin(S.clock * 6) * 2);
          ctx.fillStyle = '#1c1a26';
          ctx.fillRect(bx - 7, by - 9, 14, 3);
          ctx.fillRect(bx - 5, by - 6, 10, 3);
          ctx.fillRect(bx - 3, by - 3, 6, 3);
          ctx.fillRect(bx - 1, by, 2, 2);
          ctx.fillStyle = '#ffd45c';
          ctx.fillRect(bx - 6, by - 8, 12, 2);
          ctx.fillRect(bx - 4, by - 5, 8, 2);
          ctx.fillRect(bx - 2, by - 2, 4, 2);
        }
      }

      // tô màu ô đang kéo (xanh được, đỏ không được)
      if (drag && S.ghost) {
        const r = itemRect(drag.type, S.ghost.x, S.ghost.y);
        ctx.fillStyle = S.ghost.valid ? 'rgba(60,220,120,0.38)' : 'rgba(240,70,70,0.45)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      // khung vàng quanh món đang chọn
      if (S.mode === 'edit' && S.selected) {
        const it = S.house.placed.find((p) => p.uid === S.selected);
        if (it) {
          const p = at(it);
          const r = itemRect(it.type, p.x, p.y);
          ctx.fillStyle = '#ffd45c';
          ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, 3);
          ctx.fillRect(r.x - 2, r.y + r.h - 1, r.w + 4, 3);
          ctx.fillRect(r.x - 2, r.y - 2, 3, r.h + 4);
          ctx.fillRect(r.x + r.w - 1, r.y - 2, 3, r.h + 4);
        }
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

  // ----- kéo thả khi sắp xếp đồ -----
  function toWorld(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * CW) / r.width, y: ((e.clientY - r.top) * CH) / r.height - WALL_H };
  }
  function onPointerDown(e) {
    if (S.mode !== 'edit') return;
    const p = toWorld(e);
    const cands = S.house.placed
      .map((it) => ({ it, d: CATALOG[it.type], r: itemRect(it.type, it.x, it.y) }))
      .filter((c) => p.x >= c.r.x && p.x < c.r.x + c.r.w && p.y >= c.r.y && p.y < c.r.y + c.r.h)
      .sort((a, b) => (a.d.layer === 'rug') - (b.d.layer === 'rug') || b.r.y + b.r.h - (a.r.y + a.r.h));
    const hitItem = cands[0];
    if (!hitItem) {
      setSelected(null);
      return;
    }
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    setSelected(hitItem.it.uid);
    S.drag = { uid: hitItem.it.uid, type: hitItem.it.type, offX: p.x - hitItem.r.x, offY: p.y - hitItem.r.y };
    S.ghost = { x: hitItem.it.x, y: hitItem.it.y, valid: true };
  }
  function onPointerMove(e) {
    if (!S.drag) return;
    const p = toWorld(e);
    const tx = Math.round((p.x - S.drag.offX) / TILE);
    const ty = Math.round((p.y - S.drag.offY) / TILE);
    S.ghost = { x: tx, y: ty, valid: canPlace(S.drag.type, tx, ty, S.house.placed, S.drag.uid) };
  }
  function endDrag() {
    const d = S.drag;
    const g = S.ghost;
    S.drag = null;
    S.ghost = null;
    if (d && g && g.valid) {
      setHouse((h) => ({ ...h, placed: h.placed.map((it) => (it.uid === d.uid ? { ...it, x: g.x, y: g.y } : it)) }));
    } else if (d && g && !g.valid) {
      say('Chỗ này chưa đặt được, đồ về chỗ cũ.');
    }
  }

  function storeSelected() {
    const it = house.placed.find((p) => p.uid === selected);
    if (!it) return;
    setHouse((h) => ({
      ...h,
      placed: h.placed.filter((p) => p.uid !== it.uid),
      inv: [...h.inv, { uid: it.uid, type: it.type }],
    }));
    setSelected(null);
    say(`Đã cất ${CATALOG[it.type].label.toLowerCase()} vào kho.`);
  }
  function takeOut(type) {
    const item = house.inv.find((i) => i.type === type);
    if (!item) return;
    const spot = findFreeSpot(type, house.placed);
    if (!spot) {
      say('Nhà hết chỗ trống rồi, hãy cất bớt đồ.');
      return;
    }
    setHouse((h) => ({
      ...h,
      inv: h.inv.filter((i) => i.uid !== item.uid),
      placed: [...h.placed, { uid: item.uid, type, x: spot.x, y: spot.y }],
    }));
    setSelected(item.uid);
    say('Đã đặt ra giữa nhà, kéo để đưa tới chỗ em thích.');
  }

  function enterEdit() {
    S.keys.clear();
    S.stick = { x: 0, y: 0 };
    setSelected(null);
    setMode('edit');
  }
  function leaveEdit() {
    S.drag = null;
    S.ghost = null;
    setSelected(null);
    setMode('play');
  }

  // ----- cần điều khiển cảm ứng (kéo nhẹ đi chậm, kéo xa đi nhanh, đi chéo được) -----
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

  // gom kho theo loại
  const groups = [];
  for (const it of house.inv) {
    const g = groups.find((x) => x.type === it.type);
    if (g) g.n += 1;
    else groups.push({ type: it.type, n: 1 });
  }
  const statusText = { saved: 'Đã lưu', dirty: 'Chờ lưu…', saving: 'Đang lưu…', error: 'Chưa lưu được' }[saveState];

  return (
    <div className="gm-house">
      <div className="gm-hud">
        {mode === 'play' ? (
          <button type="button" className="gm-btn" onClick={enterEdit}>Sắp xếp đồ</button>
        ) : (
          <button type="button" className="gm-btn main" onClick={leaveEdit}>Xong</button>
        )}
        <button type="button" className="gm-btn" onClick={onEditCharacter}>Sửa nhân vật</button>
        <span className={`gm-status ${saveState}`}>{statusText}</span>
      </div>

      <div className="gm-view" data-mode={mode} ref={viewRef}>
        <canvas
          ref={canvasRef}
          className="gm-room"
          width={CW}
          height={CH}
          style={{ touchAction: mode === 'edit' ? 'none' : 'manipulation' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label="Căn nhà của em"
        />
        {toast && <div className="gm-toast" key={toast.id}>{toast.text}</div>}
      </div>

      {mode === 'play' ? (
        <div className="gm-ctrl">
          <div className="gm-stick" ref={stickRef} aria-label="Cần điều khiển" {...stickProps}>
            <div className="gm-knob" ref={knobRef} />
          </div>
          <div className="gm-act">
            <button type="button" className="gm-btn main big" disabled={!near} onClick={interact}>
              {near ? CATALOG[near.type].act : 'Đến gần đồ vật để dùng'}
            </button>
            <div className="gm-hint">Điện thoại: đặt ngón tay lên cần tròn rồi kéo. Máy tính: phím mũi tên hoặc W A S D, phím E để dùng đồ.</div>
          </div>
        </div>
      ) : (
        <div className="gm-edit">
          <div className="gm-hint">Chạm vào đồ để chọn, kéo để đưa đến ô khác. Đồ không đặt được sẽ về chỗ cũ.</div>
          <div className="gm-actions" style={{ marginTop: 8 }}>
            <button type="button" className="gm-btn" disabled={!selected} onClick={storeSelected}>
              {selected ? `Cất ${CATALOG[house.placed.find((p) => p.uid === selected)?.type || 'ghe'].label.toLowerCase()} vào kho` : 'Cất vào kho'}
            </button>
          </div>
          <div className="gm-lbl" style={{ marginTop: 14 }}>Kho đồ ({house.inv.length})</div>
          {groups.length === 0 ? (
            <div className="gm-hint">Kho đang trống. Chọn một món trong nhà rồi bấm "Cất vào kho".</div>
          ) : (
            <div className="gm-inv">
              {groups.map((g) => (
                <button key={g.type} type="button" className="gm-card" onClick={() => takeOut(g.type)}>
                  <ItemThumb type={g.type} />
                  <span className="n">{CATALOG[g.type].label}</span>
                  <span className="c">x{g.n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
