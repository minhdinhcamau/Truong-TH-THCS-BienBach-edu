// lib/photoQuality.js
// Bộ đo chất lượng ảnh chụp bài vẽ giấy. Hàm thuần: không dùng DOM, không gọi AI, không tốn token.
// Nhận dữ liệu điểm ảnh RGBA (Uint8ClampedArray) của ảnh đã thu nhỏ (cạnh dài <= ANALYZE_SIDE).

export const ANALYZE_SIDE = 640;

// Ngưỡng đo. Chỉnh ở đây nếu ảnh thật bị báo nhầm hoặc bị sót.
export const TH = {
  brightWarn: 130,     // phân vị 90 của độ sáng dưới mức này: "hơi tối"
  brightBad: 90,       // dưới mức này: "rất tối"
  blurWarn: 18,        // độ nét dưới mức này: "hơi mờ"
  blurBad: 11,         // dưới mức này: "mờ"
  emptyContrast: 25,   // giấy gần như trống nếu (p98 - p2) của độ sáng dưới mức này
  shadowRatio: 0.55,   // ô tối nhất / ô sáng nhất dưới mức này: "bóng đổ"
  smallSide: 700,      // cạnh dài (điểm ảnh gốc) dưới mức này: "ảnh nhỏ"
};

function lumaOf(data, n) {
  const g = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  }
  return g;
}

function percentileFromHist(hist, total, p) {
  const target = total * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}

// Độ nét: độ lệch chuẩn của Laplacian theo từng ô 8x8, lấy trung bình 10% ô nét nhất.
function sharpnessOf(g, w, h) {
  const cell = 8;
  const cw = Math.floor((w - 2) / cell);
  const ch = Math.floor((h - 2) / cell);
  if (cw < 1 || ch < 1) return 0;
  const stds = [];
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      let sum = 0, sum2 = 0, cnt = 0;
      for (let y = cy * cell + 1; y <= cy * cell + cell; y++) {
        for (let x = cx * cell + 1; x <= cx * cell + cell; x++) {
          const i = y * w + x;
          const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
          sum += lap; sum2 += lap * lap; cnt++;
        }
      }
      const mean = sum / cnt;
      stds.push(Math.sqrt(Math.max(0, sum2 / cnt - mean * mean)));
    }
  }
  stds.sort((a, b) => b - a);
  const k = Math.max(1, Math.round(stds.length * 0.1));
  let s = 0;
  for (let i = 0; i < k; i++) s += stds[i];
  return s / k;
}

// Bóng đổ: chia lưới 4x4, lấy độ sáng phân vị 85 của từng ô, so ô tối nhất với ô sáng nhất.
function shadowRatioOf(g, w, h) {
  const gx = 4, gy = 4;
  const p85 = [];
  for (let by = 0; by < gy; by++) {
    for (let bx = 0; bx < gx; bx++) {
      const x0 = Math.floor((bx * w) / gx), x1 = Math.floor(((bx + 1) * w) / gx);
      const y0 = Math.floor((by * h) / gy), y1 = Math.floor(((by + 1) * h) / gy);
      const hist = new Uint32Array(256);
      let cnt = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { hist[g[y * w + x]]++; cnt++; }
      p85.push(cnt ? percentileFromHist(hist, cnt, 0.85) : 0);
    }
  }
  const mx = Math.max(...p85);
  const mn = Math.min(...p85);
  return mx > 0 ? mn / mx : 1;
}

/**
 * @param {Uint8ClampedArray} data  RGBA của ảnh đã thu nhỏ
 * @param {number} w  rộng ảnh đã thu nhỏ
 * @param {number} h  cao ảnh đã thu nhỏ
 * @param {{longSide?: number}} [opts]  longSide: cạnh dài tính theo điểm ảnh GỐC (để báo "ảnh nhỏ")
 */
export function analyzePixels(data, w, h, opts = {}) {
  const n = w * h;
  const g = lumaOf(data, n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[g[i]]++;
  const p2 = percentileFromHist(hist, n, 0.02);
  const p90 = percentileFromHist(hist, n, 0.9);
  const p98 = percentileFromHist(hist, n, 0.98);

  const brightness = p90;
  const sharpness = sharpnessOf(g, w, h);
  const shadow = shadowRatioOf(g, w, h);
  const emptyPaper = p98 - p2 < TH.emptyContrast;
  const longSide = opts.longSide || Math.max(w, h);

  const issues = [];

  // Độ sáng
  if (brightness < TH.brightBad) {
    issues.push({ code: 'very_dark', level: 'bad', text: 'Ảnh rất tối', tip: 'Bật đèn hoặc ra chỗ sáng rồi chụp lại. Có thể thử nút "Làm trắng nền giấy" bên dưới.' });
  } else if (brightness < TH.brightWarn) {
    issues.push({ code: 'dark', level: 'warn', text: 'Ảnh hơi tối', tip: 'Tăng độ sáng hoặc bấm "Làm trắng nền giấy". Chụp gần cửa sổ sẽ sáng hơn.' });
  }

  // Độ nét
  if (sharpness < TH.blurBad) {
    if (emptyPaper) {
      issues.push({ code: 'blur_or_blank', level: 'bad', text: 'Ảnh mờ hoặc chưa thấy nét vẽ', tip: 'Kiểm tra em đã chụp đúng bài vẽ chưa. Giữ máy thật chắc, chạm vào bài vẽ để máy lấy nét rồi chụp lại.' });
    } else {
      issues.push({ code: 'very_blur', level: 'bad', text: 'Ảnh bị mờ', tip: 'Giữ máy thật chắc, chạm vào bài vẽ để lấy nét, chụp lại. Lau ống kính nếu bị mờ.' });
    }
  } else if (sharpness < TH.blurWarn) {
    issues.push({ code: 'blur', level: 'warn', text: 'Ảnh hơi mờ', tip: 'Thử chụp lại gần hơn một chút và giữ máy chắc tay.' });
  }

  // Bóng đổ
  if (shadow < TH.shadowRatio) {
    issues.push({ code: 'shadow', level: 'warn', text: 'Có bóng đổ trên giấy', tip: 'Đừng để tay hoặc điện thoại che ánh sáng. Chụp thẳng từ trên xuống, ánh sáng đều hai bên.' });
  }

  // Ảnh nhỏ
  if (longSide < TH.smallSide) {
    issues.push({ code: 'small', level: 'warn', text: 'Ảnh hơi nhỏ', tip: 'Chụp bằng camera thay vì ảnh đã gửi qua ứng dụng nhắn tin, và đừng cắt quá sát.' });
  }

  const verdict = issues.some((i) => i.level === 'bad') ? 'bad' : issues.length ? 'warn' : 'ok';
  return {
    verdict,
    issues,
    metrics: {
      brightness,
      sharpness: Math.round(sharpness * 10) / 10,
      shadow: Math.round(shadow * 100) / 100,
      w,
      h,
      longSide,
    },
  };
}
