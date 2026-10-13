// GAME (tách riêng): map CHỢ MIỀN TÂY (có sông, có xuồng). Toàn bộ dựng bằng code, không dùng ảnh nền;
// chỉ ba nhân vật cô bán hàng là ảnh pixel của thầy (public/game/cho/*.png).
// File này chỉ chứa số liệu và logic (không vẽ): kích thước, sạp, vật cản, điểm tương tác, người mua tạm thời.
// Xóa cùng thư mục lib/game khi gỡ game.
export const MW = 900;                 // bề ngang thế giới (1 đơn vị = 1 điểm ảnh của map)
export const MH = 554;
export const CHAR_H = 36;
export const SPEED = 118;
export const ZONE_MAX = 10;

export const SKY_H = 40;               // dải trời phía trên cùng (mây, chim, sao, trăng)
export const WATER_Y = 58;             // từ đây là mặt nước; phía trên là bờ bên kia (cây, nhà lá, rạch nhỏ)
export const RIVER_Y = 118;            // nước đến đây; bên dưới là bến ván gỗ
export const DOCK_MIN = 136;           // chân đứng trên bến không lên quá y này
export const STREET_Y = 166;           // từ đây trở xuống là nền chợ
export const EXIT_Y = 532;             // đi xuống hết chợ thì ra bến về làng
export const BOTTOM_Y = 542;
export const CREEK_X = 690;            // cửa rạch nhỏ ở bờ bên kia (có cây cầu ván)
export const SPAWN = { x: MW / 2, y: EXIT_Y - 22 };

// độ to nhỏ theo chiều sâu (xa = nhỏ một chút)
export const depthScale = (y) => 0.9 + 0.2 * Math.max(0, Math.min(1, y / MH));

// ---------- các sạp ----------
// seller: tên ảnh cô bán trong public/game/cho (null = sạp chưa có người bán, chỉ có ghế nhựa, thầy sẽ thêm sau).
// goods: các loại rau củ bày trên sạp (khóa trong marketArt.js: PRODUCE). tarp: màu bạt.
export const STALLS = [
  { id: 0, cx: 160, base: 266, seller: 'ba-non-la', name: 'Bà bán trái cây', tarp: 'xanh',
    goods: [['thau', ['chuoi', 'chuoi', 'chuoi']], ['ro', ['xoai', 'xoai', 'xoai', 'xoai']], ['thau', ['buoi', 'buoi']], ['met', ['dua', 'dua', 'dua']]],
    text: 'Bà bán trái cây: Chuối sứ, xoài cát mới hái nè con. Mua về ăn ngọt lắm!' },
  { id: 1, cx: 450, base: 266, seller: 'co-rau', name: 'Cô bán rau', tarp: 'do',
    goods: [['ro', ['raumuong', 'raumuong', 'raumuong']], ['thau', ['hanhla', 'hanhla', 'caixanh']], ['met', ['khoqua', 'khoqua', 'muop']], ['ro', ['caixanh', 'caixanh', 'caixanh']]],
    text: 'Cô bán rau: Rau muống, cải xanh, hành lá mới cắt sáng nay. Mua mớ đi con!' },
  { id: 2, cx: 740, base: 266, seller: 'co-trung', name: 'Chị bán trứng', tarp: 'xanh',
    goods: [['ro', ['trung', 'trung', 'trung', 'trung']], ['met', ['trung', 'trung', 'trung']], ['thau', ['cachua', 'cachua', 'cachua']], ['ro', ['ot', 'ot', 'ot']]],
    text: 'Chị bán trứng: Trứng vịt tươi, cà chua, ớt nè. Em lựa thoải mái nha!' },
  { id: 3, cx: 160, base: 434, seller: null, name: 'Sạp rau củ (chưa có người bán)', tarp: 'soc',
    goods: [['ro', ['cachua', 'cachua', 'carot']], ['thau', ['carot', 'carot', 'carot']], ['met', ['bidao', 'bidao']], ['ro', ['bapcai', 'bapcai', 'bapcai']]],
    text: 'Sạp này chưa có người bán. Hàng đã bày sẵn, chắc cô đi lấy thêm hàng.' },
  { id: 4, cx: 450, base: 434, seller: null, name: 'Sạp rau (chưa có người bán)', tarp: 'xanh',
    goods: [['thau', ['dualeo', 'dualeo', 'dualeo']], ['ro', ['bapcai', 'bapcai']], ['met', ['muop', 'muop', 'khoqua']], ['thau', ['caixanh', 'caixanh', 'hanhla']]],
    text: 'Sạp này chưa có người bán. Em quay lại sau nhé.' },
  { id: 5, cx: 740, base: 434, seller: null, name: 'Sạp dưa trái (chưa có người bán)', tarp: 'do',
    goods: [['ro', ['duahau', 'duahau']], ['thau', ['dua', 'dua', 'dua']], ['met', ['chuoi', 'chuoi']], ['ro', ['bidao', 'duahau']]],
    text: 'Sạp này chưa có người bán. Dưa hấu, dừa đã bày sẵn rồi.' },
];
export const STALL_HALF = 58;          // nửa bề ngang chỗ không đi được của sạp

