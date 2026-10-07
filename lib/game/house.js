// GAME (tách riêng): căn nhà đầu tiên của nhân vật. Danh mục đồ đạc, bố cục, va chạm và hình vẽ pixel.
// Muốn gỡ game: xóa thư mục lib/game, components/game, app/game và chạy xoa_game.sql.

export const TILE = 48;
export const COLS = 12;
export const ROWS = 8;
export const WALL_H = 96; // dải tường phía sau, vẽ phía trên sàn
export const CW = COLS * TILE;
export const CH = WALL_H + ROWS * TILE;
export const SPAWN = { x: 6 * TILE + 24, y: 4 * TILE + 30 };

const OL = '#1c1a26';

// layer: 'solid' = đồ đặc, không đi xuyên qua; 'rug' = thảm, đi lên được.
// act: tên hành động khi đứng gần.
export const CATALOG = {
  giuong: { label: 'Giường', w: 2, h: 3, layer: 'solid', act: 'Ngủ' },
  bon_cau: { label: 'Bồn cầu', w: 1, h: 1, layer: 'solid', act: 'Dùng nhà vệ sinh' },
  bon_rua: { label: 'Bồn rửa mặt', w: 1, h: 1, layer: 'solid', act: 'Rửa mặt' },
  tu_lanh: { label: 'Tủ lạnh', w: 1, h: 2, layer: 'solid', act: 'Mở tủ lạnh' },
  bep: { label: 'Bếp', w: 1, h: 1, layer: 'solid', act: 'Nấu ăn' },
  chau_rua: { label: 'Bồn rửa bát', w: 2, h: 1, layer: 'solid', act: 'Rửa bát' },
  ban_an: { label: 'Bàn ăn', w: 2, h: 2, layer: 'solid', act: 'Ăn cơm' },
  ghe: { label: 'Ghế', w: 1, h: 1, layer: 'solid', act: 'Ngồi nghỉ' },
  sofa: { label: 'Ghế sofa', w: 2, h: 1, layer: 'solid', act: 'Ngồi nghỉ' },
  ke_sach: { label: 'Kệ sách', w: 2, h: 1, layer: 'solid', act: 'Xem sách' },
  cay: { label: 'Chậu cây', w: 1, h: 1, layer: 'solid', act: null },
  den: { label: 'Đèn cây', w: 1, h: 1, layer: 'solid', act: null },
  tham: { label: 'Thảm', w: 3, h: 2, layer: 'rug', act: null },
};

// Câu hiện khi bấm tương tác. Chưa có chỉ số nên mới chỉ là lời thoại.
export const ACT_TEXT = {
  giuong: 'Em nằm nghỉ một lát. Ngủ để hồi sức sẽ có ở bản sau.',
  bon_cau: 'Em dùng nhà vệ sinh xong rồi. Nhớ rửa tay nhé!',
  bon_rua: 'Em rửa mặt cho tỉnh táo.',
  tu_lanh: 'Tủ lạnh còn ít đồ ăn. Phần nấu ăn sẽ có ở bản sau.',
  bep: 'Bếp đã sẵn sàng. Nấu ăn sẽ có ở bản sau.',
  chau_rua: 'Em rửa bát sạch bong.',
  ban_an: 'Em ngồi vào bàn ăn cơm.',
  ghe: 'Em ngồi nghỉ một chút.',
  sofa: 'Em ngồi nghỉ trên sofa.',
  ke_sach: 'Em lật vài trang sách.',
};

// Tường mỏng ngăn nhà vệ sinh (đơn vị điểm ảnh, tọa độ sàn). Cửa rộng 1 ô ở cột 10.
export const WALLS = [
  { x: 428, y: 0, w: 8, h: 196 },
  { x: 428, y: 188, w: 52, h: 8 },
  { x: 528, y: 188, w: 48, h: 8 },
];

let uidCounter = 0;
export function newUid() {
  uidCounter += 1;
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + uidCounter.toString(36)).slice(-10);
}

