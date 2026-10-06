// Nhập "Bảng phân công chuyên môn" (mẫu Phụ lục IX, Công văn 3236/SGDĐT-GDTrH) vào công cụ soạn thời khóa biểu.
// Đầu vào là mảng-của-mảng (giống XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })).
// Quy tắc tính toán thuần JavaScript, không phải AI ngôn ngữ, không phụ thuộc thư viện ngoài.
//
// Cách hiểu cột "Giảng dạy": mỗi đoạn có dạng "Môn lớp1, lớp2 (Nt)" với N là TỔNG số tiết/tuần của cả nhóm lớp
// (ví dụ "Toán 6A1, 6A3 (8t)" = 4 tiết mỗi lớp). Tiết không có lớp cụ thể (SHDC, Trí tuệ nhân tạo...) vẫn tính vào
// tổng số tiết của giáo viên nhưng KHÔNG được xếp vào lưới thời khóa biểu. Chuyên đề (bồi dưỡng học sinh giỏi) và
// kiêm nhiệm (chủ nhiệm, tổ trưởng...) cũng chỉ tính vào tổng, không xếp lưới.
import { newId, mergeCfg, subjKey } from '@/lib/tkbSolver';

const plain = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '');
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const nameKey = (s) => String(s || '').trim().toLowerCase();
const gradeOf = (cls) => (String(cls).match(/\d+/) || [''])[0];
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s.startsWith('=')) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Số tiết/tuần của từng môn theo chương trình (dùng khi trường thực hiện như nhau ở các khối). Có thể sửa ở bước 2.
export const STD_CURRICULUM = {
  'Toán': 4, 'Văn': 4, 'T. Anh': 3, 'GDCD': 1, 'LS&ĐL': 3, 'KHTN': 4, 'Công nghệ': 1, 'Tin học': 1,
  'GDTC': 2, 'MT': 1, 'Nhạc': 1, 'HĐTN-HN': 1, 'GDĐP': 1,
};

// ---------- Tên môn ----------
export function mapSubject(text) {
  const raw = clean(text);
  const pm = raw.match(/\(([^)]*)\)/);
  const partRaw = pm ? clean(pm[1]) : '';
  const head = clean(raw.replace(/\([^)]*\)/g, ' '));
  const hk = plain(head);
  const pk = plain(partRaw);
  if (!hk) return { kind: 'unknown', label: raw, part: '' };
  if (hk.startsWith('shdc') || hk.startsWith('sinhhoatduoico')) return { kind: 'shdc', label: 'SHDC', part: '' };
  if (hk.includes('tritue')) return { kind: 'other', label: 'Trí tuệ nhân tạo (AI)', part: '' };
  if (hk.startsWith('lichsu')) {
    const part = pk.startsWith('dia') ? 'Địa' : pk.startsWith('su') || !pk ? 'Sử' : partRaw;
    return { kind: 'teach', label: 'LS&ĐL', part };
  }
  if (hk === 'khtn' || hk.startsWith('khoahoctunhien')) {
    let part = partRaw;
    if (pk === 'ly' || pk === 'vatli' || pk === 'vatly') part = 'Lý';
    else if (pk === 'hoa' || pk === 'hoahoc') part = 'Hóa';
    else if (pk === 'sinh' || pk === 'sinhhoc') part = 'Sinh';
    else if (pk === 'sinhhoa' || pk === 'hoasinh') part = 'Sinh-Hóa';
    return { kind: 'teach', label: 'KHTN', part };
  }
  const map = [
    [['toan'], 'Toán'], [['van', 'nguvan'], 'Văn'], [['tanh', 'tienganh', 'anh'], 'T. Anh'], [['gdcd', 'giaoduccongdan'], 'GDCD'],
    [['cnghe', 'congnghe'], 'Công nghệ'], [['tinhoc'], 'Tin học'], [['td', 'gdtc', 'theduc', 'giaoducthechat'], 'GDTC'],
    [['mt', 'mithuat', 'mythuat'], 'MT'], [['nhac', 'amnhac'], 'Nhạc'], [['gddp', 'gdcdp', 'giaoducdiaphuong'], 'GDĐP'],
  ];
  for (const [keys, label] of map) if (keys.includes(hk)) return { kind: 'teach', label, part: '' };
  if (hk.startsWith('hdtn') || hk.startsWith('hoatdongtrainghiem')) return { kind: 'teach', label: 'HĐTN-HN', part: '' };
  return { kind: 'unknown', label: head || raw, part: '' };
}

