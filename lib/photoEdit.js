// lib/photoEdit.js
// Các hàm chỉnh ảnh chạy ở trình duyệt (canvas) cho bước kiểm tra ảnh bài vẽ: xoay, cắt, sáng, tương phản, làm trắng nền giấy.
// Ảnh gốc của học sinh không bị sửa; mọi chỉnh sửa vẽ ra canvas mới.
import { ANALYZE_SIDE, analyzePixels } from './photoQuality';

// Mở ảnh từ File. Dùng createImageBitmap (tự xoay đúng chiều theo EXIF) nếu có.
export async function openImage(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Không mở được ảnh');
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height };
    }
  } catch (e) { /* thử cách dự phòng bên dưới */ }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không mở được ảnh')); };
    img.src = url;
  });
}

// Kích thước ảnh sau khi xoay (rot = 0, 90, 180, 270).
export function rotatedSize(width, height, rot) {
  return rot % 180 === 0 ? { w: width, h: height } : { w: height, h: width };
}

/**
 * Vẽ ảnh đã xoay và (tùy chọn) đã cắt ra canvas mới.
 * crop: {x, y, w, h} tính theo tỉ lệ 0..1 trên ảnh ĐÃ xoay. scale: tỉ lệ so với điểm ảnh gốc.
 */
export function drawRegion(source, width, height, rot, crop, scale) {
  const r = rotatedSize(width, height, rot);
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  const ow = Math.max(1, Math.round(c.w * r.w * scale));
  const oh = Math.max(1, Math.round(c.h * r.h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = ow;
  canvas.height = oh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ow, oh);
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);
  ctx.translate(-c.x * r.w, -c.y * r.h);
  if (rot === 90) { ctx.translate(height, 0); ctx.rotate(Math.PI / 2); }
  else if (rot === 180) { ctx.translate(width, height); ctx.rotate(Math.PI); }
  else if (rot === 270) { ctx.translate(0, width); ctx.rotate(Math.PI * 1.5); }
  ctx.drawImage(source, 0, 0);
  return canvas;
}

// Tỉ lệ thu nhỏ để cạnh dài của vùng cắt không vượt maxSide (không phóng to).
export function scaleFor(width, height, rot, crop, maxSide) {
  const r = rotatedSize(width, height, rot);
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  const longSide = Math.max(c.w * r.w, c.h * r.h);
  return Math.min(1, maxSide / Math.max(1, longSide));
}

// Mức sáng "giấy" (phân vị 90) và mức "đen" (phân vị 2) của một canvas, để làm trắng nền giấy.
export function paperLevels(canvas) {
  const s = Math.min(1, 320 / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * s));
  const h = Math.max(1, Math.round(canvas.height * s));
  const t = document.createElement('canvas');
  t.width = w; t.height = h;
  const ctx = t.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const hist = new Uint32Array(256);
  const n = w * h;
  for (let i = 0; i < n; i++) hist[(d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8]++;
  const pick = (p) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v; } return 255; };
  const lo = pick(0.02);
  const hi = pick(0.9);
  if (hi - lo < 40) return null; // ảnh gần như một màu: không kéo để khỏi khuếch đại nhiễu
  return { lo, hi };
}

/**
 * Bảng tra 256 mức. Thứ tự: làm trắng nền (kéo lo..hi về 0..255), rồi tương phản, rồi độ sáng.
 * brightness, contrast: -100..100.
 */
export function makeLut({ brightness = 0, contrast = 0, levels = null }) {
  const lut = new Uint8ClampedArray(256);
  const cf = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55));
  const off = brightness * 1.6;
  for (let v = 0; v < 256; v++) {
    let x = v;
    if (levels) x = ((x - levels.lo) / Math.max(1, levels.hi - levels.lo)) * 255;
    x = cf * (x - 128) + 128;
    x += off;
    lut[v] = x < 0 ? 0 : x > 255 ? 255 : x;
  }
  return lut;
}

export function isIdentityLut({ brightness = 0, contrast = 0, levels = null }) {
  return !brightness && !contrast && !levels;
}

// Áp bảng tra lên canvas (sửa trực tiếp canvas đó).
export function applyLut(canvas, lut) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
  ctx.putImageData(img, 0, 0);
}

// Đo chất lượng một canvas (thu nhỏ về ANALYZE_SIDE rồi đo). longSide: cạnh dài tính theo điểm ảnh gốc.
export function measureCanvas(canvas, longSide) {
  const s = Math.min(1, ANALYZE_SIDE / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * s));
  const h = Math.max(1, Math.round(canvas.height * s));
  const t = document.createElement('canvas');
  t.width = w; t.height = h;
  const ctx = t.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  return analyzePixels(d, w, h, { longSide });
}

export function canvasToFile(canvas, name, quality = 0.88) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Không tạo được ảnh'));
      else resolve(new File([blob], name, { type: 'image/jpeg' }));
    }, 'image/jpeg', quality);
  });
}