export const DEFAULT_HOUSE = {
  v: 1,
  placed: [
    { uid: 'd01', type: 'tu_lanh', x: 0, y: 0 },
    { uid: 'd02', type: 'chau_rua', x: 1, y: 0 },
    { uid: 'd03', type: 'bep', x: 3, y: 0 },
    { uid: 'd04', type: 'ke_sach', x: 5, y: 0 },
    { uid: 'd05', type: 'cay', x: 7, y: 0 },
    { uid: 'd06', type: 'bon_cau', x: 10, y: 0 },
    { uid: 'd07', type: 'bon_rua', x: 11, y: 0 },
    { uid: 'd08', type: 'ban_an', x: 1, y: 3 },
    { uid: 'd09', type: 'ghe', x: 0, y: 3 },
    { uid: 'd10', type: 'ghe', x: 3, y: 3 },
    { uid: 'd11', type: 'tham', x: 5, y: 5 },
    { uid: 'd12', type: 'giuong', x: 10, y: 5 },
    { uid: 'd13', type: 'den', x: 9, y: 7 },
  ],
  inv: [
    { uid: 'k01', type: 'sofa' },
    { uid: 'k02', type: 'ghe' },
    { uid: 'k03', type: 'cay' },
    { uid: 'k04', type: 'den' },
  ],
};

// ---------- hình học ----------
function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function itemRect(type, x, y) {
  const d = CATALOG[type];
  return { x: x * TILE, y: y * TILE, w: d.w * TILE, h: d.h * TILE };
}

// Đặt đồ vào ô (x, y) có hợp lệ không. ignoreUid: món đang được kéo.
export function canPlace(type, x, y, placed, ignoreUid) {
  const d = CATALOG[type];
  if (!d) return false;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x + d.w > COLS || y + d.h > ROWS) return false;
  const r = itemRect(type, x, y);
  const s = { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 };
  for (const w of WALLS) if (hit(s, w)) return false;
  for (const p of placed) {
    if (p.uid === ignoreUid) continue;
    const pd = CATALOG[p.type];
    if (!pd || pd.layer !== d.layer) continue;
    if (hit(r, itemRect(p.type, p.x, p.y))) return false;
  }
  return true;
}

// Tìm chỗ trống gần giữa nhà nhất để đặt món lấy từ kho.
export function findFreeSpot(type, placed) {
  const d = CATALOG[type];
  if (!d) return null;
  const cands = [];
  for (let y = 0; y + d.h <= ROWS; y++) for (let x = 0; x + d.w <= COLS; x++) cands.push({ x, y });
  const cx = COLS / 2 - d.w / 2;
  const cy = ROWS / 2 - d.h / 2;
  cands.sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - ((b.x - cx) ** 2 + (b.y - cy) ** 2));
  for (const c of cands) if (canPlace(type, c.x, c.y, placed)) return c;
  return null;
}

// Bàn chân nhân vật (px, py là điểm chân) có đang vướng vật cản không.
export function footBlocked(px, py, placed) {
  const f = { x: px - 10, y: py - 8, w: 20, h: 8 };
  if (f.x < 0 || f.y < 0 || f.x + f.w > CW || f.y + f.h > ROWS * TILE) return true;
  for (const w of WALLS) if (hit(f, w)) return true;
  for (const p of placed) {
    const d = CATALOG[p.type];
    if (!d || d.layer !== 'solid') continue;
    if (hit(f, itemRect(p.type, p.x, p.y))) return true;
  }
  return false;
}

// Điểm đứng được gần (px, py) nhất, dùng khi đồ mới đặt đè lên nhân vật.
export function freePoint(px, py, placed) {
  const pts = [];
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) pts.push({ x: tx * TILE + 24, y: ty * TILE + 40 });
  pts.sort((a, b) => (a.x - px) ** 2 + (a.y - py) ** 2 - ((b.x - px) ** 2 + (b.y - py) ** 2));
  for (const p of pts) if (!footBlocked(p.x, p.y, placed)) return p;
  return { x: SPAWN.x, y: SPAWN.y };
}

// Món đồ có thể tương tác ở gần nhân vật nhất (trong 22 điểm ảnh quanh khung đồ).
export function nearestInteract(px, py, placed) {
  let best = null;
  let bestD = 1e9;
  for (const p of placed) {
    const d = CATALOG[p.type];
    if (!d || !d.act) continue;
    const r = itemRect(p.type, p.x, p.y);
    const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
    const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
    const dist = Math.hypot(dx, dy);
    if (dist <= 22 && dist < bestD) {
      best = p;
      bestD = dist;
    }
  }
  return best;
}

function cloneDefault() {
  return { v: 1, placed: DEFAULT_HOUSE.placed.map((p) => ({ ...p })), inv: DEFAULT_HOUSE.inv.map((p) => ({ ...p })) };
}

