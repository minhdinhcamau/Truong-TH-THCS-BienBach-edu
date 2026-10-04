// Tự phân công lớp vào khu vực trực nhật theo xếp hạng Sao đỏ.
//
// Quy tắc (theo yêu cầu của Tổng phụ trách):
//   1) Lớp điểm THẤP được phân trước (xếp hạng từ thấp lên cao); đủ khu vực thì dừng.
//   2) Một lớp KHÔNG trực lại khu vực của tuần trước; ưu tiên khu vực lâu rồi chưa trực hoặc chưa trực bao giờ.
//   3) Mỗi khu vực nhận tối đa `perZone` lớp (mặc định 1).
//
// ranking: [{ class_id, class_name, total_score, violation_count }]  (đã lấy từ get_class_leaderboard)
// zones:   [{ id, name }]
// history: [{ week_no, zone_id, class_id }]  các tuần TRƯỚC tuần đang phân
// Trả về { assign: { [zoneId]: [classId] }, order: [classId...], repeats: [classId...], skipped: [classId...] }

export function sortLowToHigh(ranking) {
  return [...ranking].sort((a, b) => {
    const d = Number(a.total_score) - Number(b.total_score);
    if (d !== 0) return d;
    const v = Number(b.violation_count || 0) - Number(a.violation_count || 0); // bị trừ nhiều lần hơn thì xếp trước
    if (v !== 0) return v;
    return String(a.class_name).localeCompare(String(b.class_name), 'vi', { numeric: true });
  });
}

export function autoAssign({ ranking, zones, history, weekNo, perZone = 1 }) {
  const per = Math.max(1, Math.floor(perZone) || 1);
  const slots = zones.length * per;
  const order = sortLowToHigh(ranking);
  const picked = order.slice(0, slots);
  const skipped = order.slice(slots).map((c) => c.class_id);

  // lastWeek[class][zone] = tuần gần nhất lớp đó trực khu vực đó (0 nếu chưa từng)
  const last = new Map();
  const total = new Map();
  (history || []).forEach((h) => {
    if (h.week_no >= weekNo) return;
    if (!last.has(h.class_id)) last.set(h.class_id, new Map());
    const m = last.get(h.class_id);
    m.set(h.zone_id, Math.max(m.get(h.zone_id) || 0, h.week_no));
    total.set(h.zone_id, (total.get(h.zone_id) || 0) + 1);
  });
  const prevWeek = weekNo - 1;
  const was = (cid, zid) => (last.get(cid)?.get(zid) || 0);
  const isRepeat = (cid, zid) => was(cid, zid) === prevWeek && prevWeek >= 1;
  // chi phí: lặp lại tuần trước rất nặng; càng gần đây càng nặng
  const cost = (cid, zid) => {
    const w = was(cid, zid);
    if (!w) return 0;
    if (w === prevWeek) return 1000;
    return Math.max(1, 40 - (weekNo - w)); // trực gần đây hơn thì phạt nặng hơn
  };

  const left = new Map(zones.map((z) => [z.id, per]));
  const assign = {};
  zones.forEach((z) => { assign[z.id] = []; });

  picked.forEach((c) => {
    let best = null;
    let bestKey = null;
    zones.forEach((z) => {
      if (left.get(z.id) <= 0) return;
      const key = [cost(c.class_id, z.id), assign[z.id].length, total.get(z.id) || 0];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
        best = z; bestKey = key;
      }
    });
    if (best) {
      assign[best.id].push(c.class_id);
      left.set(best.id, left.get(best.id) - 1);
    }
  });

  // Sửa các lớp bị trùng khu vực tuần trước bằng cách đổi chỗ với lớp khác (khi cả hai đều không trùng sau khi đổi)
  const zoneOf = () => {
    const m = new Map();
    Object.entries(assign).forEach(([zid, arr]) => arr.forEach((cid) => m.set(cid, zid)));
    return m;
  };
  for (let pass = 0; pass < 4; pass += 1) {
    const zo = zoneOf();
    let changed = false;
    for (const [cid, zid] of zo.entries()) {
      if (!isRepeat(cid, zid)) continue;
      for (const [cid2, zid2] of zo.entries()) {
        if (cid2 === cid || zid2 === zid) continue;
        if (isRepeat(cid, zid2) || isRepeat(cid2, zid)) continue;
        assign[zid] = assign[zid].filter((x) => x !== cid).concat(cid2);
        assign[zid2] = assign[zid2].filter((x) => x !== cid2).concat(cid);
        changed = true;
        break;
      }
      if (changed) break;
    }
    if (!changed) break;
  }
  const finalZo = zoneOf();
  const repeats = [];
  finalZo.forEach((zid, cid) => { if (isRepeat(cid, zid)) repeats.push(cid); });
  return { assign, order: order.map((c) => c.class_id), picked: picked.map((c) => c.class_id), repeats, skipped };
}