// Cột "Môn dạy, HĐGD" của giáo viên -> các nhãn môn mà họ đủ khả năng dạy
export function fieldToLabels(f) {
  const k = plain(f);
  const m = {
    toan: ['Toán'], vatli: ['KHTN'], vatly: ['KHTN'], ly: ['KHTN'], hoahoc: ['KHTN'], hoa: ['KHTN'], sinhhoc: ['KHTN'], sinh: ['KHTN'], khtn: ['KHTN'],
    diali: ['LS&ĐL'], dialy: ['LS&ĐL'], dia: ['LS&ĐL'], lichsu: ['LS&ĐL'], nguvan: ['Văn'], van: ['Văn'], tienganh: ['T. Anh'], anh: ['T. Anh'],
    gdtc: ['GDTC'], theduc: ['GDTC'], tinhoc: ['Tin học'], congnghe: ['Công nghệ'], mithuat: ['MT'], mythuat: ['MT'], mt: ['MT'],
    amnhac: ['Nhạc'], nhac: ['Nhạc'], gdcd: ['GDCD'],
  };
  return m[k] || (clean(f) ? [clean(f)] : []);
}

// ---------- Tách chuỗi "Giảng dạy" ----------
const COUNT_SRC = '\\(\\s*(\\d+)\\s*t?\\s*\\)';
const CLASS_SRC = '(?<![0-9])([6-9]A\\d{1,2})(?!\\d)';

export function splitSegments(text) {
  const src = String(text || '').replace(/\r?\n/g, '; ');
  const out = [];
  const addPiece = (piece, n) => {
    const t = clean(piece).replace(/^[,\s]+|[,\s]+$/g, '');
    if (!t) return;
    if (/^\(.*\)$/.test(t)) {
      if (out.length) out[out.length - 1].note = clean(`${out[out.length - 1].note || ''} ${t.replace(/^\(|\)$/g, '')}`);
      return;
    }
    out.push({ body: t, n, note: '' });
  };
  const push = (chunk, n) => {
    const pieces = chunk.split(';');
    for (let i = 0; i < pieces.length - 1; i += 1) addPiece(pieces[i], null);
    addPiece(pieces[pieces.length - 1], n);
  };
  const re = new RegExp(COUNT_SRC, 'gi');
  let last = 0;
  let m;
  while ((m = re.exec(src))) { push(src.slice(last, m.index), Number(m[1])); last = m.index + m[0].length; }
  push(src.slice(last), null);
  return out;
}

function readSegment(seg) {
  const classes = [];
  const dups = [];
  const body = seg.body.replace(new RegExp(CLASS_SRC, 'gi'), (all, c) => {
    const u = c.toUpperCase();
    (classes.includes(u) ? dups : classes).push(u);
    return ' ';
  });
  const sub = mapSubject(clean(body.replace(/[,;]+/g, ' ')));
  return { ...seg, classes, dups, sub };
}

function share(n, list) {
  const base = Math.floor(n / list.length);
  const rem = n % list.length;
  return list.map((cls, i) => ({ cls, periods: base + (i < rem ? 1 : 0) }));
}

// ---------- Đọc cả bảng ----------
function findCols(aoa) {
  const def = { name: 1, chucVu: 2, namSinh: 3, namVao: 4, mon: 5, trinhDo: 6, gd: 7, gdN: 8, cd: 9, cdN: 10, kn: 11, knN: 12, tong: 13, chuan: 14 };
  for (let r = 0; r < Math.min(aoa.length, 30); r += 1) {
    const row = aoa[r] || [];
    const idx = (re) => row.findIndex((c) => re.test(plain(c)));
    const name = idx(/^hovaten$/);
    if (name < 0) continue;
    const col = { ...def, name, headerRow: r };
    const set = (k, i) => { if (i >= 0) col[k] = i; };
    set('chucVu', idx(/^chucvu$/)); set('namSinh', idx(/^namsinh$/)); set('namVao', idx(/^namvaonganh$/));
    set('mon', idx(/^mondayhdgd$|^monday/)); set('trinhDo', idx(/^trinhdo/));
    const gd = idx(/^giangday$/); if (gd >= 0) { col.gd = gd; col.gdN = gd + 1; }
    const cd = idx(/^chuyende/); if (cd >= 0) { col.cd = cd; col.cdN = cd + 1; }
    const kn = idx(/^kiemnhiem$/); if (kn >= 0) { col.kn = kn; col.knN = kn + 1; }
    set('tong', idx(/^tongsotiet/)); set('chuan', idx(/^tietchuan$/));
    return col;
  }
  return { ...def, headerRow: -1 };
}

