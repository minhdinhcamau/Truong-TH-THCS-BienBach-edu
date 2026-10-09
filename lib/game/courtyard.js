// GAME (tách riêng): map SÂN TRƯỜNG TH - THCS Biển Bạch, dựng theo HAI ẢNH MẪU của thầy:
//   public/game/san-truong-ngay.jpg (ban ngày) và public/game/san-truong-dem.jpg (ban đêm), cùng cỡ 1952 x 806 (thế giới 976 x 403, 1 đơn vị = 2 điểm ảnh).
// Lớp phụ (cắt từ chính hai ảnh): san-truong-den.png (chỗ có đèn sáng, bật dần theo từng khu),
//   san-truong-truoc-ngay/dem/den.png (mái xanh và 4 cột, vẽ ĐÈ lên nhân vật để nhân vật đi qua phía sau, tạo chiều sâu).
// Bố cục theo ảnh: dãy nhà hai tầng bên trái và bên phải, tòa nhà chính phía trên có hai cầu thang, máy lọc nước uống,
// mái che xanh giữa sân, bồn cây và ghế đá dọc hai dãy nhà, sân gạch đỏ. Cửa ra cổng trường ở mép dưới.
// Ghế đá: ngồi được, mỗi ghế tối đa 2 bạn (BENCHES, benchSeats). Xóa cùng thư mục lib/game khi gỡ game.
export const SW = 976;
export const SH = 403;
export const CHAR_H = 36;
export const SPEED = 112;
export const ZONE_MAX = 10;

export const IMG = {
  day: '/game/san-truong-ngay.jpg',
  night: '/game/san-truong-dem.jpg',
  lights: '/game/san-truong-den.png',
  fday: '/game/san-truong-truoc-ngay.png',
  fnight: '/game/san-truong-truoc-dem.png',
  flights: '/game/san-truong-truoc-den.png',
};

// bảng ghép lớp phía trước: góc trên trái trong thế giới, ảnh rộng 600 x 370 điểm ảnh (= 300 x 185 đơn vị)
export const ATLAS = { x: 350, y: 60 };
// mái xanh (vẽ sau cùng, đè lên mọi nhân vật) và 4 cột (xếp theo chân cột để nhân vật đi trước/sau cột)
export const ROOF = { sx: 0, sy: 0, sw: 600, sh: 198 };
export const COLUMNS = [
  { id: 'BL', sx: 76, sy: 176, sw: 23, sh: 109, foot: 202.5 },
  { id: 'BR', sx: 492, sy: 176, sw: 22, sh: 110, foot: 203 },
  { id: 'FL', sx: 53, sy: 176, sw: 22, sh: 183, foot: 239.5 },
  { id: 'FR', sx: 522, sy: 176, sw: 22, sh: 183, foot: 239.5 },
];

export const SPAWN_FROM_GATE = { x: 488, y: 374 };
export const EXIT_Y = 395;          // đi xuống tới đây là ra cổng trường
const TOP_Y = 165;                  // chân tường các dãy nhà

export const YARD_TEXT = {
  thang: 'Cầu thang lên các phòng học. Lớp học sẽ mở ở bản cập nhật sau, em chờ nhé.',
  bac: 'Ảnh Bác Hồ cùng hai băng rôn khẩu hiệu trên tường tòa nhà chính. Các em luôn nhớ lời Bác dạy.',
  loc: 'Hệ thống lọc nước uống trực tiếp của Ủy ban nhân dân huyện Thới Bình. Em nhớ uống đủ nước nhé.',
  hoi: 'Mái che xanh giữa sân: nơi các em xếp hàng, sinh hoạt tập thể, và trú nắng trú mưa.',
  ghe: 'Ghế đá dưới bồn cây. Em ngồi nghỉ một lát cho mát nhé.',
  bon: 'Bồn cây xanh dọc hai dãy nhà. Giờ ra chơi các bạn hay ngồi hóng mát ở đây.',
};

// độ lớn nhân vật theo độ sâu: xa (sát tòa nhà) nhỏ, gần mép dưới to. Đo theo kích thước các ô gạch trong ảnh.
export function depthScale(y) {
  return Math.max(0.78, Math.min(1.2, 0.8 + (y - 165) * 0.0016));
}

// ---------- va chạm ----------
// vùng chắn bên trái và bên phải (bồn cây, ghế đá, chân dãy nhà), đo theo ảnh
const LEFT = [[0, 150], [262, 150], [262, 185], [224, 203], [224, 232], [204, 236], [184, 250], [184, 275], [168, 286], [148, 294], [130, 301], [130, 324], [82, 334], [80, 338], [64, 364], [0, 364]];
const RIGHT = [[770, 150], [976, 150], [976, 403], [962, 403], [962, 376], [938, 376], [938, 347], [912, 347], [891, 309], [878, 303], [851, 306], [851, 272], [850, 262], [833, 250], [815, 214], [800, 205], [790, 197], [770, 168]];
const RECTS = [
  [280, 150, 374, 185],     // sảnh máy lọc nước
  [398, 150, 596, 187],     // sân khấu dưới mái xanh
  [376, 234, 388, 241],     // cột trước trái
  [388, 197, 399, 204],     // cột sau trái
  [596, 197, 607, 204],     // cột sau phải
  [611, 234, 622, 241],     // cột trước phải
];

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function free(x, y) {
  if (x < 14 || x > SW - 14 || y > SH - 5 || y < TOP_Y) return false;
  if (inPoly(x, y, LEFT) || inPoly(x, y, RIGHT)) return false;
  for (const r of RECTS) if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return false;
  return true;
}

