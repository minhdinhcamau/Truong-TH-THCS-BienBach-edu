// GAME (tách riêng): người mua ở chợ miền Tây mặc đồ đi chợ (nón lá, khăn đỏ, mũ bảo hiểm, khẩu trang, áo hoa, quần hoa...),
// dựng từ chính khung nhân vật của game (cùng dáng chibi, viền đen, bước đi 4 nhịp) nhưng đổi áo quần và thêm mũ theo ảnh mẫu.
// Không phụ thuộc trình duyệt: nhận hàm mk(w, h) trả về canvas (mặc định dùng document).
import { ALPHA, AX, CH, CW, FRAMES, PAL } from './spriteData';
import { HAIRS, SKINS } from './sprites';

const IDX = {};
for (let i = 0; i < ALPHA.length; i++) IDX[ALPHA[i]] = i;
const SKIN_REF = [249, 190, 155];
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// vai trò của từng màu trong bảng màu nhân vật (đo từ khung F0, B0, S0)
const SHIRT = new Set([0, 4, 11, 12, 14, 22]);                // áo trắng (sáng đến tối)
const SCARF = new Set([42, 43, 44, 45]);                       // khăn quàng đỏ
const TRIM = new Set([2, 6, 13, 17, 19, 23]);                  // cổ áo, tay áo xanh đậm
const PANTS = new Set([15, 16, 18, 24]);                       // quần đen
const lumOf = (r, g, b) => (r + g + b) / 3;

// họa tiết áo: trả về màu gốc tại điểm (x, y) của khung
const h2 = (x, y, s) => { let v = Math.imul((x * 73856093) ^ (y * 19349663) ^ (s * 83492791), 0x85ebca6b); v ^= v >>> 13; return ((v >>> 0) % 1000) / 1000; };
const PATTERNS = {
  trang: () => [247, 247, 250],
  hong: () => [233, 112, 143],
  do: () => [196, 71, 74],
  xanhduong: () => [74, 123, 208],
  hoavang: (x, y) => { const v = h2(Math.floor(x / 3), Math.floor(y / 3), 1); return v < 0.22 ? [32, 30, 34] : v < 0.36 ? [244, 244, 240] : [242, 192, 30]; },
  hoaxanh: (x, y) => { const v = h2(Math.floor(x / 3), Math.floor(y / 3), 2); return v < 0.16 ? [236, 88, 158] : v < 0.2 ? [250, 220, 90] : [118, 200, 70]; },
  caro: (x, y) => { const a = Math.floor(x / 4) % 2; const b = Math.floor(y / 4) % 2; return a && b ? [38, 34, 30] : a || b ? [120, 84, 52] : [196, 160, 110]; },
};
const PANT_PATTERNS = {
  den: () => [40, 40, 50],
  navy: () => [44, 48, 78],
  xam: () => [96, 98, 108],
  kaki: () => [140, 128, 98],
  hoa: (x, y) => { const v = h2(Math.floor(x / 3), Math.floor(y / 3), 3); return v < 0.14 ? [244, 244, 232] : v < 0.22 ? [240, 196, 50] : [38, 78, 44]; },
};

// các bộ đồ (theo ảnh mẫu của thầy và ảnh chợ thật)
export const BUYER_OUTFITS = [
  { id: 'ba-non-la', gender: 'nu', skin: 1, hair: [150, 150, 160], hat: 'nonla', khan: true, shirt: 'hoavang', pants: 'navy', trim: [60, 52, 40] },
  { id: 'co-mu-bao-hiem', gender: 'nu', skin: 0, hair: [112, 78, 58], hat: 'mubh', mask: true, shirt: 'hong', pants: 'den', trim: [196, 82, 110] },
  { id: 'ba-ao-hoa-xanh', gender: 'nu', skin: 1, hair: [140, 140, 150], hat: 'nonla', shirt: 'hoaxanh', pants: 'den', trim: [60, 120, 50] },
  { id: 'co-ao-do-quan-hoa', gender: 'nu', skin: 0, hair: [128, 90, 66], shirt: 'do', pants: 'hoa', trim: [40, 90, 60] },
  { id: 'chu-ao-caro', gender: 'nam', skin: 2, hat: 'mubh', hatColor: 'den', shirt: 'caro', pants: 'kaki', trim: [60, 44, 30] },
  { id: 'co-ao-xanh-non-la', gender: 'nu', skin: 1, hair: [60, 46, 40], hat: 'nonla', mask: true, shirt: 'xanhduong', pants: 'xam', trim: [40, 80, 150] },
  { id: 'chu-ao-trang-non-la', gender: 'nam', skin: 1, hat: 'nonla', shirt: 'trang', pants: 'navy', trim: [150, 156, 190] },
];

