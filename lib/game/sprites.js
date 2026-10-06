// GAME (tách riêng): vẽ nhân vật pixel 2D kiểu chibi bằng lưới điểm ảnh. Không dùng ảnh, không thư viện.
// Muốn gỡ game: xóa thư mục lib/game, components/game, app/game và chạy xoa_game.sql.

export const W = 25;      // bề ngang nhân vật (đơn vị điểm ảnh)
export const H = 78;      // chiều cao gồm 4 hàng chừa cho tóc phía trên
const OY = 4;             // hàng 0 của đầu nằm ở dòng OY của lưới
export const SIZE = { w: W + 2, h: H + 2 }; // lưới có viền 1 điểm mỗi phía cho nét viền

const OUTLINE = '#1c1a26';

export const SKINS = [
  { name: 'Da sáng', base: '#f7bb98', shade: '#e9a07a', light: '#fcd8c2' },
  { name: 'Da bánh mật', base: '#d9976b', shade: '#c07e55', light: '#e9b48c' },
  { name: 'Da nâu', base: '#a96a45', shade: '#8f5536', light: '#c18560' },
];

export const HAIRS = [
  { name: 'Đen', base: '#23202a', shade: '#14121a', light: '#4d4960' },
  { name: 'Nâu', base: '#6b4226', shade: '#472a15', light: '#99643b' },
  { name: 'Vàng nâu', base: '#c58b3a', shade: '#966320', light: '#e8b866' },
];

export const OPTIONS = {
  gender: [
    { id: 'nam', label: 'Nam' },
    { id: 'nu', label: 'Nữ' },
  ],
  hair: {
    nam: [
      { id: 'troc', label: 'Không tóc' },
      { id: 'ngan', label: 'Tóc ngắn' },
      { id: 'cua', label: 'Tóc cua' },
      { id: 'xu', label: 'Tóc xù' },
    ],
    nu: [
      { id: 'troc', label: 'Không tóc' },
      { id: 'buoc_duoi', label: 'Buộc đuôi' },
      { id: 'xoa_dai', label: 'Xõa dài' },
      { id: 'hai_bim', label: 'Hai bím' },
    ],
  },
  shirt: [
    { id: 'dong_phuc', label: 'Đồng phục' },
    { id: 'ba_lo', label: 'Áo ba lỗ' },
  ],
  pants: [
    { id: 'dai', label: 'Quần dài' },
    { id: 'co_so', label: 'Quần đùi' },
    { id: 'vay', label: 'Váy', onlyFemale: true },
  ],
  shoes: [
    { id: 'chan', label: 'Chân trần' },
    { id: 'giay', label: 'Giày trắng' },
    { id: 'dep', label: 'Dép quai hậu' },
  ],
};

// Nhân vật mặc định giống hình mẫu: đồng phục, khăn quàng đỏ, quần dài đen, chân trần.
export const DEFAULT_CFG = {
  gender: 'nam',
  skin: 0,
  hair: 'troc',
  hairColor: 0,
  shirt: 'dong_phuc',
  scarf: true,
  pants: 'dai',
  shoes: 'chan',
};

function pickIndex(v, len, def) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n >= 0 && n < len ? n : def;
}
function pickId(v, list, def) {
  return list.some((o) => o.id === v) ? v : def;
}

// Luôn đưa dữ liệu cũ hoặc lỗi về cấu hình hợp lệ.
export function sanitize(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const gender = c.gender === 'nu' ? 'nu' : 'nam';
  const pantsList = OPTIONS.pants.filter((o) => !o.onlyFemale || gender === 'nu');
  return {
    gender,
    skin: pickIndex(c.skin, SKINS.length, 0),
    hair: pickId(c.hair, OPTIONS.hair[gender], 'troc'),
    hairColor: pickIndex(c.hairColor, HAIRS.length, 0),
    shirt: pickId(c.shirt, OPTIONS.shirt, 'dong_phuc'),
    scarf: c.scarf === undefined ? true : !!c.scarf,
    pants: pickId(c.pants, pantsList, 'dai'),
    shoes: pickId(c.shoes, OPTIONS.shoes, 'chan'),
  };
}