export function parsePccm(aoa, opts = {}) {
  const col = findCols(aoa);
  const issues = [];
  const issue = (level, teacher, text) => issues.push({ level, teacher: teacher || '', text });
  const teachers = [];
  let to = '';
  let cur = null;
  let title = '';
  for (let r = 0; r < Math.min(aoa.length, (col.headerRow >= 0 ? col.headerRow : 12)); r += 1) {
    const t = clean((aoa[r] || []).find((c) => /phancongchuyenmon/.test(plain(c))) || '');
    if (t) title = t;
  }
  const start = col.headerRow >= 0 ? col.headerRow + 1 : 12;
  const cell = (row, i) => (i >= 0 && i < row.length ? row[i] : null);
  for (let r = start; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    const name = clean(cell(row, col.name));
    const f = clean(cell(row, col.mon));
    const h = clean(cell(row, col.gd));
    const c = clean(cell(row, col.chucVu));
    const a = clean(cell(row, 0));
    if (/^lop$|^tiet|^so tiet/i.test(plain(h)) && !name) continue; // hàng tiêu đề thứ hai
    if (name) {
      if (!a && !c && !f && !h) { to = name; cur = null; continue; }
      cur = {
        name, tt: a, to, chucVu: c, namSinh: toNum(cell(row, col.namSinh)), namVaoNganh: toNum(cell(row, col.namVao)),
        trinhDo: clean(cell(row, col.trinhDo)), monRaw: [], texts: [], iSum: 0,
        chuyenDeText: '', chuyenDe: 0, kiemNhiemText: '', kiemNhiem: 0, chuan: toNum(cell(row, col.chuan)), ghiChu: '', _row: r + 1,
      };
      teachers.push(cur);
    } else if (!cur || (!f && !h)) continue;
    if (!cur) continue;
    if (f && !cur.monRaw.includes(f)) cur.monRaw.push(f);
    const i1 = toNum(cell(row, col.gdN));
    if (h) cur.texts.push({ text: h, i: i1 });
    if (i1 !== null) cur.iSum += i1;
    const cdText = clean(cell(row, col.cd)); if (cdText) cur.chuyenDeText = cur.chuyenDeText ? `${cur.chuyenDeText}; ${cdText}` : cdText;
    const cdN = toNum(cell(row, col.cdN)); if (cdN !== null) cur.chuyenDe += cdN;
    const knText = clean(cell(row, col.kn)); if (knText) cur.kiemNhiemText = cur.kiemNhiemText ? `${cur.kiemNhiemText}; ${knText}` : knText;
    const knN = toNum(cell(row, col.knN)); if (knN !== null) cur.kiemNhiem += knN;
    const ch = toNum(cell(row, col.chuan)); if (ch !== null && cur.chuan === null) cur.chuan = ch;
    for (let k = col.chuan + 1; k < row.length; k += 1) { // ghi chú nằm sau cột chênh lệch
      const v = row[k];
      if (typeof v === 'string' && v.trim() && !v.trim().startsWith('=')) cur.ghiChu = cur.ghiChu ? `${cur.ghiChu}; ${clean(v)}` : clean(v);
    }
  }

  // Đọc từng đoạn "Giảng dạy"
  const segsByT = teachers.map((t) => {
    return t.texts.flatMap((x) => {
      const part = splitSegments(x.text).map(readSegment);
      const un = part.filter((s) => s.n === null);
      const sum = part.reduce((acc, s) => acc + (s.n || 0), 0);
      // Đoạn không ghi số tiết nhưng là đoạn duy nhất của hàng: lấy phần còn lại của ô "Số tiết (1)" cùng hàng
      if (un.length === 1 && x.i !== null && x.i - sum > 0) un[0].n = x.i - sum;
      return part;
    });
  });
  // Danh sách lớp hợp lệ: lớp đã biết (opts.knownClasses) hoặc lớp xuất hiện từ 4 đoạn trở lên
  const freq = new Map();
  segsByT.flat().forEach((s) => [...s.classes, ...s.dups].forEach((c) => freq.set(c, (freq.get(c) || 0) + 1)));
  const known = new Set((opts.knownClasses || []).map((c) => String(c).toUpperCase()));
  const official = known.size ? known : new Set([...freq].filter(([, n]) => n >= 4).map(([c]) => c));
  const officialByGrade = {};
  official.forEach((c) => { (officialByGrade[gradeOf(c)] ||= []).push(c); });
  Object.values(officialByGrade).forEach((l) => l.sort());
  // Lớp đã có giáo viên theo từng môn (để đoán lớp bị gõ trùng)
  const covered = new Set();
  segsByT.flat().forEach((s) => { if (s.sub.kind === 'teach') s.classes.forEach((c) => covered.add(`${s.sub.label}|${s.sub.part}|${c}`)); });

  const lines = [];
  const pending = [];
  const out = teachers.map((t, ti) => {
    const segs = segsByT[ti];
    const other = [];
    const subjectsUsed = new Set();
    let counted = 0;
    segs.forEach((s) => { if (s.n !== null) counted += s.n; });
    segs.forEach((s) => {
      let n = s.n;
      if (n === null) { n = 0; issue('warn', t.name, `Đoạn “${s.body}” không ghi số tiết nên chưa tính. Hãy thêm số tiết cho giáo viên này.`); }
      const src = `${s.body}${s.n === null ? '' : ` (${s.n}t)`}`;
      if (s.sub.kind === 'shdc' || s.sub.kind === 'other') { other.push({ text: clean(s.body), periods: n }); return; }
      if (s.sub.kind === 'unknown') {
        issue('warn', t.name, `Không nhận ra môn “${s.sub.label}” trong đoạn “${src}”. ${s.classes.length ? 'Đoạn này được nhập như một môn mới.' : 'Đoạn này chỉ tính vào tổng tiết, không xếp lưới.'}`);
        if (!s.classes.length) { other.push({ text: clean(s.body), periods: n }); return; }
      }
      if (!s.classes.length && !s.dups.length) {
        issue('warn', t.name, `Đoạn “${src}” không thấy tên lớp nên chỉ tính vào tổng tiết, không xếp lưới.`);
        other.push({ text: clean(s.body), periods: n });
        return;
      }
      let list = [...s.classes];
      s.dups.forEach((d) => {
        const miss = (officialByGrade[gradeOf(d)] || []).filter((c) => !list.includes(c) && !covered.has(`${s.sub.label}|${s.sub.part}|${c}`));
        if (miss.length === 1) {
          list = [...list, miss[0]];
          covered.add(`${s.sub.label}|${s.sub.part}|${miss[0]}`);
          issue('warn', t.name, `Đoạn “${src}” ghi lớp ${d} hai lần, trong khi lớp ${miss[0]} chưa có giáo viên môn ${s.sub.label}. Hệ thống tạm hiểu là lớp ${miss[0]}, hãy kiểm tra lại.`);
        } else {
          issue('error', t.name, `Đoạn “${src}” ghi lớp ${d} hai lần. Hệ thống chỉ tính một lần, hãy kiểm tra số tiết các lớp.`);
        }
      });
      if (!s.sub.part && list.length > 0 && n % list.length !== 0) {
        const g = gradeOf(list[0]);
        const miss = (officialByGrade[g] || []).filter((c) => !list.includes(c) && !covered.has(`${s.sub.label}||${c}`));
        if (list.every((c) => gradeOf(c) === g) && miss.length === 1 && n % (list.length + 1) === 0) {
          list = [...list, miss[0]];
          covered.add(`${s.sub.label}||${miss[0]}`);
          issue('warn', t.name, `Đoạn “${src}”: ${n} tiết không chia đều cho ${list.length - 1} lớp, mà lớp ${miss[0]} chưa có giáo viên môn ${s.sub.label}. Hệ thống tạm thêm lớp ${miss[0]}, hãy kiểm tra lại.`);
        }
      }
      const bad = list.filter((c) => !official.has(c));
      if (bad.length) issue('error', t.name, `Đoạn “${src}” có lớp ${bad.join(', ')} không có trong danh sách lớp của trường (có thể gõ nhầm). Phần tiết của lớp này không được nhập.`);
      if (n % list.length !== 0 && STD_CURRICULUM[s.sub.label]) {
        pending.push({ t, s, list, n, src });
      } else {
        share(n, list).forEach(({ cls, periods }) => {
          if (!official.has(cls)) return;
          if (periods > 0) lines.push({ cls, subject: s.sub.label, part: s.sub.part, teacher: t.name, periods, src, note: s.note });
        });
        if (n % list.length !== 0) issue('warn', t.name, `Đoạn “${src}”: ${n} tiết chia cho ${list.length} lớp không đều, hệ thống chia ${share(n, list).map((x) => `${x.cls}=${x.periods}`).join(', ')}. Hãy kiểm tra.`);
      }
      subjectsUsed.add(s.sub.label);
    });
    if (t.iSum && counted !== t.iSum) issue('warn', t.name, `Cột “Số tiết (1)” ghi ${t.iSum} nhưng cộng các đoạn Giảng dạy được ${counted}. Hãy kiểm tra lại số tiết.`);
    const cdCount = (t.chuyenDeText.match(new RegExp(COUNT_SRC, 'i')) || [])[1];
    if (cdCount && Number(cdCount) !== t.chuyenDe) issue('warn', t.name, `Chuyên đề ghi (${cdCount}t) nhưng cột số tiết (2) là ${t.chuyenDe}.`);
    if (t.chuan === null) issue('warn', t.name, 'Chưa ghi “Tiết chuẩn”. Hệ thống tạm lấy bằng số tiết đang dạy, hãy nhập lại tiết chuẩn.');
    const homeroom = [...String(t.kiemNhiemText).matchAll(/\bCN\s*([6-9]A\d{1,2})/gi)].map((m) => m[1].toUpperCase());
    const subjects = new Set([...t.monRaw.flatMap(fieldToLabels), ...subjectsUsed]);
    return {
      name: t.name, tt: t.tt, to: t.to, chucVu: t.chucVu, namSinh: t.namSinh, namVaoNganh: t.namVaoNganh, trinhDo: t.trinhDo,
      monDay: t.monRaw.join(', '), subjects: [...subjects],
      chuyenDe: { text: t.chuyenDeText, periods: t.chuyenDe }, kiemNhiem: { text: t.kiemNhiemText, periods: t.kiemNhiem },
      other, chuan: t.chuan, ghiChu: t.ghiChu, homeroom, _iSum: t.iSum,
    };
  });

  // Đoạn chia không đều: mọi lớp nhận phần chia nguyên trước, phần dư dồn cho lớp còn thiếu nhiều tiết nhất theo chương trình
  const have = new Map();
  const hk = (label, cls) => `${label}|${cls}`;
  lines.forEach((l) => have.set(hk(l.subject, l.cls), (have.get(hk(l.subject, l.cls)) || 0) + l.periods));
  const plan = pending.map((p) => {
    const base = Math.floor(p.n / p.list.length);
    const rows = p.list.map((cls) => ({ cls, periods: base }));
    rows.forEach((r) => { if (official.has(r.cls)) have.set(hk(p.s.sub.label, r.cls), (have.get(hk(p.s.sub.label, r.cls)) || 0) + base); });
    return { ...p, rows, rem: p.n % p.list.length };
  });
  plan.forEach((p) => {
    const need = STD_CURRICULUM[p.s.sub.label];
    for (let k = 0; k < p.rem; k += 1) {
      const pick = p.rows
        .map((r, i) => ({ r, i, gap: need - (have.get(hk(p.s.sub.label, r.cls)) || 0) }))
        .sort((x, y) => y.gap - x.gap || x.i - y.i)[0];
      pick.r.periods += 1;
      if (official.has(pick.r.cls)) have.set(hk(p.s.sub.label, pick.r.cls), (have.get(hk(p.s.sub.label, pick.r.cls)) || 0) + 1);
    }
    p.rows.forEach((r) => {
      if (official.has(r.cls) && r.periods > 0) lines.push({ cls: r.cls, subject: p.s.sub.label, part: p.s.sub.part, teacher: p.t.name, periods: r.periods, src: p.src, note: p.s.note });
    });
    issue('warn', p.t.name, `Đoạn “${p.src}”: ${p.n} tiết chia cho ${p.list.length} lớp không đều. Hệ thống chia ${p.rows.map((r) => `${r.cls}=${r.periods}`).join(', ')} (lớp còn thiếu tiết theo chương trình được nhiều hơn). Hãy kiểm tra.`);
  });

  // Kiểm tra trùng tên giáo viên
  const seen = new Map();
  out.forEach((t) => { const k = nameKey(t.name); if (seen.has(k)) issue('error', t.name, 'Tên giáo viên bị trùng trong bảng. Hãy sửa để phân biệt.'); seen.set(k, true); });
  // Từng lớp so với chương trình (số tiết/tuần mỗi môn)
  const present = new Set(lines.map((l) => `${l.subject}|${gradeOf(l.cls)}`));
  [...official].sort().forEach((cls) => {
    Object.entries(STD_CURRICULUM).forEach(([subject, need]) => {
      if (!present.has(`${subject}|${gradeOf(cls)}`)) return;
      const mine = lines.filter((l) => l.cls === cls && l.subject === subject);
      const got = mine.reduce((x, l) => x + l.periods, 0);
      const who = [...new Set(mine.map((l) => l.teacher))].join(', ');
      if (got < need) issue('error', who, got === 0 ? `Lớp ${cls} chưa có giáo viên môn ${subject} (cần ${need} tiết/tuần).` : `Lớp ${cls} môn ${subject} mới có ${got} tiết, chương trình ${need} tiết.`);
      else if (got > need) issue('warn', who, `Lớp ${cls} môn ${subject} đang ${got} tiết, chương trình chỉ ${need} tiết (thừa ${got - need}).`);
    });
  });

  return { title, teachers: out, lines, issues, classes: [...official].sort(), colInfo: col };
}

