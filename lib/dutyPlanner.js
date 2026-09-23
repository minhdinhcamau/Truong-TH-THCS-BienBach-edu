// "Trợ lý xếp lịch trực nhật" của lớp. Chạy ngay trong trình duyệt, đọc dữ liệu vi phạm/điểm của lớp
// (hàm class_planner_data) rồi ĐỀ XUẤT lịch kèm LÝ DO cho từng bạn. Lớp phó lao động xem, chỉnh, rồi mới lưu.
//
// members: [{ id, name, group_no, week_net, week_violations, prior_violations, types }]
// days:    [{ date: 'YYYY-MM-DD', weekday: 2..7, label: 'Thứ 2' }]
// Kết quả: { rows: [{ date, label, student_id, name, group_no, source, reason }], warnings: [] }

export const MODES = [
  { key: 'manual', label: 'Tự chọn: chọn tổ rồi chọn thành viên, chọn thứ' },
  { key: 'group_low', label: 'Tự động: tổ có điểm thấp nhất trực, thiếu người thì thêm bạn vi phạm nhiều' },
  { key: 'violators', label: 'Tự động: những bạn vi phạm trực nhật, thiếu người thì thêm bạn vi phạm nói chung' },
  { key: 'rotation', label: 'Tự động: các tổ trực chéo nhau, không trùng với tuần trước' },
];

const num = (v) => Number(v) || 0;
const fmt = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

// Mức "đáng chú ý" của 1 bạn: vi phạm tuần này nặng hơn vi phạm các tuần trước
function severity(m) {
  return num(m.week_violations) * 3 + num(m.prior_violations);
}
function bySeverity(a, b) {
  return severity(b) - severity(a) || num(a.week_net) - num(b.week_net) || String(a.name).localeCompare(String(b.name), 'vi');
}
function describe(m) {
  const parts = [];
  if (num(m.week_violations)) parts.push(`${m.week_violations} vi phạm tuần này`);
  if (num(m.prior_violations)) parts.push(`${m.prior_violations} vi phạm trong 4 tuần trước`);
  const base = parts.length ? parts.join(', ') : 'chưa có vi phạm ghi nhận';
  return m.types ? `${base} (${m.types})` : base;
}

function makeBuilder(days) {
  const rows = [];
  const count = new Map();
  const perDay = new Map(days.map((d) => [d.date, new Set()]));
  const dayOf = new Map(days.map((d) => [d.date, d]));
  return {
    rows,
    count,
    has: (date, id) => perDay.get(date).has(id),
    size: (date) => perDay.get(date).size,
    used: (id) => (count.get(id) || 0) > 0,
    add(date, m, source, reason) {
      if (perDay.get(date).has(m.id)) return false;
      perDay.get(date).add(m.id);
      count.set(m.id, (count.get(m.id) || 0) + 1);
      rows.push({ date, label: dayOf.get(date).label, student_id: m.id, name: m.name, group_no: m.group_no || null, source, reason });
      return true;
    },
    finish(warnings) {
      // Bạn trực từ 2 lần: nhắc rõ trong lý do
      rows.forEach((r) => {
        const c = count.get(r.student_id) || 0;
        if (c >= 2 && !/lần/.test(r.reason)) r.reason = `Trực ${c} lần trong tuần: ${r.reason}`;
      });
      rows.sort((a, b) => a.date.localeCompare(b.date) || String(a.group_no).localeCompare(String(b.group_no)) || a.name.localeCompare(b.name, 'vi'));
      return { rows, warnings };
    },
  };
}

function groupsOf(members) {
  const map = new Map();
  members.forEach((m) => {
    const g = m.group_no || 0;
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(m);
  });
  return map;
}

