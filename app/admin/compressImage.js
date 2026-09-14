// lib/compressImage.js
//
// Nen anh o phia trinh duyet TRUOC KHI upload len Storage (bucket qa-photos),
// giup tiet kiem dung luong ma khong can chinh gi phia server.
//
// Cach dung trong form dang cau hoi (qa_posts):
//
//   import { compressImage } from '../../lib/compressImage';
//
//   async function handleFileChange(e) {
//     const file = e.target.files[0];
//     if (!file) return;
//     const compressed = await compressImage(file);
//     // compressed la 1 File, dung y het nhu file goc khi goi:
//     // supabase.storage.from('qa-photos').upload(path, compressed);
//   }

/**
 * Nen + resize anh, tra ve mot File moi (giu dinh dang jpeg de nen tot).
 *
 * @param {File} file - file anh goc tu <input type="file">
 * @param {Object} options
 * @param {number} options.maxWidth - chieu rong toi da (px), mac dinh 1280
 * @param {number} options.maxHeight - chieu cao toi da (px), mac dinh 1280
 * @param {number} options.quality - chat luong JPEG 0-1, mac dinh 0.72
 * @param {number} options.maxSizeKB - neu sau khi nen van lon hon muc nay,
 *   se tu giam quality them (toi thieu 0.4) de co gang dat duoc muc nay.
 * @returns {Promise<File>}
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.72,
    maxSizeKB = 400,
  } = options;

  if (!file || !file.type.startsWith('image/')) {
    throw new Error('File khong phai la anh');
  }

  const imageBitmap = await loadImage(file);

  let { width, height } = imageBitmap;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  let currentQuality = quality;
  let blob = await canvasToBlob(canvas, currentQuality);

  // Neu van con lon hon nguong mong muon, giam dan quality (toi da 4 lan).
  let attempts = 0;
  while (blob.size / 1024 > maxSizeKB && currentQuality > 0.4 && attempts < 4) {
    currentQuality -= 0.1;
    blob = await canvasToBlob(canvas, currentQuality);
    attempts += 1;
  }

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg' });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}
