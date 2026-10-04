// Xuất THỜI KHÓA BIỂU TỔNG THỂ TOÀN TRƯỜNG (1 bảng duy nhất gồm tất cả các lớp) ra Excel, Word và ảnh PNG.
// Có logo trường (public/logo-truong.png), màu pastel theo môn, giờ vào/ra từng tiết nếu có.
//   rows : [{ class_name, weekday: 2..7, session: 'sang'|'chieu', period, subject, teacher }]
//   bells: [{ session, period, label, start_time, end_time }]
// Không cần thêm thư viện: Excel dùng exceljs (đã có trong dự án), Word tự dựng file .docx, ảnh vẽ bằng canvas.
import { isMeetingSubject } from '@/lib/tkb';

export const SCHOOL = 'TRƯỜNG TH - THCS BIỂN BẠCH';
export const PLACE = 'Xã Biển Bạch, tỉnh Cà Mau';
export const TITLE = 'THỜI KHÓA BIỂU TỔNG THỂ TOÀN TRƯỜNG';
const LOGO_URL = '/logo-truong.png';

const SESSIONS = [
  { key: 'sang', label: 'SÁNG' },
  { key: 'chieu', label: 'CHIỀU' },
];
const hhmm = (t) => String(t || '').slice(0, 5);
const fmtVN = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');
const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[^\w-]+/g, '');

