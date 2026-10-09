// GAME (tách riêng): vẽ map sân trường. Nền là ảnh ngày, ảnh đêm mờ dần vào nhau theo giờ game; đèn (cửa sổ, quầng sáng dưới mái)
// bật dần theo từng khu: dãy nhà trái, tòa nhà chính, dưới mái xanh, dãy nhà phải. Mái xanh và cột vẽ đè lên nhân vật để có chiều sâu.
// Không vẽ thêm mây, sao, đom đóm hay đốm sáng: mọi thứ lấy từ ảnh mẫu.
import { ATLAS, COLUMNS, IMG, ROOF, SH, SW } from './courtyard';

const imgs = {};   // nạp một lần cho cả trang

function load(key) {
  if (typeof Image === 'undefined') return null;
  if (!imgs[key]) { imgs[key] = new Image(); imgs[key].src = IMG[key]; }
  const im = imgs[key];
  return im.complete && im.naturalWidth > 0 ? im : null;
}

export function makeYardArt() {
  for (const k of Object.keys(IMG)) load(k);     // nạp trước tất cả để chuyển ngày đêm không bị khựng
  return { img: load };
}

const smooth = (x) => { const v = x < 0 ? 0 : x > 1 ? 1 : x; return v * v * (3 - 2 * v); };
// mức sáng của đèn theo độ tối của trời: độ trễ d làm các khu bật đèn lần lượt, không bật cùng một lúc
export const lightLevel = (night, d) => smooth((night - 0.1 - d) / 0.55);

const REGIONS = [
  { x0: 0, y0: 0, x1: 262, y1: SH, d: 0 },          // dãy nhà bên trái
  { x0: 262, y0: 0, x1: 768, y1: 176, d: 0.08 },    // tòa nhà chính
  { x0: 262, y0: 176, x1: 768, y1: SH, d: 0.16 },   // mái xanh và sân
  { x0: 768, y0: 0, x1: SW, y1: SH, d: 0.24 },      // dãy nhà bên phải
];

// night: 0 sáng hẳn ... 1 tối hẳn. Trả về false nếu ảnh chưa nạp xong.
export function drawYardBackdrop(ctx, art, night) {
  const day = art.img('day');
  const nit = art.img('night');
  const base = day || nit;
  if (!base) return false;
  const aN = smooth(night);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (!(aN >= 0.999 && nit)) ctx.drawImage(base, 0, 0, SW, SH);
  if (nit && aN > 0.001 && base !== nit) {
    ctx.globalAlpha = aN;
    ctx.drawImage(nit, 0, 0, SW, SH);
    ctx.globalAlpha = 1;
  }
  const lit = art.img('lights');
  if (lit && night > 0.05 && aN < 0.999) {
    for (const r of REGIONS) {
      const a = lightLevel(night, r.d);
      if (a < 0.003) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(lit, r.x0 * 2, r.y0 * 2, (r.x1 - r.x0) * 2, (r.y1 - r.y0) * 2, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    }
    ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = false;
  return true;
}

// một mảnh của lớp phía trước (mái hoặc cột): vẽ chồng ngày, đêm, đèn y như nền để màu khớp từng khoảnh khắc
function drawFrontPiece(ctx, art, night, p) {
  const fd = art.img('fday');
  const fn = art.img('fnight');
  const fl = art.img('flights');
  const base = fd || fn;
  if (!base) return;
  const aN = smooth(night);
  const dx = ATLAS.x + p.sx / 2;
  const dy = ATLAS.y + p.sy / 2;
  const dw = p.sw / 2;
  const dh = p.sh / 2;
  ctx.imageSmoothingEnabled = true;
  if (!(aN >= 0.999 && fn)) ctx.drawImage(base, p.sx, p.sy, p.sw, p.sh, dx, dy, dw, dh);
  if (fn && aN > 0.001 && base !== fn) {
    ctx.globalAlpha = aN;
    ctx.drawImage(fn, p.sx, p.sy, p.sw, p.sh, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
  }
  if (fl && night > 0.05 && aN < 0.999) {
    const a = lightLevel(night, 0.16);
    if (a > 0.003) {
      ctx.globalAlpha = a;
      ctx.drawImage(fl, p.sx, p.sy, p.sw, p.sh, dx, dy, dw, dh);
      ctx.globalAlpha = 1;
    }
  }
  ctx.imageSmoothingEnabled = false;
}

export const drawYardRoof = (ctx, art, night) => drawFrontPiece(ctx, art, night, ROOF);
export const drawYardColumn = (ctx, art, night, col) => drawFrontPiece(ctx, art, night, col);
export { COLUMNS };