// ---------- xuồng neo ở bến (mỗi xuồng có hàng khác nhau) ----------
export const BOATS = [
  { id: 0, x: 140, y: RIVER_Y - 2, cargo: 'duahau', text: 'Xuồng chở dưa hấu từ miệt vườn về. Dưa nào cũng đỏ ruột, ngọt lịm!' },
  { id: 1, x: 350, y: RIVER_Y - 2, cargo: 'dua', text: 'Xuồng chở dừa xiêm. Chú chèo xuồng bảo: sáng sớm là hết nhẵn!' },
  { id: 2, x: 580, y: RIVER_Y - 2, cargo: 'bidao', text: 'Xuồng chở bí đao, bầu, mướp. Hàng mới hái dưới vườn sáng nay.' },
  { id: 3, x: 790, y: RIVER_Y - 2, cargo: 'chuoi', text: 'Xuồng chở chuối, xoài. Mùi trái chín thơm cả khúc sông.' },
];
// xuồng chạy chầm chậm trên sông (chỉ để trang trí), có người chèo đội nón lá. y là mực nước chỗ thân xuồng.
export const RIVER_BOATS = [
  { x0: 60, y: 78, speed: 8, dir: 1, cargo: 'bidao' },
  { x0: 560, y: 90, speed: 6, dir: -1, cargo: 'chuoi' },
  { x0: 300, y: 72, speed: 7, dir: 1, cargo: null },
  { x0: 820, y: 100, speed: 5, dir: -1, cargo: 'dua' },
  { x0: 430, y: 84, speed: 9, dir: 1, cargo: 'duahau' },
];

// ---------- trời, mây, chim, cây ----------
// mây trôi theo gió: k là kiểu mây (0, 1, 2), y là độ cao trong dải trời, sp là tốc độ (đơn vị/giây)
export const CLOUDS = [
  { x0: 40, y: 3, sp: 5, k: 0 }, { x0: 230, y: 12, sp: 3.5, k: 1 }, { x0: 430, y: 2, sp: 6, k: 2 },
  { x0: 610, y: 14, sp: 4, k: 0 }, { x0: 780, y: 5, sp: 5.5, k: 1 }, { x0: 140, y: 18, sp: 2.8, k: 2 },
];
// đàn cò trắng bay lượn (n con, xếp hình chữ V), và én bay nhanh, thấp hơn
export const FLOCKS = [
  { x0: 100, y: 22, sp: 15, dir: 1, n: 5, kind: 'co' },
  { x0: 650, y: 40, sp: 11, dir: -1, n: 3, kind: 'co' },
  { x0: 380, y: 96, sp: 23, dir: 1, n: 4, kind: 'en' },
  { x0: 800, y: 150, sp: 27, dir: -1, n: 3, kind: 'en' },
  { x0: 260, y: 230, sp: 20, dir: 1, n: 3, kind: 'en' },
];

