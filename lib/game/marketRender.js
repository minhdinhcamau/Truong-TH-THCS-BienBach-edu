// GAME (tách riêng): hàm vẽ cảnh CHỢ MIỀN TÂY (không phụ thuộc trình duyệt, vẽ lên canvas 2D bất kỳ).
// Gồm: nước chảy, xuồng neo và xuồng chạy trên sông, các sạp (bạt, người bán, hàng), cột đèn, đèn đêm.
import { BOATS, EXIT_Y, LAMP_POSTS, MH, MW, RIVER_BOATS, RIVER_Y, STALLS } from './market';

export const SELLER_SCALE = 0.48;        // ảnh cô bán (đã thu nhỏ sẵn) vẽ ra cỡ trong map

function hash01(n, salt) {
  let x = Math.imul((n | 0) ^ Math.imul(salt | 0, 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// nền (đất, nước, bến) + nước động
export function drawBase(ctx, art, t) {
  ctx.drawImage(art.ground, 0, 0);
  // gợn sóng chạy chậm theo dòng sông
  for (let i = 0; i < 190; i++) {
    const y = 28 + Math.floor(hash01(i, 1) * (RIVER_Y - 30));
    const sp = 3 + hash01(i, 2) * 6;
    const x = (hash01(i, 3) * (MW + 40) + t * sp) % (MW + 40) - 20;
    const on = Math.sin(t * 1.3 + i) > -0.25;
    if (!on) continue;
    ctx.fillStyle = hash01(i, 4) < 0.5 ? '#82c4cc' : '#2f7684';
    ctx.fillRect(Math.round(x), y, 3 + Math.floor(hash01(i, 5) * 4), 1);
  }
  // lục bình trôi
  for (let i = 0; i < 9; i++) {
    const y = 34 + Math.floor(hash01(i, 7) * (RIVER_Y - 44));
    const x = (hash01(i, 8) * (MW + 60) + t * 2.2) % (MW + 60) - 30;
    const yy = y + Math.sin(t * 1.4 + i) * 0.8;
    ctx.fillStyle = '#2f7a2a'; ctx.fillRect(Math.round(x), Math.round(yy), 9, 3);
    ctx.fillStyle = '#5ab03a'; ctx.fillRect(Math.round(x) + 1, Math.round(yy) - 1, 7, 2);
    ctx.fillStyle = '#b48ae6'; ctx.fillRect(Math.round(x) + 3, Math.round(yy) - 2, 2, 1);
  }
}

// xuồng neo ở bến + xuồng chạy trên sông (vẽ trước người, vì nằm trên nước)
export function drawBoats(ctx, art, t) {
  for (const b of RIVER_BOATS) {
    const span = MW + 220;
    const x = ((b.x0 + b.dir * b.speed * t) % span + span) % span - 110;
    const img = art.boatFor(b.cargo, true, 3 + b.x0);
    const y = b.y + Math.sin(t * 1.2 + b.x0) * 0.8;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (b.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -50, -36);
    ctx.restore();
    // vệt nước sau lái
    ctx.fillStyle = 'rgba(210,235,238,0.55)';
    const tail = x - b.dir * 52;
    ctx.fillRect(Math.round(tail), Math.round(y) - 3, 10, 1);
    ctx.fillRect(Math.round(tail - b.dir * 8), Math.round(y) - 1, 8, 1);
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

// các vật thể đứng trên mặt đất, sắp theo key (y chân) cùng với người
export function makeProps(art, sellerImgs) {
  const list = [];
  for (const s of STALLS) {
    const key = s.base + 12;
    list.push({
      key,
      draw(ctx) {
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
        // bóng đèn treo ở mép bạt
        ctx.drawImage(art.bulb, Math.round(s.cx - 40), Math.round(s.base - 50));
        ctx.drawImage(art.bulb, Math.round(s.cx + 36), Math.round(s.base - 50));
      },
    });
  }
  for (const p of LAMP_POSTS) {
    list.push({ key: p.y, draw(ctx) { ctx.drawImage(art.lamp, p.x - 7, p.y - 38); } });
  }
  // biển lối về làng ở cuối chợ
  list.push({
    key: EXIT_Y - 6,
    draw(ctx) {
      ctx.fillStyle = '#4a301a'; ctx.fillRect(398, EXIT_Y - 22, 3, 22);
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(374, EXIT_Y - 36, 52, 16);
      ctx.fillStyle = '#f0b44a'; ctx.fillRect(375, EXIT_Y - 35, 50, 14);
      ctx.fillStyle = '#2a1f1a'; ctx.font = '700 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('VỀ LÀNG', 400, EXIT_Y - 28, 46);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    },
  });
  list.sort((a, b) => a.key - b.key);
  return list;
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
