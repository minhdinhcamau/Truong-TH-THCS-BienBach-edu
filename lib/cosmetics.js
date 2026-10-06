// lib/cosmetics.js — Khung avatar và khung bài đăng/bình luận theo hạng, kèm điều kiện mở khóa.
// Ngưỡng hạng lấy từ lib/rank.js (một nơi duy nhất). Bản SQL kiểm tra nằm trong goi_t_tuy_chinh_khung.sql.
import { RANKS, getRank } from './rank';

export function levelOfXp(xp) {
  return getRank(xp).rank.level;
}
export function rankNameOfLevel(lv) {
  return RANKS.find((r) => r.level === lv)?.name || '';
}

// Khung avatar: mỗi hạng một khung, chọn được mọi khung từ hạng của mình trở xuống.
export const AVATAR_FRAMES = RANKS.map((r) => ({ id: r.level, name: r.name, minLevel: r.level }));

// Khung bài đăng + bình luận. Chỉ từ hạng Khá (3) mới có khung.
export const CHAT_FRAMES = [
  { id: 'none', name: 'Không khung', desc: 'Giao diện thường', minLevel: 1 },
  { id: 'silver', name: 'Khung bạc', desc: 'Viền bạc, nền trắng', minLevel: 3 },
  { id: 'silver-fx', name: 'Bạc xanh', desc: 'Bạc ánh xanh sang trọng', minLevel: 4 },
  { id: 'gold', name: 'Khung vàng', desc: 'Viền vàng kim, nền kem', minLevel: 5 },
  { id: 'star', name: 'Ngôi sao VIP', desc: 'Vàng, hồng, tím trên nền ngọc trai', minLevel: 6 },
];

// Khung mặc định (khi chưa chọn) = khung cao nhất mà hạng cho phép.
export function defaultChat(level) {
  if (level >= 6) return 'star';
  if (level >= 5) return 'gold';
  if (level >= 4) return 'silver-fx';
  if (level >= 3) return 'silver';
  return 'none';
}

// Giá trị lưu có thể đã bị khóa (vd. hạng không đổi nhưng dữ liệu cũ): luôn kiểm lại theo hạng hiện tại.
export function resolveChat(level, pref) {
  const f = CHAT_FRAMES.find((c) => c.id === pref);
  if (!pref || !f || f.minLevel > level) return defaultChat(level);
  return f.id;
}
export function resolveAvatar(level, pref) {
  const n = Number(pref);
  if (!n || n < 1 || n > level) return level;
  return n;
}
