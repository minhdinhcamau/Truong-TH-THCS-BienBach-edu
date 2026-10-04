import { supabase } from '@/lib/supabaseClient';
import { vnTodayIso } from '@/lib/dates';

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
    .eq('effective_from', effectiveFrom)
    .order('weekday')
    .order('session', { ascending: false }) // 'sang' > 'chieu' theo chữ cái nên đảo để sáng trước (sắp xếp lại bên dưới cho chắc)
    .order('period');
  const rows = (data || []).slice().sort((a, b) =>
    a.weekday - b.weekday || (a.session === b.session ? 0 : a.session === 'sang' ? -1 : 1) || a.period - b.period);
  return { rows, effectiveFrom, upcoming: effectiveFrom === upcoming && effectiveFrom > today ? null : upcoming };
}
