// GAME (tách riêng): tranh pixel vẽ bằng code cho map Miền Tây (ô đất, cây dừa, chuối, cột điện, hàng rào...).
// 1 điểm ảnh tranh = 1 đơn vị thế giới nên khi phóng nguyên số lần sẽ rất nét.
import { K, POLE } from './mekong';

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeArt(createCanvas) {
  const mk = (w, h) => { const c = createCanvas(w, h); c.width = w; c.height = h; return c; };
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

  // ---------- ô đất ----------
  const GRASS = ['#6cab45', '#5a9a3a', '#7fbd52', '#4d8a33'];
  function grassTile(g, r) {
    R(g, 0, 0, 16, 16, GRASS[0]);
    for (let i = 0; i < 26; i++) R(g, r() * 16, r() * 16, 1 + (r() < 0.3 ? 1 : 0), 1, GRASS[1 + Math.floor(r() * 3)]);
    for (let i = 0; i < 4; i++) { const x = r() * 15; const y = 2 + r() * 13; R(g, x, y - 2, 1, 2, GRASS[3]); R(g, x + 1, y - 3, 1, 2, GRASS[3]); }
    if (r() < 0.07) { const x = 2 + r() * 11; const y = 2 + r() * 11; R(g, x, y, 2, 2, r() < 0.5 ? '#f4efe0' : '#f3d24a'); R(g, x, y + 2, 1, 1, GRASS[3]); }
  }
  function roadTile(g, r) {
    R(g, 0, 0, 16, 16, '#b48d5a');
    for (let i = 0; i < 40; i++) R(g, r() * 16, r() * 16, 1 + (r() < 0.3 ? 1 : 0), 1, ['#9b7544', '#c9a46c', '#a8814e', '#8a6838'][Math.floor(r() * 4)]);
    R(g, 3, 0, 2, 16, '#a07a48');
    R(g, 11, 0, 2, 16, '#a07a48');
    for (let i = 0; i < 3; i++) R(g, r() * 14, r() * 14, 2, 2, '#7d6a54');
  }
  function yardTile(g, r) {
    R(g, 0, 0, 16, 16, '#c6a56f');
    for (let i = 0; i < 30; i++) R(g, r() * 16, r() * 16, 1, 1, ['#b8955e', '#d3b583', '#bd9c66'][Math.floor(r() * 3)]);
    if (r() < 0.45) for (let i = 0; i < 3; i++) { const x = r() * 14; const y = 3 + r() * 12; R(g, x, y, 1, 3, GRASS[1]); R(g, x + 1, y - 1, 1, 3, GRASS[2]); R(g, x + 2, y + 1, 1, 2, GRASS[1]); }
  }
  function pathTile(g, r) {
    R(g, 0, 0, 16, 16, '#d5ba8a');
    for (let i = 0; i < 24; i++) R(g, r() * 16, r() * 16, 1, 1, ['#c4a874', '#e0c99c'][Math.floor(r() * 2)]);
    for (let i = 0; i < 3; i++) R(g, 1 + r() * 12, 1 + r() * 12, 3, 2, '#b5a58b');
  }
  function soilTile(g, r, v) {
    if (v === 0) {
      R(g, 0, 0, 16, 16, '#7d5632');
      R(g, 0, 0, 16, 3, '#946a3f');
      R(g, 0, 13, 16, 3, '#5f3f23');
      for (let i = 0; i < 24; i++) R(g, r() * 16, r() * 16, 1, 1, ['#6a4627', '#8d6238'][Math.floor(r() * 2)]);
    } else {
      R(g, 0, 0, 16, 16, '#5f3f23');
      for (let i = 0; i < 16; i++) R(g, r() * 16, r() * 16, 1, 1, '#4e3219');
    }
  }
  function plankTile(g, r) {
    R(g, 0, 0, 16, 16, '#5a4126');
    for (let y = 0; y < 16; y += 4) {
      R(g, 0, y, 16, 3, ['#a47b45', '#9a713c', '#b08650'][Math.floor(r() * 3)]);
      R(g, 0, y, 16, 1, '#bd9159');
      R(g, 4 + r() * 8, y + 1, 1, 1, '#7d5a30');
    }
    R(g, 0, 0, 1, 16, '#6e5230');
    R(g, 15, 0, 1, 16, '#6e5230');
  }
  function waterTile(g, r, pond, frame) {
    R(g, 0, 0, 16, 16, pond ? '#4c9a8c' : '#3f86a6');
    for (let i = 0; i < 5; i++) R(g, r() * 16, r() * 16, 3, 1, pond ? '#43897c' : '#37779a');
    for (let i = 0; i < 3; i++) {
      const x = (r() * 16 + frame * 3) % 16;
      R(g, x, r() * 15, 3, 1, pond ? '#7cbfae' : '#74b2d0');
    }
    if (r() < 0.35) R(g, (r() * 16 + frame * 2) % 16, r() * 15, 2, 1, '#bfe3f0');
  }
  // bờ bùn khi đất kề nước
  function bankEdges(g, mask, r) {
    const mud = ['#6e5236', '#85653f', '#5b4229'];
    if (mask & 1) { for (let x = 0; x < 16; x++) { const h = 3 + (r() < 0.5 ? 1 : 0); R(g, x, 0, 1, h, mud[Math.floor(r() * 2)]); } R(g, 0, 4, 16, 1, GRASS[1]); }
    if (mask & 4) { for (let x = 0; x < 16; x++) { const h = 4 + (r() < 0.5 ? 1 : 0); R(g, x, 16 - h, 1, h, mud[Math.floor(r() * 3)]); } R(g, 0, 10, 16, 1, GRASS[2]); }
    if (mask & 8) { for (let y = 0; y < 16; y++) { const w = 3 + (r() < 0.5 ? 1 : 0); R(g, 0, y, w, 1, mud[Math.floor(r() * 2)]); } R(g, 4, 0, 1, 16, GRASS[1]); }
    if (mask & 2) { for (let y = 0; y < 16; y++) { const w = 3 + (r() < 0.5 ? 1 : 0); R(g, 16 - w, y, w, 1, mud[Math.floor(r() * 2)]); } R(g, 11, 0, 1, 16, GRASS[1]); }
  }
  // mask: bit1 bắc, 2 đông, 4 nam, 8 tây là nước
  function tile(kind, v, mask, frame) {
    const key = `t${kind}.${v}.${mask}.${frame}`;
    return memo(key, () => {
      const c = mk(16, 16);
      const g = c.getContext('2d');
      const r = rng(kind * 977 + v * 131 + 7);
      if (kind === K.GRASS) { grassTile(g, r); if (mask) bankEdges(g, mask, rng(v * 31 + mask)); }
      else if (kind === K.ROAD) { roadTile(g, r); if (mask) bankEdges(g, mask, rng(v * 31 + mask)); }
      else if (kind === K.YARD) yardTile(g, r);
      else if (kind === K.PATH) pathTile(g, r);
      else if (kind === K.SOIL) soilTile(g, r, v === 0 ? 0 : 1);
      else if (kind === K.PLANK) plankTile(g, r);
      else if (kind === K.WATER || kind === K.POND) {
        waterTile(g, r, kind === K.POND, frame);
      }
      return c;
    });
  }

  // ---------- vật thể ----------
  function leaf(g, x, y, len, wid, ang, droop, c1, c2, c3) {
    const dx = Math.cos(ang); const dy = Math.sin(ang);
    const px = -dy; const py = dx;
    for (let t = 0; t <= 1.0001; t += 0.5 / len) {
      const cx = x + dx * len * t;
      const cy = y + dy * len * t + droop * t * t;
      const hw = wid * Math.sin(Math.PI * Math.pow(t, 0.7));
      for (let s = -hw; s <= hw; s += 0.5) {
        const col = Math.abs(s) < 0.6 ? c3 : (s * (dx >= 0 ? 1 : -1) < 0 ? c1 : c2);
        R(g, cx + px * s, cy + py * s, 1, 1, col);
      }
    }
  }
  function frond(g, x, y, ang, len, droop, c1, c2) {
    const dx = Math.cos(ang); const dy = Math.sin(ang);
    for (let t = 0; t <= 1; t += 0.018) {
      const cx = x + dx * len * t;
      const cy = y + dy * len * t + droop * t * t;
      R(g, cx, cy, 2, 2, c2);
      if (t > 0.1) {
        const L = 7 * (1 - t * 0.55);
        for (let s = 1; s <= L; s += 1) {
          R(g, cx - s * 0.55, cy + s * 0.9 + t * s * 0.5, 1, 1, (s % 2 ? c1 : c2));
          R(g, cx + s * 0.55 + 1, cy + s * 0.9 + t * s * 0.5, 1, 1, (s % 2 ? c2 : c1));
        }
      }
    }
  }
  function palm(v) {
    return memo(`palm${v}`, () => {
      const W = 64; const H = 92;
      const c = mk(W, H); const g = c.getContext('2d');
      const r = rng(90 + v * 17);
      const lean = [5, -6, 2][v % 3];
      const topY = 34;
      for (let y = H - 1; y >= topY; y--) {
        const u = (H - 1 - y) / (H - 1 - topY);
        const x = 32 + lean * Math.pow(u, 1.7);
        const w = 4 - Math.floor(u * 1.5);
        const ring = y % 4 < 2;
        R(g, x - w / 2, y, w, 1, ring ? '#8c6c40' : '#735530');
        R(g, x + w / 2 - 1, y, 1, 1, '#5a4224');
        R(g, x - w / 2, y, 1, 1, '#a58250');
      }
      const cx = 32 + lean; const cy = topY;
      for (const [a, len, dr] of [[-0.2, 26, 16], [Math.PI + 0.2, 26, 16], [-0.9, 22, 12], [Math.PI + 0.9, 22, 12], [-1.55, 17, 6], [0.5, 22, 14], [Math.PI - 0.5, 22, 14], [-2.2, 19, 8]]) {
        frond(g, cx, cy, a, len + r() * 3, dr, '#2f8a3a', '#237030');
      }
      for (let i = 0; i < 4; i++) R(g, cx - 3 + (i % 2) * 4, cy + 1 + (i >> 1) * 3, 3, 3, i % 2 ? '#6a8a3a' : '#7b9b45');
      return c;
    });
  }
  function banana(v) {
    return memo(`ban${v}`, () => {
      const c = mk(56, 52); const g = c.getContext('2d');
      const r = rng(55 + v * 9);
      R(g, 25, 30, 6, 22, '#94b653'); R(g, 25, 30, 1, 22, '#b6d46f'); R(g, 30, 30, 1, 22, '#6f9238');
      for (let y = 32; y < 52; y += 5) R(g, 25, y, 6, 1, '#6f9238');
      const angs = [-2.55, -2.05, -1.57, -1.09, -0.6, -2.95, -0.2];
      angs.forEach((a, i) => leaf(g, 28, 30, 24 + (i % 2) * 3 + r() * 2, 5.5, a, 3 + (i % 3) * 2, '#3e9a3c', '#2f8232', '#206b27'));
      R(g, 30, 36, 3, 6, '#5a2a46'); R(g, 28, 41, 7, 4, '#d9c43a'); R(g, 28, 41, 7, 1, '#f1de62'); R(g, 29, 45, 5, 2, '#bba82d');
      return c;
    });
  }
  function bush(v) {
    return memo(`bush${v}`, () => {
      const c = mk(26, 18); const g = c.getContext('2d');
      const r = rng(200 + v);
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2; const d = Math.sqrt(r());
        const x = 13 + Math.cos(a) * 11 * d; const y = 10 + Math.sin(a) * 6.5 * d;
        R(g, x, y, 2, 2, ['#3f8a3a', '#4d9d45', '#33742f', '#5eb04f'][Math.floor(r() * 4)]);
      }
      if (v) for (let i = 0; i < 5; i++) R(g, 4 + r() * 18, 4 + r() * 9, 2, 2, '#f08ab0');
      return c;
    });
  }
  function reed(v) {
    return memo(`reed${v}`, () => {
      const c = mk(14, 26); const g = c.getContext('2d');
      const r = rng(300 + v);
      for (let i = 0; i < 5; i++) {
        const x = 2 + i * 2 + r() * 2; const h = 14 + r() * 10;
        for (let y = 0; y < h; y++) R(g, x + Math.sin(y * 0.18 + i) * 1.2, 26 - y, 1, 1, y > h - 5 ? '#8a6a3a' : ['#5b9a3e', '#7db452'][i % 2]);
      }
      return c;
    });
  }
  function crop(v) {
    return memo(`crop${v}`, () => {
      const c = mk(14, 12); const g = c.getContext('2d');
      const base = ['#4aa84a', '#79c255', '#3f9a42'][v];
      for (let i = 0; i < 12; i++) R(g, 3 + (i % 4) * 2 + (i > 7 ? 1 : 0), 10 - Math.floor(i / 4) * 3 - (i % 2), 3, 3, i % 3 ? base : '#2f7d34');
      if (v === 1) { R(g, 6, 2, 2, 2, '#f3d24a'); }
      if (v === 2) { R(g, 4, 5, 2, 3, '#d9402a'); R(g, 9, 4, 2, 3, '#d9402a'); }
      return c;
    });
  }
  function lily(v) {
    return memo(`lily${v}`, () => {
      const c = mk(12, 8); const g = c.getContext('2d');
      R(g, 1, 2, 10, 5, '#3c9a44'); R(g, 3, 1, 6, 1, '#3c9a44'); R(g, 3, 7, 6, 1, '#3c9a44');
      R(g, 5, 2, 2, 3, '#4aa84a');
      if (v) { R(g, 5, 0, 2, 2, '#f7b7d0'); R(g, 4, 1, 4, 1, '#f08ab0'); }
      return c;
    });
  }
  function hyac(v) {
    return memo(`hy${v}`, () => {
      const c = mk(22, 14); const g = c.getContext('2d');
      const r = rng(400 + v);
      for (let i = 0; i < 9; i++) { const x = 3 + r() * 13; const y = 4 + r() * 7; R(g, x, y, 5, 3, ['#4c9e3c', '#5eb44a', '#3a8a34'][i % 3]); R(g, x + 1, y - 1, 3, 1, '#7acb5a'); }
      if (v !== 1) { R(g, 9, 1, 2, 4, '#b47ad8'); R(g, 8, 2, 4, 1, '#cf9bea'); }
      return c;
    });
  }
  function pole() {
    return memo('pole', () => {
      const c = mk(POLE.w, POLE.h); const g = c.getContext('2d');
      for (let y = 8; y < POLE.h; y++) {
        const lean = y < 30 ? 1 : 0;
        R(g, 10 + lean, y, 3, 1, y % 7 === 0 ? '#3e2f1f' : '#5a4630');
        R(g, 10 + lean, y, 1, 1, '#76603f');
      }
      R(g, 1, 12, 22, 2, '#4a3a27'); R(g, 1, 12, 22, 1, '#6b5638');
      R(g, 5, 22, 14, 2, '#4a3a27');
      for (const x of [3, 12, 21]) { R(g, x - 1, 9, 3, 3, '#cfd8dc'); R(g, x - 1, 9, 3, 1, '#ffffff'); }
      R(g, 9, 30, 6, 1, '#32261a');
      return c;
    });
  }
  function poleLamp() {
    return memo('poleLamp', () => {
      const c = mk(POLE.w, POLE.h); const g = c.getContext('2d');
      g.drawImage(pole(), 0, 0);
      R(g, 3, 16, 8, 1, '#32261a');
      R(g, 2, 17, 3, 1, '#5a5a5a'); R(g, 1, 18, 5, 1, '#6a6a6a');
      R(g, 2, 19, 3, 3, '#ffe08a'); R(g, 3, 20, 1, 1, '#fff6cf');
      return c;
    });
  }
  const BAMBOO = ['#c9a45c', '#b48f48', '#d9b86f'];
  const PLANKC = ['#9a7a52', '#8a6a44', '#ad8c60'];
  const BRICK = ['#e8e4dc', '#cfc8bb', '#f4f1ea'];
  function fence(level, orient, v) {
    return memo(`f${level}.${orient}.${v}`, () => {
      const c = mk(16, 16); const g = c.getContext('2d');
      const r = rng(500 + v);
      const pal = level === 0 ? BAMBOO : level === 1 ? PLANKC : BRICK;
      if (level === 2) {
        R(g, 0, 4, 16, 12, pal[0]); R(g, 0, 4, 16, 2, pal[2]); R(g, 0, 14, 16, 2, pal[1]);
        if (orient === 'h') for (let x = 4; x < 16; x += 8) R(g, x, 6, 1, 8, pal[1]);
        return c;
      }
      if (orient === 'h') {
        R(g, 0, 6, 16, 2, pal[1]); R(g, 0, 11, 16, 2, pal[1]);
        R(g, 0, 6, 16, 1, pal[2]); R(g, 0, 11, 16, 1, pal[2]);
        for (const x of [0, 7, 14]) {
          const top = 2 + Math.floor(r() * 3);
          R(g, x, top, 3, 15 - top, pal[0]);
          R(g, x, top, 1, 15 - top, pal[2]);
          R(g, x + 2, top, 1, 15 - top, pal[1]);
          if (level === 0) R(g, x, top + 4 + Math.floor(r() * 4), 3, 1, '#8a6c34');
        }
      } else {
        R(g, 6, 0, 4, 16, pal[0]); R(g, 6, 0, 1, 16, pal[2]); R(g, 9, 0, 1, 16, pal[1]);
        R(g, 7, 3, 2, 1, pal[1]); R(g, 7, 9, 2, 1, pal[1]);
        R(g, 5, 11, 6, 5, pal[0]); R(g, 5, 11, 6, 1, pal[2]); R(g, 5, 15, 6, 1, pal[1]);
        R(g, 5, 4, 6, 3, pal[0]);
      }
      return c;
    });
  }
  function gatepost() {
    return memo('gp', () => {
      const c = mk(8, 28); const g = c.getContext('2d');
      R(g, 1, 4, 6, 24, '#8a6a3c'); R(g, 1, 4, 1, 24, '#b08c58'); R(g, 6, 4, 1, 24, '#6a4e2a');
      R(g, 0, 2, 8, 3, '#6a4e2a'); R(g, 0, 2, 8, 1, '#8a6a3c');
      return c;
    });
  }
  function rail() {
    return memo('rail', () => {
      const c = mk(16, 14); const g = c.getContext('2d');
      R(g, 0, 4, 16, 2, '#a58250'); R(g, 0, 4, 16, 1, '#c9a46c');
      R(g, 0, 9, 16, 2, '#8a6a3c');
      for (const x of [1, 13]) R(g, x, 3, 2, 11, '#7a5a30');
      return c;
    });
  }
  function boat(v) {
    return memo(`boat${v}`, () => {
      const c = mk(64, 24); const g = c.getContext('2d');
      for (let x = 0; x < 60; x++) {
        const u = x / 59; const h = Math.round(6 * Math.sin(Math.PI * Math.pow(u, 0.8)));
        const y = 12 - Math.round(2 * Math.pow(Math.abs(u - 0.5) * 2, 2.2) * -1) - 4;
        for (let k = 0; k <= h; k++) R(g, 2 + x, 10 + k - Math.round(Math.pow(Math.abs(u - 0.5) * 2, 2.5) * 5), 1, 1, k < 2 ? '#c7a56a' : k < 4 ? '#8a6a3c' : '#5d4527');
        void y;
      }
      R(g, 8, 11, 44, 2, '#3b2a18');
      R(g, 20, 3, 20, 8, v ? '#d6c28a' : '#caa95c'); R(g, 20, 3, 20, 1, '#e9d9a5'); R(g, 22, 6, 16, 1, '#a88a45');
      R(g, 58, 4, 1, 12, '#6a4e2a');
      return c;
    });
  }
  function signBoard(text, color, W) {
    return memo(`sign${text}`, () => {
      const c = mk(46, 36); const g = c.getContext('2d');
      R(g, 22, 14, 3, 22, '#6b4a2a'); R(g, 22, 14, 1, 22, '#8a6238');
      R(g, 1, 3, 44, 14, '#2b1a0c'); R(g, 2, 4, 42, 12, color);
      R(g, 2, 4, 42, 1, '#ffffff55');
      void W;
      return c;
    });
  }

  return { tile, palm, banana, bush, reed, crop, lily, hyac, pole, poleLamp, fence, gatepost, rail, boat, signBoard };
}