// ---------- Chương trình ----------
export function buildCurriculum(lines, prev) {
  const cur = {};
  const per = new Map();
  lines.forEach((l) => { const k = `${gradeOf(l.cls)}|${l.subject}|${l.cls}`; per.set(k, (per.get(k) || 0) + l.periods); });
  const bucket = new Map();
  per.forEach((n, k) => { const [g, s] = k.split('|'); const b = bucket.get(`${g}|${s}`) || {}; b[n] = (b[n] || 0) + 1; bucket.set(`${g}|${s}`, b); });
  bucket.forEach((b, k) => {
    const [g, s] = k.split('|');
    cur[g] = cur[g] || {};
    const mode = Number(Object.keys(b).sort((x, y) => b[y] - b[x] || Number(y) - Number(x))[0]);
    cur[g][s] = STD_CURRICULUM[s] ?? prev?.[g]?.[s] ?? mode;
  });
  return cur;
}

// ---------- Giáo viên: tiết chuẩn, kiêm nhiệm, định mức ----------
export const extraOf = (t) => Number(t.chuyenDe?.periods || 0) + Number(t.kiemNhiem?.periods || 0) + (t.other || []).reduce((x, o) => x + Number(o.periods || 0), 0);

// Định mức dạy trên lớp = tiết chuẩn trừ các tiết không xếp lưới. Bộ xếp và bộ kiểm tra so số tiết đứng lớp với định mức này.
export function quotaFromChuan(t, cfg) {
  const margin = Math.max(0, Number(cfg.defaultMax) - Number(cfg.defaultQuota));
  const quota = Math.max(0, Number(t.chuan) - extraOf(t));
  return { quota, max: quota + margin };
}

