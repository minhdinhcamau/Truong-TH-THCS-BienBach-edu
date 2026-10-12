// GAME (tách riêng): map CHỢ MIỀN TÂY (có sông, có xuồng). Toàn bộ dựng bằng code, không dùng ảnh nền;
// chỉ ba nhân vật cô bán hàng là ảnh pixel của thầy (public/game/cho/*.png).
// File này chỉ chứa số liệu và logic (không vẽ): kích thước, sạp, vật cản, điểm tương tác, người mua tạm thời.
// Xóa cùng thư mục lib/game khi gỡ game.
export const MW = 800;                 // bề ngang thế giới (1 đơn vị = 1 điểm ảnh của map)
export const MH = 520;
export const CHAR_H = 36;
export const SPEED = 118;
export const ZONE_MAX = 10;

export const RIVER_Y = 84;             // nước từ y = 0 đến đây; bên dưới là bến ván gỗ
export const DOCK_MIN = 102;           // chân đứng trên bến không lên quá y này
export const STREET_Y = 132;           // từ đây trở xuống là nền chợ
export const EXIT_Y = 498;             // đi xuống hết chợ thì ra bến về làng
export const BOTTOM_Y = 508;

// độ to nhỏ theo chiều sâu (xa = nhỏ một chút)
export const depthScale = (y) => 0.9 + 0.2 * Math.max(0, Math.min(1, y / MH));

// ---------- các sạp ----------
// seller: tên ảnh cô bán trong public/game/cho (null = sạp chưa có người bán, chỉ có ghế nhựa, thầy sẽ thêm sau).
// goods: các loại rau củ bày trên sạp (khóa trong marketArt.js: PRODUCE). tarp: màu bạt.
export const STALLS = [
  { id: 0, cx: 150, base: 232, seller: 'ba-non-la', name: 'Bà bán trái cây', tarp: 'xanh',
    goods: [['thau', ['chuoi', 'chuoi', 'chuoi']], ['ro', ['xoai', 'xoai', 'xoai', 'xoai']], ['thau', ['buoi', 'buoi']], ['met', ['dua', 'dua', 'dua']]],
    text: 'Bà bán trái cây: Chuối sứ, xoài cát mới hái nè con. Mua về ăn ngọt lắm!' },
  { id: 1, cx: 400, base: 232, seller: 'co-rau', name: 'Cô bán rau', tarp: 'do',
    goods: [['ro', ['raumuong', 'raumuong', 'raumuong']], ['thau', ['hanhla', 'hanhla', 'caixanh']], ['met', ['khoqua', 'khoqua', 'muop']], ['ro', ['caixanh', 'caixanh', 'caixanh']]],
    text: 'Cô bán rau: Rau muống, cải xanh, hành lá mới cắt sáng nay. Mua mớ đi con!' },
  { id: 2, cx: 650, base: 232, seller: 'co-trung', name: 'Chị bán trứng', tarp: 'xanh',
    goods: [['ro', ['trung', 'trung', 'trung', 'trung']], ['met', ['trung', 'trung', 'trung']], ['thau', ['cachua', 'cachua', 'cachua']], ['ro', ['ot', 'ot', 'ot']]],
    text: 'Chị bán trứng: Trứng vịt tươi, cà chua, ớt nè. Em lựa thoải mái nha!' },
  { id: 3, cx: 150, base: 400, seller: null, name: 'Sạp rau củ (chưa có người bán)', tarp: 'soc',
    goods: [['ro', ['cachua', 'cachua', 'carot']], ['thau', ['carot', 'carot', 'carot']], ['met', ['bidao', 'bidao']], ['ro', ['bapcai', 'bapcai', 'bapcai']]],
    text: 'Sạp này chưa có người bán. Hàng đã bày sẵn, chắc cô đi lấy thêm hàng.' },
  { id: 4, cx: 400, base: 400, seller: null, name: 'Sạp rau (chưa có người bán)', tarp: 'xanh',
    goods: [['thau', ['dualeo', 'dualeo', 'dualeo']], ['ro', ['bapcai', 'bapcai']], ['met', ['muop', 'muop', 'khoqua']], ['thau', ['caixanh', 'caixanh', 'hanhla']]],
    text: 'Sạp này chưa có người bán. Em quay lại sau nhé.' },
  { id: 5, cx: 650, base: 400, seller: null, name: 'Sạp dưa trái (chưa có người bán)', tarp: 'do',
    goods: [['ro', ['duahau', 'duahau']], ['thau', ['dua', 'dua', 'dua']], ['met', ['chuoi', 'chuoi']], ['ro', ['bidao', 'duahau']]],
    text: 'Sạp này chưa có người bán. Dưa hấu, dừa đã bày sẵn rồi.' },
];
export const STALL_HALF = 58;          // nửa bề ngang chỗ không đi được của sạp

