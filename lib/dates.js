// Ngày giờ theo múi giờ Việt Nam, không phụ thuộc múi giờ của máy đang dùng.
export const TZ = 'Asia/Ho_Chi_Minh';
export const DAY_LABELS = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const DAY_MS = 86400000;

// Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD
export function vnTodayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function isoToUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcToIso(dt) {
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  return utcToIso(new Date(isoToUTC(iso).getTime() + n * DAY_MS));
}

// "Thứ 3 15/9"
export function fmtIso(iso) {
  const dt = isoToUTC(iso);
  return `${DAY_LABELS[dt.getUTCDay()]} ${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`;
}

// "15/9/2026"
export function fmtDate(iso) {
  const dt = isoToUTC(iso);
  return `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}/${dt.getUTCFullYear()}`;
}

// Thứ 2 của tuần chứa ngày iso
export function mondayOf(iso) {
  const dow = isoToUTC(iso).getUTCDay();
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

// Thứ 2 -> Thứ 6 của tuần hiện tại (Chủ nhật thì lấy tuần vừa rồi, khớp với server)
export function getWeekdays() {
  const todayIso = vnTodayIso();
  const monday = mondayOf(todayIso);
  const days = [];
  for (let i = 0; i < 5; i++) {
    const iso = addDays(monday, i);
    const d = isoToUTC(iso);
    days.push({
      iso,
      label: DAY_LABELS[d.getUTCDay()],
      shortLabel: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
    });
  }
  return days;
}

// Mặc định = hôm nay; cuối tuần thì lấy ngày học gần nhất (Thứ 6)
export function defaultDateIso() {
  const days = getWeekdays();
  const today = days.find((d) => d.isToday);
  if (today) return today.iso;
  const past = days.filter((d) => !d.isFuture);
  return (past.length ? past[past.length - 1] : days[0]).iso;
}

export function timeVN(ts) {
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}
