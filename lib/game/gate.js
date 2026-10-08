// GAME (tách riêng): cảnh trước cổng trường TH - THCS Biển Bạch (cầu bắc qua kênh, vỉa hè, cổng có bảng tên).
// Nền là ảnh public/game/cong-truong.jpg (1681 x 935). Muốn gỡ game: xóa thư mục game như các file khác.
export const GW = 1681;           // bề ngang thế giới (bằng ảnh nền)
export const GH = 935;            // chiều cao thế giới
export const GVW = 560;           // bề ngang khung nhìn
export const GVH = 315;           // chiều cao khung nhìn (16:9)
export const GATE_BG = '/game/cong-truong.jpg';
export const GATE_SPAWN = { x: 692, y: 900 };   // đầu cầu phía nhà
export const GATE_K = 0.85;       // cỡ nhân vật

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

function pointFree(x, y) {
  if (x < 12 || x > GW - 12 || y > 930) return false;
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
  // lối vào dưới cổng (giữa hai cánh cổng)
  if (y >= 478 && y < NORTH_ROAD + 8) {
    const l = y >= 500 ? 742 : 742 + (500 - y) * 0.9;
    if (x >= l && x <= 858) return true;
  }
  return false;
}

export function gateBlocked(x, y) {
  return !(pointFree(x, y) && pointFree(x - 7, y) && pointFree(x + 7, y));
}

export const GATE_TEXT = {
  cong: 'Cổng trường rộng mở! Sân trường sẽ mở ở bản cập nhật sau, em chờ nhé.',
  bv: 'Phòng bảo vệ. Bác bảo vệ vẫy tay chào: "Chào em, chúc em một ngày học vui vẻ!"',
};

// điểm tương tác gần nhất: { id, label }
export function gateNearest(x, y) {
  if (y > 902) return { id: 've_nha', label: 'Về sân nhà em' };
  if (x > 740 && x < 860 && y < 525) return { id: 'cong', label: 'Vào sân trường' };
  if (x > 690 && x < 905 && y > 525 && y < 652) return { id: 'bang', label: 'Đọc bảng tên trường' };
  if (Math.hypot(x - 625, y - 598) < 60) return { id: 'bv', label: 'Phòng bảo vệ' };
  return null;
}