// ---------- Màu pastel cố định theo môn (giống Timetable.jsx) ----------
function hueOf(subject) {
  const s = String(subject || '').trim().toLowerCase().replace(/[\s.]+/g, '');
  let h = 7;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function hslHex(h, s, l) {
  const S = s / 100;
  const L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export const colorsOf = (subject) => {
  const h = hueOf(subject);
  return { bg: hslHex(h, 72, 93), bd: hslHex(h, 55, 82), fg: hslHex(h, 50, 22) };
};

// ---------- Dựng bảng tổng thể ----------
export function buildSchoolGrid(rows, bells) {
  const map = new Map();
  const classSet = new Set();
  const maxP = { sang: 0, chieu: 0 };
  let has7 = false;
  (rows || []).forEach((r) => {
    if (!r || isMeetingSubject(r.subject)) return;
    const cls = String(r.class_name || '').trim();
    if (!cls) return;
    classSet.add(cls);
    const key = `${r.weekday}|${r.session}|${r.period}|${cls}`;
    const old = map.get(key);
    if (old) map.set(key, { subject: `${old.subject} / ${r.subject}`, teacher: [old.teacher, r.teacher].filter(Boolean).join(', ') });
    else map.set(key, { subject: String(r.subject || '').trim(), teacher: String(r.teacher || '').trim() });
    maxP[r.session] = Math.max(maxP[r.session] || 0, Number(r.period) || 0);
    if (Number(r.weekday) === 7) has7 = true;
  });
  const classes = [...classSet].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  const days = has7 ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6];
  const sessions = SESSIONS.filter((s) => maxP[s.key] > 0).map((s) => ({ ...s, periods: Array.from({ length: maxP[s.key] }, (_, i) => i + 1) }));

  const bellMap = new Map();
  (bells || []).forEach((b) => bellMap.set(`${b.session}-${Number(b.period)}`, { start: hhmm(b.start_time), end: hhmm(b.end_time) }));
  const timeOf = (session, p) => {
    const b = bellMap.get(`${session}-${p}`);
    return b && b.start && b.end ? `${b.start.replace(/^0/, '')}-${b.end.replace(/^0/, '')}` : '';
  };

  const lines = [];
  days.forEach((d) => sessions.forEach((s) => s.periods.forEach((p, i) => lines.push({ day: d, session: s.key, sessionLabel: s.label, period: p, time: timeOf(s.key, p), firstOfSession: i === 0, sessionSpan: s.periods.length }))));
  const cell = (d, s, p, cls) => map.get(`${d}|${s}|${p}|${cls}`) || null;
  return { classes, days, sessions, lines, cell, hasTime: lines.some((l) => l.time), empty: map.size === 0 };
}

export function fileBase(effectiveFrom) {
  return `TKB-tong-the-toan-truong${effectiveFrom ? `-ap-dung-${effectiveFrom}` : ''}`;
}
export function applyText(effectiveFrom) {
  return effectiveFrom ? `Áp dụng từ ngày ${fmtVN(effectiveFrom)}` : '';
}

// ---------- Tải logo ----------
export async function loadLogoBytes() {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    return null;
  }
}
const bytesToBase64 = (bytes) => {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
};
const pngSize = (b) => (b && b.length > 24 && b[1] === 0x50 ? { w: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, h: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 } : { w: 1, h: 1 });

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// =====================================================================
// EXCEL
// =====================================================================
export async function buildSchoolExcel(rows, bells, { effectiveFrom, logo } = {}) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const g = buildSchoolGrid(rows, bells);
  const wb = new ExcelJS.Workbook();
  wb.creator = SCHOOL;
  const ws = wb.addWorksheet('TKB toàn trường', {
    pageSetup: { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
    views: [{ state: 'frozen', xSplit: 4, ySplit: 6, showGridLines: false }],
  });
  const FONT = 'Arial';
  const nCols = 4 + g.classes.length;
  ws.getColumn(1).width = 7;
  ws.getColumn(2).width = 7;
  ws.getColumn(3).width = 5.5;
  ws.getColumn(4).width = 12;
  for (let i = 0; i < g.classes.length; i += 1) ws.getColumn(5 + i).width = 15.5;

  const BLUE = 'FF1F5A96';
  const thin = (argb) => ({ style: 'thin', color: { argb } });
  const box = (argb) => ({ top: thin(argb), left: thin(argb), bottom: thin(argb), right: thin(argb) });

  // Đầu trang: logo + tên trường + tiêu đề
  const head = (r, text, size, bold, color) => {
    ws.mergeCells(r, 3, r, nCols);
    const c = ws.getCell(r, 3);
    c.value = text;
    c.font = { name: FONT, size, bold, color: { argb: color } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  };
  head(1, SCHOOL, 13, true, 'FF2C5D93');
  head(2, TITLE, 22, true, 'FF173F6B');
  head(3, [applyText(effectiveFrom), PLACE].filter(Boolean).join('   •   '), 11, false, 'FF2C5D93');
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 34;
  ws.getRow(3).height = 22;
  ws.getRow(4).height = 8;
  ws.getRow(5).height = 8;
  if (logo) {
    const id = wb.addImage({ base64: bytesToBase64(logo), extension: 'png' });
    const sz = pngSize(logo);
    const h = 78;
    ws.addImage(id, { tl: { col: 0.15, row: 0.1 }, ext: { width: Math.round((h * sz.w) / sz.h), height: h } });
  }

  // Hàng tiêu đề bảng
  const HR = 6;
  const heads = ['Thứ', 'Buổi', 'Tiết', 'Giờ', ...g.classes];
  heads.forEach((t, i) => {
    const c = ws.getCell(HR, i + 1);
    c.value = t;
    c.font = { name: FONT, size: i < 4 ? 10 : 12, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = box('FF174A7E');
  });
  ws.getRow(HR).height = 28;

  // Thân bảng
  let r = HR + 1;
  const dayFill = ['FFE8F1FB', 'FFDCEAF8'];
  let dayIdx = 0;
  g.days.forEach((d) => {
    const dayLines = g.lines.filter((l) => l.day === d);
    const startDay = r;
    dayLines.forEach((l) => {
      const row = ws.getRow(r);
      row.height = 36;
      const t = ws.getCell(r, 3);
      t.value = l.period;
      t.font = { name: FONT, size: 11, bold: true, color: { argb: 'FF173F6B' } };
      t.alignment = { horizontal: 'center', vertical: 'middle' };
      t.border = box('FFB7CFE8');
      const tm = ws.getCell(r, 4);
      tm.value = l.time || '';
      tm.font = { name: FONT, size: 9, color: { argb: 'FF4A6788' } };
      tm.alignment = { horizontal: 'center', vertical: 'middle' };
      tm.border = box('FFB7CFE8');
      g.classes.forEach((cls, i) => {
        const c = ws.getCell(r, 5 + i);
        const x = g.cell(l.day, l.session, l.period, cls);
        c.border = box('FFD3E1F0');
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        if (!x) return;
        const col = colorsOf(x.subject);
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${col.bg}` } };
        c.border = box(`FF${col.bd}`);
        c.value = { richText: [
          { font: { name: FONT, size: 11, bold: true, color: { argb: `FF${col.fg}` } }, text: x.subject },
          ...(x.teacher ? [{ font: { name: FONT, size: 9, color: { argb: `FF${col.fg}` } }, text: `\n${x.teacher}` }] : []),
        ] };
      });
      r += 1;
    });
    // Ô "Thứ" gộp dọc, ô "Buổi" gộp theo buổi
    ws.mergeCells(startDay, 1, r - 1, 1);
    const dc = ws.getCell(startDay, 1);
    dc.value = `Thứ ${d}`;
    dc.font = { name: FONT, size: 12, bold: true, color: { argb: 'FF173F6B' } };
    dc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dayFill[dayIdx % 2] } };
    dc.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
    for (let rr = startDay; rr < r; rr += 1) ws.getCell(rr, 1).border = box('FFB7CFE8');
    let sr = startDay;
    g.sessions.forEach((s) => {
      ws.mergeCells(sr, 2, sr + s.periods.length - 1, 2);
      const sc = ws.getCell(sr, 2);
      sc.value = s.label;
      sc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF2C5D93' } };
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.key === 'sang' ? 'FFF3F8FD' : 'FFFFF6E8' } };
      sc.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
      for (let rr = sr; rr < sr + s.periods.length; rr += 1) ws.getCell(rr, 2).border = box('FFB7CFE8');
      sr += s.periods.length;
    });
    // đường kẻ đậm giữa các thứ
    for (let c = 1; c <= nCols; c += 1) {
      const cell = ws.getCell(r - 1, c);
      cell.border = { ...cell.border, bottom: { style: 'medium', color: { argb: BLUE } } };
    }
    dayIdx += 1;
  });

  r += 1;
  ws.mergeCells(r, 1, r, nCols);
  const foot = ws.getCell(r, 1);
  foot.value = `${SCHOOL} • Thời khóa biểu xuất ngày ${fmtVN(new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10))}`;
  foot.font = { name: FONT, size: 9, italic: true, color: { argb: 'FF6C86A3' } };
  foot.alignment = { horizontal: 'right' };
  ws.pageSetup.printArea = `A1:${ws.getColumn(nCols).letter}${r}`;
  ws.pageSetup.printTitlesRow = `${HR}:${HR}`;

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// =====================================================================
// WORD (.docx tự dựng, không cần thư viện)
// =====================================================================
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
// Gói zip kiểu "store" (không nén) đủ cho .docx
export function zipStore(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  files.forEach((f) => {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    parts.push(local, name, data);
    central.push({ name, crc, size: data.length, offset });
    offset += local.length + name.length + data.length;
  });
  const cdStart = offset;
  central.forEach((c) => {
    const h = Uint8Array.from([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c.crc), ...u32(c.size), ...u32(c.size), ...u16(c.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.offset)]);
    parts.push(h, c.name);
    offset += h.length + c.name.length;
  });
  const cdSize = offset - cdStart;
  parts.push(Uint8Array.from([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(cdStart), ...u16(0)]));
  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

const xe = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FONTX = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>';
const run = (text, { sz = 18, bold = false, color = '000000', italic = false } = {}) => `<w:r><w:rPr>${FONTX}${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xe(text)}</w:t></w:r>`;
const para = (runs, { jc = 'center', before = 0, after = 0 } = {}) => `<w:p><w:pPr><w:spacing w:before="${before}" w:after="${after}" w:line="240" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>${runs}</w:p>`;
const tcBorders = (color, sz = 4) => `<w:tcBorders>${['top', 'left', 'bottom', 'right'].map((s) => `<w:${s} w:val="single" w:sz="${sz}" w:space="0" w:color="${color}"/>`).join('')}</w:tcBorders>`;
const tc = (w, content, { fill, vMerge, dir, border = 'BFD3E8', span } = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span ? `<w:gridSpan w:val="${span}"/>` : ''}${vMerge ? (vMerge === 'restart' ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>') : ''}${tcBorders(border)}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}${dir ? `<w:textDirection w:val="${dir}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${content || '<w:p/>'}</w:tc>`;

export function buildSchoolDocx(rows, bells, { effectiveFrom, logo } = {}) {
  const g = buildSchoolGrid(rows, bells);
  const PAGE_W = 23811; // A3 ngang
  const PAGE_H = 16838;
  const MARGIN = 567;
  const usable = PAGE_W - MARGIN * 2;
  const wDay = 620;
  const wSess = 620;
  const wPer = 560;
  const wTime = g.hasTime ? 1000 : 0;
  const fixedW = wDay + wSess + wPer + wTime;
  const wCls = Math.floor((usable - fixedW) / Math.max(1, g.classes.length));
  const tableW = fixedW + wCls * g.classes.length;

  const sz = pngSize(logo);
  const logoH = 900000; // EMU
  const logoW = Math.round((logoH * sz.w) / sz.h);
  const drawing = logo ? `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${logoW}" cy="${logoH}"/><wp:docPr id="1" name="Logo" descr="Logo trường"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${logoW}" cy="${logoH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>` : '';

  // Đầu trang: logo (trái) + tên trường, tiêu đề
  const noB = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
  const headTable = `<w:tbl><w:tblPr><w:tblW w:w="${tableW}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${noB}</w:tblPr><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="${tableW - 4000}"/><w:gridCol w:w="2000"/></w:tblGrid><w:tr>`
    + `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="left"/></w:pPr>${drawing}</w:p></w:tc>`
    + `<w:tc><w:tcPr><w:tcW w:w="${tableW - 4000}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${para(run(SCHOOL, { sz: 28, bold: true, color: '2C5D93' }), { after: 20 })}${para(run(TITLE, { sz: 44, bold: true, color: '173F6B' }), { after: 20 })}${para(run([applyText(effectiveFrom), PLACE].filter(Boolean).join('   •   '), { sz: 22, color: '2C5D93' }))}</w:tc>`
    + '<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr><w:p/></w:tc></w:tr></w:tbl>';

  const grid = `<w:tblGrid><w:gridCol w:w="${wDay}"/><w:gridCol w:w="${wSess}"/><w:gridCol w:w="${wPer}"/>${wTime ? `<w:gridCol w:w="${wTime}"/>` : ''}${g.classes.map(() => `<w:gridCol w:w="${wCls}"/>`).join('')}</w:tblGrid>`;
  const HB = '174A7E';
  const hcell = (w, t) => tc(w, para(run(t, { sz: 22, bold: true, color: 'FFFFFF' })), { fill: '1F5A96', border: HB });
  const headRow = `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="480" w:hRule="atLeast"/><w:tblHeader/></w:trPr>${hcell(wDay, 'Thứ')}${hcell(wSess, 'Buổi')}${hcell(wPer, 'Tiết')}${wTime ? hcell(wTime, 'Giờ') : ''}${g.classes.map((c) => hcell(wCls, c)).join('')}</w:tr>`;

  const dayFill = ['E8F1FB', 'DCEAF8'];
  let body = '';
  g.days.forEach((d, di) => {
    const dl = g.lines.filter((l) => l.day === d);
    dl.forEach((l, idx) => {
      const last = idx === dl.length - 1;
      const edge = last ? '1F5A96' : 'B7CFE8';
      let cells = '';
      cells += tc(wDay, idx === 0 ? para(run(`Thứ ${d}`, { sz: 22, bold: true, color: '173F6B' })) : '', { fill: dayFill[di % 2], vMerge: idx === 0 ? 'restart' : 'continue', dir: 'btLr', border: 'B7CFE8' });
      cells += tc(wSess, l.firstOfSession ? para(run(l.sessionLabel, { sz: 18, bold: true, color: '2C5D93' })) : '', { fill: l.session === 'sang' ? 'F3F8FD' : 'FFF6E8', vMerge: l.firstOfSession ? 'restart' : 'continue', dir: 'btLr', border: 'B7CFE8' });
      cells += tc(wPer, para(run(String(l.period), { sz: 20, bold: true, color: '173F6B' })), { border: edge });
      if (wTime) cells += tc(wTime, para(run(l.time, { sz: 15, color: '4A6788' })), { border: edge });
      g.classes.forEach((cls) => {
        const x = g.cell(l.day, l.session, l.period, cls);
        if (!x) { cells += tc(wCls, '', { border: edge }); return; }
        const col = colorsOf(x.subject);
        cells += tc(wCls, para(run(x.subject, { sz: 19, bold: true, color: col.fg }), { before: 20 }) + (x.teacher ? para(run(x.teacher, { sz: 16, color: col.fg }), { after: 20 }) : ''), { fill: col.bg, border: col.bd });
      });
      body += `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="600" w:hRule="atLeast"/></w:trPr>${cells}</w:tr>`;
    });
  });

  const mainTable = `<w:tbl><w:tblPr><w:tblW w:w="${tableW}" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar></w:tblPr>${grid}${headRow}${body}</w:tbl>`;
  const stamp = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const footer = para(run(`${SCHOOL} • Thời khóa biểu xuất ngày ${fmtVN(stamp)}`, { sz: 16, italic: true, color: '6C86A3' }), { jc: 'right', before: 120 });

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${headTable}${para('', { after: 60 })}${mainTable}${footer}<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}" w:orient="landscape"/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>';
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${logo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : ''}</Relationships>`;

  const files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/_rels/document.xml.rels', data: docRels },
  ];
  if (logo) files.push({ name: 'word/media/logo.png', data: logo });
  return zipStore(files);
}

// =====================================================================
// ẢNH PNG (canvas)
// =====================================================================
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function fitText(ctx, text, maxW) {
  let t = String(text || '');
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}
function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = fitText(ctx, `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, maxW);
    return kept;
  }
  return lines;
}

// Vẽ lên canvas do nơi gọi cung cấp (trình duyệt hoặc node-canvas khi kiểm thử). Trả về { width, height, scale }.
export function renderSchoolCanvas(makeCanvas, g, { effectiveFrom, logoImage } = {}) {
  const FONT = '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  const PAD = 40;
  const DAYW = 54;
  const SESSW = 50;
  const PERW = g.hasTime ? 118 : 56;
  const COLW = g.classes.length > 14 ? 112 : 128;
  const ROWH = 56;
  const GAP = 3;
  const HEAD = 150;
  const TH = 46;
  const W = PAD * 2 + DAYW + SESSW + PERW + COLW * g.classes.length;
  const dayH = (d) => g.lines.filter((l) => l.day === d).length * ROWH + 8;
  const H = HEAD + 22 + TH + g.days.reduce((s, d) => s + dayH(d) + 8, 0) + 52;
  let S = 2;
  while (W * H * S * S > 70e6 && S > 1) S -= 1;

  const canvas = makeCanvas(W * S, H * S);
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // đầu trang
  const gr = ctx.createLinearGradient(0, 0, W, HEAD);
  gr.addColorStop(0, '#dcecfb');
  gr.addColorStop(1, '#bcd8f5');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, HEAD);
  const cy = HEAD / 2;
  const cx = PAD + 48;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, 48, 0, Math.PI * 2); ctx.fill();
  if (logoImage) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 43, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logoImage, cx - 43, cy - 43, 86, 86);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2c5d93';
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(SCHOOL, W / 2, cy - 36);
  ctx.fillStyle = '#173f6b';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(TITLE, W / 2, cy + 4);
  ctx.fillStyle = '#2c5d93';
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText([applyText(effectiveFrom), PLACE].filter(Boolean).join('   •   '), W / 2, cy + 44);

  // hàng tiêu đề lớp
  let y = HEAD + 22;
  const x0 = PAD;
  const xCls = x0 + DAYW + SESSW + PERW;
  ctx.fillStyle = '#1f5a96';
  roundRect(ctx, x0, y, DAYW + SESSW + PERW, TH, 10); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText('Thứ / Buổi / Tiết', x0 + (DAYW + SESSW + PERW) / 2, y + TH / 2);
  g.classes.forEach((c, i) => {
    const x = xCls + i * COLW;
    ctx.fillStyle = '#1f5a96';
    roundRect(ctx, x + GAP, y, COLW - GAP * 2, TH, 10); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 20px ${FONT}`;
    ctx.fillText(c, x + COLW / 2, y + TH / 2);
  });
  y += TH + 8;

  // thân bảng
  g.days.forEach((d, di) => {
    const dl = g.lines.filter((l) => l.day === d);
    const top = y;
    const hh = dayH(d);
    ctx.fillStyle = di % 2 ? '#f3f8fd' : '#ffffff';
    roundRect(ctx, x0 - 4, top - 2, W - PAD * 2 + 8, hh + 4, 12); ctx.fill();
    ctx.strokeStyle = '#c9dcf0';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x0 - 4, top - 2, W - PAD * 2 + 8, hh + 4, 12); ctx.stroke();
    // nhãn thứ (xoay dọc)
    ctx.fillStyle = '#d6e7f8';
    roundRect(ctx, x0, top + 2, DAYW - 4, hh - 4, 10); ctx.fill();
    ctx.save();
    ctx.translate(x0 + (DAYW - 4) / 2, top + hh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#173f6b';
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`THỨ ${d}`, 0, 0);
    ctx.restore();

    let ry = top + 4;
    let sessTop = ry;
    dl.forEach((l, idx) => {
      if (l.firstOfSession) sessTop = ry;
      // nhãn buổi khi hết buổi
      const endSession = idx === dl.length - 1 || dl[idx + 1].firstOfSession;
      // tiết + giờ
      ctx.textAlign = 'center';
      ctx.fillStyle = '#173f6b';
      ctx.font = `800 20px ${FONT}`;
      ctx.fillText(String(l.period), x0 + DAYW + SESSW + (g.hasTime ? 22 : PERW / 2), ry + ROWH / 2 - 1);
      if (g.hasTime) {
        ctx.fillStyle = '#4a6788';
        ctx.font = `500 12px ${FONT}`;
        ctx.fillText(l.time, x0 + DAYW + SESSW + 78, ry + ROWH / 2 - 1);
      }
      g.classes.forEach((cls, i) => {
        const x = xCls + i * COLW;
        const cell = g.cell(l.day, l.session, l.period, cls);
        if (!cell) return;
        const col = colorsOf(cell.subject);
        ctx.fillStyle = `#${col.bg}`;
        roundRect(ctx, x + GAP, ry + GAP / 2, COLW - GAP * 2, ROWH - GAP, 9); ctx.fill();
        ctx.strokeStyle = `#${col.bd}`;
        ctx.lineWidth = 1;
        roundRect(ctx, x + GAP, ry + GAP / 2, COLW - GAP * 2, ROWH - GAP, 9); ctx.stroke();
        ctx.fillStyle = `#${col.fg}`;
        ctx.font = `700 16px ${FONT}`;
        const subj = wrapLines(ctx, cell.subject, COLW - 16, cell.teacher ? 1 : 2);
        const teach = cell.teacher ? fitText(ctx, cell.teacher, COLW - 16) : '';
        const totalH = subj.length * 18 + (teach ? 15 : 0);
        let ty = ry + ROWH / 2 - totalH / 2 + 9;
        subj.forEach((s) => { ctx.font = `700 16px ${FONT}`; ctx.fillText(s, x + COLW / 2, ty); ty += 18; });
        if (teach) { ctx.font = `500 12.5px ${FONT}`; ctx.fillText(teach, x + COLW / 2, ty + 1); }
      });
      if (endSession) {
        const sh = ry + ROWH - sessTop;
        ctx.fillStyle = l.session === 'sang' ? '#e9f2fc' : '#fff1dc';
        roundRect(ctx, x0 + DAYW, sessTop + 1, SESSW - 4, sh - 2, 8); ctx.fill();
        ctx.save();
        ctx.translate(x0 + DAYW + (SESSW - 4) / 2, sessTop + sh / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#2c5d93';
        ctx.font = `700 14px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(l.sessionLabel, 0, 0);
        ctx.restore();
        if (idx < dl.length - 1) {
          ctx.strokeStyle = '#c9dcf0';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 5]);
          ctx.beginPath(); ctx.moveTo(x0 + DAYW + SESSW - 2, ry + ROWH + 1); ctx.lineTo(W - PAD, ry + ROWH + 1); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ry += ROWH;
    });
    y = top + hh + 8;
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = '#6c86a3';
  ctx.font = `italic 500 13px ${FONT}`;
  ctx.fillText(`${SCHOOL} • Thời khóa biểu xuất ngày ${fmtVN(new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10))}`, W - PAD, H - 26);
  return { canvas, width: W, height: H, scale: S };
}

async function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function buildSchoolPng(rows, bells, { effectiveFrom } = {}) {
  const g = buildSchoolGrid(rows, bells);
  const logoImage = await loadImage(LOGO_URL);
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* bỏ qua */ } }
  const { canvas } = renderSchoolCanvas((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }, g, { effectiveFrom, logoImage });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// ---------- Hàm gọi nhanh từ nút bấm ----------
export async function exportSchool(kind, rows, bells, { effectiveFrom } = {}) {
  const base = fileBase(effectiveFrom);
  if (kind === 'png') {
    downloadBlob(await buildSchoolPng(rows, bells, { effectiveFrom }), `${base}.png`);
    return;
  }
  const logo = await loadLogoBytes();
  if (kind === 'xlsx') downloadBlob(await buildSchoolExcel(rows, bells, { effectiveFrom, logo }), `${base}.xlsx`);
  else if (kind === 'docx') downloadBlob(buildSchoolDocx(rows, bells, { effectiveFrom, logo }), `${base}.docx`);
}
export { slug };
