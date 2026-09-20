// Phân tích file thời khóa biểu (.xls/.xlsx) do nhà trường xuất ra.
// Đầu vào: dữ liệu dạng mảng-của-mảng (giống XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })).
// Cấu trúc file mẫu: mỗi sheet là 1 buổi (sáng / chiều); hàng tiêu đề có "THỨ", "TIẾT", rồi tên lớp
// (mỗi lớp chiếm 2 cột: môn học, giáo viên); cột THỨ chỉ ghi ở tiết đầu của ngày (ô gộp).

const NON_RATABLE = ['hoi hop']; // các mục không phải tiết học để xếp loại A/B/C

export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function clean(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function detectSession(aoa, sheetName) {
  for (let r = 0; r < Math.min(aoa.length, 6); r++) {
    for (const cell of aoa[r] || []) {
      const t = norm(cell);
      if (t.includes('buoi sang')) return 'sang';
      if (t.includes('buoi chieu')) return 'chieu';
    }
  }
  const n = norm(sheetName);
  if (n.includes('sang')) return 'sang';
  if (n.includes('chieu')) return 'chieu';
  return null;
}

function detectEffectiveFrom(aoa) {
  for (let r = 0; r < Math.min(aoa.length, 6); r++) {
    for (const cell of aoa[r] || []) {
      const m = norm(cell).match(/ngay\s+(\d{1,2})\s+thang\s+(\d{1,2})\s+nam\s+(\d{4})/);
      if (m) {
        const [, d, mo, y] = m;
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }
  return null;
}

// Trả về { session, effectiveFrom, classes: [tên lớp], rows: [...] } hoặc null nếu sheet không phải TKB
export function parseSheet(aoa, sheetName) {
  const session = detectSession(aoa, sheetName);
  if (!session) return null;

  let headerRow = -1;
  for (let r = 0; r < Math.min(aoa.length, 12); r++) {
    const row = aoa[r] || [];
    if (norm(row[0]) === 'thu' && norm(row[1]) === 'tiet') {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) return null;

  const header = aoa[headerRow];
  const classCols = [];
  for (let c = 2; c < header.length; c++) {
    const name = clean(header[c]).replace(/\s+/g, '');
    if (name) classCols.push({ col: c, name });
  }
  if (!classCols.length) return null;

  const rows = [];
  let weekday = null;
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const dayCell = Number(row[0]);
    if (Number.isInteger(dayCell) && dayCell >= 2 && dayCell <= 7) weekday = dayCell;
    const period = Number(row[1]);
    if (!weekday || !Number.isInteger(period) || period < 1 || period > 10) continue;

    for (const { col, name } of classCols) {
      const subject = clean(row[col]);
      if (!subject) continue;
      const teacher = clean(row[col + 1]);
      rows.push({
        class_name: name,
        weekday,
        session,
        period,
        subject,
        teacher,
        ratable: !NON_RATABLE.includes(norm(subject)),
      });
    }
  }

  return {
    session,
    effectiveFrom: detectEffectiveFrom(aoa),
    classes: classCols.map((c) => c.name),
    rows,
  };
}

// Gộp tất cả các sheet hợp lệ của 1 workbook. sheets = [{ name, aoa }]
export function parseWorkbookSheets(sheets) {
  const rows = [];
  const classSet = new Set();
  const sessions = [];
  let effectiveFrom = null;
  for (const { name, aoa } of sheets) {
    const res = parseSheet(aoa, name);
    if (!res) continue;
    sessions.push(res.session);
    res.classes.forEach((c) => classSet.add(c));
    if (!effectiveFrom && res.effectiveFrom) effectiveFrom = res.effectiveFrom;
    rows.push(...res.rows);
  }
  return { rows, classes: Array.from(classSet), sessions, effectiveFrom };
}
