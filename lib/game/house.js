// GAME (tách riêng): căn nhà đầu tiên của nhân vật. Danh mục đồ đạc, bố cục, va chạm và hình vẽ pixel.
// Muốn gỡ game: xóa thư mục lib/game, components/game, app/game và chạy xoa_game.sql.

export const TILE = 48;
export const COLS = 12;
export const ROWS = 8;
export const WALL_H = 96; // dải tường phía sau, vẽ phía trên sàn
export const CW = COLS * TILE;
export const CH = WALL_H + ROWS * TILE;
export const SPAWN = { x: 4 * TILE + 24, y: 6 * TILE + 30 };

const OL = '#1c1a26';

// layer: 'solid' = đồ đặc, không đi xuyên qua; 'rug' = thảm, đi lên được.
// act: tên hành động khi đứng gần.
export const CATALOG = {
  giuong_tre: { label: 'Giường tre có mùng', w: 2, h: 3, layer: 'solid', act: 'Đi ngủ' },
  ban_hoc: { label: 'Bàn học', w: 2, h: 1, layer: 'solid', act: 'Làm bài' },
  ke_sach: { label: 'Kệ sách', w: 2, h: 1, layer: 'solid', act: 'Xem sách' },
  vong: { label: 'Võng', w: 3, h: 1, layer: 'solid', act: 'Nằm võng' },
  bo_van: { label: 'Bộ ván gỗ', w: 2, h: 1, layer: 'solid', act: 'Ngồi nghỉ' },
  ban_tron: { label: 'Bàn tròn gỗ', w: 2, h: 2, layer: 'solid', act: 'Ăn cơm' },
  ghe: { label: 'Ghế đẩu', w: 1, h: 1, layer: 'solid', act: 'Ngồi nghỉ' },
  tu_chen: { label: 'Tủ chén', w: 1, h: 2, layer: 'solid', act: 'Mở tủ chén' },
  bep_cui: { label: 'Bếp củi', w: 1, h: 1, layer: 'solid', act: 'Nấu cơm' },
  chau_rua: { label: 'Chậu rửa chén', w: 2, h: 1, layer: 'solid', act: 'Rửa chén' },
  lu_nuoc: { label: 'Chum nước', w: 1, h: 1, layer: 'solid', act: 'Múc nước' },
  xo_nuoc: { label: 'Xô nước tắm', w: 1, h: 1, layer: 'solid', act: 'Tắm' },
  cau_tieu: { label: 'Cầu tiêu ao cá', w: 2, h: 1, layer: 'solid', act: 'Đi vệ sinh' },
  cay: { label: 'Chậu hoa', w: 1, h: 1, layer: 'solid', act: null },
  den: { label: 'Đèn dầu', w: 1, h: 1, layer: 'solid', act: null },
  tham: { label: 'Chiếu hoa', w: 3, h: 2, layer: 'rug', act: null },
};

// Tên đồ cũ (nhà đã lưu trước đây) đổi sang đồ miền Tây cùng cỡ.
const LEGACY = {
  giuong: 'giuong_tre',
  bon_cau: 'lu_nuoc',
  bon_rua: 'xo_nuoc',
  tu_lanh: 'tu_chen',
  bep: 'bep_cui',
  ban_an: 'ban_tron',
  sofa: 'bo_van',
};

// Câu hiện khi bấm tương tác. Chưa có chỉ số nên mới chỉ là lời thoại.
export const ACT_TEXT = {
  giuong_tre: 'Em buông mùng, nằm nghe tiếng sông vỗ. Ngủ hồi sức sẽ có ở bản sau.',
  ban_hoc: 'Em mở vở ra làm bài dưới ánh đèn dầu.',
  ke_sach: 'Em lật vài trang sách.',
  vong: 'Em nằm võng đung đưa, gió sông mát rượi.',
  bo_van: 'Em ngồi nghỉ trên bộ ván gỗ.',
  ban_tron: 'Em ngồi vào bàn ăn cơm cùng cả nhà.',
  ghe: 'Em ngồi nghỉ một chút.',
  tu_chen: 'Tủ chén còn mấy cái tô và đĩa. Nấu ăn sẽ có ở bản sau.',
  bep_cui: 'Bếp củi đỏ lửa. Nấu cơm sẽ có ở bản sau.',
  chau_rua: 'Em rửa chén sạch bong.',
  lu_nuoc: 'Em múc một gáo nước mưa mát lạnh.',
  xo_nuoc: 'Em dội gáo nước tắm cho mát. Xong nhớ lau khô nhé!',
  cau_tieu: 'Dưới sàn là sông, mấy chú cá tra đang bơi lên chờ ăn.',
};

