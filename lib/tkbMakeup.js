// Tính chỗ trống để xếp dạy bù. Quy tắc cứng (lớp trống, giáo viên rảnh, không nghỉ, đúng môn đã dạy) được
// kiểm lại ở phía cơ sở dữ liệu bằng hàm tkb_makeup_save, nên dù giao diện sai vẫn không thể xếp trùng.
import { subjKey, isFixedSubject, isAfternoonSubject } from '@/lib/tkbSolver';
import { addDays } from '@/lib/dates';

const nk = (s) => String(s || '').trim().toLowerCase();
export const splitTeachers = (cell) => String(cell || '').split(/\s*[,;/+&]\s*/).map((s) => s.trim()).filter(Boolean);
export const hasTeacher = (cell, name) => splitTeachers(cell).some((x) => nk(x) === nk(name));
// Thứ theo quy ước trường: 2..7, Chủ nhật = 8
export function weekdayOf(iso) {
  const g = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return g === 0 ? 8 : g + 1;
}
export const DAY_NAME = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };
export const SESS_NAME = { sang: 'sáng', chieu: 'chiều' };

export function teacherNames(rows) {
  const m = new Map();
  (rows || []).forEach((r) => splitTeachers(r.teacher).forEach((n) => { if (!m.has(nk(n))) m.set(nk(n), n); }));
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'vi'));
}

// Các tiết bị bỏ lỡ khi giáo viên nghỉ (không tính Chào cờ, Sinh hoạt, Họp)
export function missedLessons(rows, teacher, iso, session) {
  const wd = weekdayOf(iso);
  return (rows || [])
    .filter((r) => r.weekday === wd && (!session || r.session === session) && hasTeacher(r.teacher, teacher) && !isFixedSubject(r.subject) && !/^(họp|hộihọp|hoihop)/.test(subjKey(r.subject)))
    .sort((a, b) => (a.session === b.session ? 0 : a.session === 'sang' ? -1 : 1) || a.period - b.period);
}

// Giáo viên từng được phân công dạy đúng môn này
export function qualifiedTeachers(rows, subject) {
  const set = new Map();
  (rows || []).filter((r) => subjKey(r.subject) === subjKey(subject)).forEach((r) => splitTeachers(r.teacher).forEach((n) => set.set(nk(n), n)));
  return [...set.values()].sort((a, b) => a.localeCompare(b, 'vi'));
}

const onLeave = (leaves, teacher, iso, session) =>
  (leaves || []).some((l) => nk(l.teacher_name) === nk(teacher) && l.leave_date === iso && (!l.session || l.session === session));

// Liệt kê các chỗ trống: lớp trống + giáo viên rảnh + giáo viên không nghỉ.
export function findSlots({ ctx, bells, classId, subject, teacher, fromIso, days = 14, sessions = ['sang', 'chieu'], allowSat = false, rule = {}, limit = 40 }) {
  const out = [];
  for (let i = 0; i <= days && out.length < limit; i += 1) {
    const iso = addDays(fromIso, i);
    const wd = weekdayOf(iso);
    if (wd > 7 || (wd === 7 && !allowSat)) continue;
    for (const session of sessions) {
      const periods = (bells || []).filter((b) => b.session === session && b.period >= 1).map((b) => b.period).sort((a, b) => a - b);
      for (const period of periods) {
        const classBusy = (ctx.rows || []).some((r) => r.class_id === classId && r.weekday === wd && r.session === session && r.period === period)
          || (ctx.makeups || []).some((m) => m.class_id === classId && m.lesson_date === iso && m.session === session && m.period === period);
        if (classBusy) continue;
        const teacherBusy = (ctx.rows || []).some((r) => r.weekday === wd && r.session === session && r.period === period && hasTeacher(r.teacher, teacher))
          || (ctx.makeups || []).some((m) => nk(m.teacher) === nk(teacher) && m.lesson_date === iso && m.session === session && m.period === period);
        if (teacherBusy || onLeave(ctx.leaves, teacher, iso, session)) continue;
        let warn = '';
        if (rule.morningOnly) {
          const aft = isAfternoonSubject(subject, rule.afternoonSubjects || []);
          if (session === 'chieu' && !aft) warn = 'Môn chính xếp buổi chiều (quy tắc hiện tại: môn chính chỉ học buổi sáng).';
          if (session === 'sang' && aft) warn = 'Môn này thường học buổi chiều.';
        }
        out.push({ iso, wd, session, period, bell: (bells || []).find((b) => b.session === session && b.period === period), warn });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}
