// GAME (tách riêng): tranh pixel của chợ miền Tây vẽ bằng code (rau củ, thau rổ, bạt che, xuồng, nền chợ, nền bến).
// Không phụ thuộc trình duyệt: nhận hàm mk(w, h) trả về canvas (trình duyệt: document.createElement; thử bằng Node: @napi-rs/canvas).
import { CREEK_X, MH, MW, RIVER_Y, SKY_H, STALLS, STREET_Y, WATER_Y } from './market';

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

  // ---------- hàng đặc biệt trên xuồng: cá, thịt, hủ tiếu, hoa (toạ độ trong khung xuồng 100 x 44; xuồng cao hơn thì tự dời xuống) ----------
  const fishH = (g, x, y) => {                                   // cá treo (đầu ở trên)
    ell(g, x, y, 2.4, 6.5, '#8fa0b0', '#dbe6ec', '#5a6a78');
    line(g, x, y + 6, x - 2, y + 9, '#6a7a88', 1); line(g, x, y + 6, x + 2, y + 9, '#6a7a88', 1);
    px(g, x, y - 4, '#1a1a22');
  };
  const fishF = (g, x, y, len = 5) => {                          // cá nằm ngang (đầu bên phải)
    ell(g, x, y, len, 2.2, '#9aaab8', '#dbe6ec', '#5a6a78');
    line(g, x - len, y, x - len - 3, y - 2, '#6a7a88', 1); line(g, x - len, y, x - len - 3, y + 2, '#6a7a88', 1);
    px(g, x + len - 2, y - 1, '#1a1a22');
  };
  const rack = (g) => {                                          // giàn tre treo hàng
    rect(g, 52, 3, 2, 25, '#8a6a3a'); rect(g, 52, 3, 1, 25, '#b0904f');
    rect(g, 90, 3, 2, 25, '#8a6a3a'); rect(g, 90, 3, 1, 25, '#b0904f');
    rect(g, 51, 4, 42, 2, '#a07c52'); rect(g, 51, 4, 42, 1, '#c4a06a');
    rect(g, 52, 3, 2, 3, '#4a301a'); rect(g, 90, 3, 2, 3, '#4a301a');
  };
  const basket = (g, x, y, w, h, col = '#8a6232', hi = '#c49a52') => {
    rect(g, x, y, w, h, '#2a1a10'); rect(g, x + 1, y + 1, w - 2, h - 1, col); rect(g, x + 1, y + 1, w - 2, 1, hi);
    for (let i = x + 2; i < x + w - 2; i += 3) px(g, i, y + 3, '#6a4a22');
  };
  function cargoCa(g) {
    rack(g);
    for (const x of [58, 66, 74, 82]) { px(g, x, 6, '#8a929a'); px(g, x, 7, '#8a929a'); fishH(g, x, 14); }
    rect(g, 28, 18, 21, 10, '#1a1a22'); rect(g, 29, 19, 19, 9, '#eef2f4'); rect(g, 29, 19, 19, 1, '#ffffff'); rect(g, 29, 26, 19, 2, '#c8d2d8');
    for (let i = 0; i < 3; i++) fishF(g, 35 + i * 5, 19, 3.5);
    basket(g, 52, 21, 26, 7); fishF(g, 59, 21); fishF(g, 66, 20); fishF(g, 72, 21);
    ell(g, 85, 25, 6, 3, '#d8342a', '#ff6a58', '#8f1d18'); fishF(g, 84, 23, 3.5);
  }
  function cargoThit(g) {
    rack(g);
    const cols = [['#c43a4a', '#f08a96'], ['#e8909c', '#ffd0d6'], ['#c43a4a', '#f08a96'], ['#e8909c', '#ffd0d6']];
    [58, 66, 74, 82].forEach((x, i) => {
      px(g, x, 6, '#8a929a'); px(g, x, 7, '#8a929a');
      rect(g, x - 3, 8, 6, 14, '#2a1a10'); rect(g, x - 2, 8, 4, 13, cols[i][0]); rect(g, x - 2, 9, 1, 11, cols[i][1]); rect(g, x, 14, 2, 1, '#fff0f0');
    });
    rect(g, 28, 19, 13, 9, '#2a1a10'); rect(g, 29, 20, 11, 8, '#6a4a2a'); ell(g, 34, 19, 5.4, 2, '#a07c52', '#c4a06a', '#6a4a2a');
    rect(g, 32, 13, 6, 5, '#2a1a10'); rect(g, 33, 13, 4, 4, '#c8ced4'); rect(g, 29, 16, 4, 2, '#5a3a1e');
    rect(g, 44, 22, 22, 6, '#2a1a10'); rect(g, 45, 23, 20, 5, '#9aa2aa'); rect(g, 45, 23, 20, 1, '#d4dae0');
    rect(g, 47, 19, 6, 4, '#d44a5a'); rect(g, 54, 20, 5, 3, '#e89aa4'); rect(g, 60, 19, 5, 4, '#c43a4a'); rect(g, 47, 19, 6, 1, '#f08a96');
    ell(g, 77, 25, 5, 3, '#8a929a', '#d4dae0', '#5a626a'); rect(g, 74, 22, 6, 2, '#e89aa4');
    basket(g, 82, 22, 10, 6, '#d8a42a', '#f5d04a'); rect(g, 83, 19, 8, 3, '#4a9a34'); rect(g, 84, 18, 4, 2, '#78c050');
  }
  function cargoHuTieu(g) {
    rect(g, 30, 21, 22, 7, '#2a1a10'); rect(g, 31, 21, 20, 6, '#8a929a'); rect(g, 31, 21, 20, 1, '#d4dae0');
    rect(g, 29, 19, 24, 3, '#6a727a'); rect(g, 29, 19, 24, 1, '#c8ced4'); rect(g, 39, 16, 4, 3, '#4a4a52');
    for (const [x, y] of [[36, 14], [40, 11], [38, 8], [42, 5], [45, 9]]) rect(g, x, y, 2, 2, 'rgba(255,255,255,0.75)');
    for (let i = 0; i < 4; i++) { rect(g, 56 - (i % 2), 22 - i * 2, 11, 2, '#2a1a10'); rect(g, 57 - (i % 2), 22 - i * 2, 9, 1, '#f4f4f0'); rect(g, 57 - (i % 2), 22 - i * 2, 9, 1, i % 2 ? '#f4f4f0' : '#cfe0f4'); }
    rect(g, 56, 24, 11, 4, '#2a1a10'); rect(g, 57, 24, 9, 3, '#f4f4f0'); rect(g, 57, 25, 9, 1, '#3a6ab0');
    rect(g, 72, 18, 9, 10, '#2a1a10'); rect(g, 73, 19, 7, 8, '#d8342a'); rect(g, 73, 19, 7, 1, '#ff6a58'); rect(g, 74, 27, 1, 1, '#8f1d18');
    basket(g, 84, 22, 9, 6, '#8a6232'); rect(g, 85, 19, 7, 3, '#4a9a34'); rect(g, 86, 18, 3, 2, '#78c050');
    rect(g, 79, 2, 1, 8, '#4a301a'); rect(g, 74, 2, 6, 1, '#4a301a');
    ell(g, 74, 12, 3, 4, '#d8342a', '#ff6a58', '#8f1d18'); rect(g, 73, 7, 3, 1, '#f0b44a'); rect(g, 73, 16, 3, 1, '#f0b44a');
  }
  function cargoHoa(g) {
    const flowers = [['#f06aa0', '#ff9ac4'], ['#f5d04a', '#fff08a'], ['#ffffff', '#f4f0f0'], ['#9a5ad0', '#c490f0'], ['#e8342a', '#ff7a6a']];
    for (let i = 0; i < 5; i++) {
      const x = 28 + i * 13;
      rect(g, x + 4, 12, 1, 12, '#3a8a30'); rect(g, x + 2, 15, 1, 8, '#4a9a34'); rect(g, x + 6, 14, 1, 9, '#4a9a34');
      for (const [dx, dy, r2] of [[2, 11, 3], [5, 8, 3.4], [8, 12, 3]]) ell(g, x + dx, dy + (i % 2) * 2, r2, r2, flowers[i][0], flowers[i][1], '#2a1a10');
      rect(g, x, 21, 10, 7, '#1a1a22'); rect(g, x + 1, 22, 8, 6, i % 2 ? '#3a6ab0' : '#d8342a'); rect(g, x + 1, 22, 8, 1, i % 2 ? '#6a9ae0' : '#ff6a58');
    }
  }
  const CARGO_FN = { ca: cargoCa, thit: cargoThit, hutieu: cargoHuTieu, hoa: cargoHoa };
  const CARGO_TALL = { ca: 1, thit: 1 };

  // ---------- xuồng ba lá (canvas 100 x 44; xuồng có giàn treo hàng cao hơn 60; mũi bên phải) ----------
  function boat(cargo, rower, seed) {
    const r = rng(seed);
    const H = CARGO_TALL[cargo] ? 60 : 44;
    const c = mk(100, H); const g = c.getContext('2d');
    g.translate(0, H - 44);
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
    if (cargo && CARGO_FN[cargo]) CARGO_FN[cargo](g);
    else if (cargo) {
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

  // ---------- cây (ảnh neo ở chân giữa) ----------
  const frond = (g, cx, cy, dx, lift, droop, len, c1, c2) => {
    let x0 = cx; let y0 = cy;
    const steps = Math.max(8, Math.round(len));
    const sgn = dx >= 0 ? 1 : -1;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = cx + dx * len * t;
      const y = cy - lift * (len / 30) * t + droop * (len / 30) * t * t;
      line(g, x0, y0, x, y, c1, 2);
      if (i % 2 === 0 && t > 0.12) {
        line(g, x, y, x + sgn, y + 4, c2, 1);
        px(g, x, y - 1, c2);
      }
      x0 = x; y0 = y;
    }
  };
  function palm(H) {
    const len = Math.round(H * 0.36);
    const cy = Math.round(len * 0.62) + 3;
    const W = len * 2 + 16;
    const Ht = H + cy + 2;
    const c = mk(W, Ht); const g = c.getContext('2d');
    const cx = W / 2; const lean = H > 70 ? 5 : 3;
    const baseX = cx - lean; const baseY = Ht - 1; const topX = cx; const topY = cy + 2;
    for (let i = 0; i <= H; i++) {
      const t = i / H;
      const x = baseX + (topX - baseX) * t - Math.sin(t * Math.PI) * 2;
      const y = baseY - (baseY - topY) * t;
      const w = t < 0.1 ? 5 : t > 0.8 ? 2 : 3;
      rect(g, x - Math.floor(w / 2), y, w, 1, i % 4 === 0 ? '#6a4a2a' : '#8a6a42');
      px(g, x - Math.floor(w / 2), y, '#b8925c');
    }
    for (const [dx, lift, droop] of [[-1, 8, 18], [-0.8, 16, 10], [-0.45, 20, 4], [0.45, 20, 4], [0.8, 16, 10], [1, 8, 18], [0, 22, 2]]) {
      frond(g, topX, topY, dx, lift, droop, len, '#2f7a2a', '#5ab03a');
    }
    ell(g, topX - 2, topY + 3, 2.4, 2.4, '#6f8a2a', '#9ab84a', '#4a5e1a');
    ell(g, topX + 2, topY + 4, 2.4, 2.4, '#6f8a2a', '#9ab84a', '#4a5e1a');
    return c;
  }
  function banana() {
    const c = mk(44, 50); const g = c.getContext('2d');
    stick(g, 22, 49, 22, 22, 4, '#7aa44a', '#a8cc72');
    const leaf = (dx, dy, th) => {
      line(g, 22, 22, 22 + dx, 22 + dy, '#3f9a34', th);
      line(g, 22 + dx, 22 + dy, 22 + dx * 1.12, 22 + dy + 6, '#2f7a2a', th - 1);
      line(g, 22, 22, 22 + dx, 22 + dy, '#cfe9a0', 1);
      line(g, 22, 21, 22 + dx, 21 + dy, '#7bd04f', 1);
    };
    leaf(-17, -5, 5); leaf(-15, 6, 5); leaf(17, -5, 5); leaf(15, 6, 5); leaf(-7, -15, 4); leaf(7, -15, 4);
    ell(g, 26, 28, 3, 4, '#7ac24a', '#b0e070', '#4f8a30');
    ell(g, 26, 34, 2, 3, '#8a2a4a', '#c04a70', '#5a1a30');
    return c;
  }
  function tre() {
    const c = mk(40, 76); const g = c.getContext('2d');
    [[10, -7], [16, -3], [22, 0], [28, 3], [33, 7]].forEach(([x, lean], i) => {
      const h = 52 + (i % 2) * 10 + (i === 2 ? 6 : 0);
      for (let y = 0; y < h; y++) {
        const t = y / h; const xx = x + lean * t * t; const node = y % 8 === 0;
        px(g, xx, 75 - y, node ? '#4a7a2a' : '#8cc457');
        px(g, xx + 1, 75 - y, node ? '#3a6a22' : '#5a9a38');
      }
      const tx = x + lean; const ty = 75 - h;
      for (let k = 0; k < 7; k++) {
        const a = (k - 3) * 0.5;
        line(g, tx, ty + 5, tx + Math.sin(a) * 11, ty + 5 - Math.cos(a) * 6 + Math.abs(Math.sin(a)) * 6, k % 2 ? '#3f9a34' : '#5cb445', 1);
      }
    });
    return c;
  }
  function bui() {
    const c = mk(30, 18); const g = c.getContext('2d');
    ell(g, 9, 11, 8, 6, '#3f8a34', '#6cc650', '#2a6024');
    ell(g, 20, 11, 8, 6, '#459a3a', '#78d458', '#2f6a28');
    ell(g, 15, 7, 8, 6, '#4fa43a', '#8be05a', '#2f7a2a');
    for (const [x, y, cl] of [[8, 8, '#f5e050'], [19, 6, '#f5e050'], [14, 12, '#ff8aa0'], [23, 11, '#ff8aa0']]) px(g, x, y, cl);
    return c;
  }
  function nipa() {
    const c = mk(40, 30); const g = c.getContext('2d');
    for (const [dx, up] of [[-17, 12], [-12, 19], [-6, 25], [0, 27], [6, 25], [12, 19], [17, 12]]) {
      line(g, 20, 29, 20 + dx, 29 - up, '#2f7a2a', 2);
      line(g, 20, 28, 20 + dx, 28 - up, '#5ab03a', 1);
      for (let i = 1; i < 5; i++) { const x = 20 + dx * (i / 5); const y = 29 - up * (i / 5); line(g, x, y, x + (dx > 0 ? 2 : -2), y + 4, '#3f9a34', 1); }
    }
    return c;
  }
  art.tree = { palm: palm(84), palmF: palm(42), palmS: palm(32), chuoi: banana(), tre: tre(), bui: bui(), nipa: nipa() };

  // ---------- mây (ba kiểu) ----------
  function cloud(parts, w, h) {
    const c = mk(w, h); const g = c.getContext('2d');
    for (const [x, y, rx, ry] of parts) ell(g, x, y, rx, ry, '#f6fbff', '#ffffff', '#cfe2ee', '#f0f8fc');
    return c;
  }
  art.cloud = [
    cloud([[18, 17, 15, 7], [38, 12, 17, 10], [60, 14, 19, 9], [78, 18, 13, 6]], 96, 28),
    cloud([[14, 13, 12, 6], [30, 9, 14, 8], [48, 13, 13, 6]], 64, 24),
    cloud([[22, 19, 20, 8], [46, 14, 22, 11], [72, 17, 20, 9], [96, 20, 14, 6], [34, 10, 12, 7]], 120, 32),
  ];

  // ---------- nền cố định: trời, bờ bên kia, rạch, sông, bến ván, nền chợ ----------
  const mix = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  const ground = mk(MW, MH); {
    const g = ground.getContext('2d');
    const r = rng(20261011);
    // trời nhạt dần về chân trời
    for (let y = 0; y < SKY_H + 4; y += 2) rect(g, 0, y, MW, 2, mix([104, 184, 232], [206, 238, 250], y / (SKY_H + 4)));
    // hai lớp rặng cây xa mờ sương
    for (let x = 0; x < MW; x++) {
      const h = 7 + Math.round(3 * Math.sin(x * 0.045) + 2 * Math.sin(x * 0.11 + 1) + r() * 1.5);
      rect(g, x, SKY_H + 3 - h, 1, h, '#9cc29a');
      const h2 = 4 + Math.round(2 * Math.sin(x * 0.07 + 2) + r());
      rect(g, x, SKY_H + 3 - h2, 1, h2, '#86b480');
    }
    // bờ bên kia: cỏ, bùn mép nước, nhà lá
    rect(g, 0, SKY_H + 3, MW, WATER_Y - SKY_H - 3, '#58923e');
    for (let n = 0; n < 420; n++) { const x = Math.floor(r() * MW); const y = SKY_H + 3 + Math.floor(r() * (WATER_Y - SKY_H - 6)); px(g, x, y, r() < 0.5 ? '#4a8234' : '#6aa84a'); }
    rect(g, 0, WATER_Y - 4, MW, 3, '#6a5a3a'); rect(g, 0, WATER_Y - 2, MW, 2, '#4a3e28');
    for (const hx of [70, 255, 470, 590, 805]) {
      const by = WATER_Y - 5;
      rect(g, hx, by - 9, 22, 9, '#7a5a3a'); rect(g, hx, by - 9, 22, 1, '#9a7a4a');
      for (let k = 0; k < 7; k++) { const w = 12 + k * 3; rect(g, hx + 11 - Math.floor(w / 2), by - 16 + k, w, 1, k % 2 ? '#a48650' : '#8a6a3a'); }
      rect(g, hx + 9, by - 6, 5, 6, '#2a1a10'); rect(g, hx + 2, by - 7, 4, 3, '#caa86a');
    }
    // rạch nhỏ chảy ra sông, có cây cầu ván bắc qua
    for (let y = SKY_H + 3; y < WATER_Y; y++) {
      const w = Math.round(6 + (y - SKY_H - 3) * 0.75);
      rect(g, CREEK_X - w - 2, y, 2 * w + 4, 1, '#4a3e28');
      rect(g, CREEK_X - w, y, 2 * w, 1, y < WATER_Y - 6 ? '#3a7e8e' : '#5aaab6');
    }
    rect(g, CREEK_X - 24, 49, 48, 3, '#6a4a2a'); rect(g, CREEK_X - 24, 49, 48, 1, '#9a7240');
    for (let x = CREEK_X - 24; x < CREEK_X + 24; x += 4) rect(g, x, 49, 1, 3, '#4a301a');
    for (const x of [CREEK_X - 24, CREEK_X - 8, CREEK_X + 8, CREEK_X + 22]) rect(g, x, 44, 2, 8, '#4a301a');
    rect(g, CREEK_X - 24, 44, 48, 1, '#4a301a'); rect(g, CREEK_X - 24, 46, 48, 1, '#6a4a2a');
    for (const x of [CREEK_X - 14, CREEK_X + 14]) rect(g, x, 52, 2, 5, '#3a2614');
    // mặt sông: nước sẫm dần ra giữa dòng
    const bands = ['#62b0bb', '#56a4b2', '#4b98a8', '#418c9d', '#3c8496', '#41909f', '#4a9aa6'];
    for (let y = WATER_Y; y < RIVER_Y; y++) {
      const t = (y - WATER_Y) / (RIVER_Y - WATER_Y);
      rect(g, 0, y, MW, 1, bands[Math.min(bands.length - 1, Math.floor(t * bands.length))]);
    }
    for (let y = WATER_Y; y < RIVER_Y; y++) for (let x = 0; x < MW; x += 2) if (r() < 0.14) px(g, x + (y % 2), y, r() < 0.5 ? '#6cbcc6' : '#37798b');
    // bóng bờ bên kia soi xuống nước
    {
      const tmp = mk(MW, WATER_Y); tmp.getContext('2d').drawImage(ground, 0, 0, MW, WATER_Y, 0, 0, MW, WATER_Y);
      const sh = 24;
      g.save(); g.globalAlpha = 0.3; g.translate(0, WATER_Y); g.scale(1, -1);
      g.drawImage(tmp, 0, WATER_Y - sh, MW, sh, 0, -sh, MW, sh);
      g.restore();
    }
    // bến ván
    rect(g, 0, RIVER_Y, MW, STREET_Y - RIVER_Y, '#8a6238');
    for (let x = 0; x < MW; x += 8) { rect(g, x, RIVER_Y, 1, STREET_Y - RIVER_Y, '#5e3f22'); }
    for (let y = RIVER_Y; y < STREET_Y; y += 6) { for (let x = Math.floor(r() * 8); x < MW; x += 24 + Math.floor(r() * 16)) px(g, x, y, '#a67c4a'); }
    for (let y = RIVER_Y; y < STREET_Y; y += 12) rect(g, 0, y, MW, 1, '#6e4a28');
    rect(g, 0, RIVER_Y, MW, 3, '#4a301a');
    rect(g, 0, RIVER_Y + 3, MW, 1, '#b78a52');
    for (let x = 14; x < MW; x += 46) { rect(g, x, RIVER_Y - 7, 4, 8, '#3a2614'); rect(g, x, RIVER_Y - 7, 1, 8, '#6a4a2a'); rect(g, x - 1, RIVER_Y - 8, 6, 2, '#5a3a1e'); }
    rect(g, 0, RIVER_Y - 2, MW, 2, 'rgba(20,60,70,0.30)');
    // nền chợ: xi măng ẩm, vết bẩn, lá rau rơi
    rect(g, 0, STREET_Y, MW, MH - STREET_Y, '#8d8984');
    rect(g, 0, STREET_Y, MW, 2, '#5e5a56');
    for (let y = STREET_Y + 2; y < MH; y++) for (let x = 0; x < MW; x++) { const v = r(); if (v < 0.06) px(g, x, y, '#7b7773'); else if (v < 0.1) px(g, x, y, '#9a9690'); }
    for (let n = 0; n < 70; n++) { const x = Math.floor(r() * MW); const y = STREET_Y + 6 + Math.floor(r() * (MH - STREET_Y - 12)); const w = 6 + Math.floor(r() * 18); rect(g, x, y, w, 2, 'rgba(70,66,64,0.35)'); rect(g, x + 2, y + 2, w - 4, 1, 'rgba(70,66,64,0.25)'); }
    for (let n = 0; n < 170; n++) { const x = Math.floor(r() * MW); const y = STREET_Y + 8 + Math.floor(r() * (MH - STREET_Y - 14)); px(g, x, y, r() < 0.5 ? '#5a9a3a' : '#7ab84a'); if (r() < 0.5) px(g, x + 1, y, '#4a8a30'); }
    for (let x = 0; x < MW; x += 80) rect(g, x, STREET_Y + 2, 1, MH - STREET_Y, 'rgba(60,56,54,0.35)');
    for (let y = STREET_Y + 60; y < MH; y += 80) rect(g, 0, y, MW, 1, 'rgba(60,56,54,0.35)');
    // mép bờ cỏ hai bên (nơi trồng dừa, chuối, tre)
    for (const [y0, y1] of [[RIVER_Y, MH]]) {
      for (const x0 of [0, MW - 22]) {
        rect(g, x0, y0, 22, y1 - y0, '#5a7a3a');
        for (let n = 0; n < 260; n++) px(g, x0 + Math.floor(r() * 22), y0 + Math.floor(r() * (y1 - y0)), r() < 0.5 ? '#4a6a2e' : '#78a04a');
        rect(g, x0 === 0 ? 22 : MW - 23, y0, 1, y1 - y0, '#3f5a2a');
      }
    }
    // bậc xuống bến về làng ở đáy chợ
    const sx = MW / 2 - 80;
    rect(g, sx, MH - 32, 160, 32, '#8a6238'); for (let x = sx; x < sx + 160; x += 8) rect(g, x, MH - 32, 1, 32, '#5e3f22'); rect(g, sx, MH - 32, 160, 2, '#4a301a');
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
