// Phân tích kết quả SAU KHI xếp thời khóa biểu: đối chiếu bảng vừa xếp với thiết lập của người soạn
// để tìm lỗi (trùng lớp, trùng giáo viên, thiếu tiết, sai buổi, vượt mức...). Quy tắc tính toán, không phải AI ngôn ngữ.
// Không tự sửa gì: chỉ báo để người soạn quyết định.
import { subjKey, isAfternoonSubject, gradeOf } from '@/lib/tkbSolver';

const nk = (s) => String(s || '').trim().toLowerCase();
const SESS = { sang: 'sáng', chieu: 'chiều' };
const DAY = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };
const where = (r) => `${DAY[r.weekday] || `thứ ${r.weekday}`} buổi ${SESS[r.session]} tiết ${r.period}`;

export function verifyResult(cfg, result) {
  const errors = []; // lỗi thật sự: bảng xếp sai so với thiết lập
  const warnings = []; // chưa sai nhưng nên xem lại
  const infos = []; // thông tin
  const rows = (result && result.rows) || [];
  if (!rows.length) return { ok: false, errors: [{ text: 'Chưa xếp được tiết nào.', advice: 'Kiểm tra phân công ở bước 2 và số tiết mỗi lớp.' }], warnings, infos, counts: { lessons: 0, classes: 0, teachers: 0 } };

  const sang = Number(cfg.sang) || 0;
  const chieu = Number(cfg.chieu) || 0;
  const days = cfg.days || [];
  const useRule = cfg.morningOnly !== false && chieu > 0;

  // 1) Một lớp hai tiết cùng lúc
  const cSlot = new Map();
  rows.forEach((r) => {
    const k = `${r.class_name}|${r.weekday}|${r.session}|${r.period}`;
    cSlot.set(k, [...(cSlot.get(k) || []), r]);
  });
  cSlot.forEach((list) => {
    if (list.length > 1) errors.push({ text: `Lớp ${list[0].class_name} bị xếp ${list.length} tiết cùng lúc (${where(list[0])}): ${list.map((x) => x.subject).join(', ')}.`, advice: 'Xếp lại bằng phương án khác.' });
  });

  // 2) Một giáo viên dạy hai lớp cùng lúc (tiết cố định như Chào cờ không tính nếu chỉ có tiết cố định với nhau)
  const tSlot = new Map();
  rows.forEach((r) => {
    if (!r.teacher) return;
    const k = `${nk(r.teacher)}|${r.weekday}|${r.session}|${r.period}`;
    tSlot.set(k, [...(tSlot.get(k) || []), r]);
  });
  tSlot.forEach((list) => {
    if (list.length > 1 && list.some((x) => x.ratable !== false)) {
      errors.push({ text: `${list[0].teacher} phải dạy ${list.length} lớp cùng lúc (${where(list[0])}): ${list.map((x) => `${x.class_name} ${x.subject}`).join('; ')}.`, advice: 'Xếp lại bằng phương án khác hoặc chia bớt tiết cho giáo viên cùng môn.' });
    }
  });

  // 3) Tiết cố định (Chào cờ, Sinh hoạt) còn nguyên chỗ cũ không
  (cfg.locks || []).forEach((l) => {
    const hit = rows.some((r) => r.class_name === l.cls && r.weekday === l.day && r.session === l.session && r.period === l.period && subjKey(r.subject) === subjKey(l.subject));
    if (!hit) errors.push({ text: `Tiết cố định ${l.subject} lớp ${l.cls} (${DAY[l.day]} buổi ${SESS[l.session]} tiết ${l.period}) không còn ở chỗ cũ.`, advice: 'Kiểm tra lại các tiết cố định đã nạp.' });
  });

  // 4) Số tiết mỗi lớp từng môn: đã đặt so với đã xếp
  const want = new Map();
  (cfg.assignments || []).forEach((a) => {
    if (!a.teacher || !(Number(a.periods) > 0)) return;
    const k = `${a.cls}|${subjKey(a.subject)}`;
    const w = want.get(k) || { cls: a.cls, subject: a.subject, n: 0 };
    w.n += Number(a.periods);
    want.set(k, w);
  });
  const got = new Map();
  rows.filter((r) => r.ratable !== false).forEach((r) => {
    const k = `${r.class_name}|${subjKey(r.subject)}`;
    got.set(k, (got.get(k) || 0) + 1);
  });
  const missing = [];
  want.forEach((w, k) => {
    const g = got.get(k) || 0;
    if (g < w.n) missing.push(`Lớp ${w.cls} thiếu ${w.n - g} tiết ${w.subject} (đặt ${w.n}, xếp được ${g})`);
  });
  if (missing.length) errors.push({ text: `${missing.length} môn chưa xếp đủ tiết: ${missing.slice(0, 6).join('; ')}${missing.length > 6 ? '…' : ''}.`, advice: 'Thường do lớp hoặc giáo viên đã kín chỗ. Thử “Xếp lại”, tăng độ kỹ, giảm tiết hoặc chuyển bớt tiết sang giáo viên cùng môn.' });

  const noTeacher = (cfg.assignments || []).filter((a) => !a.teacher && Number(a.periods) > 0);
  if (noTeacher.length) warnings.push({ text: `${noTeacher.length} dòng phân công (${noTeacher.reduce((x, a) => x + Number(a.periods), 0)} tiết) chưa có giáo viên nên không được xếp: ${noTeacher.slice(0, 4).map((a) => `${a.subject} lớp ${a.cls}`).join('; ')}${noTeacher.length > 4 ? '…' : ''}.`, advice: 'Chọn giáo viên ở bước 2 rồi xếp lại.' });

  // 5) So với chương trình theo khối
  const classes = [...new Set(rows.map((r) => r.class_name))];
  const curDiff = [];
  classes.forEach((cls) => {
    const cur = (cfg.curriculum || {})[gradeOf(cls)] || {};
    Object.entries(cur).forEach(([sub, need]) => {
      const have = rows.filter((r) => r.class_name === cls && r.ratable !== false && subjKey(r.subject) === subjKey(sub)).length;
      if (have !== need) curDiff.push(`Lớp ${cls} môn ${sub}: ${have}/${need} tiết`);
    });
  });
  if (curDiff.length) warnings.push({ text: `${curDiff.length} môn lệch so với chương trình: ${curDiff.slice(0, 6).join('; ')}${curDiff.length > 6 ? '…' : ''}.`, advice: 'Xem bước 2 (Chương trình & phân công).' });

  // 6) Quy tắc buổi sáng / chiều
  if (useRule) {
    const aft = cfg.afternoonSubjects || [];
    const wrongPM = rows.filter((r) => r.ratable !== false && r.session === 'chieu' && !isAfternoonSubject(r.subject, aft));
    if (wrongPM.length) errors.push({ text: `${wrongPM.length} tiết môn chính nằm ở buổi chiều: ${[...new Set(wrongPM.map((r) => `${r.class_name} ${r.subject}`))].slice(0, 6).join('; ')}.`, advice: 'Kiểm tra mục “Môn học buổi chiều” ở bước 3.' });
    if (cfg.afternoonStrict !== false) {
      const wrongAM = rows.filter((r) => r.ratable !== false && r.session === 'sang' && isAfternoonSubject(r.subject, aft));
      if (wrongAM.length) errors.push({ text: `${wrongAM.length} tiết môn buổi chiều lại nằm ở buổi sáng: ${[...new Set(wrongAM.map((r) => `${r.class_name} ${r.subject}`))].slice(0, 6).join('; ')}.`, advice: 'Kiểm tra mục “Môn học buổi chiều” ở bước 3.' });
    }
  }

  // 7) Giáo viên: mức tiết, tối đa mỗi ngày, ngày nghỉ, đúng môn
  const per = new Map();
  rows.forEach((r) => { if (r.teacher) per.set(nk(r.teacher), [...(per.get(nk(r.teacher)) || []), r]); });
  const over = []; const aboveQ = []; const underQ = []; const perDay = []; const offBroken = []; const notSkilled = [];
  (cfg.teachers || []).forEach((t) => {
    const mine = per.get(nk(t.name)) || [];
    if (!mine.length) return;
    const quota = t.quota ?? cfg.defaultQuota;
    const max = Math.max(t.max ?? cfg.defaultMax, quota);
    if (mine.length > max) over.push(`${t.name} ${mine.length}/${max}`);
    else if (mine.length > quota) aboveQ.push(`${t.name} ${mine.length}/${quota}`);
    else if (mine.length < quota) underQ.push(`${t.name} ${mine.length}/${quota}`);
    const byDay = new Map();
    mine.forEach((r) => byDay.set(r.weekday, (byDay.get(r.weekday) || 0) + 1));
    byDay.forEach((n, d) => { if (n > cfg.maxPerDay) perDay.push(`${t.name} ${DAY[d]} ${n} tiết`); });
    if (typeof t.dayOff === 'number' && byDay.has(t.dayOff)) offBroken.push(`${t.name} (muốn nghỉ ${DAY[t.dayOff]})`);
    if ((t.subjects || []).length) {
      mine.filter((r) => r.ratable !== false).forEach((r) => {
        if (!t.subjects.some((s) => subjKey(s) === subjKey(r.subject))) notSkilled.push(`${t.name} dạy ${r.subject} lớp ${r.class_name}`);
      });
    }
  });
  if (over.length) errors.push({ text: `Giáo viên vượt mức tối đa: ${over.join('; ')}.`, advice: 'Chuyển bớt tiết sang giáo viên cùng môn (bước 1).' });
  if (perDay.length) errors.push({ text: `Giáo viên dạy quá số tiết tối đa mỗi ngày (${cfg.maxPerDay}): ${perDay.slice(0, 6).join('; ')}.`, advice: 'Tăng “Tối đa tiết/ngày” hoặc chia lại tiết.' });
  if (offBroken.length) errors.push({ text: `Giáo viên có ngày nghỉ đã chọn nhưng vẫn bị xếp tiết ngày đó: ${offBroken.join('; ')}.`, advice: 'Có thể do tiết cố định rơi vào ngày nghỉ. Đổi ngày nghỉ hoặc tiết cố định.' });
  if (aboveQ.length) warnings.push({ text: `${aboveQ.length} giáo viên trên định mức: ${aboveQ.slice(0, 6).join('; ')}${aboveQ.length > 6 ? '…' : ''}.`, advice: 'Còn trong mức tối đa nên vẫn xếp được.' });
  if (underQ.length) warnings.push({ text: `${underQ.length} giáo viên thiếu so với định mức: ${underQ.slice(0, 6).join('; ')}${underQ.length > 6 ? '…' : ''}.`, advice: 'Giao thêm tiết cùng môn hoặc thêm Hoạt động trải nghiệm, Giáo dục địa phương (bước 4, khung kiểm tra).' });
  if (notSkilled.length) warnings.push({ text: `${notSkilled.length} tiết giao cho giáo viên chưa khai báo dạy môn đó: ${notSkilled.slice(0, 4).join('; ')}${notSkilled.length > 4 ? '…' : ''}.`, advice: 'Thêm môn vào danh sách “Môn dạy được” của giáo viên nếu đúng.' });

  // 8) Tiết trống xen giữa buổi của lớp
  const gapsByClass = [];
  classes.forEach((cls) => {
    let gaps = 0;
    days.forEach((d) => ['sang', 'chieu'].forEach((s) => {
      const ps = rows.filter((r) => r.class_name === cls && r.weekday === d && r.session === s).map((r) => r.period).sort((a, b) => a - b);
      if (ps.length) gaps += ps[ps.length - 1] - ps[0] + 1 - ps.length;
    }));
    if (gaps > 0) gapsByClass.push({ cls, gaps });
  });
  if (gapsByClass.length) warnings.push({ text: `${gapsByClass.length} lớp có tiết trống xen giữa buổi: ${gapsByClass.sort((a, b) => b.gaps - a.gaps).slice(0, 6).map((g) => `${g.cls} (${g.gaps})`).join(', ')}${gapsByClass.length > 6 ? '…' : ''}.`, advice: 'Học sinh phải chờ giữa hai tiết. Thử xếp lại hoặc tăng độ kỹ.' });

  // 9) Một môn học nhiều lần trong ngày
  const multi = [];
  classes.forEach((cls) => days.forEach((d) => {
    const c = new Map();
    rows.filter((r) => r.class_name === cls && r.weekday === d && r.ratable !== false).forEach((r) => c.set(subjKey(r.subject), (c.get(subjKey(r.subject)) || 0) + 1));
    c.forEach((n, k) => { if (n >= 3) multi.push(`${cls} ${DAY[d]} ${k} ${n} tiết`); });
  }));
  if (multi.length) warnings.push({ text: `Một môn học từ 3 tiết trong một ngày: ${multi.slice(0, 5).join('; ')}.`, advice: 'Chương trình ít tiết/tuần thì nên rải đều các ngày.' });

  // 10) Tiết trống giữa buổi của giáo viên (từ bảng công bằng) và ngày nghỉ
  const gapT = (result.stats || []).filter((s) => s.gaps >= 4);
  if (gapT.length) warnings.push({ text: `${gapT.length} giáo viên nhiều tiết trống giữa buổi (từ 4 tiết/tuần): ${gapT.slice(0, 6).map((s) => `${s.name} (${s.gaps})`).join(', ')}.`, advice: 'Xếp lại hoặc tăng độ kỹ để gom tiết lại.' });
  const noOff = (result.stats || []).filter((s) => !s.hasOff);
  if (cfg.options && cfg.options.useFairness && noOff.length) infos.push({ text: `${noOff.length} giáo viên không có ngày nghỉ trọn ngày.` });

  // 11) Cảnh báo riêng của bộ xếp (tiết chưa xếp được, lớp quá chỗ...)
  (result.warnings || []).forEach((w) => { if (!/chưa có giáo viên nên chưa được xếp/.test(w)) warnings.push({ text: w }); });

  infos.push({ text: `Đã xếp ${rows.length} tiết cho ${classes.length} lớp, ${per.size} giáo viên.` });
  return { ok: errors.length === 0, errors, warnings, infos, counts: { lessons: rows.length, classes: classes.length, teachers: per.size } };
}
