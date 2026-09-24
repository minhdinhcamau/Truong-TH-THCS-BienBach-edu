// Xuat danh sach tai khoan hoc sinh (ten dang nhap + mat khau) ra file Excel
// dinh dang dep de in / phat cho hoc sinh.
//
// Nhe cho web: thu vien exceljs (~1MB) chi duoc tai KHI BAM XUAT (dynamic
// import), khong nam trong goi tai ban dau cua trang admin.
//
// File gom 2 sheet:
//   1. "Danh sách"        - bang tai khoan, in vua kho A4 doc, lap lai dong tieu de moi trang
//   2. "Phiếu cấp tài khoản" - moi hoc sinh 1 phieu nho, in ra roi cat phat tung em

const SCHOOL_NAME = 'TRƯỜNG TH-THCS BIỂN BẠCH'

const C = {
  navy: 'FF1F3A5F',
  blue: 'FF2563EB',
  band: 'FFEAF1FB',
  zebra: 'FFF5F8FC',
  line: 'FFC5D2E3',
  cut: 'FF8FA3BF',
  text: 'FF1F2937',
  muted: 'FF6B7280',
  white: 'FFFFFFFF',
  noteBg: 'FFFFF7E0',
  noteText: 'FF8A5A00',
}

const FONT = 'Calibri'
const MONO = 'Consolas'

function schoolYearNow() {
  const now = new Date()
  const y = now.getFullYear()
  const start = now.getMonth() >= 7 ? y : y - 1
  return `${start}-${start + 1}`
}

function fmtDate(d) {
  return d.toLocaleDateString('vi-VN')
}

// "Lớp 6A1" -> "Lop-6A1": ten file khong dau, khong ky tu la de mo duoc tren moi may
function safeFileName(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\w-]+/g, '_')
}