export function recalcTeacher(cfg, name) {
  return {
    ...cfg,
    teachers: cfg.teachers.map((t) => {
      if (nameKey(t.name) !== nameKey(name)) return t;
      if (t.chuan === null || t.chuan === undefined || t.chuan === '') return t;
      return { ...t, ...quotaFromChuan(t, cfg) };
    }),
  };
}

export function teacherTotals(cfg) {
  const sched = new Map();
  cfg.assignments.forEach((a) => { if (a.teacher) sched.set(nameKey(a.teacher), (sched.get(nameKey(a.teacher)) || 0) + Number(a.periods || 0)); });
  return cfg.teachers.map((t) => {
    const s = sched.get(nameKey(t.name)) || 0;
    const other = (t.other || []).reduce((x, o) => x + Number(o.periods || 0), 0);
    const cd = Number(t.chuyenDe?.periods || 0);
    const kn = Number(t.kiemNhiem?.periods || 0);
    const giangDay = s + other;
    const tong = giangDay + cd + kn;
    const chuan = t.chuan === null || t.chuan === undefined || t.chuan === '' ? null : Number(t.chuan);
    return { t, scheduled: s, other, giangDay, chuyenDe: cd, kiemNhiem: kn, tong, chuan, chenh: chuan === null ? null : tong - chuan };
  });
}

