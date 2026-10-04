// Bộ xếp thời khóa biểu tự động (quy tắc tính toán + tối ưu hóa, KHÔNG phải mô hình ngôn ngữ).
// Chạy hoàn toàn trên trình duyệt. Không phụ thuộc thư viện ngoài.

export const DAY_LABEL = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };

export const DEFAULT_CFG = {
  version: 1,
  days: [2, 3, 4, 5, 6],
  sang: 5,
  chieu: 4,
  maxPerDay: 7,
  defaultQuota: 19,
  defaultMax: 23,
  teachers: [], // { name, subjects: [label], quota, max, dayOff: 'auto'|'none'|2..7, fair: true }
  curriculum: {}, // { '6': { 'Toán': 4 } }
  assignments: [], // { id, cls, subject, teacher, periods }
  locks: [], // { cls, day, session, period, subject, teacher }
  carpool: [], // { name, teachers: [] }
  afternoonStrict: true, // true: các môn trong afternoonSubjects BẮT BUỘC học buổi chiều; false: được học cả hai buổi
  morningOnly: true, // true: chỉ các môn trong afternoonSubjects được xếp buổi chiều, mọi môn khác chỉ buổi sáng
  afternoonSubjects: ['Mỹ thuật', 'Âm nhạc', 'Thể dục', 'Giáo dục địa phương'],
  options: { onNoDayOff: 'warn', wFair: 12, wCarpool: 8, effort: 2 },
};

export const subjKey = (s) => String(s || '').toLowerCase().replace(/[\s.]+/g, '');
export const isFixedSubject = (s) => /^(sh|sinhhoạt|chàocờ|chaoco|sinhhoat)/.test(subjKey(s));
const plainKey = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '');
// Tên viết tắt hay gặp trong thời khóa biểu của trường
const AFTERNOON_ALIAS = {
  mythuat: ['mithuat', 'mt'],
  amnhac: ['nhac'],
  theduc: ['td', 'gdtc', 'giaoducthechat'],
  giaoducdiaphuong: ['gddp', 'gdcdp'],
};
export function afternoonKeys(list) {
  const set = new Set();
  (list || []).forEach((name) => {
    const k = plainKey(name);
    if (!k) return;
    set.add(k);
    Object.entries(AFTERNOON_ALIAS).forEach(([main, alias]) => { if (k === main || alias.includes(k)) { set.add(main); alias.forEach((a) => set.add(a)); } });
  });
  return set;
}
export function isAfternoonSubject(subject, list) {
  const k = plainKey(subject);
  if (!k) return false;
  return afternoonKeys(list).has(k);
}
export const gradeOf = (cls) => (String(cls).match(/\d+/) || [''])[0];
const nameKey = (s) => String(s || '').trim().toLowerCase();
let uid = 0;
export const newId = () => `l${Date.now().toString(36)}${(uid++).toString(36)}`;

export function mergeCfg(saved) {
  const c = { ...DEFAULT_CFG, ...(saved || {}) };
  c.options = { ...DEFAULT_CFG.options, ...((saved && saved.options) || {}) };
  ['days', 'teachers', 'assignments', 'locks', 'carpool'].forEach((k) => { if (!Array.isArray(c[k])) c[k] = DEFAULT_CFG[k]; });
  return c;
}

// ---------- Nạp từ thời khóa biểu hiện hành ----------
// rows: [{ class_name, weekday, session, period, subject, teacher }]
export function buildConfigFromRows(rows, prev) {
  const cfg = mergeCfg(prev ? { ...prev, assignments: [], locks: [], curriculum: {} } : {});
  const labels = new Map(); // subjKey -> {label: count}
  const lines = new Map();
  const teacherSubj = new Map();
  const per = new Map(); // grade|subj|class -> total periods
  rows.forEach((r) => {
    const sub = String(r.subject || '').trim();
    if (!sub) return;
    const k = subjKey(sub);
    const lm = labels.get(k) || {};
    lm[sub] = (lm[sub] || 0) + 1;
    labels.set(k, lm);
  });
  const labelOf = (sub) => {
    const lm = labels.get(subjKey(sub)) || {};
    return Object.keys(lm).sort((a, b) => lm[b] - lm[a])[0] || sub;
  };
  rows.forEach((r) => {
    const sub = labelOf(String(r.subject || '').trim());
    if (!sub) return;
    const teacher = String(r.teacher || '').trim();
    const cls = String(r.class_name).trim();
    if (isFixedSubject(sub)) {
      cfg.locks.push({ cls, day: r.weekday, session: r.session, period: r.period, subject: sub, teacher });
      return;
    }
    const key = `${cls}|${sub}|${teacher}`;
    lines.set(key, (lines.get(key) || 0) + 1);
    if (teacher) {
      const set = teacherSubj.get(teacher) || new Set();
      set.add(sub);
      teacherSubj.set(teacher, set);
    }
    const pk = `${gradeOf(cls)}|${sub}|${cls}`;
    per.set(pk, (per.get(pk) || 0) + 1);
  });
  lines.forEach((n, key) => {
    const [cls, subject, teacher] = key.split('|');
    cfg.assignments.push({ id: newId(), cls, subject, teacher, periods: n });
  });
  cfg.assignments.sort((a, b) => a.cls.localeCompare(b.cls, 'vi') || a.subject.localeCompare(b.subject, 'vi'));
  // Chương trình: số tiết/tuần của môn theo khối (lấy số phổ biến nhất giữa các lớp)
  const bucket = new Map();
  per.forEach((n, pk) => {
    const [g, sub] = pk.split('|');
    const k = `${g}|${sub}`;
    const m = bucket.get(k) || {};
    m[n] = (m[n] || 0) + 1;
    bucket.set(k, m);
  });
  bucket.forEach((m, k) => {
    const [g, sub] = k.split('|');
    const n = Number(Object.keys(m).sort((a, b) => m[b] - m[a])[0]);
    cfg.curriculum[g] = cfg.curriculum[g] || {};
    cfg.curriculum[g][sub] = n;
  });
  // Giáo viên: giữ cài đặt cũ nếu có
  const oldT = new Map((prev?.teachers || []).map((t) => [nameKey(t.name), t]));
  const names = new Set([...teacherSubj.keys(), ...cfg.locks.map((l) => l.teacher).filter(Boolean)]);
  cfg.teachers = [...names].sort((a, b) => a.localeCompare(b, 'vi')).map((name) => {
    const o = oldT.get(nameKey(name));
    const subs = new Set([...(o?.subjects || []), ...(teacherSubj.get(name) || [])]);
    return { name, subjects: [...subs], quota: o?.quota ?? null, max: o?.max ?? null, dayOff: o?.dayOff ?? 'auto', fair: o?.fair ?? true };
  });
  return cfg;
}

