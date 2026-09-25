// lib/musicNotes.js
// BẢN CẬP NHẬT — thêm: nốt chấm dôi, giọng (key signature) với dấu hóa
// tự động theo giọng, để soạn được đầy đủ như bản nhạc thật (vd "Con
// đường học trò": giọng Sol trưởng 1 dấu thăng, có nốt trắng chấm dôi...).

export const VN_NAME = { C: 'Đô', D: 'Rê', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

// "C4" -> "Đô", "F#4" -> "Fa thăng", "Bb3" -> "Si giáng"
export function pitchToVietnamese(pitch) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch || '');
  if (!m) return pitch;
  const [, letter, accidental] = m;
  const suffix = accidental === '#' ? ' thăng' : accidental === 'b' ? ' giáng' : '';
  return `${VN_NAME[letter]}${suffix}`;
}

export function pitchOctave(pitch) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch || '');
  return m ? Number(m[3]) : null;
}
export function pitchLetter(pitch) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch || '');
  return m ? m[1] : null;
}
export function pitchAccidental(pitch) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch || '');
  return m ? (m[2] || '') : '';
}

// Trường độ đầy đủ (thêm chấm dôi so với bản trước) <-> ký hiệu VexFlow / số phách (nhịp 4/4, đen = 1 phách)
export const DURATIONS = [
  { key: 'whole', label: 'Nốt tròn', vexKey: 'w', beats: 4 },
  { key: 'dotted_half', label: 'Nốt trắng chấm dôi', vexKey: 'hd', beats: 3 },
  { key: 'half', label: 'Nốt trắng', vexKey: 'h', beats: 2 },
  { key: 'dotted_quarter', label: 'Nốt đen chấm dôi', vexKey: 'qd', beats: 1.5 },
  { key: 'quarter', label: 'Nốt đen', vexKey: 'q', beats: 1 },
  { key: 'eighth', label: 'Nốt móc đơn', vexKey: '8', beats: 0.5 },
  { key: 'sixteenth', label: 'Nốt móc kép', vexKey: '16', beats: 0.25 },
];
export function durationToVexKey(duration) { return DURATIONS.find((d) => d.key === duration)?.vexKey || 'q'; }
export function durationBeats(duration) { return DURATIONS.find((d) => d.key === duration)?.beats ?? 1; }

// Trường độ -> ký hiệu Tone.js (dấu "." ở cuối = chấm dôi, Tone.js hiểu sẵn)
const TONE_DURATION = {
  whole: '1n', dotted_half: '2n.', half: '2n', dotted_quarter: '4n.', quarter: '4n', eighth: '8n', sixteenth: '16n',
};
export function durationToToneKey(duration) { return TONE_DURATION[duration] || '4n'; }

// Giọng (điệu trưởng) hay dùng ở THCS — mỗi giọng có sẵn các nốt bị thăng/giáng
// MẶC ĐỊNH theo hóa biểu, để khỏi phải gõ dấu hóa tay cho từng nốt.
export const KEY_SIGNATURES = [
  { key: 'C', label: 'Đô trưởng — không dấu hóa', sharps: [], flats: [] },
  { key: 'G', label: 'Sol trưởng — 1 dấu thăng (Fa)', sharps: ['F'], flats: [] },
  { key: 'D', label: 'Rê trưởng — 2 dấu thăng (Fa, Đô)', sharps: ['F', 'C'], flats: [] },
  { key: 'A', label: 'La trưởng — 3 dấu thăng (Fa, Đô, Sol)', sharps: ['F', 'C', 'G'], flats: [] },
  { key: 'F', label: 'Fa trưởng — 1 dấu giáng (Si)', sharps: [], flats: ['B'] },
  { key: 'Bb', label: 'Si giáng trưởng — 2 dấu giáng (Si, Mi)', sharps: [], flats: ['B', 'E'] },
];
// Dấu hóa MẶC ĐỊNH của 1 bậc (letter A-G) trong 1 giọng — null nếu bậc đó tự nhiên trong giọng này.
export function keyDefaultAccidental(keySignature, letter) {
  const ks = KEY_SIGNATURES.find((k) => k.key === keySignature);
  if (!ks) return null;
  if (ks.sharps.includes(letter)) return '#';
  if (ks.flats.includes(letter)) return 'b';
  return null;
}

// Danh sách phím đàn hiển thị (tên bậc, không đổi theo giọng — giọng chỉ
// quyết định dấu hóa MẶC ĐỊNH khi thêm nốt, xem trang soạn bài).
export const KEYBOARD_PITCHES = [
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
  'C5', 'D5', 'E5', 'F5', 'G5',
];