// Đưa dữ liệu lưu (có thể cũ hoặc lỗi) về nhà hợp lệ. Món đặt sai chỗ được cất vào kho.
export function sanitizeHouse(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.placed)) return cloneDefault();
  const seen = new Set();
  const uid = (u) => {
    let id = typeof u === 'string' && u.length > 0 && u.length <= 12 ? u : newUid();
    while (seen.has(id)) id = newUid();
    seen.add(id);
    return id;
  };
  const placed = [];
  const inv = [];
  for (const it of raw.placed.slice(0, 120)) {
    if (!it || !CATALOG[it.type]) continue;
    const item = { uid: uid(it.uid), type: it.type, x: Number(it.x), y: Number(it.y) };
    if (placed.length < 80 && canPlace(item.type, item.x, item.y, placed)) placed.push(item);
    else inv.push({ uid: item.uid, type: item.type });
  }
  const rawInv = Array.isArray(raw.inv) ? raw.inv : [];
  for (const it of rawInv.slice(0, 150)) {
    if (!it || !CATALOG[it.type]) continue;
    inv.push({ uid: uid(it.uid), type: it.type });
  }
  return { v: 1, placed, inv: inv.slice(0, 150) };
}

// ---------- vẽ ----------
function fr(c, x, y, w, h, f) {
  c.fillStyle = f;
  c.fillRect(x, y, w, h);
}
// Hộp có viền đen 1 điểm, vệt sáng phía trên, vệt tối phía dưới.
function ob(c, x, y, w, h, fill, hi, lo) {
  fr(c, x, y, w, h, OL);
  fr(c, x + 1, y + 1, w - 2, h - 2, fill);
  if (hi) fr(c, x + 1, y + 1, w - 2, 2, hi);
  if (lo) fr(c, x + 1, y + h - 3, w - 2, 2, lo);
}

