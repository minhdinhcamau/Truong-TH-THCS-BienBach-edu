// "Trợ lý xếp lịch trực nhật" của lớp. Chạy ngay trong trình duyệt, đọc dữ liệu vi phạm/điểm của lớp
// (hàm class_planner_data) rồi ĐỀ XUẤT lịch kèm LÝ DO cho từng bạn. Lớp phó lao động xem, chỉnh, rồi mới lưu.
//
// members: [{ id, name, group_no, week_net, week_violations, prior_violations, types,
//             dd_week, dd_prior, dd_types, is_cadre, role_label }]
//   - dd_*   : số lần bị Sao đỏ trừ điểm (discipline_deductions) tuần này / 4 tuần trước, và loại lỗi
//   - is_cadre / role_label: ban cán sự (bất kỳ chức vụ nào trong lớp, kể cả tổ phó, hoặc Sao đỏ)
//   Các trường mới có thể vắng (chưa chạy file SQL): khi đó trợ lý hoạt động như trước.
// days:    [{ date: 'YYYY-MM-DD', weekday: 2..7, label: 'Thứ 2' }]
// Kết quả: { rows: [{ date, label, student_id, name, group_no, source, reason }], warnings: [] }

export const MODES = [
  { key: 'manual', label: 'Tự chọn: chọn tổ rồi chọn thành viên, chọn thứ' },
  { key: 'group_low', label: 'Tự động: tổ có điểm thấp nhất trực, thiếu người thì thêm bạn vi phạm nhiều' },
  {
    key: 'violators',
    label:
      'Tự động: ưu tiên người vi phạm (bạn bị Sao đỏ trừ điểm xếp trước, ban cán sự vi phạm trực 2 ngày; “Số bạn / ngày” là mức tối đa)',
  },
  { key: 'rotation', label: 'Tự động: xoay vòng các tổ, không trùng với tuần trước' },
];

const num = (v) => Number(v) || 0;
const fmt = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

