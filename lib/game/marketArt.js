// GAME (tách riêng): tranh pixel của chợ miền Tây vẽ bằng code (rau củ, thau rổ, bạt che, xuồng, nền chợ, nền bến).
// Không phụ thuộc trình duyệt: nhận hàm mk(w, h) trả về canvas (trình duyệt: document.createElement; thử bằng Node: @napi-rs/canvas).
import { MH, MW, RIVER_Y, STALLS, STREET_Y } from './market';

// bộ số ngẫu nhiên cố định để mọi máy vẽ giống nhau
function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OUT = '#2a1f1a';
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

function inEll(x, y, cx, cy, rx, ry) { const dx = (x - cx) / rx; const dy = (y - cy) / ry; return dx * dx + dy * dy <= 1; }
// elip có viền tối, sáng ở góc trên trái, tối ở góc dưới phải
function ell(g, cx, cy, rx, ry, base, light, dark, edge = OUT) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (!inEll(x, y, cx, cy, rx, ry)) continue;
      const border = !inEll(x - 1, y, cx, cy, rx, ry) || !inEll(x + 1, y, cx, cy, rx, ry) || !inEll(x, y - 1, cx, cy, rx, ry) || !inEll(x, y + 1, cx, cy, rx, ry);
      if (border) { px(g, x, y, edge); continue; }
      const s = (x - cx) / rx * 0.6 + (y - cy) / ry * 0.8;
      px(g, x, y, s < -0.45 ? light : s > 0.4 ? dark : base);
    }
  }
}
function line(g, x0, y0, x1, y1, c, th = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) px(g, x + a, y + b, c);
  }
}
// đoạn dày có viền (dùng cho dưa leo, mướp, chuối...)
function stick(g, x0, y0, x1, y1, th, base, light, edge = OUT) {
  line(g, x0 - 1, y0, x1 - 1, y1, edge, th + 2);
  line(g, x0, y0 - 1, x1, y1 - 1, edge, th + 2);
  line(g, x0, y0, x1, y1, base, th);
  line(g, x0, y0, x1, y1, light, 1);
}