function colorFor(o, idx, x, y, pal) {
  const p = PAL[idx];
  if (SCARF.has(idx) && !o.khan && y >= 32) {   // không có khăn: dải khăn mang màu áo
    const f = Math.max(0.8, Math.min(1, lumOf(p[0], p[1], p[2]) / 200));
    const c = PATTERNS[o.shirt](x, y);
    return [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f)];
  }
  if (SHIRT.has(idx) && y >= 32) {   // từ cổ trở xuống; phần đầu (mắt, tai) giữ nguyên
    const f = Math.max(0.62, Math.min(1.04, lumOf(p[0], p[1], p[2]) / 246));
    const c = PATTERNS[o.shirt](x, y);
    return [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f)];
  }
  if (TRIM.has(idx) && y >= 32) {
    const f = Math.max(0.55, Math.min(1.35, lumOf(p[0], p[1], p[2]) / 80));
    return [clamp(o.trim[0] * f), clamp(o.trim[1] * f), clamp(o.trim[2] * f)];
  }
  if (PANTS.has(idx) && y >= 52) {
    const f = Math.max(0.7, Math.min(1.3, lumOf(p[0], p[1], p[2]) / 30));
    const c = PANT_PATTERNS[o.pants](x, y);
    return [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f)];
  }
  return pal[idx];
}

function basePalette(o) {
  const sk = SKINS[o.skin].rgb;
  const kr = sk[0] / SKIN_REF[0]; const kg = sk[1] / SKIN_REF[1]; const kb = sk[2] / SKIN_REF[2];
  const hair = o.hair || HAIRS[0].rgb;
  return PAL.map(([r, g, b, tag]) => {
    const lum = (r + g + b) / 3;
    if (tag === 1) return [clamp(r * kr), clamp(g * kg), clamp(b * kb)];
    if (tag === 4) {                         // chân trần (dép coi như màu da)
      const base = lum > 200 ? SKIN_REF : [226, 158, 122];
      return [clamp(base[0] * kr), clamp(base[1] * kg), clamp(base[2] * kb)];
    }
    if (tag === 3) {                         // khăn quàng: giữ đỏ nếu có khăn, không thì thành màu áo
      if (o.khan) return [r, g, b];
      return lum < 85 ? [150, 150, 160] : [210, 210, 220];
    }
    if (tag === 2 && hair) { const f = Math.pow(Math.max(lum, 8) / 52, 0.9); return [clamp(hair[0] * f), clamp(hair[1] * f), clamp(hair[2] * f)]; }
    return [r, g, b];
  });
}

const ink = '#1a1a22';
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

