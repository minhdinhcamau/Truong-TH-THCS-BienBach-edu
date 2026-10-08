// GAME (tách riêng): cảnh trước cổng trường TH - THCS Biển Bạch (cầu bắc qua kênh, vỉa hè, cổng có bảng tên, đi thẳng vào sân trường).
// Nền là ảnh public/game/cong-truong.jpg (1681 x 935). Muốn gỡ game: xóa thư mục game như các file khác.
export const GW = 1681;           // bề ngang thế giới (bằng ảnh nền)
export const GH = 935;            // chiều cao thế giới
export const GVW = 560;           // bề ngang khung nhìn
export const GVH = 315;           // chiều cao khung nhìn (16:9)
export const GATE_BG = '/game/cong-truong.jpg';
export const GATE_SPAWN = { x: 692, y: 900 };   // đầu cầu phía nhà
export const GATE_K = 0.85;       // cỡ nhân vật ở vỉa hè trước cổng

// Cỡ nhân vật theo độ xa (đi vào sân thì nhỏ dần, ra gần cầu thì lớn dần), nội suy theo y.
const SCALE_PTS = [[300, 0.58], [440, 0.72], [565, 0.82], [660, 0.88], [800, 0.96], [930, 1.04]];
export function gateScale(y) {
  if (y <= SCALE_PTS[0][0]) return SCALE_PTS[0][1];
  for (let i = 1; i < SCALE_PTS.length; i++) {
    const [y1, k1] = SCALE_PTS[i];
    if (y <= y1) {
      const [y0, k0] = SCALE_PTS[i - 1];
      return k0 + ((k1 - k0) * (y - y0)) / (y1 - y0);
    }
  }
  return SCALE_PTS[SCALE_PTS.length - 1][1];
}

export const SIGN_TEXT = 'TRƯỜNG TH - THCS BIỂN BẠCH';
export const SIGN_C = { x: 795, y: 430 };        // tâm bảng tên trên ảnh nền
// Mái cổng và bảng tên được vẽ đè lên nhân vật khi nhân vật đi vào dưới cổng.
export const ARCH = { x: 560, y: 360, w: 400, h: 87 };
export const ARCH_BASE_Y = 566;

// Chậu cây trên vỉa hè (tâm x, y đáy chậu): chặn cả cột thân cây, đi vòng phía dưới.
const PLANTERS = [
  { x: 164, y: 609 },
  { x: 404, y: 614 },
  { x: 1110, y: 624 },
  { x: 1420, y: 630 },
  { x: 1595, y: 633 },
];
const PLANTER_HW = 36;

const NORTH_ROAD = 582;           // mép trên vỉa hè (chân nhân vật)
const SOUTH_LEFT = 650;           // mép kênh bên trái cầu
const SOUTH_RIGHT = 660;          // mép kênh bên phải cầu

// Lòng cầu thu hẹp dần về phía cổng (theo ảnh): trả [trái, phải].
function bridgeBounds(y) {
  const l = (y < 672 ? 697 : 697 - 0.625 * (y - 672)) + 4;
  const r = (y < 667 ? 900 : 897 - 0.27 * (y - 667)) - 4;
  return [l, r];
}

// Sân trường phía trong cổng (gạch đỏ). Mái cổng che phần giữa sân nên khi đi sau mái cổng nhân vật hiện mờ.
const YARD_BEDS = [
  [1004, 358, 1056, 388],   // chậu cây giữa sân bên phải
  [1016, 404, 1066, 432],   // bồn gạch
  [1050, 280, 1086, 300],   // chậu cây gần tòa nhà chính
  [1055, 458, 1205, 480],   // tán cây sát hàng rào
  [994, 298, 1006, 310],    // chân cột cờ
];
function yardRight(y) {
  return Math.min(1215, 1100 + Math.max(0, y - 300) * 0.6) - 8;
}
function inYard(x, y) {
  for (const b of YARD_BEDS) {
    if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return false;
  }
  const xr = yardRight(y);
  if (y >= 352 && y < 440 && x >= 700 && x <= xr) return true;      // sân trước mái che
  if (y >= 268 && y < 352 && x >= 972 && x <= xr) return true;      // phía đông mái che, tới tòa nhà chính
  if (y >= 440 && y <= 478 && x >= 1000 && x <= xr) return true;    // bên phải cổng
  return false;
}

function pointFree(x, y) {
  if (x < 12 || x > GW - 12 || y > 930) return false;
  if (y < 590 && inYard(x, y)) return true;
  if (y >= 268 && y < 590) {
    // lối vào dưới cổng (giữa hai cánh cổng) nối thẳng ra sân
    if (y >= 440 && x >= 742 && x <= 858) return true;
  }
  for (const p of PLANTERS) {
    if (Math.abs(x - p.x) < PLANTER_HW && y > NORTH_ROAD - 8 && y < p.y + 12) return false;
  }
  // vỉa hè trước cổng và cầu
  if (y >= NORTH_ROAD && y < 640) return true;
  if (y >= 640) {
    const [l, r] = bridgeBounds(y);
    if (x >= l && x <= r) return true;
    if (x < l && y <= SOUTH_LEFT && x < 692) return true;
    if (x > r && y <= SOUTH_RIGHT && x > 905) return true;
  }
  return false;
}

export function gateBlocked(x, y) {
  return !(pointFree(x, y) && pointFree(x - 7, y) && pointFree(x + 7, y));
}

export const GATE_TEXT = {
  bv: 'Phòng bảo vệ. Bác bảo vệ vẫy tay chào: "Chào em, chúc em một ngày học vui vẻ!"',
  co: 'Cột cờ trước tòa nhà chính: lá cờ đỏ sao vàng tung bay trong nắng.',
  toa_nha: 'Tòa nhà chính sẽ mở cửa ở bản cập nhật sau, em chờ nhé.',
  mai_che: 'Dưới mái che này cả trường chào cờ mỗi sáng thứ Hai.',
};

// điểm tương tác gần nhất: { id, label }
export function gateNearest(x, y) {
  if (y > 902) return { id: 've_nha', label: 'Về sân nhà em' };
  if (x > 690 && x < 905 && y > 525 && y < 652) return { id: 'bang', label: 'Đọc bảng tên trường' };
  if (Math.hypot(x - 625, y - 598) < 60) return { id: 'bv', label: 'Phòng bảo vệ' };
  if (Math.hypot(x - 1000, y - 300) < 60) return { id: 'co', label: 'Ngắm cột cờ' };
  if (x > 975 && x < 1095 && y < 292) return { id: 'toa_nha', label: 'Tòa nhà chính' };
  if (x > 700 && x < 972 && y >= 352 && y < 385) return { id: 'mai_che', label: 'Mái che sân trường' };
  return null;
}