// "Toán 6A1, 6A3 (8t)" cho từng nhóm môn của một giáo viên (giống cách ghi trong bảng phân công)
export function teachingText(lines, extra = []) {
  const groups = new Map();
  lines.forEach((l) => {
    const k = `${l.subject}|${l.part || ''}|${l.periods}`;
    const g = groups.get(k) || { subject: l.subject, part: l.part || '', per: Number(l.periods), classes: [] };
    g.classes.push(l.cls);
    groups.set(k, g);
  });
  const sortCls = (a, b) => a.localeCompare(b, 'vi');
  const parts = [...groups.values()]
    .sort((a, b) => a.subject.localeCompare(b.subject, 'vi') || a.part.localeCompare(b.part, 'vi') || a.per - b.per)
    .map((g) => `${g.subject}${g.part ? `(${g.part})` : ''} ${g.classes.sort(sortCls).join(', ')} (${g.per * g.classes.length}t)`);
  (extra || []).forEach((o) => parts.push(`${o.text} (${o.periods}t)`));
  return parts;
}

// Giữ lại thông tin hồ sơ giáo viên khi nạp lại cấu hình từ nơi khác
export function mergeTeacherMeta(next, prev) {
  const old = new Map((prev?.teachers || []).map((t) => [nameKey(t.name), t]));
  const keep = ['tt', 'to', 'chucVu', 'namSinh', 'namVaoNganh', 'trinhDo', 'monDay', 'chuyenDe', 'kiemNhiem', 'other', 'chuan', 'ghiChu', 'homeroom'];
  return {
    ...next,
    teachers: next.teachers.map((t) => {
      const o = old.get(nameKey(t.name));
      if (!o) return t;
      const meta = {};
      keep.forEach((k) => { if (o[k] !== undefined) meta[k] = o[k]; });
      return { ...t, ...meta, quota: o.quota ?? t.quota, max: o.max ?? t.max };
    }),
  };
}