export function randomCfg() {
  const gender = Math.random() < 0.5 ? 'nam' : 'nu';
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const pantsList = OPTIONS.pants.filter((o) => !o.onlyFemale || gender === 'nu');
  return sanitize({
    gender,
    skin: Math.floor(Math.random() * SKINS.length),
    hair: pick(OPTIONS.hair[gender]).id,
    hairColor: Math.floor(Math.random() * HAIRS.length),
    shirt: pick(OPTIONS.shirt).id,
    scarf: Math.random() < 0.7,
    pants: pick(pantsList).id,
    shoes: pick(OPTIONS.shoes).id,
  });
}

// ---------- lưới điểm ảnh ----------
function makeGrid() {
  return { w: SIZE.w, h: SIZE.h, d: new Array(SIZE.w * SIZE.h).fill(null) };
}
function put(g, x, y, c) {
  const gx = x + 1;
  const gy = y + 1 + OY;
  if (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h) return;
  g.d[gy * g.w + gx] = c;
}
function R(g, x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, c);
}
// Hình chữ nhật bo góc kiểu bậc thang
function RR(g, x, y, w, h, c, cut) {
  for (let j = 0; j < h; j++) {
    const inset = Math.max(0, cut - Math.min(j, h - 1 - j));
    R(g, x + inset, y + j, w - inset * 2, 1, c);
  }
}
// Vẽ đối xứng qua cột giữa (cột 12)
function mirrorX(x, w) {
  return W - 1 - (x + w - 1);
}
function RM(g, x, y, w, h, c) {
  R(g, x, y, w, h, c);
  R(g, mirrorX(x, w), y, w, h, c);
}

function addOutline(g) {
  const src = g.d.slice();
  const at = (x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? null : src[y * g.w + x]);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (src[y * g.w + x]) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) g.d[y * g.w + x] = OUTLINE;
    }
  }
}

// ---------- các bộ phận ----------
const WHITE = '#f6f7fb';
const WSHADE = '#d6dae8';
const NAVY = '#1f2d63';
const RED = '#d6192b';
const REDD = '#a30f20';
const REDL = '#ee4a58';
const PANT = '#17171c';
const PANT2 = '#0d0d11';
const PFOLD = '#272731';

function drawHead(g, sk, female, showShine) {
  // tai
  RM(g, 0, 14, 3, 5, sk.base);
  RM(g, 1, 15, 1, 3, sk.shade);
  // sọ
  RR(g, 3, 0, 19, 24, sk.base, 4);
  R(g, 3, 6, 1, 14, sk.shade);
  R(g, 21, 6, 1, 14, sk.shade);
  R(g, 6, 23, 13, 1, sk.shade);
  if (showShine) {
    for (let k = 0; k < 7; k++) R(g, 14 + Math.floor(k * 0.7), 2 + k, 3, 1, sk.light);
  }
  // lông mày
  const brow = '#3b2a22';
  R(g, 4, 11, 6, 1, brow);
  R(g, 15, 11, 6, 1, brow);
  // mắt: khối đen có điểm sáng, như hình mẫu
  const eye = '#15151b';
  RM(g, 5, 14, 5, 6, eye);
  put(g, 5, 14, sk.base);
  put(g, 9, 14, sk.base);
  put(g, 15, 14, sk.base);
  put(g, 19, 14, sk.base);
  R(g, 6, 16, 2, 3, '#ffffff');
  R(g, 17, 16, 2, 3, '#ffffff');
  put(g, 6, 19, '#9ca6bd');
  put(g, 18, 19, '#9ca6bd');
  put(g, 8, 15, '#2c3150');
  put(g, 16, 15, '#2c3150');
  if (female) {
    // lông mi
    put(g, 4, 14, eye);
    put(g, 4, 13, eye);
    put(g, 20, 14, eye);
    put(g, 20, 13, eye);
  }
  // cổ
  R(g, 10, 24, 5, 3, sk.base);
  R(g, 10, 24, 5, 1, sk.shade);
}

