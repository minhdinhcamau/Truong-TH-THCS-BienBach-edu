// lib/scoreImport.js
//
// Nhập nốt trực tiếp từ FILE NHẠC (MusicXML .musicxml/.xml, MusicXML nén .mxl, MIDI .mid/.midi)
// thay vì nhờ AI đọc ảnh. File nhạc chứa sẵn cao độ + trường độ chính xác nên KHÔNG bị đọc sai,
// không tốn tiền API, không bị timeout. Chạy hoàn toàn trên trình duyệt, không cần cài thêm thư viện.
//
// Kết quả trả về cùng định dạng với trang soạn bài: [{ pitch, duration, startBeat, lyric }].
// Trang soạn bài chỉ hỗ trợ 1 giai điệu (mỗi thời điểm 1 nốt) nên:
//   - hợp âm / nhiều bè  → lấy nốt CAO NHẤT,
//   - bản piano 2 khuông → mặc định lấy khuông 1 (tay phải = giai điệu), có thể chọn khuông 2,
//   - nốt hoa mỹ (grace) bị bỏ qua, nốt luyến (tie) được gộp nếu ra đúng 1 trường độ có sẵn.

import { DURATIONS, VN_NAME, TIME_SIGNATURES, normalizePitch, pitchToMidi } from './musicNotes';

const PLACE = DURATIONS.filter((d) => d.key !== 'grace');
const SNAP = 0.25;
const EPS = 0.02;

const exactDur = (beats) => PLACE.find((d) => Math.abs(d.beats - beats) < EPS);
const nearestDur = (beats) => PLACE.reduce((b, d) => (Math.abs(d.beats - beats) < Math.abs(b.beats - beats) ? d : b), PLACE[0]);
const floorDur = (beats) => {
  const c = PLACE.filter((d) => d.beats <= beats + EPS).sort((a, b) => b.beats - a.beats);
  return c[0] || PLACE.reduce((s, d) => (d.beats < s.beats ? d : s), PLACE[0]);
};

// ======================= Gom danh sách nốt thô thành nốt của trang soạn bài =======================
// raw: [{ pitch, start (phách, đen = 1), beats, lyric, tieStart, tieStop }]
function finalizeNotes(raw, warnings) {
  const withMidi = raw.map((n) => ({ ...n, midi: pitchToMidi(n.pitch) }));
  withMidi.sort((a, b) => a.start - b.start || b.midi - a.midi);

  // 1) Cùng thời điểm: chỉ giữ nốt cao nhất (giai điệu)
  const top = [];
  let stacked = 0;
  for (const n of withMidi) {
    const last = top[top.length - 1];
    if (last && Math.abs(last.start - n.start) < EPS) { stacked++; continue; }
    top.push({ ...n });
  }
  if (stacked > 0) warnings.push(`Có ${stacked} nốt đánh cùng lúc (hợp âm / nhiều bè) — đã giữ nốt cao nhất, bỏ các nốt còn lại.`);

  // 2) Gộp nốt luyến (tie) nếu tổng trường độ trùng đúng 1 loại nốt có sẵn
  const merged = [];
  for (const n of top) {
    if (n.tieStop) {
      for (let i = merged.length - 1; i >= 0 && i >= merged.length - 3; i--) {
        const p = merged[i];
        if (p.pitch === n.pitch && p.tieStart && Math.abs(p.start + p.beats - n.start) < EPS && exactDur(p.beats + n.beats)) {
          p.beats += n.beats;
          p.tieStart = n.tieStart;
          p._merged = true;
          n._skip = true;
          break;
        }
      }
    }
    if (!n._skip) merged.push(n);
  }

  // 3) Quy về trường độ có sẵn, tránh chồng lên nhau
  const out = [];
  let rounded = 0;
  let trimmed = 0;
  let prevEnd = 0;
  for (let i = 0; i < merged.length; i++) {
    const n = merged[i];
    let beats = n.beats;
    const next = merged[i + 1];
    const gap = next ? next.start - n.start : Infinity;
    let dur;
    if (beats > gap + EPS) { dur = floorDur(gap); trimmed++; } else { dur = nearestDur(beats); }
    if (Math.abs(dur.beats - beats) > EPS && beats <= gap + EPS) rounded++;
    let startBeat = Math.round(n.start / SNAP) * SNAP;
    if (startBeat < prevEnd - EPS) startBeat = prevEnd;
    out.push({ pitch: normalizePitch(n.pitch), duration: dur.key, startBeat, lyric: n.lyric || '' });
    prevEnd = startBeat + dur.beats;
  }
  if (rounded > 0) warnings.push(`Có ${rounded} nốt có trường độ đặc biệt (vd nốt ba, luyến phức tạp) — đã làm tròn về loại nốt gần nhất.`);
  if (trimmed > 0) warnings.push(`Có ${trimmed} nốt kéo dài chồng lên nốt sau — đã cắt ngắn cho khớp.`);
  return out;
}