// ---------- Tiết cố định (Chào cờ, Sinh hoạt lớp) ----------
export const DEFAULT_FIXED = { chaoCo: { day: 2, session: 'sang', period: 1 }, sinhHoat: { day: 6, session: 'sang', period: 5 } };

export function homeroomMap(cfg) {
  const m = {};
  cfg.teachers.forEach((t) => (t.homeroom || []).forEach((c) => { m[c] = t.name; }));
  return m;
}

export function makeLocks(cfg, fixed = DEFAULT_FIXED) {
  const classes = [...new Set(cfg.assignments.map((a) => a.cls))].sort((a, b) => a.localeCompare(b, 'vi'));
  const hr = homeroomMap(cfg);
  const locks = [];
  classes.forEach((cls) => {
    locks.push({ cls, day: fixed.chaoCo.day, session: fixed.chaoCo.session, period: fixed.chaoCo.period, subject: 'Chào cờ', teacher: '' });
    locks.push({ cls, day: fixed.sinhHoat.day, session: fixed.sinhHoat.session, period: fixed.sinhHoat.period, subject: 'Sinh hoạt lớp', teacher: hr[cls] || '' });
  });
  return locks;
}

// ---------- Áp dụng vào cấu hình soạn thời khóa biểu ----------
// Tên giáo viên trong tiết cố định của thời khóa biểu cũ thường ngắn (ví dụ "Đỉnh"): đổi sang họ tên đầy đủ nếu khớp đúng một người
export function alignLocks(cfg) {
  const hr = homeroomMap(cfg);
  const full = (n) => {
    const k = nameKey(n);
    if (!k) return n;
    const hit = cfg.teachers.filter((t) => nameKey(t.name) === k || nameKey(t.name).endsWith(` ${k}`));
    return hit.length === 1 ? hit[0].name : n;
  };
  return {
    ...cfg,
    locks: cfg.locks.map((l) => {
      if (/^(sh|sinhhoat)/.test(plain(l.subject)) && hr[l.cls]) return { ...l, teacher: hr[l.cls] };
      return { ...l, teacher: full(l.teacher) };
    }),
  };
}

