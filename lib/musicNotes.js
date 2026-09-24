// lib/musicNotes.js
// Tách riêng ký hiệu quốc tế (dùng để tính toán/phát âm thanh chính xác)
// khỏi tên hiển thị tiếng Việt — đúng theo mục 3 trong file spec.

export const VN_NAME = { C: 'Đô', D: 'Rê', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

// "C4" -> "Đô", "F#4" -> "Fa thăng", "Bb3" -> "Si giáng"
export function pitchToVietnamese(pitch) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch || '');
  if (!m) return pitch;
  const [, letter, accidental] = m;
  const suffix = accidental === '#' ? ' thăng' : accidental === 'b' ? ' giáng' : '';
  return `${VN_NAME[letter]}${suffix}`;
}

// Quãng tám hiển thị nhỏ bên cạnh tên nốt, ví dụ để phân biệt Đô4 với Đô5
export function pitchOctave(pitch) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch || '');
  return m ? Number(m[3]) : null;
}

// Trường độ <-> ký hiệu VexFlow ("q", "h", "8"...) và số phách (nhịp 4/4)
export const DURATIONS = [
  { key: 'whole', label: 'Nốt tròn', vexKey: 'w', beats: 4 },
  { key: 'half', label: 'Nốt trắng', vexKey: 'h', beats: 2 },
  { key: 'quarter', label: 'Nốt đen', vexKey: 'q', beats: 1 },
  { key: 'eighth', label: 'Nốt móc đơn', vexKey: '8', beats: 0.5 },
  { key: 'sixteenth', label: 'Nốt móc kép', vexKey: '16', beats: 0.25 },
];

export function durationToVexKey(duration) {
  return DURATIONS.find((d) => d.key === duration)?.vexKey || 'q';
}
export function durationBeats(duration) {
  return DURATIONS.find((d) => d.key === duration)?.beats ?? 1;
}

// Trường độ -> ký hiệu thời lượng nốt của Tone.js (dùng khi gọi synth.triggerAttackRelease)
const TONE_DURATION = { whole: '1n', half: '2n', quarter: '4n', eighth: '8n', sixteenth: '16n' };
export function durationToToneKey(duration) {
  return TONE_DURATION[duration] || '4n';
}

// Tone.js dùng ký hiệu "C4" y hệt "pitch" nên không cần chuyển đổi khi phát âm thanh —
// chỉ cần đổi trường độ (beats) thành thời gian thực (giây) theo tempo.
export function beatsToSeconds(beats, tempoBpm) {
  return (beats * 60) / tempoBpm;
}

// Danh sách phím đàn hiển thị cho cả 2 trang (giáo viên nhập liệu & học sinh luyện tập):
// 1 quãng 8 rưỡi, đủ cho các bài đơn giản THCS (Đô4 → Sol5).
export const KEYBOARD_PITCHES = [
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
  'C5', 'D5', 'E5', 'F5', 'G5',
];