function drawScarf(g, top, withBand) {
  if (withBand) R(g, 9, top - 1, 7, 1, RED);
  // nút khăn
  R(g, 9, top, 7, 2, RED);
  R(g, 11, top + 1, 3, 2, REDD);
  put(g, 10, top, REDL);
  put(g, 11, top, REDL);
  // hai đuôi khăn xòe ra như hình mẫu
  for (let i = 0; i < 9; i++) {
    const spread = Math.floor(i / 3);
    R(g, 9 - spread + (i > 5 ? 1 : 0), top + 3 + i, 3, 1, RED);
    R(g, 13 + spread - (i > 5 ? 1 : 0), top + 3 + i, 3, 1, RED);
    put(g, 11 - spread + (i > 5 ? 1 : 0), top + 3 + i, REDD);
    put(g, 13 + spread - (i > 5 ? 1 : 0), top + 3 + i, REDD);
  }
  put(g, 10, top + 4, REDL);
  put(g, 14, top + 5, REDL);
}

function drawUniform(g, sk, scarf) {
  // thân và tay áo ngắn
  R(g, 6, 28, 13, 19, WHITE);
  R(g, 6, 30, 1, 17, WSHADE);
  R(g, 18, 30, 1, 17, WSHADE);
  R(g, 6, 46, 13, 1, '#c6cbdc');
  RR(g, 3, 30, 3, 7, WHITE, 1);
  RR(g, 19, 30, 3, 7, WHITE, 1);
  // viền ca-rô ở gấu tay
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const c = (i + j) % 2 === 0 ? NAVY : WHITE;
      put(g, 3 + i, 35 + j, c);
      put(g, 19 + i, 35 + j, (i + j) % 2 === 0 ? WHITE : NAVY);
    }
  }
  // cổ lật thủy thủ ca-rô
  const wing = (r) => (r <= 29 ? 4 : r <= 31 ? 5 : 6);
  for (let r = 28; r <= 32; r++) {
    const n = wing(r);
    for (let i = 0; i < n; i++) {
      const col = (r + i) % 2 === 0 ? NAVY : WHITE;
      put(g, 6 + i, r, col);
      put(g, 18 - i, r, (r + i) % 2 === 0 ? NAVY : WHITE);
    }
  }
  // cổ để hở
  R(g, 10, 28, 5, 3, sk.base);
  R(g, 11, 31, 3, 1, '#262a45');
  put(g, 12, 32, '#262a45');
  R(g, 10, 28, 5, 1, sk.shade);
  if (scarf) drawScarf(g, 32, false);
}

function drawTank(g, sk, scarf) {
  // da vai và ngực
  R(g, 4, 29, 3, 8, sk.base);
  R(g, 18, 29, 3, 8, sk.base);
  R(g, 6, 28, 13, 5, sk.base);
  R(g, 10, 28, 5, 1, sk.shade);
  // áo ba lỗ
  R(g, 7, 29, 3, 3, WHITE);
  R(g, 15, 29, 3, 3, WHITE);
  R(g, 7, 32, 4, 1, WHITE);
  R(g, 14, 32, 4, 1, WHITE);
  R(g, 7, 33, 11, 14, WHITE);
  R(g, 7, 33, 1, 14, WSHADE);
  R(g, 7, 46, 11, 1, '#c6cbdc');
  R(g, 6, 34, 1, 12, sk.base);
  R(g, 18, 34, 1, 12, sk.base);
  if (scarf) drawScarf(g, 29, true);
}

function drawArms(g, sk, uniform) {
  const top = uniform ? 37 : 37;
  R(g, 4, top, 2, 49 - top, sk.base);
  R(g, 19, top, 2, 49 - top, sk.base);
  R(g, 4, top, 1, 49 - top, sk.shade);
  R(g, 20, top, 1, 49 - top, sk.shade);
  // bàn tay
  RR(g, 3, 49, 3, 5, sk.base, 1);
  RR(g, 19, 49, 3, 5, sk.base, 1);
  R(g, 3, 52, 1, 2, sk.shade);
  R(g, 21, 52, 1, 2, sk.shade);
}

function drawLegsSkin(g, sk, y0, y1) {
  R(g, 7, y0, 4, y1 - y0 + 1, sk.base);
  R(g, 14, y0, 4, y1 - y0 + 1, sk.base);
  R(g, 7, y0, 1, y1 - y0 + 1, sk.shade);
  R(g, 14, y0, 1, y1 - y0 + 1, sk.shade);
}

