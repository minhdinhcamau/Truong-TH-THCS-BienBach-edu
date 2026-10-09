// GAME (tách riêng): nạp hai ảnh nền của map trước cổng trường (ban ngày, ban đêm). Chỉ nạp ảnh, không vẽ thêm gì bằng code.
// Xóa cùng thư mục lib/game khi gỡ game.
import { SCENE_DAY_URL, SCENE_NIGHT_URL } from './school';

const imgs = { day: null, night: null };   // nạp một lần cho cả trang

function load(key, url) {
  if (typeof Image === 'undefined') return null;
  if (!imgs[key]) { imgs[key] = new Image(); imgs[key].src = url; }
  const im = imgs[key];
  return im.complete && im.naturalWidth > 0 ? im : null;
}

export function makeSchoolArt() {
  return {
    day: () => load('day', SCENE_DAY_URL),
    night: () => load('night', SCENE_NIGHT_URL),
  };
}