// Tường ván ngăn phòng ngủ (trái) và nhà vệ sinh (phải), đơn vị điểm ảnh, tọa độ sàn.
// Cửa phòng ngủ rộng 1 ô ở hàng 2; cửa nhà vệ sinh rộng 1 ô ở cột 10.
export const WALLS = [
  { x: 192, y: 0, w: 8, h: 96 },
  { x: 192, y: 144, w: 8, h: 52 },
  { x: 0, y: 188, w: 200, h: 8 },
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
    { uid: 'd01', type: 'giuong_tre', x: 0, y: 0 },
    { uid: 'd02', type: 'ban_hoc', x: 2, y: 0 },
    { uid: 'd03', type: 'ghe', x: 2, y: 1 },
    { uid: 'd04', type: 'den', x: 3, y: 1 },
    { uid: 'd05', type: 'bep_cui', x: 5, y: 0 },
    { uid: 'd06', type: 'tu_chen', x: 6, y: 0 },
    { uid: 'd07', type: 'chau_rua', x: 7, y: 0 },
    { uid: 'd08', type: 'lu_nuoc', x: 9, y: 0 },
    { uid: 'd09', type: 'cau_tieu', x: 10, y: 0 },
    { uid: 'd10', type: 'xo_nuoc', x: 11, y: 2 },
    { uid: 'd11', type: 'ban_tron', x: 6, y: 3 },
    { uid: 'd12', type: 'ghe', x: 5, y: 3 },
    { uid: 'd13', type: 'ghe', x: 8, y: 4 },
    { uid: 'd14', type: 'vong', x: 0, y: 5 },
    { uid: 'd15', type: 'tham', x: 3, y: 5 },
    { uid: 'd16', type: 'bo_van', x: 9, y: 6 },
    { uid: 'd17', type: 'cay', x: 11, y: 5 },
  ],
  inv: [
    { uid: 'k01', type: 'ghe' },
    { uid: 'k02', type: 'cay' },
    { uid: 'k03', type: 'ke_sach' },
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
    if (!it) continue;
    const type = LEGACY[it.type] || it.type;
    if (!CATALOG[type]) continue;
    const item = { uid: uid(it.uid), type, x: Number(it.x), y: Number(it.y) };
    if (placed.length < 80 && canPlace(item.type, item.x, item.y, placed)) placed.push(item);
    else inv.push({ uid: item.uid, type: item.type });
  }
  const rawInv = Array.isArray(raw.inv) ? raw.inv : [];
  for (const it of rawInv.slice(0, 150)) {
    if (!it) continue;
    const type = LEGACY[it.type] || it.type;
    if (!CATALOG[type]) continue;
    inv.push({ uid: uid(it.uid), type });
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
// Hình tròn kiểu điểm ảnh (cx, cy: tâm, r: bán kính)
function disc(c, cx, cy, rx, ry, fill) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.0001)));
    fr(c, cx - w, cy + y, w * 2, 1, fill);
  }
}
function ring(c, cx, cy, rx, ry, fill, edge) {
  disc(c, cx, cy, rx + 1, ry + 1, edge);
  disc(c, cx, cy, rx, ry, fill);
}

const WD = '#5a3a22';
const WM = '#7a5030';
const WL = '#a0703f';
const WH = '#c08a52';
const WK = '#3a2414';
const BLUE = '#2f6fc0';
const BLUED = '#1f4f94';
const TIN = '#9aa0a8';