export function yardBlocked(x, y) {
  return !(free(x, y) && free(x - 6, y) && free(x + 6, y));
}

// điểm xuất hiện (từ cổng vào): rải ngẫu nhiên để nhiều bạn vào cùng lúc không đứng chồng lên nhau
export function yardSpawn() {
  const base = SPAWN_FROM_GATE;
  for (let i = 0; i < 40; i++) {
    const x = base.x + (Math.random() - 0.5) * (i < 20 ? 200 : 380);
    const y = base.y + (Math.random() - 0.5) * (i < 20 ? 14 : 30);
    if (!yardBlocked(x, y)) return { x, y };
  }
  return { x: base.x, y: base.y };
}

// ---------- ghế đá: mỗi ghế có 2 chỗ ngồi (tối đa 2 bạn / ghế) ----------
// x, y: tâm ghế đo theo ảnh; face: hướng mặt khi ngồi (1 = quay phải, -1 = quay trái, vì ghế quay mặt ra sân);
// ax, ay: độ lệch của mỗi chỗ so với tâm theo chiều dài ghế (chỗ 0 lệch -, chỗ 1 lệch +); dy: kéo chân xuống dưới mặt ghế.
export const BENCHES = [
  { x: 170, y: 268, face: 1, ax: 5, ay: -3.5, dy: 6 },
  { x: 211, y: 216, face: 1, ax: 5, ay: -3.5, dy: 6 },
  { x: 219, y: 183, face: 1, ax: 5, ay: -3.5, dy: 6 },
  { x: 862, y: 290, face: -1, ax: 4.5, ay: 3.5, dy: 6 },
];
export const SEATS_PER_BENCH = 2;
export const SIT_DROP = 7;   // nhân vật ngồi thấp hơn lúc đứng khoảng 7 đơn vị

// hai chỗ ngồi của ghế số i: id dạng "<ghế>-<chỗ>"
export function benchSeats(i) {
  const b = BENCHES[i];
  if (!b) return [];
  return [0, 1].map((k) => {
    const s = k === 0 ? -1 : 1;
    return { id: `${i}-${k}`, bench: i, x: b.x + s * b.ax, y: b.y + s * b.ay + b.dy, face: b.face };
  });
}

// điểm tương tác gần nhất: { id, label }
export function yardNearest(x, y) {
  if (y >= 368) return { id: 'ra', label: 'Ra cổng trường' };
  if (y <= 192 && ((x >= 258 && x <= 304) || (x >= 640 && x <= 712))) return { id: 'thang', label: 'Cầu thang lên lớp' };
  if (y <= 206 && x >= 594 && x < 640) return { id: 'bac', label: 'Xem ảnh Bác Hồ' };
  if (y <= 216 && x >= 278 && x <= 378) return { id: 'loc', label: 'Máy lọc nước uống' };
  if (y >= 184 && y <= 266 && x >= 378 && x <= 624) return { id: 'hoi', label: 'Mái che giữa sân' };
  let bi = -1;
  let bd = 34;
  BENCHES.forEach((b, i) => {
    const d = Math.hypot(x - b.x, (y - b.y) * 1.3);
    if (d < bd) { bd = d; bi = i; }
  });
  if (bi >= 0) return { id: 'ghe', label: 'Ngồi nghỉ ở ghế đá', bench: bi };
  if ((x < 210 && y > 296) || (x > 836 && y > 252)) return { id: 'bon', label: 'Ngắm bồn cây' };
  return null;
}

// ---------- ánh sáng lên nhân vật (cho khớp ảnh: bóng mái che ban ngày, quầng đèn ban đêm) ----------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ramp = (v, a, b) => clamp01((v - a) / (b - a));
const POOLS = [
  { x: 490, y: 218, rx: 215, ry: 80, a: 1 },      // dưới mái xanh
  { x: 325, y: 198, rx: 75, ry: 40, a: 0.85 },    // máy lọc nước
  { x: 110, y: 290, rx: 120, ry: 100, a: 0.3 },   // cửa sổ dãy nhà trái
  { x: 860, y: 290, rx: 120, ry: 100, a: 0.3 },   // cửa sổ dãy nhà phải
];
export function litAt(x, y) {
  let m = 0;
  for (const p of POOLS) {
    const d = ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2;
    m = Math.max(m, p.a * Math.exp(-d * 1.4));
  }
  return m;
}
export function canopyShade(x, y) {
  return ramp(x, 352, 374) * (1 - ramp(x, 630, 656)) * ramp(y, 182, 198) * (1 - ramp(y, 262, 288));
}