function drawPants(g, sk, kind) {
  if (kind === 'dai') {
    R(g, 6, 47, 6, 24, PANT);
    R(g, 13, 47, 6, 24, PANT);
    R(g, 11, 47, 3, 11, PANT);
    R(g, 6, 47, 13, 2, PANT2);
    R(g, 8, 51, 1, 19, PFOLD);
    R(g, 16, 51, 1, 19, PFOLD);
    R(g, 6, 70, 6, 1, PANT2);
    R(g, 13, 70, 6, 1, PANT2);
  } else if (kind === 'co_so') {
    const G1 = '#8b909e';
    const G2 = '#6d7282';
    drawLegsSkin(g, sk, 58, 70);
    R(g, 6, 47, 6, 11, G1);
    R(g, 13, 47, 6, 11, G1);
    R(g, 11, 47, 3, 6, G1);
    R(g, 6, 47, 13, 2, G2);
    R(g, 6, 57, 6, 1, G2);
    R(g, 13, 57, 6, 1, G2);
    R(g, 8, 51, 1, 6, '#9da2af');
    R(g, 16, 51, 1, 6, '#9da2af');
  } else {
    drawLegsSkin(g, sk, 59, 70);
    R(g, 6, 47, 13, 3, PANT);
    R(g, 5, 50, 15, 5, PANT);
    R(g, 4, 55, 17, 4, PANT);
    R(g, 6, 47, 13, 1, PANT2);
    R(g, 4, 58, 17, 1, PANT2);
    for (const x of [8, 12, 16]) R(g, x, 50, 1, 8, PFOLD);
  }
}

function drawShoes(g, sk, kind) {
  if (kind === 'giay') {
    for (const x of [6, 13]) {
      R(g, x, 71, 6, 3, '#f4f4f7');
      R(g, x, 73, 6, 1, '#9aa0b0');
      R(g, x + 1, 72, 4, 1, '#c9cedb');
      R(g, x, 72, 1, 1, '#3a5fcf');
    }
  } else if (kind === 'dep') {
    for (const x of [6, 13]) {
      R(g, x, 71, 6, 3, sk.base);
      R(g, x, 72, 6, 1, '#c9772f');
      R(g, x, 73, 6, 1, '#6b4326');
      R(g, x + 2, 71, 1, 1, '#c9772f');
    }
  } else {
    for (const x of [6, 13]) {
      R(g, x, 71, 6, 3, sk.base);
      R(g, x, 73, 6, 1, sk.shade);
      put(g, x + 1, 73, sk.base);
      put(g, x + 3, 73, sk.base);
      put(g, x + 5, 73, sk.base);
    }
  }
}

// ---------- tóc ----------
function hairCap(g, h, hl, wide) {
  for (let y = wide ? -4 : -3; y < hl; y++) {
    let a;
    let b;
    if (wide) {
      if (y === -4) { a = 6; b = 18; } else if (y === -3) { a = 4; b = 20; } else if (y === -2) { a = 3; b = 21; } else { a = 3; b = 21; }
    } else if (y === -3) { a = 8; b = 16; } else if (y === -2) { a = 6; b = 18; } else if (y === -1) { a = 4; b = 20; } else { a = 3; b = 21; }
    R(g, a, y, b - a + 1, 1, h.base);
  }
  // vệt sáng
  R(g, 9, -2, 5, 1, h.light);
  R(g, 12, -1, 5, 1, h.light);
  R(g, 15, 0, 4, 1, h.light);
  R(g, 16, 1, 3, 1, h.light);
  // bóng sát chân tóc
  R(g, 3, hl - 1, 19, 1, h.shade);
}
function fringe(g, h, hl, arr) {
  for (let i = 0; i < arr.length; i++) R(g, 3 + i, hl, 1, arr[i], h.base);
}

