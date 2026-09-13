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

// Nhan dien 1 chuoi nguoi dung go vao co phai dang ma hoc sinh khong
// (VD: HS260001, khong phan biet hoa/thuong), de trang dang nhap biet
// khi nao can quy doi sang email, khi nao dung thang lam email.
export function looksLikeStudentCode(value) {
  return /^HS\d{6,}$/i.test(value.trim())
}
