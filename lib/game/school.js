// GAME (tách riêng): map TRƯỚC CỔNG TRƯỜNG TH - THCS Biển Bạch, dựng theo ẢNH GỐC của thầy (public/game/cong-truong-map.png).
// Ảnh đã đổi thành pixel nét (1 điểm ảnh = 1 đơn vị thế giới), bầu trời được cắt bỏ để vẽ trời động có mây trôi, ban đêm.
// Bố cục theo ảnh: nhà bảo vệ bên trái, cổng có mái ngói và bảng tên ở giữa, hàng rào xanh trắng, cây lớn bên phải,
// sân lát bê tông trước cổng, kênh hai bên, đường đi ở giữa là cầu bắc qua kênh (nối thêm phía nam: bờ nam, đường đất về làng).
// Mọi máy dựng ra cùng một map vì dùng bộ số ngẫu nhiên cố định. Xóa cùng thư mục lib/game khi gỡ game.
export const SW = 700;                // bề ngang thế giới (= bề ngang ảnh)
export const SH = 484;                // chiều cao thế giới
export const VIEW_W = 640;
export const CHAR_H = 36;
export const SPEED = 118;
export const ZONE_MAX = 10;           // mỗi khu tối đa 10 bạn cùng lúc

export const SCENE_URL = '/game/cong-truong-map.png';
export const HORIZON = 150;           // dải trời động phủ tới đây (ảnh che phần còn lại)
export const GATE = { cx: 358, x0: 281, x1: 439, enterY: 234, topY: 214 };   // lối giữa hai cột cổng; bước tới enterY là sang sân trường
export const GATE_BASE = 298;         // chân cột cổng, mép trên sân
export const SPAWN_FROM_VILLAGE = { x: 352, y: 446 };   // từ làng đi lên: đứng đầu cầu phía nam, rồi bước lên cầu
export const SPAWN_FROM_YARD = { x: 358, y: 316 };      // từ sân trường ra: đứng ngay trước cổng
export const VILLAGE_Y = 468;                           // đi xuống dưới mức này là tới đường về làng
export const BANK_Y = 344;            // mép dưới sân, giáp bờ kênh
export const BRIDGE_END_Y = 416;      // hết cầu, bắt đầu bờ nam

export const SIGN_TEXT = 'TRƯỜNG TH - THCS BIỂN BẠCH';

export const GATE_TEXT = {
  bv: 'Phòng bảo vệ. Bác bảo vệ vẫy tay chào: "Chào em, chúc em một ngày học vui vẻ!"',
  cay: 'Cây bóng mát to ở góc sân trường. Giờ ra chơi các bạn hay tụ tập hóng mát dưới này.',
};

// ô cửa sổ nhà bảo vệ sáng đèn ban đêm: { x, y, w, h }
export const WINDOWS = [
  { x: 110, y: 197, w: 70, h: 29 },
  { x: 195, y: 196, w: 17, h: 29 },
];

// độ lớn nhân vật theo độ sâu: càng gần người xem (y lớn) càng to, ở cổng thì nhỏ hơn
export function depthScale(y) {
  return Math.max(0.74, Math.min(1.3, 0.78 + ((y - 215) * 0.42) / 215));
}

// hai tay vịn cầu chạy chéo (đường tâm), đo theo ảnh. Dùng chung với phần vẽ nước.
export const railL = (y) => 157 - 1.1 * (y - 379);
export const railR = (y) => 548 + 1.15 * (y - 379);
const RAIL_PAD = 22;                  // thân tay vịn + chân trụ chiếm chừng này bề ngang phía trong

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cache = null;
export function getSchool() {
  if (cache) return cache;
  const rnd = mulberry32(20261012);
  const objects = [];
  const colliders = [];
  const lights = [];        // đèn ban đêm: { x, y, r, a, seed, kind }
  const add = (o) => { objects.push(o); return o; };
  const col = (x0, y0, x1, y1) => colliders.push({ x0, y0, x1, y1 });

  // bờ nam: dừa, chuối, bụi, lau (chừa đường đất cho mọi người đứng)
  for (const x of [58, 150, 566, 640]) { const y = 452 + rnd() * 22; add({ k: 'palm', x, y, v: Math.floor(rnd() * 3) }); col(x - 3, y - 3, x + 3, y); }
  for (const x of [28, 676]) { const y = 440 + rnd() * 30; add({ k: 'banana', x, y, v: Math.floor(rnd() * 2) }); col(x - 5, y - 4, x + 5, y); }
  for (let n = 0; n < 16; n++) {
    const x = 24 + rnd() * 652;
    if (x > 226 && x < 478) continue;
    const y = 424 + rnd() * 54;
    add({ k: rnd() < 0.5 ? 'bush' : 'reed', x, y, v: Math.floor(rnd() * 2) });
  }
  // lau sậy mép nước phía nam
  for (let x = 20; x < SW - 20; x += 16 + rnd() * 26) {
    if (x > 90 && x < 610) continue;
    add({ k: 'reed', x, y: 419 + rnd() * 3, v: Math.floor(rnd() * 2) });
  }
  // súng trên kênh (ngoài cầu)
  for (const [x, y] of [[48, 394], [104, 401], [20, 386], [600, 397], [652, 402], [676, 388]]) add({ k: 'lily', x, y, v: Math.floor(rnd() * 2) });
  // biển chỉ đường về làng
  add({ k: 'sign', x: 352, y: 474, text: 'VỀ LÀNG', color: '#ffd45c' });

  // đèn ban đêm (chỉ có ánh sáng, không thêm vật lạ so với ảnh gốc)
  lights.push(
    { x: 358, y: 152, r: 110, a: 0.55, seed: 1.3, kind: 'glow' },     // bảng tên
    { x: 358, y: 262, r: 96, a: 0.95, seed: 2.7, kind: 'glow' },      // lối lát gạch vàng giữa hai cột
    { x: 146, y: 212, r: 74, a: 0.85, seed: 4.1, kind: 'glow' },      // cửa sổ phòng bảo vệ
    { x: 214, y: 316, r: 96, a: 0.8, seed: 5.2, kind: 'glow' },       // đầu cầu phía bắc, bên trái
    { x: 491, y: 316, r: 96, a: 0.8, seed: 6.6, kind: 'glow' },       // đầu cầu phía bắc, bên phải
    { x: 352, y: 372, r: 110, a: 0.7, seed: 7.3, kind: 'glow' },      // giữa cầu
    { x: 352, y: 432, r: 104, a: 0.65, seed: 8.8, kind: 'glow' },     // đầu cầu phía nam
  );

  objects.sort((a, b) => a.y - b.y);
  cache = { objects, colliders, lights };
  return cache;
}