// ---------- xuồng neo ở bến (mỗi xuồng có hàng khác nhau) ----------
export const BOATS = [
  { id: 0, x: 120, y: 82, cargo: 'duahau', text: 'Xuồng chở dưa hấu từ miệt vườn về. Dưa nào cũng đỏ ruột, ngọt lịm!' },
  { id: 1, x: 330, y: 82, cargo: 'dua', text: 'Xuồng chở dừa xiêm. Chú chèo xuồng bảo: sáng sớm là hết nhẵn!' },
  { id: 2, x: 560, y: 82, cargo: 'bidao', text: 'Xuồng chở bí đao, bầu, mướp. Hàng mới hái dưới vườn sáng nay.' },
  { id: 3, x: 700, y: 82, cargo: 'chuoi', text: 'Xuồng chở chuối, xoài. Mùi trái chín thơm cả khúc sông.' },
];
// xuồng chạy chầm chậm trên sông (chỉ để trang trí), có người chèo đội nón lá
export const RIVER_BOATS = [
  { x0: 60, y: 40, speed: 7, dir: 1, cargo: 'bidao' },
  { x0: 520, y: 48, speed: 5, dir: -1, cargo: 'chuoi' },
  { x0: 300, y: 28, speed: 6, dir: 1, cargo: null },
];

// ---------- vật cản ----------
const POSTS = [];                      // cột đèn ở bến
for (const x of [60, 260, 460, 660, 760]) POSTS.push({ x, y: 112 });
export const LAMP_POSTS = POSTS;

function stallRects() {
  return STALLS.map((s) => ({ x0: s.cx - STALL_HALF - 3, x1: s.cx + STALL_HALF + 3, y0: s.base - 100, y1: s.base + 12 }));
}
const RECTS = stallRects();

export function marketBlocked(x, y) {
  if (x < 18 || x > MW - 18 || y < DOCK_MIN || y > BOTTOM_Y) return true;
  for (const r of RECTS) if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return true;
  for (const p of POSTS) if (Math.abs(x - p.x) < 5 && y > p.y - 4 && y < p.y + 3) return true;
  return false;
}

// ---------- điểm tương tác ----------
export const EXIT_TEXT = 'Xuống bến, đi xuồng về làng quê.';
export function marketNearest(x, y) {
  if (y > 470 && x > 300 && x < 500) return { id: 've_lang', label: 'Về làng quê' };
  for (const s of STALLS) {
    if (Math.abs(x - s.cx) < STALL_HALF + 12 && y > s.base + 12 && y < s.base + 48) {
      return { id: `sap-${s.id}`, label: s.seller ? `Hỏi mua hàng của ${s.name.toLowerCase()}` : 'Xem sạp hàng', stall: s.id };
    }
  }
  for (const b of BOATS) {
    if (Math.abs(x - b.x) < 56 && y < 134) return { id: `xuong-${b.id}`, label: 'Xem xuồng bán hàng', boat: b.id };
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
const COLS = [60, 275, 525, 740];       // bốn lối dọc (giữa các sạp và hai mép)
const AY = 274;                         // lối đi A (trước hàng sạp trên)
const BY = 452;                         // lối đi B (trước hàng sạp dưới)
const DY = 116;                         // bến ván
export function buildGraph() {
  const nodes = [];
  const add = (x, y, watch) => { nodes.push({ x, y, watch: !!watch, nb: [] }); return nodes.length - 1; };
  const link = (a, b) => { nodes[a].nb.push(b); nodes[b].nb.push(a); };
  // bến: các điểm đứng xem xuồng xen giữa các lối
  const dock = [];
  const dockXs = [[60, 0], [BOATS[0].x, 1], [275, 0], [BOATS[1].x, 1], [525, 0], [BOATS[2].x, 1], [BOATS[3].x, 1], [740, 0]];
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
