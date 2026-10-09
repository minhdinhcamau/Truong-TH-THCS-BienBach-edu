// GAME (tách riêng): các hàm vẽ cho map trước cổng trường (bầu trời có mây trôi chậm, sao trăng, nước kênh, vật thể).
// Không phụ thuộc trình duyệt: vẽ lên canvas 2D bất kỳ.
import { HORIZON, SW, railL, railR } from './school';
import { CLOUD_COUNT } from './schoolArt';
import { drawStatic } from './mekongRender';

const SKY_DAY = ['#a1b9db', '#a6bbd9', '#b9c1d6', '#dacfd4', '#efd5cc'];
const SKY_NIGHT = ['#04081f', '#08113a', '#101c52', '#1a2866', '#26367a'];
const BANDS = 18;

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function ramp(stops, f) {
  const x = Math.max(0, Math.min(1, f)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(hex(stops[i]), hex(stops[i + 1]), x - i);
}
const css = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

function hash01(n, salt) {
  let x = Math.imul((n | 0) ^ Math.imul(salt | 0, 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// mây: vị trí tính từ đồng hồ thật nên mọi người chơi thấy mây ở cùng chỗ. Tốc độ rất chậm (2 - 6 đơn vị mỗi giây).
const LOOP = 1400;
const CLOUDS = [];
const CLOUD_KINDS = [3, 1, 3, 1, 4, 0, 2, 5];   // 3 mây xa nhỏ, 3 mây giữa, 2 mây gần to
for (let i = 0; i < CLOUD_KINDS.length; i++) {
  const layer = i < 3 ? 0 : i < 6 ? 1 : 2;
  CLOUDS.push({
    v: CLOUD_KINDS[i] % CLOUD_COUNT,
    x0: hash01(i, 21) * LOOP,
    y: layer === 0 ? 14 + hash01(i, 22) * 34 : layer === 1 ? 26 + hash01(i, 22) * 40 : 8 + hash01(i, 22) * 50,
    sp: layer === 0 ? 2 + hash01(i, 23) * 0.8 : layer === 1 ? 3.4 + hash01(i, 23) * 1.2 : 5 + hash01(i, 23) * 1.3,
    p: layer === 0 ? 0.22 : layer === 1 ? 0.38 : 0.55,
    a: layer === 0 ? 0.85 : layer === 1 ? 0.93 : 1,
  });
}

const STARS = [];
for (let i = 0; i < 80; i++) STARS.push({ x: hash01(i, 31) * 760 - 30, y: 4 + hash01(i, 32) * 110, b: hash01(i, 33), s: hash01(i, 34) < 0.2 ? 2 : 1 });

// bầu trời + mây + (ban đêm) sao và trăng. cx, cy: góc trên trái khung nhìn trong thế giới. night: 0 sáng ... 1 tối. now: ms.
export function drawSky(ctx, art, cx, cy, vw, vh, now, night) {
  const bandH = Math.ceil((HORIZON + 40) / BANDS);
  const glow = Math.sin(Math.PI * Math.max(0, Math.min(1, night)));
  for (let i = 0; i < BANDS; i++) {
    const f = i / (BANDS - 1);
    let col = mix(ramp(SKY_DAY, f), ramp(SKY_NIGHT, f), night);
    const k = Math.max(0, (f - 0.4) / 0.6) * glow * 0.5;
    if (k > 0) col = mix(col, [255, 150, 90], k);
    ctx.fillStyle = css(col);
    ctx.fillRect(Math.floor(cx) - 2, i * bandH, Math.ceil(vw) + 4, bandH + 1);
  }
  const t = now / 1000;
  // sao, trăng (xa nên chuyển động theo máy ảnh rất ít)
  if (night > 0.15) {
    for (const s of STARS) {
      const a = night * (0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + s.b) + s.b * 40)));
      if (a < 0.1) continue;
      ctx.fillStyle = `rgba(255,255,240,${Math.min(1, a).toFixed(2)})`;
      ctx.fillRect(Math.round(s.x + cx * 0.9), Math.round(s.y), s.s, s.s);
    }
    const mx = Math.round(470 + cx * 0.85);
    const my = 38;
    for (const [rad, al] of [[24, 0.1], [17, 0.14]]) {   // quầng sáng tròn quanh trăng
      ctx.fillStyle = `rgba(255,245,200,${(al * night).toFixed(2)})`;
      for (let y = -rad; y <= rad; y++) {
        const half = Math.floor(Math.sqrt(rad * rad - y * y));
        ctx.fillRect(mx - half, my + y, half * 2, 1);
      }
    }
    ctx.globalAlpha = night;
    for (let y = -11; y <= 11; y++) {
      const half = Math.floor(Math.sqrt(121 - y * y));
      ctx.fillStyle = '#fff6cf';
      ctx.fillRect(mx - half, my + y, half * 2, 1);
      ctx.fillStyle = '#e8dfae';
      ctx.fillRect(mx - half + 2 + (y > 2 ? 1 : 0), my + y, 3, 1);
    }
    ctx.globalAlpha = 1;
  }
  // mây trôi chậm theo đồng hồ thật
  for (const c of CLOUDS) {
    const x = ((c.x0 + t * c.sp) % LOOP) - 320 + cx * (1 - c.p);
    const w = art.cloud(c.v, false);
    if (x > cx + vw + 4 || x + w.width < cx - 4) continue;
    const dx = Math.round(x);
    const dy = Math.round(c.y + Math.sin(t * 0.05 + c.x0) * 1.5);
    if (night < 0.98) {
      ctx.globalAlpha = c.a * (1 - night);
      ctx.drawImage(w, dx, dy);
    }
    if (night > 0.02) {
      ctx.globalAlpha = c.a * night * 0.8;
      ctx.drawImage(art.cloud(c.v, true), dx, dy);
    }
    ctx.globalAlpha = 1;
  }
}

// gợn sáng trên nước kênh (hai bên cầu, phần nước nối thêm phía nam ảnh)
export function drawWater(ctx, t, x0, x1) {
  for (let i = 0; i < 90; i++) {
    const sp = 3 + hash01(i, 3) * 7;
    const w = 5 + Math.floor(hash01(i, 4) * 12);
    const x = (hash01(i, 1) * SW + t * sp) % SW;
    if (x + w < x0 || x > x1) continue;
    const y = 373 + Math.floor(hash01(i, 2) * 38);
    if (x + w > railL(y) - 4 && x < railR(y) + 4) continue;
    const a = 0.1 + 0.26 * Math.sin(t * 1.2 + i * 1.7);
    if (a < 0.12) continue;
    ctx.fillStyle = `rgba(228,246,255,${a.toFixed(2)})`;
    ctx.fillRect(Math.round(x), y, w, 1);
    if (i % 3 === 0) ctx.fillRect(Math.round(x) + 2, y + 2, Math.max(2, w - 5), 1);
  }
}

// vật thể trong cảnh. Các loại chung với làng quê (dừa, chuối, bụi, lau, súng, thuyền, biển) vẽ bằng drawStatic.
export function drawSchoolObject(ctx, art, o, t) {
  drawStatic(ctx, art, o, t, null);
}

// danh sách vật thể nhìn thấy (đã sắp theo y tăng dần)
export function visibleSchoolObjects(objects, x0, y0, x1, y1) {
  let lo = 0;
  let hi = objects.length;
  const ymin = y0 - 10;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (objects[mid].y < ymin) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = lo; i < objects.length; i++) {
    const o = objects[i];
    if (o.y > y1 + 220) break;
    if (o.x < x0 - 110 || o.x > x1 + 110) continue;
    out.push(o);
  }
  return out;
}