// mép trên sân (chân hàng rào/tường), thấp dần về hai bên theo phối cảnh của ảnh
function plazaTop(x) {
  if (x < 239) return GATE_BASE + (239 - x) * 0.115;
  if (x > 478) return GATE_BASE + (x - 478) * 0.17;
  return GATE_BASE + 1;
}

// lối đi giữa hai cột cổng: hẹp dần về phía trong, theo phối cảnh
function inGate(x, y) {
  if (y < GATE.topY || y > GATE_BASE + 2) return false;
  const t = (y - GATE.topY) / (GATE_BASE - GATE.topY);
  return x >= 314 - 30 * t && x <= 402 + 34 * t;
}

function free(x, y) {
  if (x < 14 || x > SW - 14 || y > 478) return false;
  if (y < plazaTop(x)) return inGate(x, y);
  if (x < 86 && y < 360) return false;                          // bụi cây lớn góc trái
  if (x > 610 && y > 316 && y < 350) return false;              // chậu và gốc cây lớn
  if (x > 660 && y >= 350 && y < 380) return false;             // bụi cây góc phải
  if (y >= 322 && y < BANK_Y) {                                  // đầu hai tay vịn
    if (Math.abs(x - railL(y)) < 8 || Math.abs(x - railR(y)) < 8) return false;
    if (x > railL(y) + 8 && x < railL(y) + RAIL_PAD && y > 330) return false;
    if (x < railR(y) - 8 && x > railR(y) - RAIL_PAD && y > 330) return false;
  }
  if (y >= BANK_Y && y < BRIDGE_END_Y) {                         // kênh: chỉ đi trên cầu
    const pad = y < 379 ? RAIL_PAD : 14;
    if (x < railL(y) + pad || x > railR(y) - pad) return false;
  }
  const { colliders } = getSchool();
  for (const c of colliders) if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) return false;
  return true;
}

export function schoolBlocked(x, y) {
  return !(free(x, y) && free(x - 6, y) && free(x + 6, y));
}

// điểm xuất hiện: rải ngẫu nhiên quanh điểm gốc để nhiều bạn vào cùng lúc không đứng chồng lên nhau
export function spawnPoint(from) {
  const base = from === 'yard' ? SPAWN_FROM_YARD : SPAWN_FROM_VILLAGE;
  for (let i = 0; i < 40; i++) {
    const x = base.x + (Math.random() - 0.5) * (i < 20 ? 110 : 220);
    const y = base.y + (Math.random() - 0.5) * (i < 20 ? 16 : 36);
    if (!schoolBlocked(x, y)) return { x, y };
  }
  return { x: base.x, y: base.y };
}

// điểm tương tác gần nhất: { id, label }
export function schoolNearest(x, y) {
  if (y >= VILLAGE_Y) return { id: 've_lang', label: 'Về làng quê' };
  if (x >= GATE.x0 - 14 && x <= GATE.x1 + 14 && y >= GATE.topY && y <= 330) return { id: 'vao', label: 'Vào cổng trường' };
  if (x > 200 && x < 516 && y >= GATE_BASE && y <= 340) return { id: 'bang', label: 'Đọc bảng tên trường' };
  if (x >= 86 && x <= 236 && y >= GATE_BASE && y <= 340) return { id: 'bv', label: 'Phòng bảo vệ' };
  if (x >= 520 && x <= 700 && y >= GATE_BASE && y <= 346) return { id: 'cay', label: 'Ngắm cây bóng mát' };
  return null;
}
