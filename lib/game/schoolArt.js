// GAME (tách riêng): tranh cho map trước cổng trường. Nền là ẢNH GỐC đã đổi thành pixel nét (public/game/cong-truong-map.png),
// ở đây chỉ nạp ảnh nền và vẽ mây (mây vẽ bằng code để trôi được). Dùng lại bộ vẽ chung của làng quê (makeArt) cho dừa, chuối, bụi, lau, súng, biển.
// Xóa cùng thư mục lib/game khi gỡ game.
import { SCENE_URL } from './school';
import { makeArt } from './mekongArt';

const CLOUD_DEF = [
  { w: 150, h: 46, c: [[30, 30, 16], [55, 22, 22], [85, 26, 20], [112, 30, 15], [70, 34, 22]] },
  { w: 110, h: 36, c: [[24, 24, 13], [46, 17, 17], [72, 21, 15], [90, 26, 10]] },
  { w: 190, h: 54, c: [[28, 38, 16], [58, 28, 24], [96, 20, 26], [132, 28, 24], [162, 36, 16], [96, 38, 26]] },
  { w: 80, h: 28, c: [[20, 18, 11], [38, 13, 13], [58, 17, 10]] },
  { w: 130, h: 40, c: [[22, 28, 13], [48, 20, 18], [80, 16, 17], [104, 24, 16], [60, 30, 18]] },
  { w: 170, h: 48, c: [[26, 34, 16], [56, 22, 22], [94, 26, 24], [128, 22, 20], [150, 34, 14], [90, 38, 22]] },
];
export const CLOUD_COUNT = CLOUD_DEF.length;

let sceneImg = null;   // ảnh nền nạp một lần cho cả trang

export function makeSchoolArt(createCanvas) {
  const base = makeArt(createCanvas);
  const mk = (w, h) => { const c = createCanvas(w, h); c.width = w; c.height = h; return c; };
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  const R = (g, x, y, w, h, c) => {
    const rw = Math.round(w); const rh = Math.round(h);
    if (rw <= 0 || rh <= 0) return;
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), rw, rh);
  };

  // ảnh nền: trả về null cho tới khi nạp xong
  function scene() {
    if (typeof Image === 'undefined') return null;
    if (!sceneImg) { sceneImg = new Image(); sceneImg.src = SCENE_URL; }
    return sceneImg.complete && sceneImg.naturalWidth > 0 ? sceneImg : null;
  }

  // mây: 6 kiểu x 2 sắc (ngày / đêm), trắng hồng ngả tím như trong ảnh gốc
  function cloud(v, night) {
    return memo(`cloud${v}${night ? 'n' : 'd'}`, () => {
      const def = CLOUD_DEF[v % CLOUD_DEF.length];
      const c = mk(def.w, def.h); const g = c.getContext('2d');
      const pal = night ? ['#8f9acb', '#7d88b8', '#66709f', '#515a85'] : ['#ffffff', '#fbfaff', '#ece8f6', '#d0cce7'];
      const flat = def.h - 3;
      for (let x = 0; x < def.w; x++) {
        let top = 1e9; let bot = -1e9;
        for (const [cx, cy, rad] of def.c) {
          const dx = x - cx;
          if (Math.abs(dx) > rad) continue;
          const dy = Math.sqrt(rad * rad - dx * dx);
          top = Math.min(top, cy - dy);
          bot = Math.max(bot, cy + dy);
        }
        if (top > 1e8) continue;
        top = Math.round(top);
        bot = Math.min(Math.round(bot), flat + (((x * 5 + v) % 3) - 1));
        const th = bot - top;
        if (th <= 0) continue;
        const j = ((x * 7 + v * 3) % 3) - 1;
        const b1 = Math.min(th, 4 + j);
        const b2 = Math.min(th, 9 + j);
        const b3 = Math.max(b2, th - 5);
        R(g, x, top, 1, b1, pal[0]);
        R(g, x, top + b1, 1, b2 - b1, pal[1]);
        R(g, x, top + b2, 1, b3 - b2, pal[2]);
        R(g, x, top + b3, 1, th - b3, pal[3]);
      }
      return c;
    });
  }

  return { ...base, cloud, scene };
}