function planGroupLow(members, days, perDay) {
  const warnings = [];
  const b = makeBuilder(days);
  const map = groupsOf(members);
  let list = [...map.entries()]
    .filter(([g]) => g !== 0)
    .map(([g, ms]) => ({ g, ms, score: ms.reduce((s, m) => s + num(m.week_net), 0), vio: ms.reduce((s, m) => s + num(m.week_violations), 0) }));
  if (!list.length) {
    warnings.push('Lớp chưa chia tổ (hãy lưu sơ đồ lớp trước). Tạm coi cả lớp là một tổ.');
    list = [{ g: 0, ms: members, score: 0, vio: 0 }];
  }
  list.sort((a, b2) => a.score - b2.score || b2.vio - a.vio || a.g - b2.g);

  days.forEach((day, i) => {
    const grp = list[i % list.length];
    const place = (i % list.length) + 1;
    const gname = grp.g ? `Tổ ${grp.g}` : 'Cả lớp';
    const pool = grp.ms.filter((m) => !b.used(m.id)).sort(bySeverity);
    pool.slice(0, perDay).forEach((m) => {
      b.add(
        day.date, m, 'ai_group',
        `${gname} có điểm tuần thấp thứ ${place}/${list.length} (${fmt(grp.score)} điểm) nên trực ${day.label}.` +
          (severity(m) ? ` Bạn ${describe(m)}.` : '')
      );
    });
    let need = perDay - b.size(day.date);
    if (need > 0) {
      const others = members.filter((m) => !b.used(m.id) && m.group_no !== grp.g).sort(bySeverity);
      others.slice(0, need).forEach((m) => {
        b.add(day.date, m, 'ai_group', `Bổ sung vì ${gname} chỉ còn ${pool.length} bạn chưa trực trong tuần. Bạn ${describe(m)}.`);
      });
      need = perDay - b.size(day.date);
    }
    if (need > 0) {
      // Cả lớp đã có lịch trực: buộc phải chọn lại
      const again = members.filter((m) => !b.has(day.date, m.id)).sort(bySeverity);
      again.slice(0, need).forEach((m) => {
        b.add(day.date, m, 'ai_group', `Trực thêm lần ${(b.count.get(m.id) || 0) + 1}: cả lớp đã có lịch trực nên chọn lại bạn ${describe(m)}.`);
      });
      warnings.push(`${day.label}: lớp không đủ người chưa trực nên có bạn phải trực từ 2 lần.`);
    }
  });
  return b.finish(warnings);
}

function planViolators(members, days, perDay) {
  const warnings = [];
  const b = makeBuilder(days);
  const t1 = members.filter((m) => num(m.week_violations) > 0).sort(bySeverity);
  const t2 = members.filter((m) => !num(m.week_violations) && num(m.prior_violations) > 0).sort(bySeverity);
  const t3 = members.filter((m) => !num(m.week_violations) && !num(m.prior_violations))
    .sort((a, c) => num(a.week_net) - num(c.week_net) || String(a.name).localeCompare(String(c.name), 'vi'));
  const pool = [
    ...t1.map((m) => ({ m, tier: 1 })),
    ...t2.map((m) => ({ m, tier: 2 })),
    ...t3.map((m) => ({ m, tier: 3 })),
  ];
  if (!pool.length) return b.finish(['Lớp chưa có học sinh nào.']);

  const slots = days.length * perDay;
  const reasonOf = (m, tier, again) => {
    if (again) return `Trực thêm lần ${(b.count.get(m.id) || 0) + 1}: đã dùng hết danh sách người vi phạm nên chọn lại bạn ${describe(m)}.`;
    if (tier === 1) return `Vi phạm ${m.week_violations} lần tuần này${m.types ? ` (${m.types})` : ''} nên được phân công trực nhật.`;
    if (tier === 2) return `Tuần này chưa vi phạm nhưng ${describe(m)}; bổ sung vì chưa đủ người vi phạm cho ${perDay} bạn/ngày.`;
    return `Bổ sung cho đủ người: chưa có vi phạm ghi nhận, ưu tiên bạn có điểm tuần thấp (${fmt(m.week_net)} điểm).`;
  };

  let placed = 0;
  for (let k = 0; placed < slots && k < slots * 3; k += 1) {
    const idx = k % pool.length;
    const again = k >= pool.length;
    const { m, tier } = pool[idx];
    // ngày ít người nhất mà bạn này chưa trực
    const target = days
      .filter((d) => !b.has(d.date, m.id) && b.size(d.date) < perDay)
      .sort((x, y) => b.size(x.date) - b.size(y.date) || x.date.localeCompare(y.date))[0];
    if (!target) continue;
    if (b.add(target.date, m, 'ai_violators', reasonOf(m, tier, again))) placed += 1;
  }
  if (slots > pool.length) warnings.push(`Lớp chỉ có ${pool.length} bạn nên có bạn phải trực từ 2 lần trong tuần.`);
  if (!t1.length) warnings.push('Tuần này chưa có ghi nhận vi phạm nào, hệ thống chọn theo vi phạm các tuần trước và điểm tuần.');
  return b.finish(warnings);
}

