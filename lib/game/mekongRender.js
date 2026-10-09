// GAME (tách riêng): hàm vẽ map Miền Tây (không phụ thuộc trình duyệt, vẽ lên canvas 2D bất kỳ).
import { K, MH, MW, POLE, T } from './mekong';

const isWater = (k) => k === K.WATER || k === K.POND;

export function drawGround(ctx, art, W, x0, y0, x1, y1, t) {
  const tx0 = Math.max(0, Math.floor(x0 / T));
  const ty0 = Math.max(0, Math.floor(y0 / T));
  const tx1 = Math.min(MW - 1, Math.floor(x1 / T));
  const ty1 = Math.min(MH - 1, Math.floor(y1 / T));
  const wf = Math.floor(t * 2.2);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * MW + tx;
      const k = W.tiles[i];
      const v = W.vari[i];
      let img;
      if (k === K.WATER || k === K.POND) {
        img = art.tile(k, v & 3, 0, (wf + tx * 5 + ty * 3) & 3);
      } else if (k === K.GRASS || k === K.ROAD) {
        let m = 0;
        if (ty > 0 && isWater(W.tiles[i - MW])) m |= 1;
        if (tx < MW - 1 && isWater(W.tiles[i + 1])) m |= 2;
        if (ty < MH - 1 && isWater(W.tiles[i + MW])) m |= 4;
        if (tx > 0 && isWater(W.tiles[i - 1])) m |= 8;
        img = art.tile(k, v, m, 0);
      } else {
        img = art.tile(k, k === K.SOIL ? v : v & 3, 0, 0);
      }
      ctx.drawImage(img, tx * T, ty * T);
    }
  }
}

// các vật thể tĩnh nhìn thấy (objects đã sắp theo y tăng dần)
export function visibleObjects(W, x0, y0, x1, y1) {
  const arr = W.objects;
  let lo = 0;
  let hi = arr.length;
  const ymin = y0 - 10;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].y < ymin) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = lo; i < arr.length; i++) {
    const o = arr[i];
    if (o.y > y1 + 100) break;
    if (o.x < x0 - 60 || o.x > x1 + 60) continue;
    out.push(o);
  }
  return out;
}

export function drawStatic(ctx, art, o, t, fenceLv) {
  switch (o.k) {
    case 'palm': case 'banana': {
      const img = o.k === 'palm' ? art.palm(o.v) : art.banana(o.v);
      const sway = Math.sin(t * 1.3 + o.x * 0.07) * (o.k === 'palm' ? 0.035 : 0.025);
      ctx.save();
      ctx.translate(Math.round(o.x), Math.round(o.y));
      ctx.transform(1, 0, sway, 1, 0, 0);
      ctx.drawImage(img, -(img.width >> 1), -img.height + 1);
      ctx.restore();
      break;
    }
    case 'bush': { const img = art.bush(o.v); ctx.drawImage(img, Math.round(o.x - 13), Math.round(o.y - 17)); break; }
    case 'reed': { const img = art.reed(o.v); ctx.drawImage(img, Math.round(o.x - 7), Math.round(o.y - 25)); break; }
    case 'crop': { const img = art.crop(o.v); ctx.drawImage(img, Math.round(o.x - 7), Math.round(o.y - 11)); break; }
    case 'lily': { const img = art.lily(o.v); ctx.drawImage(img, Math.round(o.x - 6), Math.round(o.y - 4)); break; }
    case 'hyac': { const img = art.hyac(o.v); ctx.drawImage(img, Math.round(o.x - 11), Math.round(o.y - 10 + Math.sin(t * 1.4 + o.ph)) ); break; }
    case 'pole': { const img = o.lamp ? art.poleLamp() : art.pole(); ctx.drawImage(img, Math.round(o.x - POLE.ax), Math.round(o.y - POLE.h + 1)); break; }
    case 'fence': { const img = art.fence((fenceLv && fenceLv[o.plot] && fenceLv[o.plot][o.g]) || 0, o.o, o.v); ctx.drawImage(img, Math.round(o.x - 8), Math.round(o.y - 16)); break; }
    case 'gatepost': { const img = art.gatepost(); ctx.drawImage(img, Math.round(o.x - 4), Math.round(o.y - 27)); break; }
    case 'rail': { const img = art.rail(); ctx.drawImage(img, Math.round(o.x - 8), Math.round(o.y - 13)); break; }
    case 'boat': { const img = art.boat(o.v || 0); ctx.drawImage(img, Math.round(o.x - 32), Math.round(o.y - 22 + Math.sin(t * 1.1 + o.x) * 0.8)); break; }
    case 'sign': {
      const img = art.signBoard(o.text, o.color);
      ctx.drawImage(img, Math.round(o.x - 23), Math.round(o.y - 35));
      ctx.fillStyle = '#1c1a26';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.text, o.x, o.y - 29, 40);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      break;
    }
    default: break;
  }
}

export function drawWires(ctx, W, x0, y0, x1, y1, t) {
  ctx.strokeStyle = 'rgba(28,22,18,0.9)';
  ctx.lineWidth = 0.9;
  for (const line of W.wires) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      if (Math.max(a.x, b.x) < x0 - 20 || Math.min(a.x, b.x) > x1 + 20 || a.y < y0 - 20 || a.y - 80 > y1) continue;
      for (const [wx, wy] of POLE.wire) {
        const ax = a.x - POLE.ax + wx; const ay = a.y - POLE.h + 1 + wy;
        const bx = b.x - POLE.ax + wx; const by = b.y - POLE.h + 1 + wy;
        const sag = Math.abs(bx - ax) * 0.045 + Math.sin(t * 0.8 + ax) * 0.3;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag * 2, bx, by);
        ctx.stroke();
      }
    }
  }
}
