// GAME (tách riêng): map làng quê MIỀN TÂY dựng bằng code (pixel rõ nét), mỗi khu 10 nhà.
// Mọi máy dựng ra cùng một map vì dùng bộ số ngẫu nhiên cố định. Không dùng ảnh nền.
export const T = 16;                       // 1 ô = 16 đơn vị
export const MW = 156;
export const MH = 81;
export const WW = MW * T;
export const WH = MH * T;
export const PLOTS_PER_SHARD = 10;
export const CHAR_H = 36;
export const SPEED = 118;
export const VIEW_W = 640;                 // bề ngang khung nhìn mong muốn (đơn vị)

export const K = { GRASS: 0, ROAD: 1, WATER: 2, PLANK: 3, YARD: 4, SOIL: 5, PATH: 6, POND: 7 };

// Các cấp nhà. Ảnh nhà là ảnh pixel đã tách nền, được thu nhỏ đúng cỡ khi vẽ để cùng độ mịn với map.
export const LEVELS = [
  {
    id: 0, name: 'Nhà lá', img: '/game/nha-la.png', w: 116, ar: 273 / 480, doorOff: 0,
    lights: [{ dx: 0.0, dy: 0.2, r: 84, kind: 'oil' }, { dx: -0.23, dy: 0.48, r: 34, kind: 'oildim' }],
    desc: 'Nhà lá vách lá, đèn dầu leo lét.',
  },
  {
    id: 1, name: 'Nhà mái tôn', img: '/game/nha-ton.png', w: 142, ar: 210 / 480, doorOff: 0.16,
    lights: [{ dx: 0.06, dy: 0.55, r: 64, kind: 'steady' }, { dx: 0.27, dy: 0.55, r: 64, kind: 'steady' }, { dx: 0.16, dy: 0.3, r: 96, kind: 'steady' }],
    desc: 'Nhà cấp bốn mái tôn, cửa kính, đèn tường.',
  },
  {
    id: 2, name: 'Nhà mái ngói', img: '/game/nha-ngoi.png', w: 132, ar: 324 / 480, doorOff: -0.17,
    lights: [{ dx: -0.34, dy: 0.42, r: 54, kind: 'steady' }, { dx: 0.0, dy: 0.42, r: 54, kind: 'steady' }, { dx: 0.4, dy: 0.4, r: 54, kind: 'steady' }, { dx: -0.17, dy: 0.22, r: 100, kind: 'steady' }],
    desc: 'Nhà mái ngói khang trang, cửa kính lớn.',
  },
];
export const MAX_LEVEL = LEVELS.length - 1;

// ---------- mảnh đất ----------
// 10 mảnh: hàng bắc (0-4) và hàng nam (5-9). Cửa nhà luôn quay xuống phía nam, ra con đường phía trước.
export function plotInfo(i) {
  const row = i < 5 ? 0 : 1;
  const col = i % 5;
  const x0 = 9 + col * 26;
  const y0 = row ? 41 : 9;
  return {
    i, row, col, x0, y0, x1: x0 + 23, y1: y0 + 25,
    yard: { x0: x0 + 1, x1: x0 + 22, y0: y0 + 16, y1: y0 + 24 },     // sân trước, rộng để trang trí
    pond: { x0: x0 + 2, x1: x0 + 9, y0: y0 + 2, y1: y0 + 8 },        // ao
    garden: { x0: x0 + 13, x1: x0 + 21, y0: y0 + 2, y1: y0 + 8 },    // vườn rau
  };
}

export function houseGeom(plot, level) {
  const p = plotInfo(plot);
  const L = LEVELS[Math.max(0, Math.min(MAX_LEVEL, level))];
  const cx = (p.x0 + 12) * T;
  const base = (p.y0 + 16) * T;
  const w = L.w;
  const h = w * L.ar;
  return {
    cx, base, w, h, L, x: cx - w / 2, y: base - h,
    door: { x: cx + L.doorOff * w, y: base + 5 },
    block: { x0: cx - w * 0.44, x1: cx + w * 0.44, y0: base - h * 0.3, y1: base + 1 },
    lights: L.lights.map((l) => ({ x: cx + l.dx * w, y: base - l.dy * h, r: l.r, kind: l.kind })),
  };
}

export const SCHOOL_SIGN = { x: 151 * T, y: 51.95 * T };
export const SCHOOL_ZONE = { x0: 151.5 * T, x1: 156 * T, y0: 51.5 * T, y1: 56 * T };
export const VISITOR_SPAWN = { x: 6 * T, y: 38 * T };
export const SCHOOL_SPAWN = { x: 150 * T, y: 54 * T };

