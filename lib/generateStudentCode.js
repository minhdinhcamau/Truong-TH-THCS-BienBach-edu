// Chi dinh dang chuoi ma hoc sinh. Viec dem so hoc sinh da co (de ra so thu tu
// tiep theo) nam o API route create-user, vi no can truy van database.
export function formatStudentCode(sequenceNumber, year = new Date().getFullYear()) {
  const yy = String(year).slice(-2)
  const padded = String(sequenceNumber).padStart(4, '0')
  return `HS${yy}${padded}`
}

// Ten mien noi bo dung de sinh email dang nhap cho hoc sinh - hoc sinh
// KHONG BAO GIO can biet den email nay, chi dang nhap bang ma hoc sinh.
// Dung chung 1 hang so o day de create-user (server) va login (client)
// luon tinh ra cung 1 gia tri.
const STUDENT_EMAIL_DOMAIN = 'hocsinh.local'

export function studentCodeToEmail(studentCode) {
  return `${studentCode.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`
}

// Nhan dien 1 chuoi nguoi dung go vao co phai la MA HOC SINH khong, de trang
// dang nhap biet khi nao can quy doi sang email noi bo, khi nao dung thang
// lam email that (giao vien / quan tri vien).
//
// Ma hoc sinh co the la HS260001 (he thong tu sinh) HOAC ma lay thang tu so
// diem cua giao vien khi nhap danh sach hang loat (VD 2503411545, chi gom so).
// Email that luon co dau "@", con ma hoc sinh thi khong bao gio co, nen chi can
// kiem tra "khong co @" la du va khong phu thuoc vao dinh dang cua ma.
export function looksLikeStudentCode(value) {
  const v = String(value || '').trim()
  return v.length > 0 && !v.includes('@')
}
