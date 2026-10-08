// GAME (tách riêng): cảnh ngoài nhà miền Tây (sông phía sau, vườn trái, ao cá phải, đường đất phía trước).
// Nền là ảnh public/game/ngoai-nha.png (483 x 612). Muốn gỡ game: xóa thư mục game như các file khác.
export const YW = 483;            // bề ngang thế giới
export const YH = 612;            // chiều cao thế giới
export const VH = 362;            // chiều cao khung nhìn (tỉ lệ 4:3)
export const YARD_BG = '/game/ngoai-nha.png';
export const YARD_SPAWN = { x: 245, y: 286 };   // chân cầu thang
export const YARD_K = 0.85;        // cỡ nhân vật ngoài sân
export const YARD_FROM_SCHOOL = { x: 245, y: 566 };   // trở về từ trường: cuối đường đất

export const POND = { cx: 380, cy: 372, rx: 94, ry: 58 };
export const GARDEN = { x0: 24, y0: 296, x1: 198, y1: 452 };
export const DOOR = { x: 245, y: 254 };

function inEllipse(x, y, e, grow = 0) {
  const dx = (x - e.cx) / (e.rx + grow);
  const dy = (y - e.cy) / (e.ry + grow * 0.6);
  return dx * dx + dy * dy < 1;
}

function pointBlocked(x, y) {
  if (x < 12 || x > 471 || y < 252 || y > 604) return true;
  if (y < 280 && (x < 216 || x > 274)) return true;           // chỉ đi được trên cầu thang
  if (y > 462 && y < 484 && (x < 210 || x > 276)) return true; // hàng rào phía trước, chừa cổng giữa
  if (x > GARDEN.x0 && x < GARDEN.x1 && y > GARDEN.y0 && y < GARDEN.y1) return true;
  if (inEllipse(x, y, POND)) return true;
  return false;
}

export function yardBlocked(x, y) {
  return pointBlocked(x, y) || pointBlocked(x - 5, y) || pointBlocked(x + 5, y);
}

export const YARD_TEXT = {
  ao: 'Ao cá có cá rô, cá trê đang bơi lội. Sau này em sẽ ra đây cho cá ăn.',
  vuon: 'Vườn rau xanh mướt: cải, xà lách, rau muống. Sau này em sẽ trồng rau ở đây.',
};

// món gần nhất để tương tác: { id, label }
export function yardNearest(x, y) {
  if (y > 590 && x > 150 && x < 340) return { id: 'truong', label: 'Đi tới trường' };
  if (Math.hypot(x - DOOR.x, y - DOOR.y) < 30) return { id: 'cua', label: 'Vào nhà' };
  if (inEllipse(x, y, POND, 30)) return { id: 'ao', label: 'Ngắm ao cá' };
  if (x > GARDEN.x0 - 30 && x < GARDEN.x1 + 30 && y > GARDEN.y0 - 30 && y < GARDEN.y1 + 30) return { id: 'vuon', label: 'Ngắm vườn rau' };
  return null;
}