const DRAW = {
  giuong_tre(c) {
    // khung giường gỗ + chiếu hoa
    ob(c, 0, 0, 96, 144, WM, WL, WD);
    ob(c, 6, 10, 84, 128, '#e8d9a8');
    for (let y = 14; y < 134; y += 8) fr(c, 8, y, 80, 1, '#d4c08a');
    for (let x = 12; x < 88; x += 8) fr(c, x, 12, 1, 124, '#dccb96');
    fr(c, 8, 70, 80, 6, '#c24b43');
    fr(c, 8, 78, 80, 3, '#2f6fc0');
    // gối
    ob(c, 12, 16, 30, 20, '#fff7e6', '', '#e3d6b8');
    ob(c, 54, 16, 30, 20, '#fff7e6', '', '#e3d6b8');
    // chăn
    ob(c, 8, 62, 80, 70, '#d9645a', '#ec8a80', '#a8433b');
    for (let x = 14; x < 86; x += 12) fr(c, x, 68, 4, 58, '#f2b9a0');
    // mùng (màn) trong suốt, bốn cột
    fr(c, 0, 0, 96, 70, 'rgba(235,245,240,0.38)');
    for (let x = 4; x < 96; x += 6) fr(c, x, 0, 1, 70, 'rgba(255,255,255,0.35)');
    for (const [px, py] of [[0, 0], [90, 0], [0, 134], [90, 134]]) ob(c, px, py, 6, 10, WK);
    fr(c, 0, 0, 96, 3, WK);
    fr(c, 0, 69, 96, 2, 'rgba(255,255,255,0.55)');
  },
  ban_hoc(c) {
    ob(c, 2, 6, 92, 38, WL, WH, WM);
    fr(c, 6, 10, 84, 1, WH);
    ob(c, 6, 40, 6, 8, WD);
    ob(c, 84, 40, 6, 8, WD);
    // vở mở + bút
    ob(c, 14, 14, 30, 20, '#fffdf2', '', '#dcd6bf');
    fr(c, 29, 14, 1, 20, '#b9b39a');
    for (let y = 19; y < 32; y += 4) { fr(c, 17, y, 10, 1, '#7a9bd6'); fr(c, 32, y, 10, 1, '#7a9bd6'); }
    // chồng sách
    ob(c, 50, 22, 18, 6, '#4f7fd6'); ob(c, 51, 17, 16, 6, '#e6b93a'); ob(c, 52, 13, 14, 5, '#d95a4a');
    // đèn dầu
    ob(c, 74, 26, 12, 8, '#8c97a8');
    ob(c, 76, 14, 8, 12, '#fff2b8', '#ffffff', '#f0cf6a');
    fr(c, 79, 10, 2, 4, '#ffd45c');
    // ống bút
    ob(c, 70, 12, 5, 7, '#3f9d54');
  },
  ke_sach(c) {
    ob(c, 2, 2, 92, 44, WM, WL, WD);
    fr(c, 5, 5, 86, 18, WK);
    fr(c, 5, 26, 86, 17, WK);
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
  vong(c) {
    // hai cột gỗ, dây thừng, tấm võng lưới
    ob(c, 0, 4, 10, 40, WM, WL, WD);
    ob(c, 134, 4, 10, 40, WM, WL, WD);
    fr(c, 8, 12, 14, 2, '#d9c7a0');
    fr(c, 122, 12, 14, 2, '#d9c7a0');
    for (let x = 16; x < 128; x++) {
      const t = (x - 16) / 112;
      const y = 14 + Math.round(Math.sin(t * Math.PI) * 18);
      fr(c, x, y, 1, 7, x % 6 < 3 ? '#e8e2d0' : '#2f6fc0');
      fr(c, x, y + 7, 1, 2, '#9a8f74');
      fr(c, x, y - 1, 1, 1, OL);
    }
    for (let x = 22; x < 122; x += 6) {
      const t = (x - 16) / 112;
      const y = 14 + Math.round(Math.sin(t * Math.PI) * 18);
      fr(c, x, y + 9, 1, 4, '#c9bfa4');
    }
    // gối nhỏ
    ob(c, 28, 24, 16, 8, '#d9645a', '#ec8a80');
  },
  bo_van(c) {
    ob(c, 2, 8, 92, 34, WL, WH, WM);
    for (let x = 14; x < 92; x += 16) fr(c, x, 10, 1, 28, WM);
    fr(c, 4, 20, 88, 1, WM);
    ob(c, 6, 38, 8, 8, WD);
    ob(c, 82, 38, 8, 8, WD);
    // chiếu cuộn
    ob(c, 62, 12, 24, 10, '#e8d9a8', '#f4ead0', '#c9b784');
  },
  ban_tron(c) {
    // chân bàn
    ob(c, 26, 66, 8, 24, WD);
    ob(c, 62, 66, 8, 24, WD);
    ob(c, 44, 72, 8, 22, WD);
    ring(c, 48, 44, 42, 30, '#a8643a', OL);
    disc(c, 48, 42, 40, 28, '#b9703f');
    disc(c, 48, 40, 34, 22, '#c27d4a');
    for (let y = 22; y < 62; y += 6) fr(c, 18, y, 60, 1, 'rgba(90,50,20,0.25)');
    // chén và đĩa
    ob(c, 22, 36, 14, 10, '#ffffff', '', '#d9deea');
    ob(c, 60, 36, 14, 10, '#ffffff', '', '#d9deea');
    ob(c, 38, 26, 20, 12, '#e8d7a8', '#f4ead0', '#c9b784');
    fr(c, 44, 22, 8, 4, '#3f9d54');
    ob(c, 40, 46, 16, 12, '#d95a4a', '#f08a7c');
  },
  ghe(c) {
    ring(c, 24, 20, 14, 8, '#c88f55', OL);
    disc(c, 24, 19, 12, 6, '#d9a56a');
    ob(c, 12, 26, 5, 16, WD);
    ob(c, 31, 26, 5, 16, WD);
    ob(c, 21, 30, 5, 14, WM);
    fr(c, 14, 36, 20, 2, WD);
  },
  tu_chen(c) {
    ob(c, 3, 2, 42, 92, WM, WL, WD);
    ob(c, 7, 8, 34, 38, '#2a1d12');
    fr(c, 8, 9, 32, 36, '#7fb0c0');
    fr(c, 8, 9, 32, 10, '#a3cfdc');
    // chén bát bên trong
    for (let i = 0; i < 3; i++) ob(c, 10 + i * 10, 28, 8, 7, '#ffffff', '', '#c7cfdf');
    fr(c, 9, 36, 30, 2, WD);
    for (let i = 0; i < 3; i++) ob(c, 10 + i * 10, 19, 8, 7, '#e8d7a8');
    fr(c, 23, 9, 2, 36, WM);
    ob(c, 7, 52, 34, 36, '#6b4326', '#8a5a34');
    fr(c, 23, 52, 2, 36, OL);
    ob(c, 19, 66, 3, 8, '#e8d7a8'); ob(c, 26, 66, 3, 8, '#e8d7a8');
  },
  bep_cui(c) {
    // bếp lò đất nung, nồi đen, củi
    ob(c, 4, 18, 40, 26, '#a85a36', '#c8754d', '#7a3d22');
    ob(c, 14, 26, 20, 14, '#2a1a10');
    fr(c, 18, 32, 12, 6, '#ff7a2a');
    fr(c, 21, 30, 6, 4, '#ffc24a');
    ob(c, 8, 6, 32, 16, '#2b2f3a', '#4a4f60');
    fr(c, 12, 4, 24, 3, '#1c1a26');
    fr(c, 16, 9, 8, 2, '#6a7080');
    // khói
    fr(c, 22, 0, 3, 2, 'rgba(230,230,230,0.7)');
    fr(c, 26, 2, 3, 2, 'rgba(230,230,230,0.5)');
    // củi
    fr(c, 6, 42, 14, 4, WD); fr(c, 28, 43, 14, 3, WM);
  },
  chau_rua(c) {
    ob(c, 4, 18, 88, 28, WM, WL, WD);
    ob(c, 8, 22, 80, 4, WL);
    // chậu nhôm
    ring(c, 30, 14, 20, 8, '#c8ced8', OL);
    disc(c, 30, 14, 17, 5, '#8fb4c9');
    // chồng chén
    ob(c, 60, 8, 14, 4, '#ffffff', '', '#c7cfdf');
    ob(c, 61, 4, 12, 4, '#ffffff', '', '#c7cfdf');
    ob(c, 62, 0, 10, 4, '#e8d7a8');
    ob(c, 78, 10, 8, 10, '#3f6fd0', '#7fa0f0');
    for (const x of [10, 78]) ob(c, x, 40, 6, 8, WD);
  },
  lu_nuoc(c) {
    // chum sành đỏ nâu như trong ảnh
    disc(c, 24, 28, 17, 15, OL);
    disc(c, 24, 28, 16, 14, '#b5603a');
    disc(c, 20, 25, 8, 8, '#d27d54');
    disc(c, 30, 34, 10, 6, '#8c4524');
    ob(c, 12, 10, 24, 8, '#d9a56a', '#ecc690', '#a8793a');
    fr(c, 14, 12, 20, 3, '#6a3a1c');
    fr(c, 16, 44, 16, 2, OL);
  },
  xo_nuoc(c) {
    // xô nhựa xanh đựng nước, gáo dừa
    ob(c, 10, 14, 28, 28, '#3f7fd6', '#7fb0f0', '#2f5fa8');
    fr(c, 12, 16, 24, 6, '#8fd3f4');
    fr(c, 12, 20, 24, 2, '#bfe9fb');
    fr(c, 12, 12, 24, 3, '#2f5fa8');
    fr(c, 12, 12, 2, 8, OL);
    fr(c, 34, 12, 2, 8, OL);
    // gáo dừa
    disc(c, 34, 24, 6, 4, '#6a3e1c');
    fr(c, 38, 20, 8, 2, '#8a5a34');
    // dép + giọt nước
    ob(c, 8, 42, 14, 4, '#d9645a');
    fr(c, 28, 42, 3, 2, '#8fd3f4'); fr(c, 33, 44, 2, 2, '#8fd3f4');
  },
  cau_tieu(c) {
    // sàn ván có lỗ nhìn xuống sông, cá tra bơi dưới
    ob(c, 0, 4, 96, 40, WM, WL, WD);
    for (let x = 12; x < 96; x += 14) fr(c, x, 6, 1, 36, WK);
    ob(c, 22, 10, 52, 28, WK);
    fr(c, 24, 12, 48, 24, '#2f7d8e');
    for (let y = 14; y < 36; y += 5) fr(c, 24, y, 48, 1, '#4aa0b0');
    fr(c, 24, 12, 48, 5, '#5cb8c8');
    // cá tra: thân xám, bụng sáng, râu
    for (const [fx, fy, d] of [[32, 24, 1], [54, 18, -1]]) {
      ob(c, fx, fy, 16, 6, '#7d8794', '#a8b2bf');
      fr(c, fx + 2, fy + 4, 12, 2, '#d8dde4');
      ob(c, d > 0 ? fx - 4 : fx + 14, fy + 1, 4, 4, '#6a7480');
      fr(c, d > 0 ? fx + 14 : fx + 1, fy + 2, 1, 1, OL);
      fr(c, d > 0 ? fx + 15 : fx - 2, fy + 3, 3, 1, '#4a5260');
    }
    fr(c, 40, 30, 10, 1, '#bfe9fb'); fr(c, 58, 27, 8, 1, '#bfe9fb');
    fr(c, 22, 10, 52, 2, OL);
  },
  cay(c) {
    ob(c, 12, 26, 24, 18, '#b5603a', '#d27d54', '#8c4524');
    ob(c, 10, 6, 28, 12, '#3f9d54', '#6bc57a');
    ob(c, 6, 14, 16, 14, '#3f9d54', '#6bc57a');
    ob(c, 26, 14, 16, 14, '#3f9d54', '#6bc57a');
    ob(c, 18, 16, 12, 14, '#2f7d41');
    fr(c, 12, 10, 4, 4, '#e8628a'); fr(c, 32, 18, 4, 4, '#e8628a'); fr(c, 22, 8, 4, 4, '#ffd45c');
  },
  den(c) {
    // đèn dầu để trên giá gỗ thấp
    ob(c, 14, 30, 20, 14, WM, WL, WD);
    ob(c, 18, 22, 12, 9, '#8c97a8');
    ob(c, 19, 8, 10, 14, '#fff2b8', '#ffffff', '#f0cf6a');
    fr(c, 23, 4, 2, 5, '#ffd45c');
    fr(c, 22, 2, 4, 3, '#ff9a2a');
  },
  tham(c) {
    // chiếu cói dệt hoa
    ob(c, 0, 0, 144, 96, '#e8d9a8', '#f4ead0', '#c9b784');
    for (let x = 6; x < 140; x += 6) fr(c, x, 3, 1, 90, '#d4c08a');
    ob(c, 8, 8, 128, 80, '#e8d9a8');
    for (let y = 12; y < 86; y += 12) fr(c, 10, y, 124, 3, y % 24 === 12 ? '#c24b43' : '#2f6fc0');
    for (let x = 22; x < 130; x += 24) {
      disc(c, x, 48, 6, 6, '#c24b43');
      disc(c, x, 48, 3, 3, '#fff1c8');
    }
    ob(c, 8, 8, 128, 3, '#6a4a2a');
    ob(c, 8, 85, 128, 3, '#6a4a2a');
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
// Nền nhà sàn: tường ván, mái tôn, cửa sổ chớp xanh, sàn ván, phòng ngủ và nhà vệ sinh có vách ván.
export function getRoomCanvas() {
  if (typeof document === 'undefined') return null;
  if (roomCache) return roomCache;
  const cv = document.createElement('canvas');
  cv.width = CW;
  cv.height = CH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;

  // ----- tường phía sau: ván gỗ đứng -----
  fr(c, 0, 0, CW, WALL_H, WM);
  for (let x = 0; x < CW; x += 16) {
    fr(c, x, 0, 16, WALL_H, (x / 16) % 3 === 0 ? '#6e4829' : (x / 16) % 3 === 1 ? '#7a5030' : '#85583a');
    fr(c, x, 0, 1, WALL_H, WK);
    fr(c, x + 5, 20 + ((x * 7) % 30), 2, 2, '#4e301a');
  }
  // mái tôn nhìn từ dưới + xà gỗ
  fr(c, 0, 0, CW, 16, '#8a9098');
  for (let x = 0; x < CW; x += 6) fr(c, x, 0, 3, 16, '#767c84');
  fr(c, 0, 14, CW, 2, WK);
  for (let x = 0; x < CW; x += 144) ob(c, x, 0, 10, 24, WD, WM);
  fr(c, 0, 16, CW, 8, WD);
  fr(c, 0, 16, CW, 2, WM);
  // gờ chân tường
  fr(c, 0, WALL_H - 10, CW, 10, WD);
  fr(c, 0, WALL_H - 10, CW, 2, WH);
  fr(c, 0, WALL_H - 2, CW, 2, OL);

  // cửa sổ chớp xanh bên trái, mở ra thấy sông
  ob(c, 100, 26, 80, 56, BLUE, '#5a9ae0', BLUED);
  fr(c, 106, 32, 68, 44, OL);
  fr(c, 107, 33, 66, 42, '#8fd3f4');
  fr(c, 107, 33, 66, 14, '#a9e0f7');
  fr(c, 107, 58, 66, 17, '#4a8f9e');
  fr(c, 120, 38, 14, 4, '#ffffff'); fr(c, 126, 36, 10, 3, '#ffffff');
  for (let y = 34; y < 74; y += 5) { fr(c, 104, y, 12, 2, BLUED); fr(c, 164, y, 12, 2, BLUED); }

  // cửa sổ hoa văn (thoáng gió) ở giữa
  ob(c, 262, 22, 76, 56, '#2a1d12', WM);
  fr(c, 268, 28, 64, 44, '#6a4a2a');
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 6; j++) {
      const x0 = 270 + i * 8; const y0 = 30 + j * 7;
      fr(c, x0 + 3, y0, 2, 7, '#d9b46a');
      if ((i + j) % 2 === 0) { fr(c, x0, y0 + 3, 8, 1, '#d9b46a'); }
    }
  }
  fr(c, 268, 28, 64, 44, 'rgba(10,6,2,0.22)');

  // nón lá + chiếc khăn rằn treo tường
  c.fillStyle = OL; c.fillRect(380, 28, 40, 3);
  for (let i = 0; i < 14; i++) fr(c, 400 - i * 1 - 4, 31 + i, 8 + i * 2, 1, i % 2 ? '#e6d28a' : '#f0e0a0');
  fr(c, 396, 44, 8, 2, '#c24b43');
  ob(c, 232, 44, 8, 22, '#c24b43', '#e0645a');
  for (let y = 46; y < 64; y += 4) fr(c, 233, y, 6, 1, '#ffffff');

  // vách nhà vệ sinh phía sau tối hơn, ô thoáng nhỏ
  fr(c, 432, 16, 144, WALL_H - 26, 'rgba(0,0,0,0.12)');
  ob(c, 484, 30, 44, 22, '#2a1d12', WM);
  fr(c, 488, 34, 36, 14, '#a9e0f7');
  fr(c, 504, 34, 2, 14, WM);

  // ----- sàn -----
  c.save();
  c.translate(0, WALL_H);
  for (let r = 0, y = 0; y < ROWS * TILE; y += 24, r++) {
    fr(c, 0, y, CW, 24, r % 2 ? '#8a5a38' : '#7e5133');
    fr(c, 0, y + 23, CW, 1, WK);
    fr(c, 0, y, CW, 1, '#9a6a44');
    for (let x = (r * 53) % 96; x < CW; x += 96) fr(c, x, y, 1, 24, WK);
    for (let x = (r * 29) % 120 + 14; x < CW; x += 120) { fr(c, x, y + 8, 3, 2, '#5a3a22'); }
  }
  // sàn xi măng nhà vệ sinh (ướt, có rêu)
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) {
    fr(c, 432 + i * 24, j * 24, 24, 24, (i + j) % 2 ? '#9aa3a8' : '#8d979c');
    fr(c, 432 + i * 24, j * 24 + 23, 24, 1, '#6b747a');
    fr(c, 432 + i * 24 + 23, j * 24, 1, 24, '#6b747a');
  }
  fr(c, 440, 60, 30, 6, 'rgba(60,120,110,0.35)');
  fr(c, 520, 20, 20, 5, 'rgba(60,120,110,0.35)');
  // sàn phòng ngủ trải chiếu mỏng viền
  fr(c, 4, 4, 184, 2, 'rgba(0,0,0,0.12)');

  // ----- vách ván -----
  const plank = (w) => {
    fr(c, w.x, w.y, w.w, w.h, OL);
    fr(c, w.x + 1, w.y + 1, w.w - 2, w.h - 2, WL);
    if (w.w > w.h) { fr(c, w.x + 1, w.y + 1, w.w - 2, 2, WH); for (let x = w.x + 12; x < w.x + w.w; x += 16) fr(c, x, w.y + 1, 1, w.h - 2, WM); }
    else { fr(c, w.x + 1, w.y + 1, 2, w.h - 2, WH); for (let y = w.y + 10; y < w.y + w.h; y += 14) fr(c, w.x + 1, y, w.w - 2, 1, WM); }
  };
  for (const w of WALLS) plank(w);
  // khung cửa
  ob(c, 190, 92, 12, 6, WD, WM);
  ob(c, 190, 142, 12, 6, WD, WM);
  ob(c, 476, 184, 6, 20, WD, WM);
  ob(c, 524, 184, 6, 20, WD, WM);
  // rèm vải hoa che cửa phòng ngủ (không cản đường)
  fr(c, 194, 98, 4, 44, '#d9645a');
  for (let y = 100; y < 140; y += 6) fr(c, 194, y, 4, 2, '#fff1c8');
  fr(c, 194, 98, 4, 2, OL);
  c.restore();

  roomCache = cv;
  return cv;
}