function drawHair(g, cfg, sk) {
  const h = HAIRS[cfg.hairColor];
  const id = cfg.hair;
  if (id === 'troc') return;
  if (id === 'ngan') {
    hairCap(g, h, 9, false);
    fringe(g, h, 9, [4, 4, 3, 2, 2, 1, 1, 2, 3, 3, 2, 1, 1, 2, 2, 3, 4, 4, 4]);
    R(g, 3, 9, 2, 5, h.base);
    R(g, 20, 9, 2, 5, h.base);
  } else if (id === 'cua') {
    hairCap(g, h, 7, false);
    fringe(g, h, 7, [2, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 2]);
    R(g, 3, 7, 1, 6, h.base);
    R(g, 21, 7, 1, 6, h.base);
  } else if (id === 'xu') {
    hairCap(g, h, 8, true);
    for (const [x, w] of [[7, 3], [12, 4], [17, 2]]) R(g, x, -5, w, 1, h.base);
    fringe(g, h, 8, [4, 3, 3, 2, 3, 3, 2, 1, 2, 3, 2, 1, 2, 3, 3, 2, 3, 4, 4]);
    R(g, 2, 6, 2, 8, h.base);
    R(g, 21, 6, 2, 8, h.base);
  } else if (id === 'buoc_duoi') {
    hairCap(g, h, 8, false);
    fringe(g, h, 8, [4, 3, 3, 2, 2, 1, 1, 2, 3, 3, 2, 1, 1, 2, 3, 3, 4, 4, 4]);
    R(g, 3, 8, 2, 5, h.base);
    R(g, 20, 8, 2, 4, h.base);
    // đuôi tóc bên phải
    R(g, 22, 7, 3, 3, h.base);
    R(g, 21, 10, 4, 1, RED);
    R(g, 22, 11, 3, 11, h.base);
    R(g, 23, 22, 2, 5, h.base);
    R(g, 24, 11, 1, 16, h.shade);
    R(g, 22, 12, 1, 8, h.light);
  } else if (id === 'xoa_dai') {
    hairCap(g, h, 8, false);
    fringe(g, h, 8, [5, 4, 3, 2, 2, 1, 1, 2, 3, 3, 2, 1, 1, 2, 2, 3, 3, 4, 5]);
    R(g, 1, 8, 4, 28, h.base);
    R(g, 20, 8, 4, 28, h.base);
    R(g, 2, 34, 2, 3, h.base);
    R(g, 21, 34, 2, 3, h.base);
    R(g, 1, 10, 1, 24, h.shade);
    R(g, 23, 10, 1, 24, h.shade);
    R(g, 3, 12, 1, 18, h.light);
    R(g, 21, 12, 1, 18, h.shade);
  } else if (id === 'hai_bim') {
    hairCap(g, h, 8, false);
    fringe(g, h, 8, [4, 3, 3, 2, 2, 1, 1, 2, 3, 3, 2, 1, 1, 2, 3, 3, 4, 4, 4]);
    R(g, 1, 8, 4, 4, h.base);
    R(g, 20, 8, 4, 4, h.base);
    for (let y = 12; y <= 36; y++) {
      const off = Math.floor((y - 12) / 2) % 2 === 0 ? 0 : 1;
      R(g, 0 + off, y, 3, 1, h.base);
      R(g, 22 - off, y, 3, 1, h.base);
      if ((y - 12) % 4 === 1) {
        put(g, 1 + off, y, h.shade);
        put(g, 23 - off, y, h.shade);
      }
    }
    R(g, 0, 37, 3, 1, RED);
    R(g, 22, 37, 3, 1, RED);
    R(g, 1, 38, 2, 2, h.base);
    R(g, 22, 38, 2, 2, h.base);
  }
}

// ---------- lắp ráp ----------
export function buildGrid(cfgIn) {
  const cfg = sanitize(cfgIn);
  const sk = SKINS[cfg.skin];
  const female = cfg.gender === 'nu';
  const g = makeGrid();

  drawHead(g, sk, female, cfg.hair === 'troc');
  if (cfg.shirt === 'ba_lo') drawTank(g, sk, cfg.scarf);
  else drawUniform(g, sk, cfg.scarf);
  drawArms(g, sk, cfg.shirt === 'dong_phuc');
  drawPants(g, sk, cfg.pants);
  drawShoes(g, sk, cfg.shoes);
  drawHair(g, cfg, sk);
  addOutline(g);
  return g;
}

export function drawCharacter(ctx, cfg, scale = 8, ox = 0, oy = 0) {
  const g = buildGrid(cfg);
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.d[y * g.w + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}

export function renderCharacter(canvas, cfg, scale = 8) {
  if (!canvas) return;
  canvas.width = SIZE.w * scale;
  canvas.height = SIZE.h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCharacter(ctx, cfg, scale, 0, 0);
}