// ---------- Phân tích tải tiết, thiếu / thừa, đề xuất ----------
const quotaOf = (cfg, t) => t.quota ?? cfg.defaultQuota;
const maxOf = (cfg, t) => Math.max(t.max ?? cfg.defaultMax, quotaOf(cfg, t));

export function loadsOf(cfg) {
  const load = new Map();
  cfg.assignments.forEach((a) => { if (a.teacher) load.set(nameKey(a.teacher), (load.get(nameKey(a.teacher)) || 0) + Number(a.periods || 0)); });
  cfg.locks.forEach((l) => { if (l.teacher) load.set(nameKey(l.teacher), (load.get(nameKey(l.teacher)) || 0) + 1); });
  return load;
}

const qualified = (t, subject) => (t.subjects || []).some((s) => subjKey(s) === subjKey(subject));

export function analyzeLoad(cfg) {
  const load = loadsOf(cfg);
  const teachers = cfg.teachers.map((t) => {
    const l = load.get(nameKey(t.name)) || 0;
    const q = quotaOf(cfg, t);
    const m = maxOf(cfg, t);
    return { ...t, load: l, quota: q, max: m, status: l > m ? 'over' : l > q ? 'above' : l < q ? 'under' : 'ok' };
  });
  const byName = new Map(teachers.map((t) => [nameKey(t.name), t]));
  const work = new Map(teachers.map((t) => [nameKey(t.name), t.load]));
  const suggestions = [];
  const unassigned = cfg.assignments.filter((a) => !a.teacher && a.periods > 0);

  // 1) Tiết chưa có giáo viên
  unassigned.forEach((a) => {
    const cands = teachers.filter((t) => qualified(t, a.subject)).sort((x, y) => (work.get(nameKey(x.name)) / x.quota) - (work.get(nameKey(y.name)) / y.quota));
    const fit = cands.find((t) => work.get(nameKey(t.name)) + a.periods <= t.max);
    if (fit) {
      suggestions.push({ type: 'move', lineId: a.id, to: fit.name, text: `Giao ${a.periods} tiết ${a.subject} lớp ${a.cls} (chưa có giáo viên) cho ${fit.name}.` });
      work.set(nameKey(fit.name), work.get(nameKey(fit.name)) + a.periods);
    } else {
      const spare = teachers.filter((t) => work.get(nameKey(t.name)) + a.periods <= t.max).sort((x, y) => work.get(nameKey(x.name)) - work.get(nameKey(y.name)))[0];
      suggestions.push({ type: 'info', text: `Môn ${a.subject} lớp ${a.cls} (${a.periods} tiết) chưa có giáo viên đủ khả năng nhận.${spare ? ` Có thể cho ${spare.name} dạy kiêm (đang ${work.get(nameKey(spare.name))}/${spare.quota} tiết)` : ' Cần bổ sung giáo viên hoặc hợp đồng thêm.'}` });
    }
  });

  // 2) Giáo viên vượt định mức: chuyển bớt tiết sang người đủ khả năng còn trống
  teachers.filter((t) => work.get(nameKey(t.name)) > t.quota).sort((a, b) => b.load - a.load).forEach((t) => {
    const mine = cfg.assignments.filter((a) => nameKey(a.teacher) === nameKey(t.name) && a.periods > 0).sort((a, b) => a.periods - b.periods);
    for (const a of mine) {
      if (work.get(nameKey(t.name)) <= t.quota) break;
      const to = teachers
        .filter((x) => nameKey(x.name) !== nameKey(t.name) && qualified(x, a.subject) && work.get(nameKey(x.name)) < x.quota && work.get(nameKey(x.name)) + a.periods <= x.max)
        .sort((x, y) => work.get(nameKey(x.name)) - work.get(nameKey(y.name)))[0];
      if (to) {
        suggestions.push({ type: 'move', lineId: a.id, to: to.name, text: `${t.name} đang ${work.get(nameKey(t.name))}/${t.quota} tiết: chuyển ${a.periods} tiết ${a.subject} lớp ${a.cls} sang ${to.name} (đang ${work.get(nameKey(to.name))}/${to.quota}).` });
        work.set(nameKey(t.name), work.get(nameKey(t.name)) - a.periods);
        work.set(nameKey(to.name), work.get(nameKey(to.name)) + a.periods);
      }
    }
    if (work.get(nameKey(t.name)) > t.max) {
      suggestions.push({ type: 'info', text: `${t.name} vẫn vượt mức tối đa (${work.get(nameKey(t.name))}/${t.max} tiết) và chưa có người cùng môn nhận thay. Cần thêm giáo viên môn ${[...new Set(mine.map((a) => a.subject))].join(', ')} hoặc giảm tiết.` });
    }
  });

  // 3) Giáo viên thiếu tiết so với định mức
  teachers.filter((t) => work.get(nameKey(t.name)) < t.quota).forEach((t) => {
    const need = t.quota - work.get(nameKey(t.name));
    if (need < 1) return;
    suggestions.push({ type: 'info', text: `${t.name} còn thiếu ${need} tiết so với định mức (${work.get(nameKey(t.name))}/${t.quota}). Có thể nhận thêm tiết ${t.subjects.join(', ') || 'đã đăng ký'} hoặc kiêm nhiệm (chủ nhiệm, bồi dưỡng, câu lạc bộ).` });
  });

  // 4) Tổng quan theo môn
  const subj = new Map();
  cfg.assignments.forEach((a) => {
    const k = subjKey(a.subject);
    const s = subj.get(k) || { label: a.subject, demand: 0, none: 0 };
    s.demand += Number(a.periods || 0);
    if (!a.teacher) s.none += Number(a.periods || 0);
    subj.set(k, s);
  });
  const subjects = [...subj.values()].map((s) => {
    const q = teachers.filter((t) => qualified(t, s.label));
    return { ...s, teachers: q.length, room: q.reduce((x, t) => x + Math.max(0, t.max - t.load), 0) };
  }).sort((a, b) => a.label.localeCompare(b.label, 'vi'));

  return { teachers, subjects, suggestions, byName, totalDemand: subjects.reduce((x, s) => x + s.demand, 0) + cfg.locks.filter((l) => l.teacher).length };
}

