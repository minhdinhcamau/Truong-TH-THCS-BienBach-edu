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
  { key: 'dotted_eighth', label: 'Nốt móc đơn chấm dôi', vexKey: '8d', beats: 0.75 },
  { key: 'sixteenth', label: 'Nốt móc kép', vexKey: '16', beats: 0.25 },
  // Nốt hoa mỹ (grace note): KHÔNG tính vào số phách của ô nhịp (beats:0) —
  // được "gắn" vào nốt chính đi ngay sau nó khi vẽ khuông nhạc, không đứng
  // độc lập. Xem xử lý riêng trong trang soạn bài.
  { key: 'grace', label: 'Nốt hoa mỹ (láy)', vexKey: '8', beats: 0 },
];
export function durationToVexKey(duration) { return DURATIONS.find((d) => d.key === duration)?.vexKey || 'q'; }
export function durationBeats(duration) { return DURATIONS.find((d) => d.key === duration)?.beats ?? 1; }

// Nhịp thường dùng ở THCS
export const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8'];
// Số phách/ô nhịp theo từng loại nhịp — dùng để tự xuống dòng đúng chỗ nếu cần,
// và để trang soạn bài biết 1 ô nhịp "đầy" là bao nhiêu phách.
export function beatsPerMeasure(timeSignature) {
  const map = { '2/4': 2, '3/4': 3, '4/4': 4, '6/8': 3 }; // 6/8 tính theo phách chấm dôi (đơn vị phách = nốt đen chấm dôi = 1 phách gộp)
  return map[timeSignature] || 4;
}

// Trường độ -> ký hiệu Tone.js (dấu "." ở cuối = chấm dôi, Tone.js hiểu sẵn)
const TONE_DURATION = {
  whole: '1n', dotted_half: '2n.', half: '2n', dotted_quarter: '4n.', quarter: '4n', eighth: '8n', dotted_eighth: '8n.', sixteenth: '16n',
  grace: '32n',
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

// ===== Dùng cho bàn phím piano thật + trò chơi nốt chạy ngang (trang học sinh) =====

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// "F#4" -> số MIDI (C4 = 60) — dùng để so sánh cao độ và sắp xếp thứ tự phím.
export function pitchToMidi(pitch) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch || '');
  if (!m) return 60;
  const [, letter, acc, octave] = m;
  let s = SEMITONE[letter];
  if (acc === '#') s += 1;
  if (acc === 'b') s -= 1;
  return (Number(octave) + 1) * 12 + s;
}

const MIDI_TO_LETTER = { 0: ['C', false], 1: ['C', true], 2: ['D', false], 3: ['D', true], 4: ['E', false], 5: ['F', false], 6: ['F', true], 7: ['G', false], 8: ['G', true], 9: ['A', false], 10: ['A', true], 11: ['B', false] };

// Sinh danh sách phím trắng/đen liên tiếp cho 1 khoảng MIDI, dùng để vẽ bàn phím piano thật.
export function buildPianoKeys(minMidi, maxMidi) {
  const keys = [];
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const octave = Math.floor(midi / 12) - 1;
    const [letter, isBlack] = MIDI_TO_LETTER[((midi % 12) + 12) % 12];
    keys.push({ pitch: `${letter}${isBlack ? '#' : ''}${octave}`, letter, isBlack, midi });
  }
  return keys;
}

// Sao (0-3) theo % trung bình của Cao độ + Tiết tấu.
export function starsForScore(pct) {
  if (pct >= 90) return 3;
  if (pct >= 75) return 2;
  if (pct >= 50) return 1;
  return 0;
}

// Cấp độ mỗi bài: Luyện tập (tự chọn nhịp độ, chỉ chạy tiếp khi bấm đúng)
// rồi tới 3 cấp theo tốc độ thật (nhân với tempo_bpm giáo viên đã đặt).
export const LEVELS = [
  { key: 'practice', label: 'Luyện tập', mult: null, selfPaced: true },
  { key: 'slow', label: 'Chậm', mult: 0.6 },
  { key: 'medium', label: 'Vừa', mult: 1.0 },
  { key: 'fast', label: 'Nhanh', mult: 1.3 },
];
