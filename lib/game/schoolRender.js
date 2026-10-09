// GAME (tách riêng): vẽ nền map trước cổng trường. Ban ngày là ảnh ngày, ban đêm là ảnh đêm, lúc chuyển giờ hai ảnh mờ dần vào nhau.
// Không vẽ mây, sao, trăng, đom đóm hay đốm sáng: tất cả đã có sẵn trong ảnh mẫu.
import { SH, SW } from './school';

// night: 0 sáng hẳn ... 1 tối hẳn. cx, cy: góc trên trái khung nhìn trong thế giới.
export function drawBackdrop(ctx, art, cx, cy, vw, vh, night) {
  const day = art.day();
  const nit = art.night();
  const first = night >= 0.98 && nit ? nit : day || nit;
  if (!first) return false;
  // nếu khung nhìn cao hơn map thì kéo dài dải trời trên cùng lên phía trên cho khỏi hở
  if (cy < 0) {
    ctx.globalAlpha = 1;
    ctx.drawImage(first, 0, 0, SW, 1, cx - 4, cy - 2, vw + 8, -cy + 3);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(first, 0, 0, SW, SH);
  if (first === day && nit && night > 0.01) {
    ctx.globalAlpha = Math.min(1, night);
    ctx.drawImage(nit, 0, 0, SW, SH);
    ctx.globalAlpha = 1;
  }
  return true;
}
