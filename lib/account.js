// Học sinh đăng nhập bằng mã (VD: HS260001); email thật của họ chỉ là địa chỉ nội bộ
// dạng hs260001@hocsinh.local (xem lib/generateStudentCode.js). Khi hiện danh sách tài khoản,
// hiện MÃ HỌC SINH thay vì email nội bộ. Tài khoản giáo viên/admin vẫn hiện email thật.
const STUDENT_EMAIL_DOMAIN = 'hocsinh.local';

export function displayLogin(email) {
  if (!email) return '—';
  const [name, domain] = email.split('@');
  return domain === STUDENT_EMAIL_DOMAIN ? name.toUpperCase() : email;
}
