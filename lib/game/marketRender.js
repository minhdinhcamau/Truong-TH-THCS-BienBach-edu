// GAME (tách riêng): hàm vẽ cảnh CHỢ MIỀN TÂY (không phụ thuộc trình duyệt, vẽ lên canvas 2D bất kỳ).
// Gồm: trời (mây, sao, trăng), bờ bên kia có cây lay theo gió, sông có sóng, xuồng neo và xuồng chạy, các sạp,
// cột đèn, cây ven bờ, chim bay, lá bay theo gió, bóng mây, đèn đêm.
import {
  BOATS, CLOUDS, EXIT_Y, FAR_TREES, FLOCKS, LAMP_POSTS, MH, MW, NEAR_TREES, RIVER_BOATS, RIVER_Y, SKY_H, STALLS, WATER_Y,
} from './market';

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
    const x = (((c.x0 + (c.sp + windAt(t, c.x0) * 1.5) * t) % span) + span) % span - 150;
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

// xuồng neo ở bến + xuồng chạy trên sông (vẽ trước người, vì nằm trên nước)
export function drawBoats(ctx, art, t) {
  for (const b of RIVER_BOATS) {
    const span = MW + 220;
    const x = ((b.x0 + b.dir * b.speed * t) % span + span) % span - 110;
    const img = art.boatFor(b.cargo, true, 3 + b.x0);
    const y = b.y + Math.sin(t * 1.2 + b.x0) * 0.8;
    // bóng xuồng dưới nước
    ctx.fillStyle = 'rgba(20,60,70,0.28)';
    ctx.fillRect(Math.round(x) - 40, Math.round(y) + 5, 80, 2);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (b.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -50, -36);
    ctx.restore();
    // vệt nước sau lái, bọt nước ở mũi
    ctx.fillStyle = 'rgba(210,235,238,0.55)';
    const tail = x - b.dir * 52;
    ctx.fillRect(Math.round(tail), Math.round(y) - 3, 10, 1);
    ctx.fillRect(Math.round(tail - b.dir * 8), Math.round(y) - 1, 8, 1);
    ctx.fillRect(Math.round(tail - b.dir * 20), Math.round(y) + 1, 12, 1);
    ctx.fillRect(Math.round(tail - b.dir * 36), Math.round(y) - 2, 8, 1);
    ctx.fillStyle = 'rgba(240,252,252,0.7)';
    ctx.fillRect(Math.round(x + b.dir * 44), Math.round(y) + 2, 5, 1);
  }
  for (const b of BOATS) {
    const img = art.boatFor(b.cargo, false, 11 + b.id);
    const y = b.y + Math.sin(t * 1.1 + b.x * 0.05) * 0.9;
    ctx.drawImage(img, Math.round(b.x - 50), Math.round(y - 36));
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
    const baseX = (((f.x0 + f.dir * (f.sp + windAt(t, f.x0) * 2) * t) % span) + span) % span - 120;
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
    const x = (((c.x0 * 1.3 + (c.sp * 1.4 + windAt(t, c.x0) * 2) * t) % span) + span) % span - 200;
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
    const x = (((hash01(i, 12) * MW + (sp + windAt(t, i * 40) * 14) * t) % (MW + 40)) + MW + 40) % (MW + 40) - 20;
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
