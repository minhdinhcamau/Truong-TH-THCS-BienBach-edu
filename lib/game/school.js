// GAME (tách riêng): map TRƯỚC CỔNG TRƯỜNG TH - THCS Biển Bạch, dựng theo HAI ẢNH MẪU của thầy:
//   public/game/cong-truong-ngay.png (ban ngày) và public/game/cong-truong-dem.png (ban đêm), cùng cỡ 700 x 390.
// Ban đêm dùng chính ảnh đêm (đèn bảng tên, cửa sổ nhà bảo vệ, mặt đường ướt đã có sẵn trong ảnh), không vẽ thêm mây, sao, trăng, đom đóm hay đốm sáng bằng code.
// Bố cục theo ảnh: nhà bảo vệ bên trái, cổng có mái ngói và bảng tên ở giữa, hàng rào xanh trắng, cây lớn bên phải,
// sân bê tông trước cổng, kênh hai bên, cầu có tay vịn đá chạy xuống mép dưới ảnh (đi hết cầu là về làng).
// Xóa cùng thư mục lib/game khi gỡ game.
export const SW = 700;                // bề ngang thế giới (= bề ngang ảnh)
export const SH = 390;                // chiều cao thế giới
export const VIEW_W = 640;
export const CHAR_H = 36;
export const SPEED = 118;
export const ZONE_MAX = 10;           // mỗi khu tối đa 10 bạn cùng lúc

export const SCENE_DAY_URL = '/game/cong-truong-ngay.png';
export const SCENE_NIGHT_URL = '/game/cong-truong-dem.png';
export const GATE = { cx: 350, x0: 278, x1: 424, enterY: 238, topY: 230 };   // lối giữa hai cột cổng; bước tới enterY là sang sân trường
export const GATE_BASE = 274;         // chân cột cổng, mép trên sân
export const SPAWN_FROM_VILLAGE = { x: 350, y: 372 };   // từ làng đi lên: đứng cuối cầu (mép dưới ảnh), rồi bước lên cầu
export const SPAWN_FROM_YARD = { x: 352, y: 294 };      // từ sân trường ra: đứng ngay trước cổng
export const VILLAGE_Y = 380;                           // đi xuống dưới mức này là tới đường về làng
export const BOTTOM_Y = 388;          // mép dưới của cầu
export const CURB_Y = 316;            // mép dưới sân, giáp bờ kênh

export const SIGN_TEXT = 'TRƯỜNG TH - THCS BIỂN BẠCH';

export const GATE_TEXT = {
  bv: 'Phòng bảo vệ. Bác bảo vệ vẫy tay chào: "Chào em, chúc em một ngày học vui vẻ!"',
  cay: 'Cây bóng mát to ở góc sân trường. Giờ ra chơi các bạn hay tụ tập hóng mát dưới này.',
};

// độ lớn nhân vật theo độ sâu: càng gần người xem (y lớn) càng to, ở cổng thì nhỏ hơn
export function depthScale(y) {
  return Math.max(0.74, Math.min(1.25, 0.76 + ((y - 238) * 0.44) / 150));
}

// hai tay vịn cầu: cạnh phía mặt cầu (đo theo ảnh). Từ CURB_Y trở xuống, ngoài hai cạnh này là nước kênh.
export const railInL = (y) => 206 - 0.97 * (y - CURB_Y - 2);
export const railInR = (y) => 494 + 0.9 * (y - CURB_Y);
// mép ngoài của thân tay vịn ở phần còn nằm trên sân (từ đỉnh trụ tới mép sân)
const railOutL = (y) => 200 - 1.31 * (y - 294);
const railOutR = (y) => 506 + 1.14 * (y - 296);

// mép trên sân (chân hàng rào/tường), thấp dần về hai bên theo phối cảnh của ảnh
function plazaTop(x) {
  if (x < 218) return GATE_BASE + 3 + (218 - x) * 0.08;
  if (x > 481) return GATE_BASE + 3 + Math.min(14, (x - 481) * 0.065);
  return GATE_BASE + 1;
}

// lối đi giữa hai cột cổng: hẹp dần về phía trong, theo phối cảnh
function inGate(x, y) {
  if (y < GATE.topY || y > GATE_BASE + 3) return false;
  const t = Math.max(0, 262 - y) * 0.25;
  return x >= GATE.x0 + t && x <= GATE.x1 - t;
}

function free(x, y) {
  if (x < 14 || x > SW - 14 || y > BOTTOM_Y) return false;
  if (y < plazaTop(x)) return inGate(x, y);
  if (y >= CURB_Y) {                                                // kênh: chỉ đi trên cầu
    return x >= railInL(y) && x <= railInR(y);
  }
  if (x < 84) return false;                                         // bụi cây lớn và trụ rào góc trái
  if (x > 610 && y > 291) return false;                             // chậu và gốc cây lớn góc phải
  if (x > 654 && y > 296) return false;                             // bụi cây góc phải
  if (y >= 288) {                                                   // đầu hai tay vịn (trụ và thân tay vịn nằm trên sân)
    const lo = y < 294 ? 192 : railOutL(y);
    if (x >= lo && x <= 208) return false;
    const hi = y < 296 ? 508 : railOutR(y);
    if (x >= 492 && x <= hi) return false;
  }
  return true;
}

export function schoolBlocked(x, y) {
  return !(free(x, y) && free(x - 6, y) && free(x + 6, y));
}

// điểm xuất hiện: rải ngẫu nhiên quanh điểm gốc để nhiều bạn vào cùng lúc không đứng chồng lên nhau
export function spawnPoint(from) {
  const base = from === 'yard' ? SPAWN_FROM_YARD : SPAWN_FROM_VILLAGE;
  for (let i = 0; i < 40; i++) {
    const x = base.x + (Math.random() - 0.5) * (i < 20 ? 100 : 200);
    const y = base.y + (Math.random() - 0.5) * (i < 20 ? 12 : 24);
    if (!schoolBlocked(x, y)) return { x, y };
  }
  return { x: base.x, y: base.y };
}

// điểm tương tác gần nhất: { id, label }
export function schoolNearest(x, y) {
  if (y >= VILLAGE_Y) return { id: 've_lang', label: 'Về làng quê' };
  if (x >= GATE.x0 - 14 && x <= GATE.x1 + 14 && y >= GATE.topY && y <= 304) return { id: 'vao', label: 'Vào cổng trường' };
  if (x > 200 && x < 500 && y >= GATE_BASE && y <= 316) return { id: 'bang', label: 'Đọc bảng tên trường' };
  if (x >= 84 && x <= 216 && y >= GATE_BASE && y <= 316) return { id: 'bv', label: 'Phòng bảo vệ' };
  if (x >= 520 && x <= 700 && y >= GATE_BASE && y <= 316) return { id: 'cay', label: 'Ngắm cây bóng mát' };
  return null;
}