function planRotation(members, days, perDay, lastWeekDuty, wholeGroup) {
  const warnings = [];
  const b = makeBuilder(days);
  const map = groupsOf(members);
  let groups = [...map.entries()].filter(([g]) => g !== 0).map(([g, ms]) => ({ g, ms })).sort((a, c) => a.g - c.g);
  if (!groups.length) {
    warnings.push('Lớp chưa chia tổ (hãy lưu sơ đồ lớp trước). Tạm coi cả lớp là một tổ.');
    groups = [{ g: 0, ms: members }];
  }
  const lastGroup = new Map();
  const lastIds = new Set();
  (lastWeekDuty || []).forEach((d) => {
    if (d.group_no && !lastGroup.has(d.weekday)) lastGroup.set(d.weekday, d.group_no);
    lastIds.add(d.student_id);
  });
  const usage = new Map(groups.map((x) => [x.g, 0]));

  days.forEach((day) => {
    const last = lastGroup.get(day.weekday);
    const cand = groups.filter((x) => x.g !== last);
    const pool = cand.length ? cand : groups;
    const pick = [...pool].sort((x, y) => usage.get(x.g) - usage.get(y.g) || x.g - y.g)[0];
    usage.set(pick.g, usage.get(pick.g) + 1);
    const gname = pick.g ? `Tổ ${pick.g}` : 'Cả lớp';
    const sorted = [...pick.ms].sort((x, y) => Number(b.used(x.id)) - Number(b.used(y.id)) || Number(lastIds.has(x.id)) - Number(lastIds.has(y.id)) || String(x.name).localeCompare(String(y.name), 'vi'));
    const chosen = wholeGroup ? sorted : sorted.slice(0, perDay);
    const why =
      `${gname} trực ${day.label}. ` +
      (last ? `Tuần trước ${day.label} là Tổ ${last} trực nên đổi tổ để không trùng. ` : 'Tuần trước ngày này chưa có lịch trực. ') +
      'Các tổ được xoay vòng đều nhau.';
    chosen.forEach((m) => b.add(day.date, m, 'rotation', why + (lastIds.has(m.id) ? ' Bạn đã trực tuần trước nên xếp sau các bạn khác.' : '')));
    if (!wholeGroup && chosen.length < perDay) warnings.push(`${day.label}: ${gname} chỉ có ${chosen.length} bạn (cần ${perDay}).`);
  });
  return b.finish(warnings);
}

export function planDuty({ mode, members, days, perDay = 4, lastWeekDuty = [], wholeGroup = false }) {
  const list = (members || []).map((m) => ({ ...m, name: m.name || '' }));
  if (!days.length) return { rows: [], warnings: ['Hãy chọn ít nhất một ngày trực.'] };
  if (mode === 'group_low') return planGroupLow(list, days, perDay);
  if (mode === 'violators') return planViolators(list, days, perDay);
  if (mode === 'rotation') return planRotation(list, days, perDay, lastWeekDuty, wholeGroup);
  return { rows: [], warnings: [] };
}

// Những bạn trực từ 2 lần trong tuần mà còn thiếu lý do (bắt buộc phải điền)
export function missingReasons(rows) {
  const by = new Map();
  rows.forEach((r) => {
    if (!by.has(r.student_id)) by.set(r.student_id, []);
    by.get(r.student_id).push(r);
  });
  const out = [];
  by.forEach((list, id) => {
    if (list.length >= 2 && list.some((r) => !String(r.reason || '').trim())) out.push({ student_id: id, name: list[0].name, count: list.length });
  });
  return out;
}
