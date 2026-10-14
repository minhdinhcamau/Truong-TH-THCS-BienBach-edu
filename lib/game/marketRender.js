// GAME (tách riêng): hàm vẽ cảnh CHỢ MIỀN TÂY (không phụ thuộc trình duyệt, vẽ lên canvas 2D bất kỳ).
// Gồm: trời (mây, sao, trăng), bờ bên kia có cây lay theo gió, sông có sóng, xuồng neo và xuồng chạy, các sạp,
// cột đèn, cây ven bờ, chim bay, lá bay theo gió, bóng mây, đèn đêm.
import {
  BOATS, BOAT_KINDS, CLOUDS, EXIT_Y, FAR_TREES, FLOCKS, LAMP_POSTS, MH, MW, NEAR_TREES, RIVER_Y, SKY_H, STALLS, WATER_Y, activeBoats,
} from './market';
import { HERO, HERO_SCALE } from './marketHero';

export const SELLER_SCALE = 0.48;        // ảnh cô bán (đã thu nhỏ sẵn) vẽ ra cỡ trong map

function hash01(n, salt) {
  let x = Math.imul((n | 0) ^ Math.imul(salt | 0, 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// gió: -1..1, đổi chậm theo thời gian; mỗi chỗ lệch nhau một chút (cơn gió lướt qua map)
export function windAt(t, x = 0) {
  return 0.55 * Math.sin(t * 0.45) + 0.3 * Math.sin(t * 1.1 + 1.7) + 0.15 * Math.sin(t * 2.3 + x * 0.02);
}
// cây lay: vẽ ảnh nghiêng đều theo chiều cao, chân cây đứng yên
function sway(ctx, img, x, y, ph, t, flip) {
  const s = windAt(t, x) * 0.028 + Math.sin(t * 1.9 + ph) * 0.012 + 0.006;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(1, -1);
  ctx.transform(1, 0, s, 1, 0, 0);
  ctx.drawImage(img, -Math.floor(img.width / 2), -img.height);
  ctx.restore();
}

// nền (trời, bờ xa, sông) + mọi thứ chuyển động trên nền
export function drawBase(ctx, art, t, night = 0) {
  ctx.drawImage(art.ground, 0, 0);

  // trời đêm: tối dần, có sao nhấp nháy và trăng
  if (night > 0.02) {
    ctx.fillStyle = `rgba(10,16,48,${(0.82 * night).toFixed(3)})`;
    ctx.fillRect(0, 0, MW, SKY_H + 1);
    if (night > 0.25) {
      for (let i = 0; i < 70; i++) {
        const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash01(i, 3) * 2) + i);
        ctx.fillStyle = `rgba(255,250,225,${(night * (0.25 + 0.65 * tw)).toFixed(3)})`;
        ctx.fillRect(Math.floor(hash01(i, 1) * MW), Math.floor(hash01(i, 2) * (SKY_H - 6)), 1, 1);
      }
      const mx = Math.round(MW * 0.82); const my = 13;
      ctx.fillStyle = `rgba(250,244,205,${night.toFixed(3)})`;
      for (let dy = -6; dy <= 6; dy++) { const w = Math.floor(Math.sqrt(36 - dy * dy)); ctx.fillRect(mx - w, my + dy, w * 2 + 1, 1); }
      ctx.fillStyle = `rgba(10,16,48,${(0.8 * night).toFixed(3)})`;
      for (let dy = -5; dy <= 5; dy++) { const w = Math.floor(Math.sqrt(25 - dy * dy)); ctx.fillRect(mx - w + 4, my + dy - 1, w * 2 + 1, 1); }
    }
  }

  // mây trôi theo gió (xa hơn thì trôi chậm hơn)
  const span = MW + 300;
  for (const c of CLOUDS) {
    const img = art.cloud[c.k];
    const x = (((c.x0 + c.sp * t + windAt(t, c.x0) * 10) % span) + span) % span - 150;
    ctx.globalAlpha = 1 - 0.78 * night;
    ctx.drawImage(img, Math.round(x), c.y);
    ctx.globalAlpha = 1;
  }

  // cây bờ bên kia lay theo gió, kèm bóng đổ xuống nước (ngược, mờ, rung rinh)
  for (const f of FAR_TREES) sway(ctx, art.tree[f.kind], f.x, f.y, f.ph, t, false);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, WATER_Y, MW, RIVER_Y - WATER_Y); ctx.clip();
  ctx.globalAlpha = 0.2;
  for (const f of FAR_TREES) sway(ctx, art.tree[f.kind], f.x + Math.sin(t * 1.6 + f.ph) * 0.8, WATER_Y + 1, f.ph, t, true);
  ctx.restore();

  // sóng: các vạt sáng/tối chạy ngang theo dòng, nhanh chậm theo gió
  const wv = windAt(t, 300);
  for (let row = 0; row < 11; row++) {
    const y = WATER_Y + 4 + row * 5;
    for (let x = 0; x < MW; x += 5) {
      const v = Math.sin(x * 0.045 + t * (1.0 + wv * 0.4) + row * 1.9) + Math.sin(x * 0.11 - t * 0.7 + row * 0.8);
      if (v > 1.35) { ctx.fillStyle = '#9ad6dc'; ctx.fillRect(x, y, 4, 1); }
      else if (v < -1.55) { ctx.fillStyle = '#2f7684'; ctx.fillRect(x, y + 1, 4, 1); }
    }
  }
  // gợn nhỏ trôi theo dòng sông
  for (let i = 0; i < 170; i++) {
    const y = WATER_Y + 3 + Math.floor(hash01(i, 1) * (RIVER_Y - WATER_Y - 6));
    const sp = 3 + hash01(i, 2) * 6;
    const x = (hash01(i, 3) * (MW + 40) + t * sp) % (MW + 40) - 20;
    if (Math.sin(t * 1.3 + i) <= -0.25) continue;
    ctx.fillStyle = hash01(i, 4) < 0.5 ? '#82c4cc' : '#2f7684';
    ctx.fillRect(Math.round(x), y, 3 + Math.floor(hash01(i, 5) * 4), 1);
  }
  // nắng lấp lánh trên mặt nước
  for (let i = 0; i < 38; i++) {
    const ph = Math.sin(t * (1.5 + hash01(i, 6)) + i * 3.1);
    if (ph < 0.82) continue;
    ctx.fillStyle = '#f4ffff';
    ctx.fillRect(Math.floor(hash01(i, 7) * MW), WATER_Y + 3 + Math.floor(hash01(i, 8) * (RIVER_Y - WATER_Y - 6)), 2, 1);
  }
  // lục bình trôi
  for (let i = 0; i < 12; i++) {
    const y = WATER_Y + 6 + Math.floor(hash01(i, 7) * (RIVER_Y - WATER_Y - 20));
    const x = (hash01(i, 8) * (MW + 60) + t * 2.2) % (MW + 60) - 30;
    const yy = y + Math.sin(t * 1.4 + i) * 0.8;
    ctx.fillStyle = '#2f7a2a'; ctx.fillRect(Math.round(x), Math.round(yy), 9, 3);
    ctx.fillStyle = '#5ab03a'; ctx.fillRect(Math.round(x) + 1, Math.round(yy) - 1, 7, 2);
    ctx.fillStyle = '#b48ae6'; ctx.fillRect(Math.round(x) + 3, Math.round(yy) - 2, 2, 1);
  }
  // sóng vỗ nhẹ vào chân bến
  for (let x = 0; x < MW; x += 3) {
    const h = Math.sin(x * 0.2 + t * 2.1) + Math.sin(x * 0.07 - t * 1.2);
    if (h > 0.3) { ctx.fillStyle = 'rgba(235,250,250,0.75)'; ctx.fillRect(x, RIVER_Y - 1, 3, 1); }
    if (h > 1.3) { ctx.fillStyle = 'rgba(235,250,250,0.55)'; ctx.fillRect(x, RIVER_Y - 2, 2, 1); }
  }
}