// ======================= XML tối giản (không cần DOMParser, chạy được cả server) =======================
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
export function parseXml(str) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  const attrRe = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2] !== undefined) { if (stack.length > 1) stack.pop(); }
    else if (m[3] !== undefined) {
      const node = { name: m[3], attrs: {}, children: [], text: '' };
      let a;
      attrRe.lastIndex = 0;
      while ((a = attrRe.exec(m[4] || '')) !== null) node.attrs[a[1]] = decodeEntities(a[2] !== undefined ? a[2] : a[3]);
      top.children.push(node);
      if (m[5] !== '/') stack.push(node);
    } else if (m[6] !== undefined) top.text += decodeEntities(m[6]);
  }
  return root;
}
const child = (n, name) => (n ? n.children.find((c) => c.name === name) : undefined);
const kids = (n, name) => (n ? n.children.filter((c) => c.name === name) : []);
const txt = (n, name) => { const c = child(n, name); return c ? c.text.trim() : ''; };
const num = (s) => { const v = parseFloat(s); return Number.isFinite(v) ? v : 0; };

// ======================= MusicXML =======================
const MAJOR_KEYS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MINOR_KEYS = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
function keyName(fifths, mode) {
  const minor = String(mode || '').toLowerCase() === 'minor';
  const k = (minor ? MINOR_KEYS : MAJOR_KEYS)[fifths + 7];
  if (!k) return null;
  const acc = k[1] === '#' ? ' thăng' : k[1] === 'b' ? ' giáng' : '';
  return `${VN_NAME[k[0]]}${acc} ${minor ? 'thứ' : 'trưởng'}`;
}

function extractPart(part, staffWanted) {
  let divisions = 1;
  let staves = 1;
  let fifths = null, mode = '';
  let tsBeats = null, tsType = null;
  let tempo = null;
  let measureStart = 0;
  let hasLyrics = false;
  let graceCount = 0;
  const raw = [];

  for (const measure of kids(part, 'measure')) {
    let cursor = 0, maxEnd = 0, lastStart = 0;
    for (const el of measure.children) {
      if (el.name === 'attributes') {
        divisions = num(txt(el, 'divisions')) || divisions;
        staves = Math.max(staves, num(txt(el, 'staves')) || 1);
        const key = child(el, 'key');
        if (key && fifths === null) { fifths = num(txt(key, 'fifths')); mode = txt(key, 'mode'); }
        const time = child(el, 'time');
        if (time && tsBeats === null) { tsBeats = txt(time, 'beats'); tsType = txt(time, 'beat-type'); }
      } else if (el.name === 'direction' || el.name === 'sound') {
        const snd = el.name === 'sound' ? el : child(el, 'sound');
        if (snd && snd.attrs.tempo && tempo === null) tempo = num(snd.attrs.tempo) || null;
      } else if (el.name === 'backup') {
        cursor -= num(txt(el, 'duration')) / divisions;
      } else if (el.name === 'forward') {
        cursor += num(txt(el, 'duration')) / divisions;
        maxEnd = Math.max(maxEnd, cursor);
      } else if (el.name === 'note') {
        const isGrace = !!child(el, 'grace');
        const isChord = !!child(el, 'chord');
        const isRest = !!child(el, 'rest');
        const isCue = !!child(el, 'cue');
        const staff = num(txt(el, 'staff')) || 1;
        const dur = isGrace ? 0 : num(txt(el, 'duration')) / divisions;
        let start;
        if (isChord) start = lastStart;
        else { start = cursor; lastStart = cursor; if (!isGrace) cursor += dur; }
        maxEnd = Math.max(maxEnd, cursor);
        const lyricEl = child(el, 'lyric');
        const lyric = lyricEl ? txt(lyricEl, 'text') : '';
        if (lyric) hasLyrics = true;
        if (isGrace) { graceCount++; continue; }
        if (isRest || isCue || staff !== staffWanted || dur <= 0) continue;
        const p = child(el, 'pitch');
        if (!p) continue;
        const step = txt(p, 'step');
        const alter = Math.round(num(txt(p, 'alter')));
        const octave = txt(p, 'octave');
        if (!/^[A-G]$/.test(step) || octave === '') continue;
        const ties = kids(el, 'tie');
        raw.push({
          pitch: `${step}${alter > 0 ? '#' : alter < 0 ? 'b' : ''}${octave}`,
          start: measureStart + start,
          beats: dur,
          lyric,
          tieStart: ties.some((t) => t.attrs.type === 'start'),
          tieStop: ties.some((t) => t.attrs.type === 'stop'),
        });
      }
    }
    measureStart += maxEnd;
  }
  return { raw, staves, hasLyrics, graceCount, fifths, mode, tsBeats, tsType, tempo };
}

