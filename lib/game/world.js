// GAME (tách riêng): map khu vực NÔNG THÔN dùng chung cho mọi người chơi.
// Nền là ảnh public/game/nong-thon.jpg (1536 x 1024). Muốn gỡ game: xóa thư mục game như các file khác.
import { MASK_B64 } from './worldMask';

export const WW = 1536;
export const WH = 1024;
export const WORLD_BG = '/game/nong-thon.jpg';
export const VIEW_W = 640;        // bề ngang khung nhìn (đơn vị thế giới) khi chơi
export const CHAR_H = 36;         // chiều cao nhân vật ngoài map
export const SPEED = 118;

// 15 mảnh đất (vùng đất trống trong ảnh). Mỗi khu có 15 người; đầy thì mở khu mới.
export const PLOTS_PER_SHARD = 15;
export const PLOTS = [
  { x0: 313, y0: 167, x1: 447, y1: 260 }, { x0: 500, y0: 167, x1: 647, y1: 267 },
  { x0: 800, y0: 207, x1: 940, y1: 300 }, { x0: 1000, y0: 233, x1: 1120, y1: 333 },
  { x0: 300, y0: 327, x1: 467, y1: 433 }, { x0: 567, y0: 347, x1: 693, y1: 447 },
  { x0: 813, y0: 380, x1: 953, y1: 487 }, { x0: 1013, y0: 400, x1: 1147, y1: 507 },
  { x0: 347, y0: 520, x1: 467, y1: 613 }, { x0: 553, y0: 533, x1: 680, y1: 633 },
  { x0: 793, y0: 560, x1: 940, y1: 667 }, { x0: 1033, y0: 587, x1: 1173, y1: 687 },
  { x0: 520, y0: 707, x1: 653, y1: 807 }, { x0: 793, y0: 733, x1: 927, y1: 827 },
  { x0: 1027, y0: 760, x1: 1153, y1: 853 },
];

// Các cấp nhà. ar = cao / rộng của ảnh; doorOff = vị trí cửa lệch khỏi giữa nhà (tỉ lệ bề rộng).
// lights: đèn phát sáng ban đêm (dx: lệch ngang theo bề rộng, dy: cao hơn chân nhà theo chiều cao).
export const LEVELS = [
  {
    id: 0, name: 'Nhà lá', img: '/game/nha-la.png', w: 116, ar: 273 / 480, doorOff: 0,
    lights: [
      { dx: 0.0, dy: 0.2, r: 84, kind: 'oil' },
      { dx: -0.23, dy: 0.48, r: 34, kind: 'oildim' },
    ],
    desc: 'Nhà lá vách lá, đèn dầu leo lét.',
  },
  {
    id: 1, name: 'Nhà mái tôn', img: '/game/nha-ton.png', w: 142, ar: 210 / 480, doorOff: 0.16,
    lights: [
      { dx: 0.06, dy: 0.55, r: 64, kind: 'steady' },
      { dx: 0.27, dy: 0.55, r: 64, kind: 'steady' },
      { dx: 0.16, dy: 0.3, r: 96, kind: 'steady' },
    ],
    desc: 'Nhà cấp bốn mái tôn, cửa kính, đèn tường.',
  },
  {
    id: 2, name: 'Nhà mái ngói', img: '/game/nha-ngoi.png', w: 132, ar: 324 / 480, doorOff: -0.17,
    lights: [
      { dx: -0.34, dy: 0.42, r: 54, kind: 'steady' },
      { dx: 0.0, dy: 0.42, r: 54, kind: 'steady' },
      { dx: 0.4, dy: 0.4, r: 54, kind: 'steady' },
      { dx: -0.17, dy: 0.22, r: 100, kind: 'steady' },
    ],
    desc: 'Nhà mái ngói khang trang, cửa kính lớn.',
  },
];
export const MAX_LEVEL = LEVELS.length - 1;

export const SCHOOL_SIGN = { x: 1318, y: 868 };   // biển chỉ đường tới trường ở cuối con đường bên phải

// ----- vùng đi được -----
const CELL = 8;
const GCOLS = 192;
const GROWS = 128;
let maskBits = null;
function bits() {
  if (maskBits) return maskBits;
  const raw = typeof atob === 'function' ? atob(MASK_B64) : Buffer.from(MASK_B64, 'base64').toString('binary');
  maskBits = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) maskBits[i] = raw.charCodeAt(i);
  return maskBits;
}
export function walkable(x, y) {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= GCOLS || cy >= GROWS) return false;
  const idx = cy * GCOLS + cx;
  return ((bits()[idx >> 3] >> (7 - (idx & 7))) & 1) === 1;
}

// ----- hình học nhà theo mảnh đất -----
export function houseGeom(plot, level) {
  const p = PLOTS[plot];
  const L = LEVELS[Math.max(0, Math.min(MAX_LEVEL, level))];
  const cx = (p.x0 + p.x1) / 2;
  const base = p.y0 + (p.y1 - p.y0) * 0.64;
  const w = L.w;
  const h = w * L.ar;
  return {
    cx, base, w, h, L,
    x: cx - w / 2, y: base - h,
    door: { x: cx + L.doorOff * w, y: base + 5 },
    block: { x0: cx - w * 0.44, x1: cx + w * 0.44, y0: base - h * 0.3, y1: base + 1 },
    lights: L.lights.map((l) => ({ x: cx + l.dx * w, y: base - l.dy * h, r: l.r, kind: l.kind })),
  };
}
export function signPos(plot) {
  const p = PLOTS[plot];
  return { x: p.x0 + 18, y: p.y1 - 6 };
}

// houses: [{ plot, level }]
export function worldBlocked(x, y, houses) {
  if (!walkable(x, y) || !walkable(x - 5, y) || !walkable(x + 5, y)) return true;
  for (const hs of houses) {
    const g = houseGeom(hs.plot, hs.level);
    const b = g.block;
    if (x > b.x0 - 4 && x < b.x1 + 4 && y > b.y0 && y < b.y1 + 2) return true;
  }
  return false;
}

export function nearestFree(x, y, houses) {
  if (!worldBlocked(x, y, houses)) return { x, y };
  for (let r = 4; r < 120; r += 4) {
    for (let a = 0; a < 16; a++) {
      const tx = x + Math.cos((a / 16) * Math.PI * 2) * r;
      const ty = y + Math.sin((a / 16) * Math.PI * 2) * r;
      if (!worldBlocked(tx, ty, houses)) return { x: tx, y: ty };
    }
  }
  return { x, y };
}

export function plotOf(x, y) {
  for (let i = 0; i < PLOTS.length; i++) {
    const p = PLOTS[i];
    if (x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) return i;
  }
  return -1;
}