// đường thẳng bằng điểm ảnh (cho tay chèo, mái chèo)
function pline(ctx, x0, y0, x1, y1, c, th = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  ctx.fillStyle = c;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), th, th);
}
// nhịp chèo 0..1: 0 đến 0,55 là kéo mái chèo dưới nước (đẩy xuồng đi), còn lại là nhấc chèo lên đưa về phía trước
function rowPhase(t, seed) { return (((t * 0.85 + seed * 0.37) % 1) + 1) % 1; }
// bắn nước ở đầu mái chèo: vòng sóng khi kéo, giọt nước khi nhấc lên (toạ độ x, mực nước wy)
function splash(ctx, u, x, wy) {
  ctx.fillStyle = 'rgba(235,250,250,0.85)';
  if (u < 0.55) { ctx.fillRect(Math.round(x) - 3, wy, 7, 1); ctx.fillRect(Math.round(x) - 1, wy - 1, 3, 1); ctx.fillStyle = 'rgba(235,250,250,0.5)'; ctx.fillRect(Math.round(x) - 6, wy + 1, 13, 1); }
  else if (u < 0.7) { ctx.fillRect(Math.round(x) + 1, wy - 3 - Math.round((u - 0.55) * 20), 1, 1); ctx.fillRect(Math.round(x) - 2, wy - 2 - Math.round((u - 0.55) * 14), 1, 1); ctx.fillRect(Math.round(x), wy - 1, 3, 1); }
}
const DEFAULT_ST = { sex: 'f', shirt: '#5a4636', shirtL: '#7a6248', skin: '#e0a278', skinD: '#b97a52', hair: '#1a1210', hat: 'non' };
// người chèo xuồng ngồi ở đuôi, vẽ theo toạ độ ảnh xuồng (100 x 44, mũi bên phải). Thân nghiêng, tay kéo, mái chèo quét dưới nước.
// st: kiểu người chèo (giới tính, áo, da, tóc, mũ, khăn) lấy từ BOAT_KINDS trong market.js
function drawRower(ctx, u, st = DEFAULT_ST) {
  const Px = 24; const Py = 27;                     // chỗ gác chèo ở mạn xuồng
  let a; let tipY;
  if (u < 0.55) { a = 10 - 20 * (u / 0.55); tipY = 37; }
  else { const w = (u - 0.55) / 0.45; a = -10 + 20 * w; tipY = 37 - 7 * Math.sin(Math.PI * w); }
  const Tx = Px + a; const Ty = tipY;                 // đầu mái chèo
  const Hx = Px - (Tx - Px) * 0.6; const Hy = Py - (Ty - Py) * 0.7;   // tay cầm chèo (đòn bẩy quanh chỗ gác)
  const lx = Math.round((Hx - 24) * 0.25);            // thân nghiêng theo nhịp chèo
  const OUTL = '#2a1a10'; const SK = st.skin; const SKD = st.skinD; const SH = st.shirt; const SHL = st.shirtL; const HAIR = st.hair;
  ctx.fillStyle = '#3a2614'; ctx.fillRect(Px - 1, 24, 2, 4);                 // cọc gác chèo
  // tóc dài buộc đuôi ngựa phía sau (nữ)
  if (st.sex === 'f') { ctx.fillStyle = HAIR; ctx.fillRect(14 + lx, 10, 3, 7); ctx.fillRect(13 + lx, 15, 2, 4); ctx.fillStyle = '#9a1f1f'; ctx.fillRect(14 + lx, 13, 3, 1); }
  // thân dưới (ngồi yên), thân trên (nghiêng)
  ctx.fillStyle = OUTL; ctx.fillRect(14, 22, 11, 6);
  ctx.fillStyle = SH; ctx.fillRect(15, 22, 9, 5); ctx.fillStyle = SHL; ctx.fillRect(15, 22, 2, 5);
  ctx.fillStyle = OUTL; ctx.fillRect(15 + lx, 15, 9, 8);
  ctx.fillStyle = SH; ctx.fillRect(16 + lx, 16, 7, 7); ctx.fillStyle = SHL; ctx.fillRect(16 + lx, 16, 2, 7);
  ctx.fillStyle = SHL; ctx.fillRect(19 + lx, 17, 1, 6);                       // đường nút áo
  // khăn rằn quanh cổ
  if (st.scarf === 'rang') { for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f4f4f0' : '#3a7a4a'; ctx.fillRect(17 + lx + i, 15, 1, 2); } }
  // đầu quay mặt về phía mũi xuồng
  ctx.fillStyle = OUTL; ctx.fillRect(16 + lx, 8, 8, 8);
  ctx.fillStyle = SK; ctx.fillRect(17 + lx, 9, 6, 6); ctx.fillStyle = SKD; ctx.fillRect(17 + lx, 14, 6, 1);
  ctx.fillStyle = HAIR; ctx.fillRect(17 + lx, 9, 6, 1); ctx.fillRect(17 + lx, 9, 1, 4);
  ctx.fillStyle = '#1a1210'; ctx.fillRect(21 + lx, 11, 1, 2);
  const hc = 20 + lx;
  if (st.hat === 'non') {                                                        // nón lá
    for (let i = 0; i < 5; i++) { const w = 4 + i * 4; ctx.fillStyle = i % 2 ? '#cdb77a' : '#e9d6a0'; ctx.fillRect(hc - Math.floor(w / 2), 4 + i, w, 1); }
    ctx.fillStyle = '#e9d6a0'; ctx.fillRect(hc, 3, 1, 1); ctx.fillStyle = '#a6925a'; ctx.fillRect(hc - 10, 8, 20, 1);
    ctx.fillStyle = '#9a1f1f'; ctx.fillRect(hc + 2, 13, 1, 3);
  } else if (st.hat === 'ram') {                                                 // mũ rơm vành rộng
    ctx.fillStyle = '#d8c070'; ctx.fillRect(hc - 9, 7, 19, 2); ctx.fillStyle = '#a8924a'; ctx.fillRect(hc - 9, 9, 19, 1);
    ctx.fillStyle = '#e8d088'; ctx.fillRect(hc - 5, 3, 11, 4); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(hc - 5, 6, 11, 1);
  } else if (st.hat === 'cap') {                                                 // mũ lưỡi trai
    const col = st.hatColor || '#2a4a8a';
    ctx.fillStyle = col; ctx.fillRect(hc - 5, 4, 11, 4); ctx.fillRect(hc - 5, 8, 7, 1); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(hc + 2, 8, 9, 2); ctx.fillStyle = col; ctx.fillRect(hc + 2, 7, 9, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(hc - 1, 5, 3, 2);
  } else if (st.hat === 'khan') {                                                // khăn quấn đầu (khăn rằn nếu có caro)
    const c1 = st.scarf || '#f0f0e8';
    ctx.fillStyle = c1; ctx.fillRect(16 + lx, 6, 9, 4); ctx.fillRect(14 + lx, 8, 3, 4);
    ctx.fillStyle = OUTL; ctx.fillRect(16 + lx, 5, 9, 1);
    for (let i = 0; i < 9; i += 2) { ctx.fillStyle = c1 === '#f0f0e8' ? '#d8d8cc' : '#f4f4f0'; ctx.fillRect(16 + lx + i, 6 + (i % 4 ? 0 : 2), 1, 1); }
  }
  // hai tay: tay áo rồi cẳng tay trần, nắm cán chèo
  const Sx = 20 + lx; const Sy = 19;
  const Ex = (Sx + Hx) / 2; const Ey = Math.max(Sy, (Sy + Hy) / 2) + 2;
  pline(ctx, Sx, Sy, Ex, Ey, SH, 2);
  pline(ctx, Ex, Ey, Hx, Hy, SK, 2);
  // mái chèo: cán nâu, bản chèo rộng ở đầu
  pline(ctx, Hx - (Tx - Hx) * 0.15, Hy - (Ty - Hy) * 0.15, Tx, Ty, '#6a4a2a', 1);
  pline(ctx, Hx - (Tx - Hx) * 0.15, Hy - (Ty - Hy) * 0.15 - 1, Tx, Ty - 1, '#a07c52', 1);
  const bx = Tx - (Tx - Px) * 0.28; const by = Ty - (Ty - Py) * 0.28;
  ctx.globalAlpha = u < 0.55 ? 0.85 : 1;
  pline(ctx, bx, by, Tx, Ty, '#8a6238', 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = SK; ctx.fillRect(Math.round(Hx) - 1, Math.round(Hy) - 1, 2, 2);
  splash(ctx, u, Tx, 34);
}
// xuồng theo ảnh mẫu của thầy, ghép từ các lớp (marketHero.js): nền, thân, đầu (mở hoặc nhắm mắt), mái chèo kèm hai bàn tay.
// Mỗi nhịp chèo: mái chèo xoay quanh chỗ gác chèo (kéo dưới nước rồi nhấc lên), thân và đầu nghiêng theo, đầu nhấp nhô, xuồng lắc nhẹ, nước bắn ở đầu mái chèo.
// im: các ảnh đã tải của xuồng này (base, body, head, blink, oar); blink: true khi đang nhắm mắt
function drawHeroBoat(ctx, hd, im, x, y, dir, u, t, blink) {
  const ok = (i) => i && (i.complete === undefined || i.complete) && i.width;
  if (!hd || !im || !ok(im.base)) return;
  const sc = HERO_SCALE;
  const PHI = 0.12;                                   // góc xoay mái chèo mỗi bên (radian)
  let phi; let lift = 0;
  if (u < 0.55) phi = -PHI + 2 * PHI * (u / 0.55);
  else { const w = (u - 0.55) / 0.45; phi = PHI - 2 * PHI * w; lift = 5 * Math.sin(Math.PI * w); }
  const lean = phi / PHI;                             // -1 đến 1
  const bob = Math.sin(t * 1.3) * 0.5;
  const [px, py] = hd.pivot; const [tx, ty] = hd.tip;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (dir < 0) ctx.scale(-1, 1);
  ctx.rotate(Math.sin(u * Math.PI * 2) * 0.02 + Math.sin(t * 1.1) * 0.01);
  ctx.save();
  ctx.translate(-hd.w * sc / 2, -hd.hull * sc - 1);
  ctx.scale(sc, sc);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im.base, 0, 0, hd.w, hd.h);
  const put = (img, l, dx, dy) => { if (ok(img)) ctx.drawImage(img, l.x + dx, l.y + dy, l.w, l.h); };
  put(im.body, hd.body, lean * 2, 0);
  put(blink ? im.blink : im.head, blink ? hd.blink : hd.head, lean * 2.5, bob);
  ctx.save();
  ctx.translate(px, py - lift); ctx.rotate(phi); ctx.translate(-px, -py);
  put(im.oar, hd.oar, 0, 0);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  ctx.restore();
  // đầu mái chèo sau khi xoay (đổi sang toạ độ map) để bắn nước đúng chỗ
  const dxp = tx - px; const dyp = ty - py;
  const tipX = px + dxp * Math.cos(phi) - dyp * Math.sin(phi);
  splash(ctx, u, tipX * sc - (hd.w * sc) / 2, -3);
  ctx.restore();
}

// xuồng bán hàng chạy trên sông theo lịch (activeBoats): xuồng gần (y lớn) vẽ sau nên che xuồng xa.
// imgs: ảnh các lớp của xuồng mẫu theo id (xem MarketView); wall: giây theo đồng hồ thật (mặc định lấy giờ máy) để mọi máy thấy cùng một lịch xuồng
export function drawBoats(ctx, art, t, imgs = {}, wall = Date.now() / 1000) {
  const list = activeBoats(wall).sort((p, q) => p.y - q.y || (p.key < q.key ? -1 : 1));
  for (const b of list) {
    const k = BOAT_KINDS[b.kind];
    const ph = b.lane * 3 + (b.key.charCodeAt(b.key.length - 1) % 5);
    const u = rowPhase(t, ph);
    const surge = Math.sin(u * Math.PI * 2) * 0.7;      // xuồng nhích lên mỗi nhịp chèo
    const x = b.x + b.dir * surge;
    const y = b.y + Math.sin(t * 1.2 + b.lane * 2.3 + b.kind) * 0.8 + Math.sin(u * Math.PI * 2 + 1) * 0.4;
    // bóng xuồng dưới nước, vệt nước sau lái (vẽ trước thân xuồng)
    ctx.fillStyle = 'rgba(20,60,70,0.28)';
    ctx.fillRect(Math.round(x) - 56, Math.round(y) + 5, 112, 2);
    ctx.fillStyle = 'rgba(210,235,238,0.55)';
    const tail = x - b.dir * 74;
    ctx.fillRect(Math.round(tail), Math.round(y) - 3, 10, 1);
    ctx.fillRect(Math.round(tail - b.dir * 8), Math.round(y) - 1, 8, 1);
    ctx.fillRect(Math.round(tail - b.dir * 20), Math.round(y) + 1, 12, 1);
    ctx.fillRect(Math.round(tail - b.dir * 36), Math.round(y) - 2, 8, 1);
    if (k.hero) {
      // chớp mắt khoảng mỗi 3,6 giây (đôi khi chớp hai lần liền)
      const tb = (((t + ph * 1.7) % 3.6) + 3.6) % 3.6;
      drawHeroBoat(ctx, HERO[k.id], imgs[k.id], x, y, b.dir, u, t, tb < 0.13 || (ph % 2 === 0 && tb > 0.3 && tb < 0.41));
    } else {
      const img = art.boatFor(k.cargo, false, 3 + b.kind);
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      if (b.dir < 0) ctx.scale(-1, 1);
      ctx.translate(-50, -(img.height - 8));
      ctx.drawImage(img, 0, 0);
      ctx.translate(0, img.height - 44);
      drawRower(ctx, u, k.st);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(240,252,252,0.7)';
    ctx.fillRect(Math.round(x + b.dir * 62), Math.round(y) + 2, 5, 1);
  }
  // xuồng neo ở bến (vẽ sau cùng nên che xuồng trên sông)
  for (const b of BOATS) {
    const img = art.boatFor(b.cargo, false, 11 + b.id);
    const y = b.y + Math.sin(t * 1.1 + b.x * 0.05) * 0.9;
    ctx.drawImage(img, Math.round(b.x - 50), Math.round(y - (img.height - 8)));
    ctx.fillStyle = 'rgba(210,235,238,0.4)';
    ctx.fillRect(Math.round(b.x - 44), Math.round(y) + 8, 12, 1);
    ctx.fillRect(Math.round(b.x + 28), Math.round(y) + 8, 10, 1);
  }
}

// các vật thể đứng trên mặt đất, sắp theo key (y chân) cùng với người. draw(ctx, t): t là giây (để lay theo gió)
export function makeProps(art, sellerImgs) {
  const list = [];
  for (const s of STALLS) {
    const key = s.base + 12;
    list.push({
      key,
      draw(ctx, t = 0) {
        // bạt che + cột, rồi tấm bạt trải dưới hàng
        ctx.drawImage(art.canopy[s.tarp], Math.round(s.cx - 70), Math.round(s.base - 100));
        ctx.drawImage(art.mat[s.id], Math.round(s.cx - 64), Math.round(s.base + 10 - 51));
        // người bán ngồi xổm phía sau hàng (hoặc ghế nhựa nếu sạp chưa có người)
        if (s.seller) {
          const im = sellerImgs && sellerImgs[s.seller];
          if (im && (im.complete === undefined || im.complete) && im.width) {
            const w = im.width * SELLER_SCALE;
            const h = im.height * SELLER_SCALE;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(im, Math.round(s.cx - w / 2), Math.round(s.base - 18 - h), Math.round(w), Math.round(h));
            ctx.imageSmoothingEnabled = false;
          }
          ctx.drawImage(art.scale, Math.round(s.cx + 42), Math.round(s.base - 14));
        } else {
          ctx.drawImage(art.stool, Math.round(s.cx - 9), Math.round(s.base - 28));
        }
        // hàng bày phía trước
        ctx.drawImage(art.goods[s.id], Math.round(s.cx - 64), Math.round(s.base + 10 - 51));
        // bóng đèn treo ở mép bạt, đung đưa theo gió
        const sw = Math.round(windAt(t, s.cx) * 1.4 + Math.sin(t * 2.2 + s.id) * 0.4);
        ctx.drawImage(art.bulb, Math.round(s.cx - 40) + sw, Math.round(s.base - 50));
        ctx.drawImage(art.bulb, Math.round(s.cx + 36) + sw, Math.round(s.base - 50));
      },
    });
  }
  for (const p of LAMP_POSTS) {
    list.push({ key: p.y, draw(ctx) { ctx.drawImage(art.lamp, p.x - 7, p.y - 38); } });
  }
  // cây dừa, chuối, tre, bụi ở hai mép chợ
  for (const tr of NEAR_TREES) {
    list.push({ key: tr.y, draw(ctx, t = 0) { sway(ctx, art.tree[tr.kind], tr.x, tr.y, tr.ph, t, false); } });
  }
  // biển lối về làng ở cuối chợ
  const cx = MW / 2;
  list.push({
    key: EXIT_Y - 6,
    draw(ctx) {
      ctx.fillStyle = '#4a301a'; ctx.fillRect(cx - 2, EXIT_Y - 22, 3, 22);
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(cx - 26, EXIT_Y - 36, 52, 16);
      ctx.fillStyle = '#f0b44a'; ctx.fillRect(cx - 25, EXIT_Y - 35, 50, 14);
      ctx.fillStyle = '#2a1f1a'; ctx.font = '700 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('VỀ LÀNG', cx, EXIT_Y - 28, 46);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    },
  });
  list.sort((a, b) => a.key - b.key);
  return list;
}

// ---------- chim ----------
function bird(ctx, x, y, ph, dir, kind, a) {
  const f = Math.floor((((ph % 1) + 1) % 1) * 4);
  const wy = kind === 'co' ? [-5, -2, 2, 3][f] : [-3, -1, 1, 2][f];
  const body = kind === 'co' ? '#fbfbf6' : '#20202a';
  const rx = Math.round(x); const ry = Math.round(y);
  ctx.globalAlpha = a;
  const seg = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    ctx.fillStyle = c;
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
  };
  if (kind === 'co') {
    ctx.fillStyle = body; ctx.fillRect(rx - 3, ry, 6, 2);                    // thân
    ctx.fillRect(rx + dir * 3 - (dir < 0 ? 1 : 0), ry - 1, 2, 2);             // đầu
    ctx.fillStyle = '#f0b830'; ctx.fillRect(rx + dir * 5 - (dir < 0 ? 0 : 0), ry, 2, 1);   // mỏ vàng
    seg(rx - dir * 3, ry + 2, rx - dir * 9, ry + 3, '#4a4a4a');              // chân duỗi ra sau
    seg(rx, ry, rx - dir * 3, ry + wy * 1.2, body); seg(rx - dir * 3, ry + wy * 1.2, rx - dir * 7, ry + wy * 1.4 + 1, '#e4e8e4');
    seg(rx + 1, ry, rx - dir * 2, ry + wy, '#dfe3df');
  } else {
    ctx.fillStyle = body; ctx.fillRect(rx - 1, ry, 3, 1);
    seg(rx, ry, rx - 4, ry + wy, body); seg(rx, ry, rx + 4, ry + wy, body);
    ctx.fillRect(rx - dir * 3, ry + 1, 2, 1);                                 // đuôi chẻ
  }
  ctx.globalAlpha = 1;
}
// đàn cò trắng và én bay ngang qua; ban đêm và khi mưa to thì vắng chim
export function drawBirds(ctx, t, night = 0, rain = 0) {
  const a = clamp01(1 - night * 1.6) * clamp01(1 - rain * 1.2);
  if (a < 0.05) return;
  const span = MW + 240;
  FLOCKS.forEach((f, fi) => {
    const baseX = (((f.x0 + f.dir * f.sp * t + windAt(t, f.x0) * 20) % span) + span) % span - 120;
    const baseY = f.y + Math.sin(t * 0.5 + fi) * 4;
    for (let k = 0; k < f.n; k++) {
      const row = Math.ceil(k / 2);
      const side = k % 2 ? 1 : -1;
      const x = baseX - f.dir * row * (f.kind === 'co' ? 9 : 6);
      const y = baseY + (k === 0 ? 0 : side * row * (f.kind === 'co' ? 5 : 3)) + Math.sin(t * 1.1 + k * 2) * 1.2;
      const ph = t * (f.kind === 'co' ? 2.4 : 6.5) + k * 0.37 + fi;
      bird(ctx, x, y, ph, f.dir, f.kind, a);
      // bóng chim lướt trên mặt đất / mặt nước (mờ)
      ctx.fillStyle = 'rgba(0,0,30,0.10)';
      ctx.fillRect(Math.round(x) - 2, Math.round(y + 26 + fi * 4), 4, 1);
    }
  });
}

// bóng mây lướt qua chợ và mặt sông
export function drawCloudShadows(ctx, t, night = 0) {
  const a = 0.09 * (1 - night * 0.7);
  if (a < 0.01) return;
  const span = MW + 400;
  ctx.fillStyle = `rgba(16,40,70,${a.toFixed(3)})`;
  CLOUDS.forEach((c, i) => {
    const x = (((c.x0 * 1.3 + c.sp * 1.15 * t + windAt(t, c.x0) * 10) % span) + span) % span - 200;
    const y = 80 + ((i * 97) % (MH - 120));
    ctx.beginPath();
    ctx.ellipse(Math.round(x), y, 78, 24, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

// lá cây và cánh hoa bay theo gió qua chợ
export function drawLeaves(ctx, t) {
  for (let i = 0; i < 18; i++) {
    const sp = 14 + hash01(i, 11) * 18;
    const x = (((hash01(i, 12) * MW + sp * t + windAt(t, i * 40) * 40) % (MW + 40)) + MW + 40) % (MW + 40) - 20;
    const y = 30 + hash01(i, 13) * (MH - 60) + Math.sin(t * 1.7 + i * 2.3) * 7;
    ctx.fillStyle = hash01(i, 14) < 0.6 ? '#7ab84a' : hash01(i, 14) < 0.85 ? '#d6c04a' : '#f2a0b4';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
    ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1);
  }
}

// ánh sáng ấm của đèn sạp và đèn bến về đêm (vẽ sau lớp tối)
export function drawLights(ctx, night, t) {
  if (night < 0.04) return;
  const glow = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,214,130,${(a * night).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of STALLS) { glow(s.cx - 37, s.base - 40, 56 + Math.sin(t * 2 + s.id) * 2, 0.42); glow(s.cx + 39, s.base - 40, 56 + Math.sin(t * 2.3 + s.id) * 2, 0.42); }
  for (const p of LAMP_POSTS) glow(p.x, p.y - 32, 66, 0.42);
  ctx.restore();
}
export const NIGHT_TINT = (night) => `rgba(14,24,56,${(0.5 * night).toFixed(3)})`;
export { MH, MW };