function xmlSource(xmlText) {
  const doc = parseXml(xmlText.replace(/^\uFEFF/, ''));
  if (child(doc, 'score-timewise')) throw new Error('File MusicXML dạng "timewise" chưa hỗ trợ — hãy xuất lại từ MuseScore (mặc định là dạng partwise).');
  const score = child(doc, 'score-partwise');
  if (!score) throw new Error('Không phải file MusicXML hợp lệ.');

  const names = {};
  for (const sp of kids(child(score, 'part-list'), 'score-part')) names[sp.attrs.id] = txt(sp, 'part-name');
  const partNodes = kids(score, 'part');

  const parts = partNodes.map((pn, index) => {
    const info = extractPart(pn, 1);
    return { index, name: names[pn.attrs.id] || `Phần ${index + 1}`, staves: info.staves, noteCount: info.raw.length, hasLyrics: info.hasLyrics };
  });
  // Mặc định: phần có lời hát, không có thì phần đầu tiên có nốt
  const withLyrics = parts.find((p) => p.hasLyrics && p.noteCount > 0);
  const firstWithNotes = parts.find((p) => p.noteCount > 0);
  const defaultPart = (withLyrics || firstWithNotes || parts[0] || { index: 0 }).index;

  const work = child(score, 'work');
  const title = txt(work, 'work-title') || txt(score, 'movement-title');
  const ident = child(score, 'identification');
  const creator = (type) => { const c = kids(ident, 'creator').find((x) => x.attrs.type === type); return c ? c.text.trim().replace(/\s+/g, ' ') : ''; };

  return {
    kind: 'musicxml',
    parts,
    defaultPart,
    parse(partIndex = defaultPart, staff = 1) {
      const pn = partNodes[partIndex];
      if (!pn) throw new Error('Không có phần nhạc này.');
      const ex = extractPart(pn, staff);
      const warnings = [];
      if (ex.graceCount > 0) warnings.push(`Bỏ qua ${ex.graceCount} nốt hoa mỹ (láy) — thêm tay nếu cần.`);
      const notes = finalizeNotes(ex.raw, warnings);
      const sig = ex.tsBeats && ex.tsType ? `${ex.tsBeats}/${ex.tsType}` : null;
      return {
        notes,
        warnings,
        meta: {
          title,
          timeSignature: sig && TIME_SIGNATURES.includes(sig) ? sig : null,
          keySignature: ex.fifths !== null ? keyName(ex.fifths, ex.mode) : null,
          tempoBpm: ex.tempo,
          composer: creator('composer'),
          lyricist: creator('lyricist') || creator('poet'),
        },
      };
    },
  };
}

// ======================= MXL (MusicXML nén = file zip) =======================
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function zipEntries(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('File .mxl không phải zip hợp lệ.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, csize, lho });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = async (e) => {
    const lNameLen = dv.getUint16(e.lho + 26, true);
    const lExtraLen = dv.getUint16(e.lho + 28, true);
    const start = e.lho + 30 + lNameLen + lExtraLen;
    const data = u8.subarray(start, start + e.csize);
    if (e.method === 0) return data;
    if (e.method === 8) return inflateRaw(data);
    throw new Error('File .mxl dùng kiểu nén không hỗ trợ.');
  };
  return { entries, read };
}
async function xmlFromMxl(buf) {
  const zip = zipEntries(new Uint8Array(buf));
  const dec = new TextDecoder('utf-8');
  let rootPath = null;
  const container = zip.entries.find((e) => e.name === 'META-INF/container.xml');
  if (container) {
    const doc = parseXml(dec.decode(await zip.read(container)));
    const find = (n) => { if (n.name === 'rootfile' && n.attrs['full-path']) return n.attrs['full-path']; for (const c of n.children) { const r = find(c); if (r) return r; } return null; };
    rootPath = find(doc);
  }
  const entry = zip.entries.find((e) => e.name === rootPath) || zip.entries.find((e) => !e.name.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(e.name));
  if (!entry) throw new Error('Không tìm thấy nội dung MusicXML trong file .mxl.');
  return dec.decode(await zip.read(entry));
}

