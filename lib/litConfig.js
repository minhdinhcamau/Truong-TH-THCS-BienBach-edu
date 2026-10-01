// Cấu hình + hàm nhỏ dùng chung cho cả server và trình duyệt

export const GENRES = [
  { value: 'nghi_luan_xh', label: 'Nghị luận xã hội' },
  { value: 'nghi_luan_vh', label: 'Nghị luận văn học' },
  { value: 'tu_su', label: 'Tự sự' },
  { value: 'mieu_ta', label: 'Miêu tả' },
  { value: 'bieu_cam', label: 'Biểu cảm' },
  { value: 'thuyet_minh', label: 'Thuyết minh' },
  { value: 'khac', label: 'Khác' },
];

export const genreLabel = (v) => GENRES.find((g) => g.value === v)?.label || 'Khác';

export const countWords = (t) => (t || '').trim().split(/\s+/).filter(Boolean).length;

export const round025 = (n) => Math.round(Number(n) * 4) / 4;

export const MAX_ESSAY_CHARS = 12000;

// Trạng thái bài làm: nhãn + màu chip
export const STATUS_META = {
  none: { label: 'Chưa làm', color: '#6b7f7a', bg: '#f3f6f5' },
  draft: { label: 'Đang viết', color: '#b45309', bg: '#FFF4E0' },
  submitted: { label: 'Đã nộp, chờ chấm', color: '#225da3', bg: '#E9F2FC' },
  ai_graded: { label: 'Chờ thầy cô duyệt', color: '#225da3', bg: '#E9F2FC' },
  published: { label: 'Đã có điểm', color: '#1a7f4e', bg: '#EAFBEA' },
};

// Xếp loại + màu theo tỉ lệ điểm / điểm tối đa
export function toneFor(ratio) {
  if (ratio >= 0.8) return { label: 'Giỏi', color: '#1a7f4e', soft: '#EAFBEA' };
  if (ratio >= 0.65) return { label: 'Khá', color: '#225da3', soft: '#E9F2FC' };
  if (ratio >= 0.5) return { label: 'Đạt', color: '#b45309', soft: '#FFF4E0' };
  return { label: 'Cần cố gắng', color: '#a3374a', soft: '#fdeef0' };
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
