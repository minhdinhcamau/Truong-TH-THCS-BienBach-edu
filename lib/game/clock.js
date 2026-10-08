// GAME (tách riêng): đồng hồ thế giới. Mọi người chơi cùng thấy một giờ và một cơn mưa,
// vì tính từ đồng hồ thật (không cần máy chủ). 1 ngày game = 24 phút thật: 12 phút sáng, 12 phút tối.
export const DAY_SEC = 24 * 60;      // 1 ngày game
export const HALF_SEC = DAY_SEC / 2; // 12 phút sáng, 12 phút tối
const RAMP = 50;                     // giây chuyển bình minh / hoàng hôn (nằm trong nửa sáng)

// giây trong ngày game, 0 = bắt đầu buổi sáng
export function dayTime(now = Date.now()) {
  return (now / 1000) % DAY_SEC;
}

// 0 = sáng hẳn, 1 = tối hẳn
export function nightLevel(t) {
  if (t >= HALF_SEC) return 1;
  if (t < RAMP) return 1 - t / RAMP;
  if (t > HALF_SEC - RAMP) return (t - (HALF_SEC - RAMP)) / RAMP;
  return 0;
}

// giờ trên đồng hồ game: buổi sáng bắt đầu lúc 6:00, 1 phút thật = 1 giờ game
export function clockLabel(t) {
  const h = (6 + t / 60) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
export function isNight(t) {
  return t >= HALF_SEC;
}

function hash01(n, salt) {
  let x = Math.imul((n | 0) ^ Math.imul(salt | 0, 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const RAIN_CHANCE = 0.22; // khoảng 1 ngày game trong 4-5 ngày có mưa
// 0..1: cường độ mưa. Cơn mưa kéo dài 3-7 phút, bắt đầu ở thời điểm ngẫu nhiên trong ngày.
export function rainLevel(now = Date.now()) {
  const sec = now / 1000;
  const d = Math.floor(sec / DAY_SEC);
  let best = 0;
  for (let k = d - 1; k <= d; k++) {
    if (hash01(k, 11) >= RAIN_CHANCE) continue;
    const start = k * DAY_SEC + hash01(k, 12) * (DAY_SEC - 60);
    const dur = 180 + hash01(k, 13) * 240;
    const x = sec - start;
    if (x < 0 || x > dur) continue;
    const fade = Math.min(1, x / 25, (dur - x) / 25);
    const power = 0.6 + 0.4 * hash01(k, 14);
    best = Math.max(best, fade * power);
  }
  return best;
}