// ---------- rau củ quả (mỗi loại vẽ ở giữa ô 22 x 18, chân ở y = 15) ----------
export const PRODUCE_NAMES = {
  raumuong: 'Rau muống', caixanh: 'Cải xanh', bapcai: 'Bắp cải', cachua: 'Cà chua', carot: 'Cà rốt', chuoi: 'Chuối',
  dualeo: 'Dưa leo', hanhla: 'Hành lá', ot: 'Ớt', bidao: 'Bí đao', xoai: 'Xoài', dua: 'Dừa', khoqua: 'Khổ qua',
  trung: 'Trứng vịt', buoi: 'Bưởi', muop: 'Mướp', duahau: 'Dưa hấu',
};
const DRAW = {
  raumuong(g) {
    for (let i = -3; i <= 3; i++) line(g, 11 + i * 0.6, 15, 11 + i * 2, 7, '#5ab03a', 1);
    for (let i = -3; i <= 3; i++) {
      const x = 11 + i * 2; const y = 6 + Math.abs(i) * 0.5;
      ell(g, x, y, 2.2, 1.8, '#4fa43a', '#8be05a', '#2f7a2a');
    }
    line(g, 7, 13, 15, 13, '#d6b45a', 1); line(g, 7, 14, 15, 14, '#a8843c', 1);
  },
  caixanh(g) {
    ell(g, 8, 10, 4, 5, '#4fa43a', '#7bd04f', '#2f7a2a');
    ell(g, 14, 10, 4, 5, '#4fa43a', '#7bd04f', '#2f7a2a');
    ell(g, 11, 9, 4, 6, '#5cb445', '#8bdc5a', '#3a8a30');
    line(g, 11, 6, 11, 15, '#cfe9a0', 1);
  },
  bapcai(g) {
    ell(g, 11, 9, 7, 6, '#a6d86b', '#d4f09a', '#6fa83e');
    line(g, 6, 8, 10, 12, '#6fa83e', 1); line(g, 16, 8, 12, 12, '#6fa83e', 1); line(g, 11, 4, 11, 13, '#8cc454', 1);
  },
  cachua(g) {
    ell(g, 7, 11, 4, 3.6, '#e23a2c', '#ff7a5e', '#a6201a');
    ell(g, 15, 11, 4, 3.6, '#e23a2c', '#ff7a5e', '#a6201a');
    ell(g, 11, 7, 4, 3.6, '#ea4634', '#ff8266', '#b02a20');
    px(g, 7, 8, '#3c9a3a'); px(g, 15, 8, '#3c9a3a'); px(g, 11, 4, '#3c9a3a'); px(g, 10, 4, '#3c9a3a'); px(g, 12, 4, '#3c9a3a');
  },
  carot(g) {
    for (const [x, a] of [[7, -1], [11, 0], [15, 1]]) {
      stick(g, x, 6, x - a * 1 + 0, 15, 3, '#f08a2a', '#ffb860');
      px(g, x, 4, '#3f9a34'); px(g, x - 1, 3, '#5cb445'); px(g, x + 1, 3, '#5cb445'); px(g, x, 5, '#3f9a34');
    }
  },
  chuoi(g) {
    for (let k = 0; k < 3; k++) {
      const x = 5 + k * 4;
      stick(g, x, 4, x + 1, 9, 3, '#f3cf3a', '#fff08a');
      stick(g, x + 1, 9, x + 4, 13, 3, '#efc42e', '#fbe66a');
      px(g, x + 5, 14, '#5a3a14'); px(g, x, 3, '#5a3a14');
    }
    line(g, 5, 3, 13, 3, '#5a8a2a', 2);
  },
  dualeo(g) {
    stick(g, 4, 12, 17, 9, 3, '#3d9a3a', '#7bd05a');
    stick(g, 5, 8, 16, 5, 3, '#348f34', '#6cc650');
    px(g, 8, 11, '#a6e08a'); px(g, 12, 10, '#a6e08a'); px(g, 9, 7, '#a6e08a');
  },
  hanhla(g) {
    for (let i = -3; i <= 3; i++) {
      line(g, 11 + i * 1.3, 15, 11 + i * 1.8, 5, '#4faa3a', 1);
      line(g, 11 + i * 1.3, 15, 11 + i * 1.5, 12, '#f2f2e8', 1);
    }
    line(g, 7, 12, 15, 12, '#d6b45a', 1);
  },
  ot(g) {
    for (const [x, y] of [[6, 5], [10, 4], [14, 6]]) {
      stick(g, x, y, x + 2, y + 8, 2, '#d8281e', '#ff7a5e');
      px(g, x, y - 1, '#3c9a3a'); px(g, x - 1, y - 1, '#3c9a3a');
    }
  },
  bidao(g) {
    ell(g, 11, 9, 9, 6, '#a9cf8a', '#d9ecc0', '#7fa860');
    for (let i = 0; i < 9; i++) px(g, 5 + (i * 7) % 12, 7 + (i * 3) % 6, '#e8f0dc');
    px(g, 11, 3, '#6a8a3a');
  },
  xoai(g) {
    ell(g, 8, 10, 5, 4.4, '#efb934', '#ffe06a', '#c98a22');
    ell(g, 15, 9, 5, 4.4, '#e4a62e', '#fcd25a', '#b97a1a');
    px(g, 6, 8, '#7ac24a'); px(g, 7, 7, '#7ac24a'); px(g, 14, 6, '#7ac24a'); px(g, 15, 5, '#7ac24a');
  },
  dua(g) {
    ell(g, 8, 10, 5, 5, '#8ad060', '#c6f090', '#4f9a3a');
    ell(g, 15, 10, 5, 5, '#7cc455', '#b8ea84', '#478f35');
    ell(g, 11, 6, 4, 4.4, '#9ad870', '#d2f6a2', '#5aa844');
    px(g, 11, 2, '#4a7a28'); px(g, 11, 3, '#4a7a28');
  },
  khoqua(g) {
    stick(g, 4, 12, 17, 9, 3, '#3a8a30', '#78c050');
    stick(g, 5, 7, 16, 5, 3, '#348230', '#6cb44a');
    for (const [x, y] of [[7, 11], [10, 10], [13, 9], [8, 6], [12, 5]]) px(g, x, y, '#1f5c1f');
  },
  trung(g) {
    for (const [x, y] of [[7, 11], [12, 12], [17, 11], [9, 7], [14, 8]]) ell(g, x, y, 2.9, 3.4, '#f6efe0', '#ffffff', '#cdbfa0', '#6a5a46');
  },
  buoi(g) {
    ell(g, 11, 9, 7, 6.4, '#bcd860', '#e2f08a', '#8aa83a');
    px(g, 11, 3, '#4a6a22'); px(g, 10, 3, '#4a6a22');
  },
  muop(g) {
    stick(g, 4, 6, 18, 13, 3, '#6fb04a', '#a8e07a');
    stick(g, 5, 11, 17, 5, 2, '#62a43f', '#98d46a');
    line(g, 6, 7, 16, 12, '#4d8a32', 1);
  },
  duahau(g) {
    ell(g, 11, 9, 8.5, 6.4, '#3f9a4a', '#6fcf7a', '#2a6a34');
    for (let k = -3; k <= 3; k++) line(g, 11 + k * 2.2, 4 + Math.abs(k) * 0.4, 11 + k * 2.6, 14 - Math.abs(k) * 0.4, '#1f5a28', 1);
  },
};
export const PRODUCE = Object.keys(DRAW);