// mũ, khăn, khẩu trang vẽ đè lên khung (dir: 'front' | 'back' | 'side')
function overlay(g, o, dir) {
  if (o.gender === 'nam') {
    // tóc ngắn đen dưới mũ (khung nam gốc là đầu trọc)
    const hc = '#221e22'; const hl = '#3a3338';
    if (dir === 'back') { rect(g, 9, 14, 22, 15, hc); rect(g, 11, 16, 6, 3, hl); }
    else if (dir === 'front') { rect(g, 8, 14, 4, 11, hc); rect(g, 29, 14, 4, 11, hc); rect(g, 12, 14, 17, 4, hc); }
    else { rect(g, 8, 14, 15, 15, hc); rect(g, 10, 16, 5, 3, hl); rect(g, 22, 14, 9, 4, hc); }
  }
  if (o.hat === 'nonla') {
    // nón lá: chóp ở trên, vành rộng che trán
    for (let y = 0; y <= 17; y++) {
      const half = Math.round(1 + (y / 17) * 19);
      for (let x = 20 - half; x <= 20 + half; x++) {
        const edge = x === 20 - half || x === 20 + half || y === 17;
        let c = x < 18 ? '#f4e8c4' : x < 24 ? '#ecdcae' : '#d8c48e';
        if (y >= 14) c = '#b8a070';
        if ((x + y) % 5 === 0 && y > 4 && y < 14) c = x < 20 ? '#e2d2a0' : '#c8b47c';
        px(g, x, y, edge ? ink : c);
      }
    }
    rect(g, 11, 18, 18, 1, '#6a4e2c');   // bóng dưới vành
  } else if (o.hat === 'mubh') {
    const col = o.hatColor === 'den' ? ['#2e3036', '#5a5d68', '#1a1b20'] : ['#2f86b8', '#62b8e6', '#1d5a82'];
    for (let y = 1; y <= 17; y++) {
      const t = (y - 1) / 16;
      const half = Math.round(17 * Math.sqrt(Math.max(0, 1 - Math.pow(1 - t, 2.2))));
      for (let x = 20 - half; x <= 20 + half; x++) {
        const edge = x === 20 - half || x === 20 + half || y === 1;
        px(g, x, y, edge ? ink : (x < 17 && y < 9 ? col[1] : x > 28 ? col[2] : col[0]));
      }
    }
    // vành trắng phía trước
    const vx0 = dir === 'side' ? 6 : 3; const vx1 = dir === 'side' ? 39 : 37;
    if (dir !== 'back') { rect(g, vx0, 16, vx1 - vx0 + 1, 3, ink); rect(g, vx0 + 1, 17, vx1 - vx0 - 1, 1, '#f4f4f6'); }
    // quai mũ đen
    if (dir !== 'back') { rect(g, 10, 19, 1, 12, ink); rect(g, 30, 19, 1, 12, ink); }
  }
  if (o.khan && dir !== 'back') {
    // khăn đỏ chấm trắng quấn hai bên đầu và buộc ở cằm (dưới nón)
    const dots = [[9, 22], [10, 27], [31, 22], [30, 27], [12, 31], [28, 31]];
    for (const [x, y] of dots) px(g, x, y, '#f4e0e0');
  }
  if (o.mask && dir !== 'back') {
    if (dir === 'front') {
      rect(g, 12, 25, 17, 8, '#9ca0a8'); rect(g, 13, 26, 15, 6, '#d4d7dc');
      for (const y of [28, 30]) rect(g, 13, y, 15, 1, '#b0b4bc');
      rect(g, 12, 25, 17, 1, ink); rect(g, 12, 32, 17, 1, ink);
      rect(g, 8, 26, 4, 1, ink); rect(g, 29, 26, 4, 1, ink);
    } else {
      rect(g, 22, 25, 13, 8, '#9ca0a8'); rect(g, 23, 26, 11, 6, '#d4d7dc');
      for (const y of [28, 30]) rect(g, 23, y, 11, 1, '#b0b4bc');
      rect(g, 22, 25, 13, 1, ink); rect(g, 22, 32, 13, 1, ink);
      rect(g, 15, 26, 7, 1, ink);
    }
  }
}

// dựng đủ khung (đứng, bước, nhìn trước, nhìn sau, nhìn bên, chớp mắt) cho một bộ đồ
export function buildBuyerFrames(outfit, mk) {
  const make = mk || ((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  const o = { hair: null, hat: null, mask: false, khan: false, hatColor: 'xanh', ...outfit };
  const pal = basePalette(o);
  const letter = o.gender === 'nam' ? 'b' : 'h';
  const draw = (key, dir) => {
    const fr = FRAMES[`${letter}:${key}`];
    const cv = make(CW, CH);
    const g = cv.getContext('2d');
    fr.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        const x = fr.x + i; const y = fr.y + j;
        const c = colorFor(o, IDX[ch], x, y, pal);
        px(g, x, y, `rgb(${c[0]},${c[1]},${c[2]})`);
      }
    });
    overlay(g, o, dir);
    return cv;
  };
  return {
    front: [draw('F0', 'front'), draw('F1', 'front'), draw('F0', 'front'), draw('F2', 'front')],
    back: [draw('B0', 'back'), draw('B1', 'back'), draw('B0', 'back'), draw('B2', 'back')],
    side: [draw('S0', 'side'), draw('S1', 'side'), draw('S2', 'side'), draw('S3', 'side')],
    blinkFront: draw('F0b', 'front'),
    blinkSide: draw('S0b', 'side'),
    w: CW, h: CH, ax: AX,
  };
}
