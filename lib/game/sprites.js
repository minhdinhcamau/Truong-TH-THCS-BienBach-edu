// GAME (tách riêng): nhân vật pixel dựng từ ảnh mẫu (tóc, đồng phục, chớp mắt, dáng đi).
// Muốn gỡ game: xóa thư mục lib/game, components/game, app/game và chạy xoa_game.sql.
import { ALPHA, AX, CH, CW, FRAMES, PAL } from './spriteData';

export const SIZE = { w: CW, h: CH };
export const ANCHOR_X = AX;
export const SPR_SCALE = 1.2; // phóng to nhân vật khi vẽ trong nhà

export const SKINS = [
  { name: 'Da sáng', base: '#f9be9b', rgb: [249, 190, 155] },
  { name: 'Da bánh mật', base: '#d9976b', rgb: [217, 151, 107] },
  { name: 'Da nâu', base: '#a96a45', rgb: [169, 106, 69] },
];

// Màu đầu tiên là đúng màu trong hình mẫu; các màu sau là tùy chọn thêm.
export const HAIRS = [
  { name: 'Như hình mẫu', base: '#3e302c', rgb: null },
  { name: 'Vàng', base: '#d4a848', rgb: [212, 168, 72] },
  { name: 'Hồng', base: '#e2709c', rgb: [226, 112, 156] },
  { name: 'Xanh dương', base: '#466ec8', rgb: [70, 110, 200] },
  { name: 'Bạc', base: '#c4c6d6', rgb: [196, 198, 214] },
];

const HAIR_LIST = [
  { id: 'troc', label: 'Không tóc' },
  { id: 'mau', label: 'Tóc như hình mẫu' },
];
export const OPTIONS = {
  gender: [
    { id: 'nam', label: 'Nam' },
    { id: 'nu', label: 'Nữ' },
  ],
  hair: { nam: HAIR_LIST, nu: HAIR_LIST },
  shirt: [{ id: 'dong_phuc', label: 'Đồng phục' }],
  pants: [{ id: 'dai', label: 'Quần dài' }],
  shoes: [
    { id: 'chan', label: 'Chân trần' },
    { id: 'giay', label: 'Giày trắng' },
  ],
};

// Nhân vật nữ giống hình mẫu: tóc buộc kẹp, đồng phục, khăn quàng đỏ, quần dài đen, giày trắng.
export const DEFAULT_CFG = {
  gender: 'nu',
  skin: 0,
  hair: 'mau',
  hairColor: 0,
  shirt: 'dong_phuc',
  scarf: true,
  pants: 'dai',
  shoes: 'giay',
};

function pickIndex(v, len, def) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n >= 0 && n < len ? n : def;
}

// Luôn đưa dữ liệu cũ hoặc lỗi về cấu hình hợp lệ.
export function sanitize(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const gender = c.gender === 'nam' ? 'nam' : 'nu';
  const hasHair = c.hair === undefined ? gender === 'nu' : c.hair !== 'troc';
  return {
    gender,
    skin: pickIndex(c.skin, SKINS.length, 0),
    hair: hasHair ? 'mau' : 'troc',
    hairColor: pickIndex(c.hairColor, HAIRS.length, 0),
    shirt: 'dong_phuc',
    scarf: c.scarf === undefined ? true : !!c.scarf,
    pants: 'dai',
    shoes: c.shoes === 'chan' || c.shoes === 'dep' ? 'chan' : c.shoes === 'giay' ? 'giay' : gender === 'nu' ? 'giay' : 'chan',
  };
}

export function randomCfg() {
  const gender = Math.random() < 0.5 ? 'nam' : 'nu';
  return sanitize({
    gender,
    skin: Math.floor(Math.random() * SKINS.length),
    hair: Math.random() < 0.7 ? 'mau' : 'troc',
    hairColor: Math.floor(Math.random() * HAIRS.length),
    scarf: Math.random() < 0.8,
    shoes: Math.random() < 0.5 ? 'giay' : 'chan',
  });
}

