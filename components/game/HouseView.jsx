'use client';
// GAME (tách riêng): căn nhà, đi lại, sắp xếp đồ và kho. Xóa cùng thư mục components/game khi gỡ game.
import { useCallback, useEffect, useRef, useState } from 'react';
import { renderCharacter } from '../../lib/game/sprites';
import {
  ACT_TEXT, CATALOG, CH, COLS, CW, ROWS, SPAWN, TILE, WALL_H,
  canPlace, findFreeSpot, footBlocked, freePoint, getItemCanvas, getRoomCanvas,
  itemRect, nearestInteract, sanitizeHouse,
} from '../../lib/game/house';

const SPEED = 130; // điểm ảnh mỗi giây

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
  const S = useRef({
    pos: { x: SPAWN.x, y: SPAWN.y },
    keys: new Set(),
    dpad: { x: 0, y: 0 },
    drag: null,
    ghost: null,
    facing: 1,
    t: 0,
    moving: false,
    nearUid: null,
    charCanvas: null,
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

  // nhân vật
  useEffect(() => {
    const cv = document.createElement('canvas');
    renderCharacter(cv, cfg, 1);
    S.charCanvas = cv;
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
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
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

  // vòng lặp cập nhật và vẽ
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let last = performance.now();

    function update(dt) {
      if (S.mode !== 'play') {
        S.moving = false;
        if (S.nearUid) {
          S.nearUid = null;
          setNear(null);
        }
        return;
      }
      let dx = (S.keys.has('r') ? 1 : 0) - (S.keys.has('l') ? 1 : 0) + S.dpad.x;
      let dy = (S.keys.has('d') ? 1 : 0) - (S.keys.has('u') ? 1 : 0) + S.dpad.y;
      dx = Math.max(-1, Math.min(1, dx));
      dy = Math.max(-1, Math.min(1, dy));
      S.moving = dx !== 0 || dy !== 0;
      if (S.moving) {
        const len = Math.hypot(dx, dy);
        const nx = S.pos.x + (dx / len) * SPEED * dt;
        const ny = S.pos.y + (dy / len) * SPEED * dt;
        if (!footBlocked(nx, S.pos.y, S.house.placed)) S.pos.x = nx;
        if (!footBlocked(S.pos.x, ny, S.house.placed)) S.pos.y = ny;
        if (dx !== 0) S.facing = dx > 0 ? 1 : -1;
        S.t += dt;
      }
      const it = nearestInteract(S.pos.x, S.pos.y, S.house.placed);
      const uid = it ? it.uid : null;
      if (uid !== S.nearUid) {
        S.nearUid = uid;
        setNear(it ? { uid: it.uid, type: it.type } : null);
      }
    }

    function drawCharacter() {
      const px = Math.round(S.pos.x);
      const py = Math.round(S.pos.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(px - 9, py - 3, 18, 4);
      ctx.fillRect(px - 12, py - 2, 24, 2);
      if (!S.charCanvas) return;
      const bob = S.moving ? Math.round(Math.abs(Math.sin(S.t * 14)) * 2) : 0;
      ctx.save();
      ctx.translate(px, py - bob);
      if (S.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(S.charCanvas, -14, -80);
      ctx.restore();
    }

    function draw() {
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
      list.sort((a, b) => a.key - b.key);
      for (const e of list) {
        if (e.char) {
          drawCharacter();
        } else {
          drawItem(e);
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
    S.dpad = { x: 0, y: 0 };
    setSelected(null);
    setMode('edit');
  }
  function leaveEdit() {
    S.drag = null;
    S.ghost = null;
    setSelected(null);
    setMode('play');
  }

  const holdPad = (x, y) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      S.dpad = { x, y };
    },
    onPointerUp: () => { S.dpad = { x: 0, y: 0 }; },
    onPointerCancel: () => { S.dpad = { x: 0, y: 0 }; },
    onLostPointerCapture: () => { S.dpad = { x: 0, y: 0 }; },
    onContextMenu: (e) => e.preventDefault(),
  });

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

      <div className="gm-view" data-mode={mode}>
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
          <div className="gm-pad" aria-label="Nút di chuyển">
            <button type="button" className="u" aria-label="Lên" {...holdPad(0, -1)}>▲</button>
            <button type="button" className="l" aria-label="Sang trái" {...holdPad(-1, 0)}>◀</button>
            <button type="button" className="r" aria-label="Sang phải" {...holdPad(1, 0)}>▶</button>
            <button type="button" className="d" aria-label="Xuống" {...holdPad(0, 1)}>▼</button>
          </div>
          <div className="gm-act">
            <button type="button" className="gm-btn main big" disabled={!near} onClick={interact}>
              {near ? CATALOG[near.type].act : 'Đến gần đồ vật để dùng'}
            </button>
            <div className="gm-hint">Máy tính: phím mũi tên hoặc W A S D để đi, phím E để dùng đồ.</div>
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