function solid(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function thin(argb = C.line) {
  return { style: 'thin', color: { argb } }
}

// ---------------------------------------------------------------------------
// Sheet 1: bang danh sach
// ---------------------------------------------------------------------------
function buildListSheet(wb, { className, rows, schoolYear, loginUrl, exportedAt }) {
  const ws = wb.addWorksheet('Danh sách', {
    views: [{ showGridLines: false }],
  })

  ws.columns = [
    { key: 'stt', width: 7 },
    { key: 'name', width: 34 },
    { key: 'code', width: 24 },
    { key: 'pass', width: 22 },
  ]

  const LAST_COL = 4

  // --- Tieu de ---
  const head = (rowNo, text, font, height) => {
    ws.mergeCells(rowNo, 1, rowNo, LAST_COL)
    const cell = ws.getCell(rowNo, 1)
    cell.value = text
    cell.font = { name: FONT, ...font }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(rowNo).height = height
  }

  head(1, SCHOOL_NAME, { size: 12, bold: true, color: { argb: C.navy } }, 24)
  head(2, 'DANH SÁCH TÀI KHOẢN HỌC SINH', { size: 18, bold: true, color: { argb: C.navy } }, 32)
  head(3, `Lớp ${className}  ·  Năm học ${schoolYear}`, { size: 13, bold: true, color: { argb: C.blue } }, 22)
  head(
    4,
    `Xuất ngày ${fmtDate(exportedAt)}  ·  Tổng số: ${rows.length} học sinh`,
    { size: 10, italic: true, color: { argb: C.muted } },
    18
  )
  ws.getRow(5).height = 8

  // --- Ghi chu + dia chi dang nhap (dat tren bang de khong bi roi sang trang sau) ---
  const NOTE_ROW = 6
  ws.mergeCells(NOTE_ROW, 1, NOTE_ROW, LAST_COL)
  const note = ws.getCell(NOTE_ROW, 1)
  note.value =
    (loginUrl ? `Đăng nhập tại: ${loginUrl}\n` : '') +
    'Mật khẩu chỉ hiển thị một lần khi cấp. Học sinh nên đổi mật khẩu ngay sau lần đăng nhập đầu tiên và không chia sẻ cho bạn khác.'
  note.font = { name: FONT, size: 10, color: { argb: C.noteText } }
  note.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }
  for (let c = 1; c <= LAST_COL; c++) ws.getCell(NOTE_ROW, c).fill = solid(C.noteBg)
  ws.getRow(NOTE_ROW).height = loginUrl ? 44 : 32
  ws.getRow(7).height = 8

  // duong ke mau xanh duoi phan tieu de
  for (let c = 1; c <= LAST_COL; c++) {
    ws.getCell(4, c).border = { bottom: { style: 'medium', color: { argb: C.navy } } }
  }

  // --- Dong tieu de cot ---
  const HEADER_ROW = 8
  const headers = ['STT', 'Họ và tên', 'Tên đăng nhập', 'Mật khẩu']
  headers.forEach((text, i) => {
    const cell = ws.getCell(HEADER_ROW, i + 1)
    cell.value = text
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: C.white } }
    cell.fill = solid(C.navy)
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { top: thin(C.navy), left: thin(C.white), bottom: thin(C.navy), right: thin(C.white) }
  })
  ws.getRow(HEADER_ROW).height = 26

  // --- Du lieu ---
  rows.forEach((r, idx) => {
    const rowNo = HEADER_ROW + 1 + idx
    const zebra = idx % 2 === 1
    const values = [idx + 1, r.fullName, r.studentCode, r.password]

    values.forEach((v, i) => {
      const cell = ws.getCell(rowNo, i + 1)
      cell.value = v
      cell.border = { top: thin(), left: thin(), bottom: thin(), right: thin() }
      if (zebra) cell.fill = solid(C.zebra)

      if (i === 0) {
        cell.font = { name: FONT, size: 11, color: { argb: C.muted } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else if (i === 1) {
        cell.font = { name: FONT, size: 12, color: { argb: C.text } }
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      } else if (i === 2) {
        cell.font = { name: MONO, size: 12, color: { argb: C.text } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else {
        // mat khau: chu dam, dong dieu de de doc, tranh nham lan O/0, l/1
        cell.font = { name: MONO, size: 13, bold: true, color: { argb: C.navy } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        // ep kieu chuoi de Excel khong tu doi "0123" thanh so
        cell.numFmt = '@'
      }
    })
    ws.getRow(rowNo).height = 24
  })

  // --- In an: A4 doc, vua chieu ngang, lap lai dong tieu de, danh so trang ---
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
    margins: { left: 0.6, right: 0.6, top: 0.7, bottom: 0.8, header: 0.3, footer: 0.4 },
  }
  ws.headerFooter.oddFooter = `&L&8${SCHOOL_NAME} - Lớp ${className}&R&8Trang &P / &N`
}

// ---------------------------------------------------------------------------
// Sheet 2: phieu cap tai khoan (2 phieu / hang, 5 hang / trang A4 = 10 phieu / trang)
// ---------------------------------------------------------------------------
function buildSlipSheet(wb, { className, rows, schoolYear, loginUrl }) {
  const ws = wb.addWorksheet('Phiếu cấp tài khoản', {
    views: [{ showGridLines: false }],
  })

  // A,B = phieu ben trai | C = khe cat | D,E = phieu ben phai
  ws.columns = [
    { width: 15 },
    { width: 27 },
    { width: 3 },
    { width: 15 },
    { width: 27 },
  ]

  const SLIP_ROWS = 7 // 6 dong phieu + 1 dong trong cach phieu
  const SLIPS_PER_PAGE_ROW = 5

  const cutLine = { style: 'dashed', color: { argb: C.cut } }

  const drawSlip = (r, index) => {
    const blockRow = Math.floor(index / 2)
    const left = index % 2 === 0 ? 1 : 4 // cot bat dau
    const right = left + 1
    const top = 1 + blockRow * SLIP_ROWS

    // Chieu cao dong (dat mot lan, dung chung cho ca 2 phieu tren cung hang)
    if (index % 2 === 0) {
      ;[20, 18, 22, 22, 24, 28, 12].forEach((h, k) => {
        ws.getRow(top + k).height = h
      })
    }

    // Dong 0: ten truong (nen xanh dam)
    // Dong 1: tieu de phieu + lop
    // Dong 2-4: ho ten / ten dang nhap / mat khau
    // Dong 5: nhac doi mat khau
    // Chi gop o cho dong 0, 1, 5; dong 2-4 khong gop (nhan o cot trai, gia tri o cot phai)
    for (const k of [0, 1, 5]) ws.mergeCells(top + k, left, top + k, right)

    const title = ws.getCell(top, left)
    title.value = SCHOOL_NAME
    title.font = { name: FONT, size: 11, bold: true, color: { argb: C.white } }
    title.alignment = { horizontal: 'center', vertical: 'middle' }

    const sub = ws.getCell(top + 1, left)
    sub.value = `PHIẾU TÀI KHOẢN  ·  Lớp ${className}  ·  ${schoolYear}`
    sub.font = { name: FONT, size: 10, bold: true, color: { argb: C.navy } }
    sub.alignment = { horizontal: 'center', vertical: 'middle' }

    const rowsDef = [
      ['Họ và tên', r.fullName, { name: FONT, size: 12, bold: true, color: { argb: C.text } }],
      ['Tên đăng nhập', r.studentCode, { name: MONO, size: 12, color: { argb: C.text } }],
      ['Mật khẩu', r.password, { name: MONO, size: 14, bold: true, color: { argb: C.navy } }],
    ]
    rowsDef.forEach(([label, value, font], k) => {
      const lc = ws.getCell(top + 2 + k, left)
      lc.value = label
      lc.font = { name: FONT, size: 10, color: { argb: C.muted } }
      lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

      const vc = ws.getCell(top + 2 + k, right)
      vc.value = value
      vc.font = font
      vc.alignment = { horizontal: 'left', vertical: 'middle' }
      vc.numFmt = '@'
    })

    const foot = ws.getCell(top + 5, left)
    foot.value = loginUrl
      ? `Đăng nhập: ${loginUrl}  ·  Nhớ đổi mật khẩu lần đầu`
      : 'Nhớ đổi mật khẩu sau lần đăng nhập đầu tiên'
    foot.font = { name: FONT, size: 8.5, italic: true, color: { argb: C.muted } }
    foot.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

    // Nen + vien (dat sau khi gop o, gan cho TUNG o de vien hien du tren moi ban Excel)
    for (let k = 0; k <= 5; k++) {
      for (let c = left; c <= right; c++) {
        const cell = ws.getCell(top + k, c)
        const border = {}
        if (k === 0) border.top = cutLine
        if (k === 5) border.bottom = cutLine
        if (c === left) border.left = cutLine
        if (c === right) border.right = cutLine
        if (k >= 2 && k <= 4) {
          // dong ke mo giua cac dong thong tin
          if (k < 4) border.bottom = thin(C.line)
        }
        cell.border = border

        if (k === 0) cell.fill = solid(C.navy)
        else if (k === 1) cell.fill = solid(C.band)
        else if (k === 4) cell.fill = solid(C.noteBg)
      }
    }

    // Ngat trang sau moi 5 hang phieu
    const isLastOfPageRow = (blockRow + 1) % SLIPS_PER_PAGE_ROW === 0
    if (isLastOfPageRow && index % 2 === 1) {
      ws.getRow(top + SLIP_ROWS - 1).addPageBreak()
    }
  }

  rows.forEach((r, i) => drawSlip(r, i))

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    scale: 100, // khong dung fitToPage vi Excel bo qua ngat trang thu cong khi fit
    horizontalCentered: true,
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Dung workbook (khong dung API trinh duyet) - tach rieng de co the test tren Node.
export function buildAccountsWorkbook(ExcelJS, { className, rows, schoolYear, loginUrl, exportedAt }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Trường TH-THCS Biển Bạch'
  wb.created = exportedAt || new Date()

  const opts = {
    className,
    rows,
    schoolYear: schoolYear || schoolYearNow(),
    loginUrl,
    exportedAt: exportedAt || new Date(),
  }
  buildListSheet(wb, opts)
  buildSlipSheet(wb, opts)
  return wb
}

/**
 * Xuat file Excel tai khoan hoc sinh cua 1 lop va tai ve may.
 * @param {{ className: string, rows: {fullName:string, studentCode:string, password:string}[],
 *           schoolYear?: string, loginUrl?: string }} args
 */
export async function exportAccountsExcel({ className, rows, schoolYear, loginUrl }) {
  if (!rows || rows.length === 0) return

  // Chi tai exceljs luc nay (~1MB), khong nam trong bundle ban dau cua trang
  const mod = await import('exceljs')
  const ExcelJS = mod.default || mod

  const exportedAt = new Date()
  const wb = buildAccountsWorkbook(ExcelJS, {
    className,
    rows,
    schoolYear,
    loginUrl: loginUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
    exportedAt,
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const dateStr = exportedAt.toISOString().slice(0, 10)
  const fileName = `tai-khoan-lop-${safeFileName(className)}-${dateStr}.xlsx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
