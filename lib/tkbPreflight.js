// Kiểm tra TRƯỚC KHI xếp thời khóa biểu: thiếu tiết, trùng, quá chỗ, giáo viên vượt mức...
// Có lỗi (errors) thì nút "Xếp tự động" bị khóa, người soạn phải chỉnh cho đúng ý rồi mới xếp.
// Đây là quy tắc tính toán, không phải AI ngôn ngữ.
import { subjKey, isFixedSubject, isAfternoonSubject, gradeOf, analyzeLoad, newId } from '@/lib/tkbSolver';

const nk = (s) => String(s || '').trim().toLowerCase();
const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '');
const isClub = (s) => /caulacbo|clb/.test(plain(s));
const isHdtn = (s) => /^(hoatdongtrainghiem|hdtn)/.test(plain(s));
const isGddp = (s) => /^(giaoducdiaphuong|gddp|gdcdp)/.test(plain(s));

export function preflight(cfg) {
  const errors = [];
  const warnings = [];
  const fixes = [];
  const days = cfg.days.length;
  const sang = Number(cfg.sang) || 0;
  const chieu = Number(cfg.chieu) || 0;
  const cap = days * (sang + chieu);
  const morningOnly = !!cfg.morningOnly && chieu > 0;
  const aftList = cfg.afternoonSubjects || [];
  const classes = [...new Set([...cfg.assignments.map((a) => a.cls), ...cfg.locks.map((l) => l.cls)])].sort((a, b) => a.localeCompare(b, 'vi'));

  // 1) Dòng phân công chưa có giáo viên
  const noTeacher = cfg.assignments.filter((a) => !a.teacher && Number(a.periods) > 0);
  if (noTeacher.length) {
    const n = noTeacher.reduce((x, a) => x + Number(a.periods), 0);
    errors.push(`${noTeacher.length} dòng phân công (${n} tiết) chưa có giáo viên, ví dụ: ${noTeacher.slice(0, 3).map((a) => `${a.subject} lớp ${a.cls}`).join('; ')}. Hãy chọn giáo viên ở bước 2.`);
  }

  // 2) Môn không được phép tồn tại
  cfg.assignments.forEach((a) => {
    if (isClub(a.subject)) errors.push(`Lớp ${a.cls}: “${a.subject}” bị chặn vì trường không tổ chức sinh hoạt câu lạc bộ. Hãy xóa dòng này.`);
    else if (isFixedSubject(a.subject) && Number(a.periods) > 0) warnings.push(`Lớp ${a.cls}: “${a.subject}” nằm trong phân công thường. Sinh hoạt lớp chỉ do giáo viên chủ nhiệm, nên để ở dạng tiết cố định (nạp từ thời khóa biểu hiện hành).`);
  });

  // 3) Trùng tiết cố định
  const seenLock = new Map();
  const seenTeacherLock = new Map();
  cfg.locks.forEach((l) => {
    const k = `${l.cls}|${l.day}|${l.session}|${l.period}`;
    if (seenLock.has(k)) errors.push(`Lớp ${l.cls} có hai tiết cố định cùng lúc (thứ ${l.day}, ${l.session === 'sang' ? 'sáng' : 'chiều'} tiết ${l.period}).`);
    seenLock.set(k, true);
    if (l.teacher) {
      const tk = `${nk(l.teacher)}|${l.day}|${l.session}|${l.period}`;
      const prev = seenTeacherLock.get(tk);
      if (prev && prev !== l.cls) errors.push(`${l.teacher} bị trùng tiết cố định: lớp ${prev} và lớp ${l.cls} cùng thứ ${l.day} ${l.session === 'sang' ? 'sáng' : 'chiều'} tiết ${l.period}.`);
      seenTeacherLock.set(tk, l.cls);
    }
  });

  // 4) Giáo viên: vượt mức tối đa, lệch định mức, quá số chỗ
  const A = analyzeLoad(cfg);
  A.teachers.forEach((t) => {
    if (t.load > t.max) errors.push(`${t.name} đang ${t.load} tiết, vượt mức tối đa ${t.max}. Hãy chuyển bớt tiết cho giáo viên cùng môn (xem gợi ý ở bước 1).`);
    if (t.load > cap) errors.push(`${t.name} có ${t.load} tiết nhưng một tuần chỉ có ${cap} chỗ.`);
  });
  const lech = A.teachers.filter((t) => t.load !== t.quota && t.load <= t.max);
  if (lech.length) {
    const text = `${lech.length} giáo viên chưa đúng định mức: ${lech.slice(0, 4).map((t) => `${t.name} ${t.load}/${t.quota}`).join('; ')}${lech.length > 4 ? '…' : ''}.`;
    if (cfg.options?.requireExactQuota) errors.push(`${text} Bạn đang bật “Mỗi giáo viên phải đúng số tiết định mức”, hãy chỉnh phân công cho khớp.`);
    else warnings.push(text);
  }

  // 5) Từng lớp: đủ chương trình, vừa số chỗ sáng/chiều
  const free = new Map();
  classes.forEach((cls) => {
    const lines = cfg.assignments.filter((a) => a.cls === cls);
    const locks = cfg.locks.filter((l) => l.cls === cls);
    const lockM = locks.filter((l) => l.session === 'sang').length;
    const lockA = locks.length - lockM;
    let main = 0;
    let aft = 0;
    lines.forEach((a) => {
      const p = Number(a.periods) || 0;
      if (morningOnly && isAfternoonSubject(a.subject, aftList)) aft += p; else main += p;
    });
    const total = main + aft + lockM + lockA;
    if (total > cap) errors.push(`Lớp ${cls} có ${total} tiết nhưng một tuần chỉ có ${cap} chỗ (${days} ngày × ${sang + chieu} tiết).`);
    if (morningOnly) {
      if (main + lockM > days * sang) errors.push(`Lớp ${cls}: môn chỉ học buổi sáng có ${main + lockM} tiết, buổi sáng chỉ có ${days * sang} chỗ. Hãy giảm ${main + lockM - days * sang} tiết.`);
      if (aft + lockA > days * chieu) errors.push(`Lớp ${cls}: môn buổi chiều có ${aft + lockA} tiết, buổi chiều chỉ có ${days * chieu} chỗ. Hãy giảm ${aft + lockA - days * chieu} tiết.`);
      free.set(cls, { m: Math.max(0, days * sang - main - lockM), a: Math.max(0, days * chieu - aft - lockA) });
    } else {
      free.set(cls, { m: Math.max(0, cap - total), a: Math.max(0, cap - total) });
    }
    const cur = cfg.curriculum[gradeOf(cls)] || {};
    Object.entries(cur).forEach(([sub, need]) => {
      const have = lines.filter((a) => subjKey(a.subject) === subjKey(sub)).reduce((x, a) => x + (Number(a.periods) || 0), 0);
      if (have < need) errors.push(`Lớp ${cls} thiếu ${need - have} tiết môn ${sub} (chương trình ${need}, đang ${have}).`);
      else if (have > need) warnings.push(`Lớp ${cls} thừa ${have - need} tiết môn ${sub} (chương trình ${need}, đang ${have}).`);
    });
  });

  // 6) Gợi ý bù tiết thiếu của giáo viên bằng Hoạt động trải nghiệm / Giáo dục địa phương
  const work = new Map(A.teachers.map((t) => [nk(t.name), t.load]));
  const under = A.teachers.filter((t) => t.load < t.quota);
  if (under.length) {
    const label = (test, fallback) => {
      const hit = [...Object.values(cfg.curriculum).flatMap((o) => Object.keys(o)), ...cfg.assignments.map((a) => a.subject)].find(test);
      return hit || fallback;
    };
    const hdtn = label(isHdtn, 'Hoạt động trải nghiệm');
    const gddp = label(isGddp, 'Giáo dục địa phương');
    const pickTeacher = (sub) => {
      const c = under
        .filter((t) => (t.subjects || []).some((s) => subjKey(s) === subjKey(sub)) && (work.get(nk(t.name)) || 0) < t.quota)
        .sort((x, y) => (work.get(nk(x.name)) / x.quota) - (work.get(nk(y.name)) / y.quota))[0];
      return c ? c.name : '';
    };
    const extra = [];
    classes.forEach((cls) => {
      const f = free.get(cls);
      const g = morningOnly ? 'a' : 'm';
      if (f[g] > 0) extra.push({ cls, subject: gddp, key: g });
      if (morningOnly && f.m > 0) extra.push({ cls, subject: hdtn, key: 'm' });
    });
    extra.forEach((x) => {
      const t = pickTeacher(x.subject);
      if (!t) return;
      const f = free.get(x.cls);
      if (f[x.key] <= 0) return;
      if (!morningOnly) { f.m -= 1; f.a -= 1; } else f[x.key] -= 1;
      work.set(nk(t), (work.get(nk(t)) || 0) + 1);
      fixes.push({ id: newId(), text: `Thêm 1 tiết ${x.subject} cho lớp ${x.cls} do ${t} dạy (còn trống ${x.key === 'a' ? 'buổi chiều' : morningOnly ? 'buổi sáng' : 'chỗ'}).`, add: { cls: x.cls, subject: x.subject, teacher: t, periods: 1 } });
    });
    if (!fixes.length) warnings.push('Có giáo viên còn thiếu tiết nhưng không có lớp nào còn chỗ trống phù hợp để thêm Hoạt động trải nghiệm hoặc Giáo dục địa phương.');
  }

  return { ok: errors.length === 0, errors, warnings, fixes };
}

export function applyFix(cfg, fix) {
  if (!fix?.add) return cfg;
  const { cls, subject, teacher, periods } = fix.add;
  const hit = cfg.assignments.find((a) => a.cls === cls && subjKey(a.subject) === subjKey(subject) && nk(a.teacher) === nk(teacher));
  if (hit) return { ...cfg, assignments: cfg.assignments.map((a) => (a.id === hit.id ? { ...a, periods: Number(a.periods || 0) + periods } : a)) };
  return { ...cfg, assignments: [...cfg.assignments, { id: newId(), cls, subject, teacher, periods }] };
}