const DRAW = {
  giuong(c) {
    ob(c, 0, 0, 96, 144, '#8a5a34', '#a8744a', '#6b4326');
    ob(c, 5, 14, 86, 122, '#f4f0e6');
    ob(c, 10, 20, 34, 24, '#ffffff', '', '#d9deea');
    ob(c, 52, 20, 34, 24, '#ffffff', '', '#d9deea');
    ob(c, 5, 58, 86, 78, '#4f7fd6', '#9bb8f0', '#3a63b0');
    for (let x = 12; x < 88; x += 14) fr(c, x, 70, 3, 62, '#6b92e0');
    fr(c, 5, 58, 86, 8, '#9bb8f0');
    ob(c, 0, 0, 96, 14, '#7a4e2c', '#a8744a', '#5e3b20');
    ob(c, 0, 134, 96, 10, '#8a5a34', '#a8744a', '#6b4326');
  },
  bon_cau(c) {
    ob(c, 13, 2, 22, 16, '#f4f6fa', '#ffffff', '#cdd5e4');
    fr(c, 28, 6, 4, 3, '#aab4c8');
    ob(c, 10, 18, 28, 24, '#ffffff', '#ffffff', '#cdd5e4');
    ob(c, 15, 22, 18, 14, '#dfe8f4');
    ob(c, 15, 40, 18, 6, '#e8edf5');
  },
  bon_rua(c) {
    ob(c, 6, 1, 36, 14, '#bfe6f6', '#e3f6fd');
    ob(c, 4, 20, 40, 26, '#ecf0f8', '#ffffff', '#c7cfdf');
    ob(c, 4, 16, 40, 8, '#ffffff', '', '#cdd5e4');
    ob(c, 14, 17, 20, 5, '#aac4dc');
    ob(c, 21, 10, 6, 8, '#aab4c8');
    fr(c, 12, 32, 24, 1, '#c7cfdf');
    ob(c, 21, 34, 6, 3, '#aab4c8');
  },
  tu_lanh(c) {
    ob(c, 4, 2, 40, 92, '#eef2f6', '#ffffff', '#c7cfdf');
    fr(c, 5, 34, 38, 2, OL);
    ob(c, 37, 10, 4, 18, '#8c97a8');
    ob(c, 37, 42, 4, 28, '#8c97a8');
    fr(c, 10, 8, 10, 3, '#ffffff');
  },
  bep(c) {
    ob(c, 2, 2, 44, 44, '#cfd4de', '#eef1f6', '#aab1c0');
    ob(c, 7, 7, 15, 12, '#2a2d38');
    ob(c, 26, 7, 15, 12, '#2a2d38');
    fr(c, 11, 11, 7, 4, '#4a4f60');
    fr(c, 30, 11, 7, 4, '#4a4f60');
    ob(c, 6, 24, 36, 18, '#3b3f4d');
    ob(c, 10, 28, 28, 9, '#8fb4c9', '#b9d4e2');
    fr(c, 10, 39, 28, 2, '#aab1c0');
  },
  chau_rua(c) {
    ob(c, 2, 6, 92, 40, '#b88a5b', '#d3a574', '#8f6538');
    ob(c, 2, 4, 92, 14, '#e2e6ee', '#ffffff', '#b9c0d0');
    ob(c, 16, 6, 38, 10, '#9fb3cc', '', '#7d92ad');
    fr(c, 33, 0, 5, 8, '#aab4c8');
    fr(c, 30, 0, 11, 3, '#aab4c8');
    fr(c, 47, 20, 2, 24, OL);
    ob(c, 43, 28, 3, 6, '#e8d7a8');
    ob(c, 50, 28, 3, 6, '#e8d7a8');
  },
  ban_an(c) {
    ob(c, 6, 10, 84, 72, '#b9824f', '#d49c68', '#8f5f36');
    fr(c, 12, 16, 72, 2, '#d9a877');
    ob(c, 12, 82, 6, 12, '#7a4e2c');
    ob(c, 78, 82, 6, 12, '#7a4e2c');
    ob(c, 24, 34, 14, 10, '#ffffff', '', '#d9deea');
    ob(c, 58, 34, 14, 10, '#ffffff', '', '#d9deea');
    ob(c, 42, 44, 12, 12, '#d95a4a', '#f08a7c');
    fr(c, 47, 41, 3, 4, '#3f9d54');
  },
  ghe(c) {
    ob(c, 11, 4, 26, 20, '#a86f3d', '#c88f55', '#855327');
    ob(c, 8, 24, 32, 14, '#c88f55', '#e0a96f', '#a06c3a');
    ob(c, 10, 38, 5, 8, '#7a4e2c');
    ob(c, 33, 38, 5, 8, '#7a4e2c');
  },
  sofa(c) {
    ob(c, 2, 6, 92, 40, '#3f8e7d', '#5fb09d', '#2f6b5e');
    ob(c, 10, 10, 36, 26, '#58ad9a', '#7fcbb7', '#3f8e7d');
    ob(c, 50, 10, 36, 26, '#58ad9a', '#7fcbb7', '#3f8e7d');
    ob(c, 0, 18, 10, 26, '#2f6b5e', '#3f8e7d');
    ob(c, 86, 18, 10, 26, '#2f6b5e', '#3f8e7d');
  },
  ke_sach(c) {
    ob(c, 2, 2, 92, 44, '#8a5a34', '#a8744a', '#6b4326');
    fr(c, 5, 5, 86, 18, '#5e3b20');
    fr(c, 5, 26, 86, 17, '#5e3b20');
    const cols = ['#d95a4a', '#4f7fd6', '#e6b93a', '#3f9d54', '#8a58c4'];
    let i = 0;
    for (let x = 8; x < 86; x += 7) {
      const h1 = 11 + (i % 3) * 2;
      const h2 = 10 + ((i + 1) % 3) * 2;
      ob(c, x, 23 - h1, 6, h1, cols[i % 5], '', '');
      ob(c, x, 43 - h2, 6, h2, cols[(i + 2) % 5], '', '');
      i += 1;
    }
  },
  cay(c) {
    ob(c, 14, 28, 20, 16, '#b5603a', '#d27d54', '#8c4524');
    ob(c, 10, 6, 28, 12, '#3f9d54', '#6bc57a');
    ob(c, 6, 14, 16, 14, '#3f9d54', '#6bc57a');
    ob(c, 26, 14, 16, 14, '#3f9d54', '#6bc57a');
    ob(c, 18, 16, 12, 14, '#2f7d41');
  },
  den(c) {
    ob(c, 15, 40, 18, 6, '#5a5f70', '#7a8094');
    fr(c, 23, 16, 2, 25, '#5a5f70');
    ob(c, 12, 2, 24, 16, '#ffe08a', '#fff3c4', '#e0b84a');
  },
  tham(c) {
    ob(c, 0, 0, 144, 96, '#c24b43', '#d9625a', '#9a352f');
    ob(c, 8, 8, 128, 80, '#efd9a8');
    ob(c, 16, 16, 112, 64, '#d8645a');
    ob(c, 52, 28, 40, 40, '#efd9a8');
    fr(c, 66, 42, 12, 12, '#c24b43');
    for (let x = 6; x < 140; x += 8) {
      fr(c, x, 0, 3, 2, '#efd9a8');
      fr(c, x, 94, 3, 2, '#efd9a8');
    }
  },
};