// Mức "đáng chú ý" của 1 bạn. Lỗi bị Sao đỏ trừ điểm là lỗi nặng nên tính nặng nhất;
// vi phạm tuần này nặng hơn vi phạm các tuần trước.
function severity(m) {
  return num(m.dd_week) * 10 + num(m.dd_prior) * 5 + num(m.week_violations) * 3 + num(m.prior_violations);
}
function bySeverity(a, b) {
  return severity(b) - severity(a) || num(a.week_net) - num(b.week_net) || String(a.name).localeCompare(String(b.name), 'vi');
}
function describe(m) {
  const parts = [];
  if (num(m.dd_week)) parts.push(`${m.dd_week} lần bị Sao đỏ trừ điểm tuần này`);
  if (num(m.week_violations)) parts.push(`${m.week_violations} vi phạm tuần này`);
  if (num(m.dd_prior)) parts.push(`${m.dd_prior} lần bị Sao đỏ trừ điểm trong 4 tuần trước`);
  if (num(m.prior_violations)) parts.push(`${m.prior_violations} vi phạm trong 4 tuần trước`);
  const base = parts.length ? parts.join(', ') : 'chưa có vi phạm ghi nhận';
  const types = [m.dd_types, m.types].filter(Boolean).join('; ');
  return types ? `${base} (${types})` : base;
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

// ---- Chế độ "ưu tiên người vi phạm" -------------------------------------------------------
// 1) Bạn vi phạm tuần này (bị Sao đỏ trừ điểm, hoặc có ghi nhận vi phạm) xếp trước, nặng nhất lên đầu.
// 2) Ban cán sự (có chức vụ trong lớp, kể cả tổ phó, hoặc là Sao đỏ) mà vi phạm thì trực 2 ngày
//    (các bạn khác 1 ngày), 2 ngày được cách nhau, không xếp liền kề nếu còn chỗ.
// 3) Số bạn mỗi ngày tự co giãn từ 2 đến "số bạn / ngày" tối đa theo số người vi phạm cần xếp
//    (nhiều người vi phạm thì 3-4 bạn / ngày). Ngày nào còn thiếu thì bổ sung bạn vi phạm các tuần trước,
//    rồi bạn có điểm tuần thấp. Mỗi bạn đều có lý do.
const isHot = (m) => num(m.dd_week) > 0 || num(m.week_violations) > 0;
const isCadre = (m) => !!m.is_cadre;

function planViolators(members, days, perDay) {
  const warnings = [];
  const b = makeBuilder(days);
  if (!members.length) return b.finish(['Lớp chưa có học sinh nào.']);

  const t1 = members.filter(isHot).sort(bySeverity);
  const t2 = members.filter((m) => !isHot(m) && (num(m.dd_prior) > 0 || num(m.prior_violations) > 0)).sort(bySeverity);
  const t3 = members
    .filter((m) => !isHot(m) && !num(m.dd_prior) && !num(m.prior_violations))
    .sort((a, c) => num(a.week_net) - num(c.week_net) || String(a.name).localeCompare(String(c.name), 'vi'));

  const maxPer = Math.max(1, Math.floor(Number(perDay)) || 4);
  const wantDays = (m) => (isCadre(m) && isHot(m) ? Math.min(2, days.length) : 1);
  const demand = t1.reduce((s, m) => s + wantDays(m), 0);
  const target = Math.min(maxPer, Math.max(Math.min(2, maxPer), Math.ceil(demand / days.length)));

  // chọn các ngày còn chỗ, ngày ít người nhất trước; ngày thứ 2 của ban cán sự cách ngày thứ nhất >= 2 thứ
  const pickDays = (m, n) => {
    const chosen = [];
    for (let k = 0; k < n; k += 1) {
      let cand = days.filter((d) => !chosen.includes(d) && !b.has(d.date, m.id) && b.size(d.date) < target);
      if (!cand.length) break;
      const apart = cand.filter((d) => chosen.every((c) => Math.abs(c.weekday - d.weekday) >= 2));
      if (apart.length) cand = apart;
      cand.sort((x, y) => b.size(x.date) - b.size(y.date) || x.date.localeCompare(y.date));
      chosen.push(cand[0]);
    }
    return chosen;
  };

  const reasonHot = (m, ds) => {
    const sao = num(m.dd_week) > 0;
    let s = sao
      ? `Bị Sao đỏ trừ điểm ${m.dd_week} lần tuần này${m.dd_types ? ` (${m.dd_types})` : ''}: lỗi nặng nên được xếp trực ưu tiên.`
      : `Vi phạm ${m.week_violations} lần tuần này${m.types ? ` (${m.types})` : ''} nên được phân công trực nhật.`;
    if (sao && num(m.week_violations)) s += ` Ngoài ra có ${m.week_violations} vi phạm được ghi nhận.`;
    if (isCadre(m)) {
      const role = m.role_label || 'ban cán sự';
      s += ds.length >= 2
        ? ` Là ${role} (ban cán sự) cần làm gương nên trực gấp đôi: ${ds.map((d) => d.label).join(' và ')}.`
        : days.length < 2
          ? ` Là ${role} (ban cán sự) nên đáng ra trực 2 ngày, nhưng tuần này mới chọn 1 ngày trực.`
          : ` Là ${role} (ban cán sự) nên đáng ra trực 2 ngày, nhưng chỉ xếp được 1 ngày vì các ngày còn lại đã đủ người.`;
    }
    return s;
  };

  let leftHot = 0;
  t1.forEach((m) => {
    const ds = pickDays(m, wantDays(m));
    if (!ds.length) { leftHot += 1; return; }
    if (ds.length < wantDays(m)) warnings.push(`${m.name}: là ban cán sự vi phạm nên cần trực 2 ngày nhưng chỉ xếp được ${ds.length} ngày vì các ngày đã đủ người.`);
    const why = reasonHot(m, ds);
    ds.forEach((d) => b.add(d.date, m, 'ai_violators', why));
  });
  if (leftHot) warnings.push(`Còn ${leftHot} bạn vi phạm chưa xếp được vì mỗi ngày đã đủ ${target} bạn. Hãy tăng “Số bạn / ngày” hoặc chọn thêm ngày trực.`);
  if (!t1.length) warnings.push('Tuần này chưa có bạn nào bị Sao đỏ trừ điểm hoặc có ghi nhận vi phạm, hệ thống chọn theo vi phạm các tuần trước và điểm tuần.');

  // bổ sung cho đủ số bạn mỗi ngày
  [...t2.map((m) => ({ m, tier: 2 })), ...t3.map((m) => ({ m, tier: 3 }))].forEach(({ m, tier }) => {
    const ds = pickDays(m, 1);
    if (!ds.length) return;
    const why = tier === 2
      ? `Tuần này chưa vi phạm nhưng ${describe(m)}; bổ sung để mỗi ngày có đủ ${target} bạn.`
      : `Bổ sung cho đủ ${target} bạn mỗi ngày: chưa có vi phạm ghi nhận, ưu tiên bạn có điểm tuần thấp (${fmt(m.week_net)} điểm).`;
    b.add(ds[0].date, m, 'ai_violators', why);
  });

  const short = days.filter((d) => b.size(d.date) < target);
  if (short.length) warnings.push(`${short.map((d) => d.label).join(', ')}: lớp không còn bạn nào chưa trực nên chưa đủ ${target} bạn.`);
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