// Thêm vào danh sách giáo viên những tên có trong phân công nhưng chưa khai báo
export function syncTeachers(cfg) {
  const have = new Set(cfg.teachers.map((t) => nameKey(t.name)));
  const add = [];
  [...cfg.assignments.map((a) => a.teacher), ...cfg.locks.map((l) => l.teacher)].forEach((n) => {
    const k = nameKey(n);
    if (k && !have.has(k)) { have.add(k); add.push({ name: String(n).trim(), subjects: [], quota: null, max: null, dayOff: 'auto', fair: true }); }
  });
  if (!add.length) return cfg;
  return { ...cfg, teachers: [...cfg.teachers, ...add] };
}

export function applySuggestion(cfg, s) {
  if (s.type !== 'move') return cfg;
  return { ...cfg, assignments: cfg.assignments.map((a) => (a.id === s.lineId ? { ...a, teacher: s.to } : a)) };
}

// Tạo thêm dòng phân công còn thiếu theo chương trình (không xóa dòng có sẵn)
export function fillFromCurriculum(cfg) {
  const classes = [...new Set([...cfg.assignments.map((a) => a.cls), ...cfg.locks.map((l) => l.cls)])];
  const add = [];
  const notes = [];
  classes.forEach((cls) => {
    const cur = cfg.curriculum[gradeOf(cls)] || {};
    Object.entries(cur).forEach(([sub, need]) => {
      const have = cfg.assignments.filter((a) => a.cls === cls && subjKey(a.subject) === subjKey(sub)).reduce((x, a) => x + Number(a.periods || 0), 0);
      if (have < need) add.push({ id: newId(), cls, subject: sub, teacher: '', periods: need - have });
      if (have > need) notes.push(`Lớp ${cls} môn ${sub}: đang ${have} tiết, chương trình ${need} tiết (giữ nguyên, hãy kiểm tra).`);
    });
  });
  return { cfg: { ...cfg, assignments: [...cfg.assignments, ...add] }, added: add.length, notes };
}