function mulb(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// cây ở bờ bên kia sông (chân ở y = WATER_Y - 3). Dùng bộ số cố định để mọi máy giống nhau.
export const FAR_TREES = (() => {
  const r = mulb(77123);
  const list = [];
  for (let x = 10; x < MW - 6; x += 18 + Math.floor(r() * 22)) {
    if (Math.abs(x - CREEK_X) < 34) continue;
    const q = r();
    list.push({ x, y: WATER_Y - 3 + Math.round(r() * 2), kind: q < 0.42 ? 'palmS' : q < 0.62 ? 'palmF' : q < 0.78 ? 'chuoi' : q < 0.9 ? 'nipa' : 'bui', ph: r() * 6 });
  }
  return list;
})();
// cây ở hai mép chợ phía gần (dừa, chuối, tre, bụi), vẽ sắp theo độ sâu cùng với người
export const NEAR_TREES = (() => {
  const r = mulb(40519);
  const list = [];
  for (const side of [0, 1]) {
    let y = DOCK_MIN + 4 + Math.floor(r() * 10);
    while (y < BOTTOM_Y - 4) {
      const q = r();
      const kind = q < 0.34 ? 'palm' : q < 0.58 ? 'chuoi' : q < 0.76 ? 'tre' : q < 0.9 ? 'bui' : 'nipa';
      list.push({ x: side ? MW - 9 + Math.round(r() * 3) : 9 - Math.round(r() * 3), y, kind, ph: r() * 6 });
      y += 34 + Math.floor(r() * 30);
    }
  }
  // hai bụi cây ở đáy chợ, hai bên bến về làng
  list.push({ x: MW / 2 - 100, y: BOTTOM_Y + 1, kind: 'bui', ph: 1 }, { x: MW / 2 + 100, y: BOTTOM_Y + 1, kind: 'bui', ph: 4 });
  list.sort((a, b) => a.y - b.y);
  return list;
})();

// ---------- vật cản ----------
const POSTS = [];                      // cột đèn ở bến
for (const x of [56, 245, 450, 655, 844]) POSTS.push({ x, y: RIVER_Y + 28 });
export const LAMP_POSTS = POSTS;

function stallRects() {
  return STALLS.map((s) => ({ x0: s.cx - STALL_HALF - 3, x1: s.cx + STALL_HALF + 3, y0: s.base - 100, y1: s.base + 12 }));
}
const RECTS = stallRects();

export function marketBlocked(x, y) {
  if (x < 24 || x > MW - 24 || y < DOCK_MIN || y > BOTTOM_Y) return true;
  for (const r of RECTS) if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return true;
  for (const p of POSTS) if (Math.abs(x - p.x) < 5 && y > p.y - 4 && y < p.y + 3) return true;
  return false;
}

// ---------- điểm tương tác ----------
export const EXIT_TEXT = 'Xuống bến, đi xuồng về làng quê.';
export function marketNearest(x, y) {
  if (y > EXIT_Y - 28 && x > MW / 2 - 100 && x < MW / 2 + 100) return { id: 've_lang', label: 'Về làng quê' };
  for (const s of STALLS) {
    if (Math.abs(x - s.cx) < STALL_HALF + 12 && y > s.base + 12 && y < s.base + 48) {
      return { id: `sap-${s.id}`, label: s.seller ? `Hỏi mua hàng của ${s.name.toLowerCase()}` : 'Xem sạp hàng', stall: s.id };
    }
  }
  for (const b of BOATS) {
    if (Math.abs(x - b.x) < 56 && y < STREET_Y + 2) return { id: `xuong-${b.id}`, label: 'Xem xuồng bán hàng', boat: b.id };
  }
  return null;
}
export function interactText(it) {
  if (!it) return '';
  if (it.id === 've_lang') return EXIT_TEXT;
  if (it.stall !== undefined) return STALLS[it.stall].text;
  if (it.boat !== undefined) return BOATS[it.boat].text;
  return '';
}

// ---------- người mua TẠM THỜI (sau này thầy thay bằng nhân vật riêng) ----------
// Để thêm nhân vật người mua riêng: bỏ ảnh pixel (nền trong) vào public/game/cho/ và thêm một dòng vào BUYER_IMAGES.
// h: chiều cao khi vẽ (đơn vị map, nhân vật chơi cao 36). Các ảnh này sẽ được gán lần lượt cho những người mua đầu tiên.
export const BUYER_IMAGES = [];        // ví dụ: { src: '/game/cho/khach-1.png', h: 34 }
export const BUYER_COUNT = 16;

// đồ thị đường đi của người mua: bến -> các lối giữa sạp -> lối đi giữa hai hàng sạp
const COLS = [60, 305, 595, 840];       // bốn lối dọc (giữa các sạp và hai mép)
const AY = 308;                         // lối đi A (trước hàng sạp trên)
const BY = 486;                         // lối đi B (trước hàng sạp dưới)
const DY = 150;                         // bến ván
export function buildGraph() {
  const nodes = [];
  const add = (x, y, watch) => { nodes.push({ x, y, watch: !!watch, nb: [] }); return nodes.length - 1; };
  const link = (a, b) => { nodes[a].nb.push(b); nodes[b].nb.push(a); };
  // bến: các điểm đứng xem xuồng xen giữa các lối
  const dock = [];
  const dockXs = [...COLS.map((x) => [x, 0]), ...BOATS.map((b) => [b.x, 1])].sort((a, b) => a[0] - b[0]);
  for (const [x, w] of dockXs) dock.push(add(x, DY, w));
  for (let i = 0; i < dock.length - 1; i++) link(dock[i], dock[i + 1]);
  // hai lối đi ngang A và B, mỗi sạp có một điểm đứng mua ngay trước sạp
  const rowChain = (y, row) => {
    const chain = [];
    const xs = [];
    for (let i = 0; i < 3; i++) xs.push(STALLS[row * 3 + i].cx);
    const all = [...COLS.map((x) => ({ x, s: -1 })), ...xs.map((x, i) => ({ x, s: i }))].sort((a, b) => a.x - b.x);
    for (const p of all) chain.push({ id: add(p.x, y, false), s: p.s, x: p.x });
    for (let i = 0; i < chain.length - 1; i++) link(chain[i].id, chain[i + 1].id);
    for (const c of chain) {
      if (c.s >= 0) {
        const st = STALLS[row * 3 + c.s];
        const f = add(c.x, st.base + 28, true);
        link(c.id, f);
      }
    }
    return chain;
  };
  const A = rowChain(AY, 0);
  const B = rowChain(BY, 1);
  // lối dọc nối bến - A - B tại bốn cột
  for (let ci = 0; ci < COLS.length; ci++) {
    const d = dock.find((n) => nodes[n].x === COLS[ci]);
    const a = A.find((c) => c.x === COLS[ci] && c.s === -1);
    const b = B.find((c) => c.x === COLS[ci] && c.s === -1);
    link(d, a.id); link(a.id, b.id);
  }
  return nodes;
}

// người mua: vị trí, đích đến, thời gian đứng chờ. Mỗi máy tự cho họ đi lại (chưa đồng bộ giữa các máy).
export function makeBuyers(n = BUYER_COUNT, rnd = Math.random) {
  const nodes = buildGraph();
  const list = [];
  for (let i = 0; i < n; i++) {
    let at = Math.floor(rnd() * nodes.length);
    list.push({
      id: i, nodes, at, prev: -1, x: nodes[at].x, y: nodes[at].y, tx: nodes[at].x, ty: nodes[at].y,
      speed: 30 + rnd() * 16, wait: rnd() * 3, dir: 'front', facing: 1, walk: false, phase: 0, frame: 0,
      img: BUYER_IMAGES[i] || null, frames: null,
    });
  }
  return list;
}

export function stepBuyer(b, dt, rnd = Math.random) {
  const nodes = b.nodes;
  if (b.wait > 0) {
    b.wait -= dt;
    b.walk = false;
    if (b.wait <= 0) {
      // chọn nơi tiếp theo: thích ghé sạp, tránh quay lại chỗ vừa đi
      const cur = nodes[b.at];
      let cand = cur.nb.filter((k) => k !== b.prev);
      if (!cand.length) cand = cur.nb.slice();
      const watch = cand.filter((k) => nodes[k].watch);
      const pick = watch.length && rnd() < 0.7 ? watch : cand;
      const nx = pick[Math.floor(rnd() * pick.length)];
      b.prev = b.at; b.next = nx; b.tx = nodes[nx].x; b.ty = nodes[nx].y;
    }
    return;
  }
  const dx = b.tx - b.x;
  const dy = b.ty - b.y;
  const d = Math.hypot(dx, dy);
  const step = b.speed * dt;
  if (d <= step) {
    b.x = b.tx; b.y = b.ty; b.at = b.next === undefined ? b.at : b.next; b.walk = false;
    const w = nodes[b.at].watch;
    b.wait = w ? 2.5 + rnd() * 3.5 : 0.1 + rnd() * 0.8;
    if (w) { b.dir = 'back'; }
    return;
  }
  b.x += (dx / d) * step; b.y += (dy / d) * step;
  b.walk = true;
  if (Math.abs(dx) > Math.abs(dy) * 1.2) { b.dir = 'side'; b.facing = dx > 0 ? 1 : -1; } else b.dir = dy < 0 ? 'back' : 'front';
}

export const MARKET_TITLE = 'Chợ miền Tây';