// ---------- đổi màu theo cấu hình ----------
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const SKIN_REF = [249, 190, 155];

function palette(cfgIn) {
  const cfg = sanitize(cfgIn);
  const sk = SKINS[cfg.skin].rgb;
  const kr = sk[0] / SKIN_REF[0];
  const kg = sk[1] / SKIN_REF[1];
  const kb = sk[2] / SKIN_REF[2];
  const hair = HAIRS[cfg.hairColor].rgb;
  return PAL.map(([r, g, b, tag]) => {
    const lum = (r + g + b) / 3;
    if (tag === 1 || (tag === 4 && cfg.shoes !== 'giay')) return [clamp(r * kr), clamp(g * kg), clamp(b * kb)];
    if (tag === 4) {
      // giày trắng
      if (lum > 190) return [244, 244, 247];
      if (lum > 150) return [214, 218, 228];
      return [150, 156, 172];
    }
    if (tag === 3 && !cfg.scarf) return lum < 85 ? [214, 218, 232] : [246, 247, 251];
    if (tag === 2 && hair) {
      const f = Math.pow(Math.max(lum, 8) / 52, 0.9);
      return [clamp(hair[0] * f), clamp(hair[1] * f), clamp(hair[2] * f)];
    }
    return [r, g, b];
  });
}

const IDX = {};
for (let i = 0; i < ALPHA.length; i++) IDX[ALPHA[i]] = i;

// Khung nguồn: kiểu 'F0','F1','B0','B1','S0','S1','S2' (+ 'b' = nhắm mắt)
function drawFrame(cfgIn, key, pal) {
  const cfg = sanitize(cfgIn);
  const fr = FRAMES[`${cfg.hair === 'mau' ? 'h' : 'b'}:${key}`];
  const cv = document.createElement('canvas');
  cv.width = CW;
  cv.height = CH;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(CW, CH);
  fr.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const c = pal[IDX[ch]];
      const o = ((fr.y + j) * CW + fr.x + i) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  });
  ctx.putImageData(img, 0, 0);
  return cv;
}

function mirror(cv) {
  const m = document.createElement('canvas');
  m.width = cv.width;
  m.height = cv.height;
  const c = m.getContext('2d');
  c.translate(cv.width, 0);
  c.scale(-1, 1);
  c.drawImage(cv, 0, 0);
  return m;
}

// Trả về mọi khung hình đã đổi màu. Dáng đi: đứng, bước, đứng, bước đối chân (như ảnh mẫu).
// Nhìn bên: hai tư thế bước trong ảnh mẫu xen kẽ. Nhìn bên quay phải; quay trái thì lật hình khi vẽ.
export function buildFrames(cfg) {
  const pal = palette(cfg);
  const d = (k) => drawFrame(cfg, k, pal);
  const F0 = d('F0');
  const F1 = d('F1');
  const B0 = d('B0');
  const B1 = d('B1');
  const S0 = d('S0');
  const S1 = d('S1');
  const S2 = d('S2');
  return {
    front: [F0, F1, F0, mirror(F1)],
    back: [B0, B1, B0, mirror(B1)],
    side: [S0, S1, S2, S1],
    blinkFront: d('F0b'),
    blinkSide: d('S0b'),
    w: CW,
    h: CH,
    ax: AX,
  };
}

// Vẽ nhân vật ra canvas cho màn hình tạo nhân vật.
// pose: { dir: 'front'|'back'|'side', step: 0..3, blink: bool }
export function renderCharacter(canvas, cfg, scale = 8, pose) {
  if (!canvas) return;
  const p = pose || {};
  const fr = buildFrames(cfg);
  const dir = p.dir === 'back' || p.dir === 'side' ? p.dir : 'front';
  let img = fr[dir][p.step || 0];
  if (p.blink && dir === 'front') img = fr.blinkFront;
  if (p.blink && dir === 'side') img = fr.blinkSide;
  canvas.width = CW * scale;
  canvas.height = CH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, CW * scale, CH * scale);
}