// ---------- sinh map ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const POLE = { w: 24, h: 76, ax: 12, wire: [[3, 9], [12, 9], [21, 9]], lamp: { dx: -9, dy: -57 } };

let cache = null;
export function getWorld() {
  if (cache) return cache;
  const rnd = mulberry32(20261009);
  const tiles = new Uint8Array(MW * MH);
  const vari = new Uint8Array(MW * MH);
  const solid = new Uint8Array(MW * MH);
  const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  const set = (x, y, k) => { if (inb(x, y)) tiles[y * MW + x] = k; };
  const fill = (x0, y0, x1, y1, k) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, k); };
  const kindAt = (x, y) => (inb(x, y) ? tiles[y * MW + x] : K.WATER);
  const objects = [];
  const colliders = [];
  const lamps = [];
  const wires = [];
  const add = (o) => { objects.push(o); return o; };
  const col = (x0, y0, x1, y1) => colliders.push({ x0, y0, x1, y1 });

  // sông, kênh
  fill(0, 0, MW - 1, 5, K.WATER);
  fill(0, 75, MW - 1, 80, K.WATER);
  fill(0, 0, 2, MH - 1, K.WATER);
  fill(143, 0, 148, MH - 1, K.WATER);
  // đường đất
  fill(3, 36, 141, 39, K.ROAD);
  fill(3, 68, 141, 71, K.ROAD);
  fill(4, 36, 7, 71, K.ROAD);
  fill(138, 36, 141, 71, K.ROAD);
  fill(138, 52, 155, 55, K.ROAD);
  fill(143, 52, 148, 55, K.PLANK);                   // cầu ra khỏi làng
  // 10 mảnh đất
  for (let i = 0; i < PLOTS_PER_SHARD; i++) {
    const p = plotInfo(i);
    // mương giữa các nhà
    fill(p.x1 + 1, p.y0, p.x1 + 2, p.y1, K.WATER);
    // sân trước
    fill(p.yard.x0, p.yard.y0, p.yard.x1, p.yard.y1, K.YARD);
    fill(p.x0 + 10, p.y0 + 16, p.x0 + 13, p.y1, K.PATH);       // lối từ cổng vào nhà
    // ao, vườn
    fill(p.pond.x0, p.pond.y0, p.pond.x1, p.pond.y1, K.POND);
    for (const [cx, cy] of [[p.pond.x0, p.pond.y0], [p.pond.x1, p.pond.y0], [p.pond.x0, p.pond.y1], [p.pond.x1, p.pond.y1]]) set(cx, cy, K.GRASS);
    fill(p.garden.x0, p.garden.y0, p.garden.x1, p.garden.y1, K.SOIL);
  }
  // cầu tàu
  fill(70, 74, 71, 78, K.PLANK);
  fill(100, 3, 101, 6, K.PLANK);

  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) vari[y * MW + x] = Math.floor(rnd() * 8);
  for (let i = 0; i < PLOTS_PER_SHARD; i++) {
    const p = plotInfo(i);
    for (let y = p.garden.y0; y <= p.garden.y1; y++) for (let x = p.garden.x0; x <= p.garden.x1; x++) vari[y * MW + x] = (y - p.y0) % 2 === 0 ? 0 : 1;
  }

  // hàng rào cho từng mảnh đất (3 nhóm để sau này nâng cấp riêng: sân, ao, vườn)
  const fenceTile = (x, y, o, g, plot) => {
    solid[y * MW + x] = 1;
    add({ k: 'fence', o, g, plot, x: x * T + 8, y: (y + 1) * T, v: Math.floor(rnd() * 4) });
  };
  for (let i = 0; i < PLOTS_PER_SHARD; i++) {
    const p = plotInfo(i);
    for (let x = p.x0; x <= p.x1; x++) {
      fenceTile(x, p.y0, 'h', 'yard', i);
      if (!(x >= p.x0 + 11 && x <= p.x0 + 12)) fenceTile(x, p.y1, 'h', 'yard', i);
    }
    for (let y = p.y0 + 1; y < p.y1; y++) { fenceTile(p.x0, y, 'v', 'yard', i); fenceTile(p.x1, y, 'v', 'yard', i); }
    for (let x = p.x0 + 1; x <= p.x0 + 10; x++) if (x < p.x0 + 5 || x > p.x0 + 6) fenceTile(x, p.y0 + 10, 'h', 'pond', i);
    for (let x = p.x0 + 12; x <= p.x0 + 22; x++) if (x < p.x0 + 17 || x > p.x0 + 18) fenceTile(x, p.y0 + 10, 'h', 'garden', i);
    for (let y = p.y0 + 1; y <= p.y0 + 10; y++) fenceTile(p.x0 + 11, y, 'v', 'pond', i);
    add({ k: 'gatepost', x: (p.x0 + 11) * T + 2, y: (p.y1 + 1) * T, plot: i });
    add({ k: 'gatepost', x: (p.x0 + 13) * T - 2, y: (p.y1 + 1) * T, plot: i });
    // cây trong vườn: chuối góc vườn, dừa sau ao
    add({ k: 'banana', x: (p.garden.x1 + 0.4) * T, y: (p.y0 + 2.8) * T, v: i % 2 });
    add({ k: 'palm', x: (p.x0 + 1.5) * T, y: (p.y0 + 3.2) * T, v: i % 3 });
    add({ k: 'palm', x: (p.x0 + 22) * T, y: (p.y0 + 9.6) * T, v: (i + 1) % 3 });
    // rau trong vườn
    for (let y = p.garden.y0; y <= p.garden.y1; y += 2) {
      for (let x = p.garden.x0; x <= p.garden.x1; x++) {
        if (rnd() < 0.8) add({ k: 'crop', x: x * T + 8, y: y * T + 13, v: Math.floor(rnd() * 3) });
      }
    }
    // súng trong ao
    for (let n = 0; n < 4; n++) add({ k: 'lily', x: (p.pond.x0 + 1 + rnd() * 6) * T, y: (p.pond.y0 + 1 + rnd() * 5) * T, v: n % 2 });
    // vài bụi cỏ, cây nhỏ ở sân (để sân thoáng, dành chỗ trang trí)
    add({ k: 'bush', x: (p.x0 + 2) * T, y: (p.y1 - 1) * T, v: i % 2 });
    add({ k: 'bush', x: (p.x1 - 2) * T, y: (p.y1 - 1) * T, v: (i + 1) % 2 });
  }

  // cầu: lan can hai bên
  for (let x = 143; x <= 148; x++) {
    add({ k: 'rail', x: x * T + 8, y: 52 * T + 4 });
    add({ k: 'rail', x: x * T + 8, y: 56 * T + 2 });
  }
  // cột điện cũ dọc theo đường, có dây
  const poleLine = (pts) => {
    const line = pts.map(([tx, by]) => {
      const lamp = rnd() < 0.7;
      const o = add({ k: 'pole', x: tx * T, y: by * T, lamp, dim: 0.45 + rnd() * 0.4 });
      col(o.x - 3, o.y - 3, o.x + 3, o.y);
      if (lamp) lamps.push({ x: o.x + POLE.lamp.dx, y: o.y + POLE.lamp.dy, r: 52, a: o.dim, seed: rnd() * 10 });
      return o;
    });
    wires.push(line);
  };
  const topX = [7.5];
  for (let c = 0; c < 5; c++) topX.push(plotInfo(c).x1 + 2);
  poleLine(topX.map((x) => [x, 35.95]));
  poleLine(topX.map((x) => [x, 72.95]));
  poleLine([[137.5, 51.95], [153.5, 51.95]]);

  // cây ven sông, kênh
  const treeAt = (x, y, kind) => {
    const o = add({ k: kind, x, y, v: Math.floor(rnd() * 3) });
    if (kind === 'palm') col(x - 3, y - 3, x + 3, y);
    else if (kind === 'banana') col(x - 5, y - 4, x + 5, y);
    return o;
  };
  const okTile = (tx, ty) => kindAt(tx, ty) === K.GRASS;
  for (let x = 3; x < 142;) {
    const y = (6.5 + rnd() * 1.9) * T;
    const tx = Math.floor(x); const ty = Math.floor(y / T);
    if (okTile(tx, ty) && !(x > 98 && x < 103)) { const r = rnd(); treeAt(x * T, y, r < 0.55 ? 'palm' : r < 0.85 ? 'banana' : 'bush'); }
    x += 2.6 + rnd() * 2.6;
  }
  for (let x = 3; x < 142;) {
    const y = (73.2 + rnd() * 1.6) * T;
    const tx = Math.floor(x); const ty = Math.floor(y / T);
    if (okTile(tx, ty) && !(x > 68 && x < 74)) { const r = rnd(); treeAt(x * T, y, r < 0.55 ? 'palm' : r < 0.85 ? 'banana' : 'bush'); }
    x += 2.6 + rnd() * 2.6;
  }
  for (let y = 7; y < 74; y += 2.5 + rnd() * 3) {
    if (y > 48 && y < 59) continue;
    const x = (149.8 + rnd() * 5) * T;
    if (okTile(Math.floor(x / T), Math.floor(y))) treeAt(x, y * T, rnd() < 0.6 ? 'palm' : 'banana');
  }
  for (let y = 8; y < 36; y += 3 + rnd() * 3) treeAt((3.4 + rnd() * 0.5) * T, y * T, rnd() < 0.5 ? 'bush' : 'reed');
  // bụi cây ở các dải cỏ cạnh đường
  for (let n = 0; n < 90; n++) {
    const x = 8 + rnd() * 130;
    const y = rnd() < 0.5 ? 35.2 + rnd() * 0.6 : 72.2 + rnd() * 0.6;
    const ty = Math.floor(y);
    if (okTile(Math.floor(x), ty)) add({ k: rnd() < 0.5 ? 'bush' : 'reed', x: x * T, y: y * T + 10, v: Math.floor(rnd() * 2) });
  }
  // lau sậy ven nước, lục bình trên sông
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const k = tiles[y * MW + x];
      if (k === K.WATER) {
        const nearPlank = kindAt(x - 1, y) === K.PLANK || kindAt(x + 1, y) === K.PLANK || kindAt(x, y - 1) === K.PLANK || kindAt(x, y + 1) === K.PLANK;
        if (!nearPlank && rnd() < 0.045) add({ k: 'hyac', x: (x + 0.2 + rnd() * 0.6) * T, y: (y + 0.4 + rnd() * 0.5) * T, v: Math.floor(rnd() * 3), ph: rnd() * 6 });
      } else if (k === K.GRASS) {
        const wn = kindAt(x, y - 1) === K.WATER || kindAt(x, y + 1) === K.WATER || kindAt(x - 1, y) === K.WATER || kindAt(x + 1, y) === K.WATER;
        if (wn && rnd() < 0.1) add({ k: 'reed', x: (x + 0.3 + rnd() * 0.4) * T, y: (y + 0.95) * T, v: Math.floor(rnd() * 2) });
      }
    }
  }
  add({ k: 'boat', x: 74.6 * T, y: 77.2 * T });
  add({ k: 'boat', x: 104 * T, y: 3.4 * T, v: 1 });
  add({ k: 'sign', x: SCHOOL_SIGN.x, y: SCHOOL_SIGN.y, text: 'ĐẾN TRƯỜNG', color: '#5aa0ff' });

  // ô không đi được: nước (trừ ván), hàng rào
  for (let i = 0; i < MW * MH; i++) { const k = tiles[i]; if (k === K.WATER || k === K.POND) solid[i] = 1; }

  objects.sort((a, b) => a.y - b.y);
  // thùng chứa vật cản theo ô 64 đơn vị
  const BK = 64;
  const bw = Math.ceil(WW / BK);
  const buckets = new Map();
  for (const c of colliders) {
    for (let by = Math.floor(c.y0 / BK); by <= Math.floor(c.y1 / BK); by++) {
      for (let bx = Math.floor(c.x0 / BK); bx <= Math.floor(c.x1 / BK); bx++) {
        const key = by * bw + bx;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(c);
      }
    }
  }
  cache = { tiles, vari, solid, objects, lamps, wires, buckets, bw, BK };
  return cache;
}