// Tự chọn giáo viên cho các dòng chưa có giáo viên
export function autoAssign(cfg) {
  const load = loadsOf(cfg);
  const T = cfg.teachers.map((t) => ({ ...t, q: quotaOf(cfg, t), m: maxOf(cfg, t) }));
  const out = cfg.assignments.map((a) => ({ ...a }));
  let done = 0;
  const left = [];
  out.filter((a) => !a.teacher && a.periods > 0).sort((a, b) => b.periods - a.periods).forEach((a) => {
    const cands = T.filter((t) => qualified(t, a.subject));
    const sameGrade = new Set(out.filter((x) => x.teacher && subjKey(x.subject) === subjKey(a.subject) && gradeOf(x.cls) === gradeOf(a.cls)).map((x) => nameKey(x.teacher)));
    const score = (t) => {
      const l = load.get(nameKey(t.name)) || 0;
      return (l + a.periods) / t.q - (sameGrade.has(nameKey(t.name)) ? 0.15 : 0);
    };
    const ok = cands.filter((t) => (load.get(nameKey(t.name)) || 0) + a.periods <= t.m).sort((x, y) => score(x) - score(y));
    const pick = ok[0];
    if (pick) {
      a.teacher = pick.name;
      load.set(nameKey(pick.name), (load.get(nameKey(pick.name)) || 0) + a.periods);
      done += 1;
    } else left.push(a);
  });
  return { cfg: { ...cfg, assignments: out }, done, left };
}

// ---------- Xếp ngày nghỉ công bằng ----------
export function planDaysOff(cfg) {
  const D = cfg.days.length;
  const K = cfg.sang + cfg.chieu;
  const load = loadsOf(cfg);
  const warnings = [];
  const off = new Map();
  const counts = Array(D).fill(0);
  const cap = (D - 1) * Math.min(cfg.maxPerDay, K);
  const info = new Map();
  cfg.teachers.forEach((t) => {
    const l = load.get(nameKey(t.name)) || 0;
    if (l === 0) { off.set(nameKey(t.name), -1); return; }
    const locked = new Set(cfg.locks.filter((x) => nameKey(x.teacher) === nameKey(t.name)).map((x) => cfg.days.indexOf(x.day)));
    const feasible = [];
    for (let d = 0; d < D; d += 1) if (!locked.has(d)) feasible.push(d);
    info.set(nameKey(t.name), { t, l, feasible });
  });
  const failed = [];
  const place = (names, d) => { names.forEach((n) => off.set(n, d)); counts[d] += names.length; };
  const pickDay = (names) => {
    const infos = names.map((n) => info.get(n));
    if (infos.some((i) => !i || i.l > cap)) return -1;
    let days = infos[0].feasible.filter((d) => infos.every((i) => i.feasible.includes(d)));
    const fixed = infos.map((i) => (typeof i.t.dayOff === 'number' ? cfg.days.indexOf(i.t.dayOff) : null)).filter((x) => x !== null && x >= 0);
    if (fixed.length) days = days.filter((d) => fixed.includes(d));
    if (!days.length) return -1;
    return days.sort((a, b) => counts[a] - counts[b] || a - b)[0];
  };
  const handled = new Set();
  cfg.carpool.forEach((g) => {
    const names = g.teachers.map(nameKey).filter((n) => info.has(n) && info.get(n).t.dayOff !== 'none');
    if (names.length < 2) return;
    const d = pickDay(names);
    if (d >= 0) { place(names, d); names.forEach((n) => handled.add(n)); }
  });
  const rest = [...info.keys()].filter((n) => !handled.has(n) && info.get(n).t.dayOff !== 'none')
    .sort((a, b) => info.get(a).feasible.length - info.get(b).feasible.length || info.get(b).l - info.get(a).l);
  rest.forEach((n) => {
    const d = pickDay([n]);
    if (d >= 0) place([n], d);
    else { off.set(n, -1); failed.push({ name: info.get(n).t.name, reason: info.get(n).l > cap ? `dạy ${info.get(n).l} tiết, 4 ngày chỉ nhận tối đa ${cap} tiết` : 'có tiết cố định ở mọi ngày hoặc ngày nghỉ chọn trùng tiết cố định' }); }
  });
  info.forEach((i, n) => { if (i.t.dayOff === 'none') off.set(n, -1); });
  failed.forEach((f) => warnings.push(`Không xếp được ngày nghỉ cho ${f.name}: ${f.reason}.`));
  return { off, failed, warnings, counts };
}

// ---------- Bộ xếp chính (mô phỏng luyện kim) ----------
const U_PEN = 500;