// ---------- thau, rổ, mẹt ----------
const CONT = {
  thau: { rx: 15, ry: 6, body: '#d8342a', rim: '#ff6a58', dark: '#8f1d18' },     // thau nhựa đỏ
  ro: { rx: 14, ry: 6, body: '#2f7ad8', rim: '#6ab0ff', dark: '#1d4f94' },        // rổ nhựa xanh
  met: { rx: 15, ry: 5, body: '#d9b27a', rim: '#f2d29c', dark: '#a47a42' },       // mẹt tre
};

// ---------- tranh tổng hợp ----------
export function makeMarketArt(mk) {
  const art = { produce: {}, sheet: {}, canopy: {}, goods: {}, boat: {}, bulb: null };

  for (const k of PRODUCE) {
    const c = mk(22, 18); const g = c.getContext('2d');
    DRAW[k](g);
    art.produce[k] = c;
  }

  // một thau/rổ/mẹt đầy hàng (canvas 40 x 34, tâm miệng ở (20, 16))
  function container(kind, items, seed) {
    const r = rng(seed);
    const c = mk(40, 34); const g = c.getContext('2d');
    const d = CONT[kind];
    const cx = 20; const cy = 16;
    const ry = kind === 'met' ? 4 : 5;
    const wall = kind === 'met' ? 3 : 8;
    // lòng thau (phía trong)
    ell(g, cx, cy, d.rx, ry, d.dark, d.dark, d.dark);
    // hàng chất lên trên miệng
    const n = items.length;
    const slots = n === 1 ? [0] : n === 2 ? [-6, 6] : n === 3 ? [-9, 0, 9] : [-11, -4, 4, 11];
    const order = items.map((k, i) => ({ k, dx: slots[i] + Math.round((r() - 0.5) * 2), dy: -2 - Math.round(r() * 3) + (i % 2 ? 1 : 0) }));
    order.sort((a, b) => a.dy - b.dy);
    for (const it of order) g.drawImage(art.produce[it.k], cx + it.dx - 11, cy + it.dy - 12);
    // thành thau phía trước che chân hàng
    for (let x = cx - d.rx; x <= cx + d.rx; x++) {
      const t = (x - cx) / d.rx;
      const top = Math.round(cy + ry * Math.sqrt(Math.max(0, 1 - t * t)));
      for (let k = 0; k <= wall; k++) {
        const shrink = Math.abs(t) > 0.85 ? k * 0.0 : 0;
        const y = top + k;
        const left = (x - cx) / d.rx < -0.35;
        px(g, x, y, k === 0 ? d.rim : k === wall ? OUT : left ? d.rim : (x - cx) / d.rx > 0.4 ? d.dark : d.body);
        void shrink;
      }
    }
    line(g, cx - d.rx, cy, cx - d.rx, cy + wall, OUT, 1);
    line(g, cx + d.rx, cy, cx + d.rx, cy + wall, OUT, 1);
    return c;
  }

  // tấm bạt trải dưới hàng (art.mat) và các thau rổ đầy hàng (art.goods), cùng cỡ 128 x 52, đáy ở y = 50
  function goods(stall) {
    const mat = mk(128, 52); const g0 = mat.getContext('2d');
    const c = mk(128, 52); const g = c.getContext('2d');
    const tarp = stall.tarp === 'do' ? ['#b83a32', '#cf5046'] : stall.tarp === 'soc' ? ['#e9e2d2', '#c64a3a'] : ['#2f6fcf', '#4a8ae6'];
    for (let y = 33; y < 51; y++) for (let x = 6; x < 122; x++) {
      const edge = x < 7 || x > 120 || y === 33 || y === 50;
      px(g0, x, y, edge ? '#1a1a22' : ((Math.floor(x / 6) + Math.floor(y / 6)) % 2 ? tarp[0] : tarp[1]));
    }
    stall.goods.forEach(([kind, items], i) => {
      const cont = container(kind, items, 50 + stall.id * 13 + i * 7);
      g.drawImage(cont, 9 + i * 29 - 4, 17 + (i % 2) * 2);
    });
    return { mat, items: c };
  }
  for (const s of STALLS) { const r = goods(s); art.mat = art.mat || {}; art.mat[s.id] = r.mat; art.goods[s.id] = r.items; }

  // bạt che sạp (hình bình hành nhìn từ phía trước, nghiêng) + cột: canvas 140 x 100, gốc cột ở y = 96
  function canopy(color) {
    const c = mk(140, 100); const g = c.getContext('2d');
    const cols = color === 'do' ? ['#c4352c', '#e6564a', '#8a1f1a'] : color === 'soc' ? ['#f2eadb', '#d5483a', '#a8402f'] : ['#2f72d4', '#5a98f0', '#1d4a94'];
    // cột trước
    for (const x of [8, 130]) { rect(g, x, 50, 3, 46, '#6b625a'); rect(g, x, 50, 1, 46, '#a79d92'); rect(g, x + 3, 50, 1, 46, '#3a342f'); }
    // cột sau (thấp hơn, bị bạt che)
    for (const x of [14, 124]) rect(g, x, 20, 2, 36, '#575049');
    // mặt bạt: mép sau cao (y = 6), mép trước thấp (y = 46)
    for (let y = 6; y <= 46; y++) {
      const t = (y - 6) / 40;
      const x0 = Math.round(14 - 8 * t);
      const x1 = Math.round(126 + 8 * t);
      for (let x = x0; x <= x1; x++) {
        const stripe = color === 'soc' ? (Math.floor((x - x0) / 9) % 2) : ((x - x0) % 28 < 2);
        let col = color === 'soc' ? (stripe ? cols[1] : cols[0]) : cols[0];
        if (color !== 'soc' && stripe) col = cols[1];
        if (t > 0.7) col = color === 'soc' ? (stripe ? cols[2] : '#d8cfbd') : cols[2];
        if (x === x0 || x === x1 || y === 6) col = '#1a1a22';
        px(g, x, y, col);
      }
    }
    // nếp gấp
    for (let k = 0; k < 6; k++) { const x = 30 + k * 18; line(g, x, 9, x - 5 + (k % 2) * 3, 40, 'rgba(0,0,0,0.12)', 1); }
    // mép bạt rủ xuống phía trước, có răng cưa
    for (let x = 6; x <= 134; x++) {
      const w = (x - 6) % 8 < 4 ? 6 : 4;
      for (let y = 47; y < 47 + w; y++) {
        const col = color === 'soc' ? (Math.floor((x - 6) / 8) % 2 ? cols[1] : '#f2eadb') : (Math.floor((x - 6) / 8) % 2 ? cols[0] : cols[1]);
        px(g, x, y, y === 46 + w ? '#1a1a22' : col);
      }
    }
    return c;
  }
  for (const k of ['xanh', 'do', 'soc']) art.canopy[k] = canopy(k);

  // cân đồng hồ xanh ngọc đặt cạnh người bán
  const scale = mk(14, 14); {
    const g = scale.getContext('2d');
    rect(g, 2, 8, 10, 6, '#1a1a22'); rect(g, 3, 9, 8, 4, '#2aa88a'); rect(g, 3, 9, 8, 1, '#6fe0c4');
    rect(g, 6, 4, 2, 5, '#8a929a'); rect(g, 1, 2, 12, 2, '#1a1a22'); rect(g, 2, 3, 10, 1, '#d4dae0');
  }
  art.scale = scale;

  // ghế nhựa đỏ cho sạp chưa có người bán
  const stool = mk(18, 14); {
    const g = stool.getContext('2d');
    rect(g, 2, 1, 14, 5, '#1a1a22'); rect(g, 3, 2, 12, 3, '#d8342a'); rect(g, 3, 2, 12, 1, '#ff6a58');
    rect(g, 3, 6, 2, 7, '#8f1d18'); rect(g, 13, 6, 2, 7, '#8f1d18'); rect(g, 8, 6, 2, 6, '#a82820');
  }
  art.stool = stool;

  // ---------- xuồng ba lá (canvas 100 x 40; mũi bên phải) ----------
  function boat(cargo, rower, seed) {
    const r = rng(seed);
    const c = mk(100, 44); const g = c.getContext('2d');
    // thân xuồng: hai đầu nhọn
    const hull = (y0, col, edge) => {
      for (let x = 6; x <= 94; x++) {
        const t = (x - 50) / 44;
        const h = Math.round(7 * (1 - Math.pow(Math.abs(t), 2.2)));
        for (let y = 0; y <= h; y++) px(g, x, y0 + y, y === h ? edge : col);
      }
    };
    hull(28, '#6a4a2a', '#2a1a10');
    for (let x = 8; x <= 92; x += 5) { px(g, x, 30, '#8a6a42'); px(g, x + 1, 31, '#4a3018'); }
    line(g, 7, 27, 93, 27, '#a47a46', 1);
    line(g, 9, 28, 91, 28, '#2a1a10', 1);
    // hàng chất trên xuồng
    if (cargo) {
      const n = cargo === 'duahau' || cargo === 'dua' || cargo === 'bidao' ? 9 : 8;
      const items = [];
      for (let i = 0; i < n; i++) items.push({ x: 22 + (i % 5) * 11 + (i >= 5 ? 5 : 0), y: i >= 5 ? 14 : 19 });
      for (const it of items) g.drawImage(art.produce[cargo], it.x - 11, it.y - 8 + Math.round(r() * 1 - 0.5));
    }
    if (rower) {
      // người chèo đội nón lá ngồi ở đuôi xuồng
      rect(g, 14, 16, 9, 12, '#7a5a3a'); rect(g, 14, 16, 9, 1, '#a07c52');
      rect(g, 16, 9, 6, 6, '#e0a278'); rect(g, 16, 14, 6, 1, '#b97a52');
      for (let i = 0; i < 8; i++) rect(g, 19 - i * 1, 8 - Math.min(i, 3) + (i > 3 ? 1 : 0) * 0, 2 + i * 2, 1, '#e9d6a0');
      for (let y = 4; y <= 8; y++) { const w = (y - 3) * 3; rect(g, 19 - Math.round(w / 2), y, w, 1, y % 2 ? '#e9d6a0' : '#cdb77a'); }
      line(g, 22, 22, 4, 36, '#5a3f22', 1);   // mái chèo
    }
    return c;
  }
  art.boatFor = (cargo, rower, seed) => {
    const key = `${cargo || '-'}${rower ? 'r' : ''}${seed}`;
    if (!art.boat[key]) art.boat[key] = boat(cargo, rower, seed);
    return art.boat[key];
  };

  // ---------- nền cố định: bờ bên kia, nước, bến ván, nền chợ ----------
  const ground = mk(MW, MH); {
    const g = ground.getContext('2d');
    const r = rng(20261011);
    // nước
    rect(g, 0, 0, MW, RIVER_Y, '#3f8a9a');
    for (let y = 0; y < RIVER_Y; y += 2) for (let x = 0; x < MW; x += 2) { if (r() < 0.2) px(g, x, y, '#4a9aa8'); }
    // bờ bên kia: dải đất, dừa, nhà lá
    rect(g, 0, 0, MW, 20, '#4f8a3a');
    for (let x = 0; x < MW; x++) { const h = 18 + Math.round(Math.sin(x * 0.06) * 2 + r() * 2); rect(g, x, h, 1, 22 - h > 0 ? 3 : 1, '#3a6a2a'); }
    for (let x = 0; x < MW; x += 3) { rect(g, x, 20, 3, 4, '#6a5a3a'); }
    rect(g, 0, 24, MW, 2, '#2f5a6a');
    // nhà lá, dừa xa
    for (let k = 0; k < 8; k++) {
      const x = 40 + k * 96 + Math.round(r() * 30);
      if (k % 2 === 0) { rect(g, x, 8, 26, 10, '#7a5a3a'); for (let i = 0; i < 28; i++) rect(g, x - 1 + i, 4 + Math.abs(14 - i) * 0.0 + (i < 14 ? 14 - i : i - 14) * 0.3, 1, 6, '#9a7a4a'); rect(g, x + 10, 12, 6, 6, '#2a1a10'); }
      else { rect(g, x + 12, 0, 2, 20, '#5a3a22'); for (let a = -3; a <= 3; a++) line(g, x + 13, 2, x + 13 + a * 5, 2 + Math.abs(a) * 2 + 3, '#2f6a2a', 2); }
    }
    // bến ván
    rect(g, 0, RIVER_Y, MW, STREET_Y - RIVER_Y, '#8a6238');
    for (let x = 0; x < MW; x += 8) { rect(g, x, RIVER_Y, 1, STREET_Y - RIVER_Y, '#5e3f22'); }
    for (let y = RIVER_Y; y < STREET_Y; y += 6) { for (let x = Math.floor(r() * 8); x < MW; x += 24 + Math.floor(r() * 16)) px(g, x, y, '#a67c4a'); }
    for (let y = RIVER_Y; y < STREET_Y; y += 12) rect(g, 0, y, MW, 1, '#6e4a28');
    rect(g, 0, RIVER_Y, MW, 3, '#4a301a');
    rect(g, 0, RIVER_Y + 3, MW, 1, '#b78a52');
    // nền chợ: xi măng ẩm, vết bẩn, lá rau rơi
    rect(g, 0, STREET_Y, MW, MH - STREET_Y, '#8d8984');
    rect(g, 0, STREET_Y, MW, 2, '#5e5a56');
    for (let y = STREET_Y + 2; y < MH; y++) for (let x = 0; x < MW; x++) { const v = r(); if (v < 0.06) px(g, x, y, '#7b7773'); else if (v < 0.1) px(g, x, y, '#9a9690'); }
    for (let n = 0; n < 60; n++) { const x = Math.floor(r() * MW); const y = STREET_Y + 6 + Math.floor(r() * (MH - STREET_Y - 12)); const w = 6 + Math.floor(r() * 18); rect(g, x, y, w, 2, 'rgba(70,66,64,0.35)'); rect(g, x + 2, y + 2, w - 4, 1, 'rgba(70,66,64,0.25)'); }
    for (let n = 0; n < 150; n++) { const x = Math.floor(r() * MW); const y = STREET_Y + 8 + Math.floor(r() * (MH - STREET_Y - 14)); px(g, x, y, r() < 0.5 ? '#5a9a3a' : '#7ab84a'); if (r() < 0.5) px(g, x + 1, y, '#4a8a30'); }
    // đường nối khe xi măng
    for (let x = 0; x < MW; x += 80) rect(g, x, STREET_Y + 2, 1, MH - STREET_Y, 'rgba(60,56,54,0.35)');
    for (let y = STREET_Y + 60; y < MH; y += 80) rect(g, 0, y, MW, 1, 'rgba(60,56,54,0.35)');
    // mép bờ hai bên
    rect(g, 0, STREET_Y, 14, MH - STREET_Y, '#5a7a3a'); rect(g, MW - 14, STREET_Y, 14, MH - STREET_Y, '#5a7a3a');
    rect(g, 0, RIVER_Y, 14, STREET_Y - RIVER_Y, '#5a7a3a'); rect(g, MW - 14, RIVER_Y, 14, STREET_Y - RIVER_Y, '#5a7a3a');
    // bậc xuống bến về làng ở đáy chợ
    rect(g, 320, 488, 160, 32, '#8a6238'); for (let x = 320; x < 480; x += 8) rect(g, x, 488, 1, 32, '#5e3f22'); rect(g, 320, 488, 160, 2, '#4a301a');
  }
  art.ground = ground;

  // cột đèn ở bến: canvas 14 x 40
  const lamp = mk(14, 40); {
    const g = lamp.getContext('2d');
    rect(g, 6, 8, 3, 32, '#4a3a2a'); rect(g, 6, 8, 1, 32, '#7a644a');
    rect(g, 3, 4, 9, 6, '#1a1a22'); rect(g, 4, 5, 7, 4, '#ffe39a'); px(g, 5, 5, '#fff6d0');
  }
  art.lamp = lamp;

  // dây đèn nhỏ treo ở các sạp: bóng đèn
  const bulb = mk(7, 8); {
    const g = bulb.getContext('2d');
    rect(g, 3, 0, 1, 2, '#2a2a2a'); rect(g, 2, 2, 3, 4, '#ffe08a'); rect(g, 3, 3, 1, 2, '#fffbe0'); rect(g, 2, 6, 3, 1, '#c8a040');
  }
  art.bulb = bulb;
  return art;
}