function solidAt(W, x, y) {
  const tx = Math.floor(x / T);
  const ty = Math.floor(y / T);
  if (tx < 1 || ty < 1 || tx >= MW - 1 || ty >= MH - 1) return true;
  return W.solid[ty * MW + tx] === 1;
}
function colliderAt(W, x, y) {
  const list = W.buckets.get(Math.floor(y / W.BK) * W.bw + Math.floor(x / W.BK));
  if (!list) return false;
  for (const c of list) if (x >= c.x0 - 3 && x <= c.x1 + 3 && y >= c.y0 - 2 && y <= c.y1 + 1) return true;
  return false;
}

// houses: [{ plot, level }]
export function worldBlocked(x, y, houses) {
  const W = getWorld();
  if (solidAt(W, x, y) || solidAt(W, x - 5, y) || solidAt(W, x + 5, y)) return true;
  if (colliderAt(W, x, y)) return true;
  for (const hs of houses) {
    const b = houseGeom(hs.plot, hs.level).block;
    if (x > b.x0 - 4 && x < b.x1 + 4 && y > b.y0 && y < b.y1 + 2) return true;
  }
  return false;
}

export function nearestFree(x, y, houses) {
  if (!worldBlocked(x, y, houses)) return { x, y };
  for (let r = 4; r < 160; r += 4) {
    for (let a = 0; a < 16; a++) {
      const tx = x + Math.cos((a / 16) * Math.PI * 2) * r;
      const ty = y + Math.sin((a / 16) * Math.PI * 2) * r;
      if (!worldBlocked(tx, ty, houses)) return { x: tx, y: ty };
    }
  }
  return { x, y };
}
