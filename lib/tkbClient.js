import { supabase } from '@/lib/supabaseClient';
import { vnTodayIso } from '@/lib/dates';
import { isMeetingSubject } from '@/lib/tkb';

const bySlot = (a, b) =>
  a.weekday - b.weekday ||
  (a.session === b.session ? 0 : a.session === 'sang' ? -1 : 1) ||
  a.period - b.period ||
  String(a.class_name || '').localeCompare(String(b.class_name || ''), 'vi');

// Bỏ tiết họp (không phải tiết học) kể cả dữ liệu cũ đã lưu trong cơ sở dữ liệu
const onlyLessons = (rows) => (rows || []).filter((r) => !isMeetingSubject(r.subject));

// Tải thời khóa biểu đang áp dụng của 1 lớp: bản có ngày áp dụng gần nhất không vượt quá hôm nay
// (nếu chưa có bản nào đến hạn thì lấy bản sớm nhất để học sinh vẫn xem trước được).
// Trả về { rows, effectiveFrom, upcoming } hoặc { rows: [], effectiveFrom: null }.
export async function loadClassTimetable(classId) {
  if (!classId) return { rows: [], effectiveFrom: null, upcoming: null };
  const today = vnTodayIso();

  const cur = await supabase
    .from('class_timetable')
    .select('effective_from')
    .eq('class_id', classId)
    .lte('effective_from', today)
    .order('effective_from', { ascending: false })
    .limit(1);
  let effectiveFrom = cur.data?.[0]?.effective_from || null;

  const next = await supabase
    .from('class_timetable')
    .select('effective_from')
    .eq('class_id', classId)
    .gt('effective_from', today)
    .order('effective_from', { ascending: true })
    .limit(1);
  const upcoming = next.data?.[0]?.effective_from || null;
  if (!effectiveFrom) effectiveFrom = upcoming;
  if (!effectiveFrom) return { rows: [], effectiveFrom: null, upcoming: null };

  const { data } = await supabase
    .from('class_timetable')
    .select('weekday, session, period, subject, teacher')
    .eq('class_id', classId)
    .eq('effective_from', effectiveFrom);
  const rows = onlyLessons(data).sort(bySlot);
  return { rows, effectiveFrom, upcoming: effectiveFrom === upcoming && effectiveFrom > today ? null : upcoming };
}

// Giờ vào / giờ ra từng tiết (bảng school_bell_times, dùng chung toàn trường).
// Chưa chạy SQL gói E hoặc lỗi mạng thì trả về [] và thời khóa biểu vẫn hiện bình thường, chỉ không có giờ.
export async function loadBellTimes() {
  const { data, error } = await supabase
    .from('school_bell_times')
    .select('session, period, label, start_time, end_time');
  if (error || !data) return [];
  return data
    .slice()
    .sort((a, b) => (a.session === b.session ? 0 : a.session === 'sang' ? -1 : 1) || a.period - b.period);
}

// Thời khóa biểu riêng của 1 giáo viên (profileId trống = chính mình; xem người khác chỉ Tổng phụ trách / admin).
// Trả về { rows, error, effectiveFrom }. Mỗi dòng có thêm class_name.
export async function loadTeacherTimetable(profileId) {
  const { data, error } = await supabase.rpc('teacher_timetable', { p_profile_id: profileId || null });
  if (error) return { rows: [], error: error.message, effectiveFrom: null };
  const rows = onlyLessons(data).sort(bySlot);
  // Mỗi lớp có thể đang dùng một bản khác nhau; ghi ngày của bản mới nhất
  const effectiveFrom = rows.reduce((m, r) => (r.effective_from && (!m || r.effective_from > m) ? r.effective_from : m), null);
  return { rows, error: null, effectiveFrom };
}