const itemCache = {};
export function getItemCanvas(type) {
  if (typeof document === 'undefined' || !CATALOG[type]) return null;
  if (itemCache[type]) return itemCache[type];
  const d = CATALOG[type];
  const cv = document.createElement('canvas');
  cv.width = d.w * TILE;
  cv.height = d.h * TILE;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  DRAW[type](c);
  itemCache[type] = cv;
  return cv;
}

let roomCache = null;
// Nền nhà (tường, sàn, cửa sổ, tường nhà vệ sinh) vẽ một lần rồi dùng lại.
export function getRoomCanvas() {
  if (typeof document === 'undefined') return null;
  if (roomCache) return roomCache;
  const cv = document.createElement('canvas');
  cv.width = CW;
  cv.height = CH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;

  // tường phía sau
  fr(c, 0, 0, CW, WALL_H, '#f3e5c6');
  for (let x = 0; x < CW; x += 24) fr(c, x, 0, 12, WALL_H, '#eedbb3');
  fr(c, 432, 0, 144, WALL_H, '#bfe3ee');
  for (let x = 432; x < CW; x += 24) fr(c, x, 0, 1, WALL_H, '#a9d2df');
  for (let y = 0; y < WALL_H; y += 24) fr(c, 432, y, 144, 1, '#a9d2df');
  fr(c, 0, WALL_H - 8, CW, 8, '#a8794a');
  fr(c, 0, WALL_H - 8, CW, 2, '#c99560');
  fr(c, 0, WALL_H - 2, CW, 2, OL);
  fr(c, 428, 0, 8, WALL_H, '#e9dfcc');
  fr(c, 428, 0, 1, WALL_H, OL);
  fr(c, 435, 0, 1, WALL_H, OL);
  // cửa sổ
  ob(c, 244, 14, 88, 56, '#8a5a34', '#a8744a');
  fr(c, 250, 22, 76, 40, OL);
  fr(c, 251, 23, 74, 38, '#8fd3f4');
  fr(c, 251, 23, 74, 12, '#a9e0f7');
  fr(c, 288, 23, 2, 38, '#8a5a34');
  fr(c, 251, 41, 74, 2, '#8a5a34');
  fr(c, 258, 28, 14, 4, '#ffffff');
  fr(c, 262, 26, 10, 3, '#ffffff');
  // đồng hồ nhà bếp
  ob(c, 100, 22, 26, 26, '#ffffff');
  fr(c, 112, 27, 2, 11, OL);
  fr(c, 112, 36, 8, 2, OL);
  // gương và khăn trong nhà vệ sinh
  ob(c, 500, 18, 30, 28, '#bfe6f6', '#e3f6fd');

  // sàn
  c.save();
  c.translate(0, WALL_H);
  for (let r = 0, y = 0; y < ROWS * TILE; y += 24, r++) {
    fr(c, 0, y, CW, 24, r % 2 ? '#c99c63' : '#c4965c');
    fr(c, 0, y + 23, CW, 1, '#a9783f');
    for (let x = (r * 37) % 72; x < CW; x += 72) fr(c, x, y, 1, 24, '#a9783f');
  }
  // sàn gạch nhà bếp
  for (let j = 0; j < 6; j++) for (let i = 0; i < 10; i++) fr(c, i * 24, j * 24, 24, 24, (i + j) % 2 ? '#efe3c8' : '#dccdae');
  // sàn gạch nhà vệ sinh
  for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) fr(c, 432 + i * 24, j * 24, 24, j === 7 ? 20 : 24, (i + j) % 2 ? '#d8edf3' : '#c3e0ea');
  // tường ngăn nhà vệ sinh
  const wall = (w) => {
    ob(c, w.x, w.y, w.w, w.h, '#efe6d4');
  };
  wall(WALLS[0]);
  wall(WALLS[1]);
  wall(WALLS[2]);
  fr(c, 429, 196, 51, 8, '#b9aa8c');
  fr(c, 529, 196, 47, 8, '#b9aa8c');
  fr(c, 429, 196, 51, 1, OL);
  fr(c, 529, 196, 47, 1, OL);
  ob(c, 476, 184, 6, 20, '#8a5a34', '#a8744a');
  ob(c, 524, 184, 6, 20, '#8a5a34', '#a8744a');
  c.restore();

  roomCache = cv;
  return cv;
}