export function solve(cfg, { seed = 1, onProgress } = {}) {
  const O = cfg.options;
  const D = cfg.days.length;
  const K = cfg.sang + cfg.chieu;
  const S = D * K;
  const warnings = [];

  const dayOff = planDaysOff(cfg);
  warnings.push(...dayOff.warnings);
  if (dayOff.failed.length && O.onNoDayOff === 'stop') {
    return Promise.resolve({ ok: false, stopped: true, warnings: [...warnings, 'Đã dừng theo thiết lập: có giáo viên không thể nghỉ trọn 1 ngày. Hãy sửa thiết lập rồi xếp lại, hoặc chuyển sang “Cảnh báo và vẫn xếp”.'], rows: [], stats: [] });
  }

  const classes = [...new Set([...cfg.assignments.map((a) => a.cls), ...cfg.locks.map((l) => l.cls)])].sort((a, b) => a.localeCompare(b, 'vi'));
  const cIdx = new Map(classes.map((c, i) => [c, i]));
  const tNames = [];
  const tIdx = new Map();
  const tOf = (name) => {
    const k = nameKey(name);
    if (!k) return -1;
    if (!tIdx.has(k)) { tIdx.set(k, tNames.length); tNames.push(String(name).trim()); }
    return tIdx.get(k);
  };
  cfg.teachers.forEach((t) => tOf(t.name));
  const sIdx = new Map();
  const sLabels = [];
  const sOf = (label) => {
    const k = subjKey(label);
    if (!sIdx.has(k)) { sIdx.set(k, sLabels.length); sLabels.push(label); }
    return sIdx.get(k);
  };

  const lessons = [];
  cfg.locks.forEach((l) => {
    const d = cfg.days.indexOf(l.day);
    const k = l.session === 'sang' ? l.period - 1 : cfg.sang + l.period - 1;
    if (d < 0 || k < 0 || k >= K) return;
    lessons.push({ c: cIdx.get(l.cls), t: tOf(l.teacher), sub: sOf(l.subject), label: l.subject, fixed: true, slot: d * K + k });
  });
  cfg.assignments.forEach((a) => {
    if (!(a.periods > 0)) return;
    if (!a.teacher) warnings.push(`Lớp ${a.cls} môn ${a.subject}: ${a.periods} tiết chưa có giáo viên nên chưa được xếp.`);
    else {
      const useRule = cfg.morningOnly !== false && cfg.chieu > 0;
      const pmSubject = isAfternoonSubject(a.subject, cfg.afternoonSubjects);
      const mo = useRule && !pmSubject; // môn chính: chỉ buổi sáng
      const pm = useRule && pmSubject && cfg.afternoonStrict !== false; // môn buổi chiều: chỉ buổi chiều
      for (let i = 0; i < a.periods; i += 1) lessons.push({ c: cIdx.get(a.cls), t: tOf(a.teacher), sub: sOf(a.subject), label: a.subject, fixed: false, mo, pm, slot: -1 });
    }
  });
  const T = tNames.length;
  const C = classes.length;
  const NS = sLabels.length;
  const tInfo = tNames.map((n) => cfg.teachers.find((t) => nameKey(t.name) === nameKey(n)) || {});
  const fairT = tNames.map((n, i) => tInfo[i].fair !== false);
  const offDay = tNames.map((n) => (dayOff.off.has(nameKey(n)) ? dayOff.off.get(nameKey(n)) : -1));
  const groups = cfg.carpool.map((g) => g.teachers.map((n) => tIdx.get(nameKey(n))).filter((x) => x !== undefined)).filter((g) => g.length > 1);

  // Kiểm tra sức chứa lớp
  classes.forEach((c, ci) => {
    const n = lessons.filter((l) => l.c === ci).length;
    if (n > S) warnings.push(`Lớp ${c} có ${n} tiết nhưng chỉ có ${S} chỗ trong tuần.`);
    const pmN = lessons.filter((l) => l.c === ci && !l.fixed && l.pm).length;
    if (pmN > D * cfg.chieu) warnings.push(`Lớp ${c} có ${pmN} tiết môn buổi chiều nhưng buổi chiều chỉ có ${D * cfg.chieu} chỗ.`);
    if (cfg.morningOnly !== false) {
      const mo = lessons.filter((l) => l.c === ci && !l.fixed && l.mo).length;
      const fixedMorning = lessons.filter((l) => l.c === ci && l.fixed && l.slot % K < cfg.sang).length;
      if (mo + fixedMorning > D * cfg.sang) warnings.push(`Lớp ${c} có ${mo + fixedMorning} tiết phải học buổi sáng nhưng buổi sáng chỉ có ${D * cfg.sang} chỗ. Cần giảm tiết hoặc cho thêm môn được học buổi chiều.`);
    }
  });

  const clsOcc = classes.map(() => new Int32Array(S).fill(-1));
  const tOcc = tNames.map(() => new Int32Array(S).fill(-1));
  const W = { gapS: 10, gapC: 4, fullC: 6, useC: 3, lead: 0.5, sameSub: 12, tGap: 5, both: 2, over: 20 };

  // rng
  let st = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };

  const cCost = new Float64Array(C);
  const tCost = new Float64Array(T);
  const tFirst = new Int16Array(T * D).fill(-1);
  const tLast = new Int16Array(T * D).fill(-1);
  const tCnt = new Int16Array(T * D);
  const sumA = new Float64Array(T);
  const sumL = new Float64Array(T);
  const nDay = new Int16Array(T);
  let sumC = 0;
  let sumT = 0;
  let unplaced = 0;
  const subCnt = new Int16Array(NS);

  function recalcClass(c) {
    const occ = clsOcc[c];
    let cost = 0;
    for (let d = 0; d < D; d += 1) {
      const base = d * K;
      let cs = 0; let lastS = -1; let cc = 0; let firstC = -1; let lastC = -1;
      for (let k = 0; k < K; k += 1) {
        if (occ[base + k] < 0) continue;
        if (k < cfg.sang) { cs += 1; lastS = k; } else { cc += 1; if (firstC < 0) firstC = k; lastC = k; }
      }
      cost += W.gapS * (lastS + 1 - cs);
      if (cc > 0) {
        cost += W.gapC * (lastC - firstC + 1 - cc) + W.useC + W.lead * (firstC - cfg.sang);
        if (cs < cfg.sang) cost += W.fullC * (cfg.sang - cs);
      }
      // trùng môn trong ngày
      let used = false;
      for (let k = 0; k < K; k += 1) {
        const id = occ[base + k];
        if (id >= 0) { subCnt[lessons[id].sub] += 1; used = true; }
      }
      if (used) {
        for (let k = 0; k < K; k += 1) {
          const id = occ[base + k];
          if (id < 0) continue;
          const s = lessons[id].sub;
          const n = subCnt[s];
          if (n > 1) {
            let adj = n === 2;
            if (adj) {
              adj = false;
              for (let j = 0; j < K - 1; j += 1) {
                const a = occ[base + j];
                const b = occ[base + j + 1];
                if (a >= 0 && b >= 0 && lessons[a].sub === s && lessons[b].sub === s && (j + 1 !== cfg.sang)) { adj = true; break; }
              }
            }
            cost += adj ? 0.5 : W.sameSub * (n - 1);
          }
          if (id >= 0) subCnt[s] = 0;
        }
      }
    }
    sumC += cost - cCost[c];
    cCost[c] = cost;
  }

  function recalcTeacher(t) {
    const occ = tOcc[t];
    let cost = 0;
    sumA[t] = 0; sumL[t] = 0; nDay[t] = 0;
    const maxPD = cfg.maxPerDay;
    for (let d = 0; d < D; d += 1) {
      const base = d * K;
      let first = -1; let last = -1; let cnt = 0; let fS = -1; let lS = -1; let nS = 0; let fC = -1; let lC = -1; let nC = 0;
      for (let k = 0; k < K; k += 1) {
        if (occ[base + k] < 0) continue;
        cnt += 1;
        if (first < 0) first = k;
        last = k;
        if (k < cfg.sang) { nS += 1; if (fS < 0) fS = k; lS = k; } else { nC += 1; if (fC < 0) fC = k; lC = k; }
      }
      if (nS > 0) cost += W.tGap * (lS - fS + 1 - nS);
      if (nC > 0) cost += W.tGap * (lC - fC + 1 - nC);
      if (nS > 0 && nC > 0) cost += W.both;
      if (cnt > maxPD) cost += W.over * (cnt - maxPD);
      tFirst[t * D + d] = first; tLast[t * D + d] = last; tCnt[t * D + d] = cnt;
      if (cnt > 0) { sumA[t] += first; sumL[t] += last; nDay[t] += 1; }
    }
    sumT += cost - tCost[t];
    tCost[t] = cost;
  }

  function globalCost() {
    let g = 0;
    if (O.wFair > 0) {
      let n = 0; let ma = 0; let ml = 0;
      for (let t = 0; t < T; t += 1) if (fairT[t] && nDay[t] > 0) { n += 1; ma += sumA[t] / nDay[t]; ml += sumL[t] / nDay[t]; }
      if (n > 1) {
        ma /= n; ml /= n;
        let v = 0;
        for (let t = 0; t < T; t += 1) if (fairT[t] && nDay[t] > 0) { const a = sumA[t] / nDay[t] - ma; const l = sumL[t] / nDay[t] - ml; v += a * a + l * l; }
        g += O.wFair * v;
      }
    }
    if (O.wCarpool > 0) {
      for (let gi = 0; gi < groups.length; gi += 1) {
        const gr = groups[gi];
        for (let d = 0; d < D; d += 1) {
          let mnF = 99; let mxF = -1; let mnL = 99; let mxL = -1; let teach = 0;
          for (let x = 0; x < gr.length; x += 1) {
            const i = gr[x] * D + d;
            if (tCnt[i] > 0) { teach += 1; if (tFirst[i] < mnF) mnF = tFirst[i]; if (tFirst[i] > mxF) mxF = tFirst[i]; if (tLast[i] < mnL) mnL = tLast[i]; if (tLast[i] > mxL) mxL = tLast[i]; }
          }
          if (teach > 0) g += O.wCarpool * ((mxF - mnF) + (mxL - mnL) + 2 * (gr.length - teach) * (teach > 0 ? 1 : 0));
        }
      }
    }
    return g;
  }
  const total = () => sumC + sumT + globalCost() + U_PEN * unplaced;

  // đặt / bỏ
  function put(id, s) {
    const l = lessons[id];
    if (l.slot >= 0) { clsOcc[l.c][l.slot] = -1; if (l.t >= 0) tOcc[l.t][l.slot] = -1; } else unplaced -= 1;
    l.slot = s;
    if (s >= 0) { clsOcc[l.c][s] = id; if (l.t >= 0) tOcc[l.t][s] = id; } else unplaced += 1;
  }
  const refresh = (cs, ts) => { cs.forEach((c) => recalcClass(c)); ts.forEach((t) => { if (t >= 0) recalcTeacher(t); }); };
  const allowed = (t, s) => t < 0 || (offDay[t] < 0 || Math.floor(s / K) !== offDay[t]);
  // Tiết môn chính (mo) chỉ được đặt vào buổi sáng; tiết môn buổi chiều (pm) chỉ được đặt vào buổi chiều
  const okFor = (l, s) => allowed(l.t, s) && !(l.mo && s % K >= cfg.sang) && !(l.pm && s % K < cfg.sang);

  // khởi tạo
  lessons.forEach((l) => { if (!l.fixed) unplaced += 1; });
  lessons.forEach((l, id) => { if (l.fixed) { const s = l.slot; l.slot = -1; unplaced += 1; put(id, s); } });
  for (let c = 0; c < C; c += 1) recalcClass(c);
  for (let t = 0; t < T; t += 1) recalcTeacher(t);

  const loadOfT = new Int32Array(T);
  lessons.forEach((l) => { if (l.t >= 0) loadOfT[l.t] += 1; });
  const order = lessons.map((l, i) => i).filter((i) => !lessons[i].fixed)
    .sort((a, b) => (lessons[b].t >= 0 ? loadOfT[lessons[b].t] : 0) - (lessons[a].t >= 0 ? loadOfT[lessons[a].t] : 0) || rnd() - 0.5);
  order.forEach((id) => {
    const l = lessons[id];
    let best = -1; let bestV = Infinity;
    for (let s = 0; s < S; s += 1) {
      if (clsOcc[l.c][s] >= 0 || (l.t >= 0 && tOcc[l.t][s] >= 0) || !okFor(l, s)) continue;
      put(id, s); refresh([l.c], [l.t]);
      const v = total() + rnd() * 0.5;
      put(id, -1); refresh([l.c], [l.t]);
      if (v < bestV) { bestV = v; best = s; }
    }
    if (best >= 0) { put(id, best); refresh([l.c], [l.t]); }
  });

  const movable = lessons.map((l, i) => i).filter((i) => !lessons[i].fixed);
  const iters = [40000, 120000, 300000, 700000][Math.min(3, Math.max(0, (O.effort ?? 2)))] ;
  const T0 = 8;
  const T1 = 0.05;
  let cur = total();
  let it = 0;
  let best = cur;
  let bestSlots = lessons.map((l) => l.slot);
  const CHUNK = 6000;
  if (unplaced > 0 && repairAll()) { cur = total(); best = cur; bestSlots = lessons.map((l) => l.slot); }


  // Sửa chuỗi luân phiên (Kempe chain): đặt một tiết chưa xếp bằng cách đổi chỗ dây chuyền các tiết khác.
  // a = chỗ trống của lớp (giáo viên đang bận), b = chỗ trống của giáo viên. Đổi a <-> b dọc đường đi
  // lớp - giáo viên - lớp... cho tới khi a trống ở cả lớp và giáo viên. Chỉ áp dụng nếu mọi tiết bị đổi vẫn hợp lệ.
  function repairOne(u) {
    const l = lessons[u];
    const c = l.c;
    const t = l.t;
    const A = [];
    const B = [];
    for (let s = 0; s < S; s += 1) {
      const cf = clsOcc[c][s] < 0;
      const tf = t < 0 || tOcc[t][s] < 0;
      if (cf && tf && okFor(l, s)) { put(u, s); refresh([c], [t]); return true; }
      if (cf && okFor(l, s)) A.push(s);
      else if (!cf && tf && t >= 0) B.push(s);
    }
    if (t < 0 || !A.length || !B.length) return false;
    for (let ai = 0; ai < A.length; ai += 1) {
      for (let bi = 0; bi < B.length; bi += 1) {
        const a = A[ai];
        const b = B[bi];
        const chain = [];
        let vt = t;
        let ok = true;
        for (let guard = 0; guard < 4 * C + 4; guard += 1) {
          const x = tOcc[vt][a];
          if (x < 0) break;
          if (lessons[x].fixed) { ok = false; break; }
          chain.push({ id: x, to: b });
          const y = clsOcc[lessons[x].c][b];
          if (y < 0) break;
          if (lessons[y].fixed) { ok = false; break; }
          chain.push({ id: y, to: a });
          vt = lessons[y].t;
          if (vt < 0) break;
        }
        if (!ok || !chain.length) continue;
        if (!chain.every((m) => okFor(lessons[m.id], m.to))) continue;
        const cs = new Set([c]);
        const ts = new Set([t]);
        chain.forEach((m) => { cs.add(lessons[m.id].c); ts.add(lessons[m.id].t); });
        chain.forEach((m) => put(m.id, -1));
        chain.forEach((m) => put(m.id, m.to));
        put(u, a);
        refresh([...cs], [...ts]);
        return true;
      }
    }
    return false;
  }
  function repairAll() {
    let any = false;
    let progress = true;
    while (progress && unplaced > 0) {
      progress = false;
      for (let i = 0; i < movable.length; i += 1) {
        const id = movable[i];
        if (lessons[id].slot < 0 && repairOne(id)) { progress = true; any = true; }
      }
    }
    return any;
  }

  function step() {
    const temp = T0 * Math.pow(T1 / T0, it / iters);
    let id;
    if (unplaced > 0 && rnd() < 0.3) {
      const off = Math.floor(rnd() * movable.length);
      id = -1;
      for (let i = 0; i < movable.length; i += 1) { const x = movable[(i + off) % movable.length]; if (lessons[x].slot < 0) { id = x; break; } }
      if (id < 0) id = movable[Math.floor(rnd() * movable.length)];
    } else id = movable[Math.floor(rnd() * movable.length)];
    const l = lessons[id];
    const a = l.slot;
    const s = Math.floor(rnd() * S);
    if (s === a) return;
    const occId = clsOcc[l.c][s];
    const cs = [l.c];
    let ts;
    let undo;
    if (occId < 0) {
      if (!okFor(l, s)) return;
      const tb = l.t >= 0 ? tOcc[l.t][s] : -1;
      if (tb >= 0) return;
      ts = [l.t];
      undo = () => put(id, a);
      put(id, s);
    } else {
      const m = lessons[occId];
      if (m.fixed) return;
      if (!okFor(l, s)) return;
      if (a >= 0 && !okFor(m, a)) return;
      const tl = l.t >= 0 ? tOcc[l.t][s] : -1;
      if (tl >= 0 && tl !== occId) return;
      if (a >= 0) { const tm = m.t >= 0 ? tOcc[m.t][a] : -1; if (tm >= 0 && tm !== id) return; }
      ts = [l.t, m.t];
      undo = () => { put(occId, -1); put(id, a); put(occId, s); };
      put(occId, -1);
      put(id, s);
      if (a >= 0) put(occId, a);
    }
    refresh(cs, ts);
    const nv = total();
    const dlt = nv - cur;
    if (dlt <= 0 || rnd() < Math.exp(-dlt / temp)) {
      cur = nv;
      if (cur < best - 1e-9) { best = cur; bestSlots = lessons.map((x) => x.slot); }
    } else { undo(); refresh(cs, ts); }
  }

  function finish() {
    // khôi phục nghiệm tốt nhất
    lessons.forEach((l, id) => { if (!l.fixed) put(id, -1); });
    lessons.forEach((l, id) => { if (!l.fixed && bestSlots[id] >= 0) put(id, bestSlots[id]); });
    for (let c = 0; c < C; c += 1) recalcClass(c);
    for (let t = 0; t < T; t += 1) recalcTeacher(t);
    if (unplaced > 0) repairAll();

    const rows = [];
    const miss = [];
    lessons.forEach((l) => {
      if (l.slot < 0) { miss.push(l); return; }
      const d = Math.floor(l.slot / K);
      const k = l.slot % K;
      rows.push({ class_name: classes[l.c], weekday: cfg.days[d], session: k < cfg.sang ? 'sang' : 'chieu', period: k < cfg.sang ? k + 1 : k - cfg.sang + 1, subject: l.label, teacher: l.t >= 0 ? tNames[l.t] : null, ratable: !l.fixed });
    });
    const missSum = new Map();
    miss.forEach((l) => { const key = `Lớp ${classes[l.c]} · ${l.label} · ${l.t >= 0 ? tNames[l.t] : '—'}`; missSum.set(key, (missSum.get(key) || 0) + 1); });
    missSum.forEach((n, key) => warnings.push(`Chưa xếp được ${n} tiết: ${key} (trùng lịch giáo viên hoặc lớp đã kín). Thử xếp lại, tăng mức “kỹ”, hoặc giảm tiết/chuyển giáo viên.`));

    const stats = tNames.map((name, t) => {
      let early = 0; let late = 0; let outEarly = 0; let outLate = 0; let gaps = 0; let both = 0; let days = 0; const offs = [];
      for (let d = 0; d < D; d += 1) {
        const i = t * D + d;
        if (tCnt[i] === 0) { offs.push(cfg.days[d]); continue; }
        days += 1;
        if (tFirst[i] === 0) early += 1;
        if (tFirst[i] >= 2) late += 1;
        if (tLast[i] >= cfg.sang - 1) outLate += 1;
        if (tLast[i] < cfg.sang - 2) outEarly += 1;
      }
      const periods = tOcc[t].reduce((x, v) => x + (v >= 0 ? 1 : 0), 0);
      gaps = 0;
      for (let d = 0; d < D; d += 1) {
        const b = d * K;
        let nS = 0; let fS = -1; let lS = -1; let nC = 0; let fC = -1; let lC = -1;
        for (let k = 0; k < K; k += 1) if (tOcc[t][b + k] >= 0) { if (k < cfg.sang) { nS += 1; if (fS < 0) fS = k; lS = k; } else { nC += 1; if (fC < 0) fC = k; lC = k; } }
        if (nS) gaps += lS - fS + 1 - nS;
        if (nC) gaps += lC - fC + 1 - nC;
        if (nS && nC) both += 1;
      }
      return { name, periods, days, offDays: offs, early, late, outEarly, outLate, gaps, both, hasOff: offs.length > 0 };
    }).filter((x) => x.periods > 0);

    stats.forEach((s) => {
      const want = tInfo[tIdx.get(nameKey(s.name))]?.dayOff;
      if (!s.hasOff && want !== 'none') warnings.push(`${s.name} không có ngày nghỉ trọn ngày trong tuần này.`);
    });
    return { ok: miss.length === 0, rows, stats, warnings, cost: Math.round(best), unplaced: miss.length };
  }

  return new Promise((resolve) => {
    function tick() {
      const end = Math.min(iters, it + CHUNK);
      for (; it < end; it += 1) step();
      if (unplaced > 0 && repairAll()) { cur = total(); if (cur < best) { best = cur; bestSlots = lessons.map((x) => x.slot); } }
      if (onProgress) onProgress(Math.min(1, it / iters));
      if (it >= iters) resolve(finish());
      else setTimeout(tick, 0);
    }
    tick();
  });
}