// ======================= MIDI (.mid) =======================
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiToPitch = (m) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

export function parseMidi(buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let p = 0;
  const str4 = () => { const s = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]); p += 4; return s; };
  if (str4() !== 'MThd') throw new Error('Không phải file MIDI hợp lệ.');
  const hlen = dv.getUint32(p); p += 4;
  const ntrk = dv.getUint16(p + 2);
  const division = dv.getUint16(p + 4);
  p += hlen;
  if (division & 0x8000) throw new Error('File MIDI dùng thời gian SMPTE, chưa hỗ trợ.');
  const ppq = division;
  let tempoBpm = null;
  let timeSig = null;
  const tracks = [];
  for (let t = 0; t < ntrk && p < u8.length; t++) {
    if (str4() !== 'MTrk') break;
    const len = dv.getUint32(p); p += 4;
    const end = Math.min(u8.length, p + len);
    let tick = 0, running = 0, name = '';
    const open = new Map();
    const notes = [];
    const vlq = () => { let v = 0, b; do { b = u8[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80 && p < end); return v; };
    while (p < end) {
      tick += vlq();
      let status = u8[p];
      if (status < 0x80) status = running; else { p++; if (status < 0xf0) running = status; }
      if (status === 0xff) {
        const type = u8[p++];
        const l = vlq();
        if (type === 0x51 && l === 3 && tempoBpm === null) tempoBpm = 60000000 / ((u8[p] << 16) | (u8[p + 1] << 8) | u8[p + 2]);
        else if (type === 0x58 && l >= 2 && !timeSig) timeSig = `${u8[p]}/${2 ** u8[p + 1]}`;
        else if (type === 0x03) name = new TextDecoder().decode(u8.subarray(p, p + l));
        p += l;
      } else if (status === 0xf0 || status === 0xf7) {
        p += vlq();
      } else {
        const hi = status & 0xf0, ch = status & 0x0f;
        if (hi === 0xc0 || hi === 0xd0) { p += 1; continue; }
        const d1 = u8[p++], d2 = u8[p++];
        const key = `${ch}:${d1}`;
        if (hi === 0x90 && d2 > 0) {
          if (!open.has(key)) open.set(key, []);
          open.get(key).push(tick);
        } else if (hi === 0x80 || (hi === 0x90 && d2 === 0)) {
          const st = open.get(key);
          if (st && st.length) {
            const s = st.shift();
            if (ch !== 9) notes.push({ midi: d1, startTick: s, durTick: Math.max(1, tick - s) }); // kênh 10 = trống, bỏ
          }
        }
      }
    }
    p = end;
    tracks.push({ name, notes });
  }
  return { ppq, tempoBpm, timeSig, tracks };
}

function midiSource(buf) {
  const m = parseMidi(buf);
  const usable = m.tracks.map((t, i) => ({ t, i })).filter((x) => x.t.notes.length > 0);
  const parts = usable.map((x, k) => ({ index: k, name: x.t.name || `Track ${x.i + 1}`, staves: 1, noteCount: x.t.notes.length, hasLyrics: false }));
  return {
    kind: 'midi',
    parts,
    defaultPart: 0,
    parse(partIndex = 0) {
      const tr = usable[partIndex];
      if (!tr) throw new Error('Không có track nhạc này.');
      const warnings = ['File MIDI không có lời hát và không phân biệt nốt thăng/giáng — hãy tự nhập lời, và nghe lại để kiểm tra.'];
      const raw = tr.t.notes.map((n) => ({ pitch: midiToPitch(n.midi), start: n.startTick / m.ppq, beats: n.durTick / m.ppq, lyric: '' }));
      const notes = finalizeNotes(raw, warnings);
      return {
        notes,
        warnings,
        meta: { title: '', timeSignature: m.timeSig && TIME_SIGNATURES.includes(m.timeSig) ? m.timeSig : null, keySignature: null, tempoBpm: m.tempoBpm, composer: '', lyricist: '' },
      };
    },
  };
}

// ======================= Điểm vào chính =======================
// file: đối tượng File từ <input type="file">. Trả về { kind, parts, defaultPart, parse(partIndex, staff) }.
export async function loadScoreFile(file) {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0x4d && u8[1] === 0x54 && u8[2] === 0x68 && u8[3] === 0x64) return midiSource(buf);
  if (u8[0] === 0x50 && u8[1] === 0x4b) return xmlSource(await xmlFromMxl(buf));
  return xmlSource(new TextDecoder('utf-8').decode(u8));
}