export function ensureSubjects(cfg) {
  const need = new Map();
  cfg.assignments.forEach((a) => {
    if (!a.teacher) return;
    const k = nameKey(a.teacher);
    const set = need.get(k) || new Map();
    set.set(subjKey(a.subject), a.subject);
    need.set(k, set);
  });
  let changed = false;
  const teachers = cfg.teachers.map((t) => {
    const set = need.get(nameKey(t.name));
    if (!set) return t;
    const have = new Set((t.subjects || []).map(subjKey));
    const add = [...set].filter(([k]) => !have.has(k)).map(([, l]) => l);
    if (!add.length) return t;
    changed = true;
    return { ...t, subjects: [...(t.subjects || []), ...add] };
  });
  return changed ? { ...cfg, teachers } : cfg;
}

// Đọc file Excel (.xlsx/.xls) trong trình duyệt, tìm sheet có bảng phân công chuyên môn
export async function readPccmFile(file, opts = {}) {
  const mod = await import('xlsx');
  const XLSX = mod.read ? mod : mod.default;
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
    const parsed = parsePccm(aoa, opts);
    if (parsed.teachers.length) return { parsed, sheet: name };
  }
  return { parsed: null, sheet: '' };
}

export function applyPccm(prev, parsed, meta = {}) {
  const base = mergeCfg(prev || {});
  const oldT = new Map(base.teachers.map((t) => [nameKey(t.name), t]));
  const assignments = parsed.lines.map((l) => ({ id: newId(), cls: l.cls, subject: l.subject, part: l.part || '', teacher: l.teacher, periods: l.periods, src: l.src }));
  const sched = new Map();
  assignments.forEach((a) => sched.set(nameKey(a.teacher), (sched.get(nameKey(a.teacher)) || 0) + a.periods));
  const margin = Math.max(0, Number(base.defaultMax) - Number(base.defaultQuota));
  const teachers = parsed.teachers.map((p) => {
    const o = oldT.get(nameKey(p.name));
    const { _iSum, ...rest } = p;
    const t = { ...rest, dayOff: o?.dayOff ?? 'auto', fair: o?.fair ?? true, quota: null, max: null };
    if (t.chuan === null || t.chuan === undefined) { t.quota = sched.get(nameKey(t.name)) || 0; t.max = t.quota + margin; } else Object.assign(t, quotaFromChuan(t, base));
    return t;
  });
  const next = {
    ...base, teachers, assignments,
    curriculum: buildCurriculum(parsed.lines, prev?.curriculum),
  };
  next.pccm = { title: parsed.title || '', file: meta.file || '', at: new Date().toISOString() };
  return next.locks.length ? alignLocks(next) : { ...next, locks: makeLocks(next) };
}

// Nhập nhanh một chuỗi cùng cách ghi với bảng phân công: "Toán 6A1, 6A3 (8t); KHTN(Lý) 7A1 (1t)"
export function parseQuick(text, teacher, classes) {
  const known = new Set(classes || []);
  const lines = [];
  const problems = [];
  splitSegments(text).map(readSegment).forEach((s) => {
    if (s.n === null) { problems.push(`Thiếu số tiết ở “${s.body}” (viết dạng “Toán 6A1, 6A3 (8t)”).`); return; }
    if (!s.classes.length) { problems.push(`Không thấy tên lớp ở “${s.body}”.`); return; }
    const list = s.classes.filter((c) => !known.size || known.has(c));
    const bad = s.classes.filter((c) => known.size && !known.has(c));
    if (bad.length) problems.push(`Lớp ${bad.join(', ')} không có trong trường.`);
    if (!list.length) return;
    share(s.n, list).forEach(({ cls, periods }) => lines.push({ id: newId(), cls, subject: s.sub.label, part: s.sub.part, teacher, periods }));
  });
  return { lines, problems };
}

export function renameTeacher(cfg, from, to) {
  const k = nameKey(from);
  const re = (n) => (nameKey(n) === k ? to : n);
  return {
    ...cfg,
    teachers: cfg.teachers.map((t) => (nameKey(t.name) === k ? { ...t, name: to } : t)),
    assignments: cfg.assignments.map((a) => ({ ...a, teacher: re(a.teacher) })),
    locks: cfg.locks.map((l) => ({ ...l, teacher: re(l.teacher) })),
    carpool: cfg.carpool.map((g) => ({ ...g, teachers: g.teachers.map(re) })),
  };
}
