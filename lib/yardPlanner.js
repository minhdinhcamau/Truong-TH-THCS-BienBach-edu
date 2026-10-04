// Chia các bạn đã được trợ lý chọn trực trong ngày thành 2 nhóm: trong lớp và ngoài sân.
// Chỉ dùng khi Tổng phụ trách Đội đã phân khu vực ngoài sân cho lớp trong tuần.
// - Mỗi ngày có tối đa "yardPerDay" bạn ra sân, luôn chừa lại ít nhất 1 bạn trong lớp (nếu ngày đó có từ 2 bạn).
// - Ưu tiên bạn vi phạm nặng ra sân trước (lỗi bị Sao đỏ trừ điểm nặng nhất), sau đó đến bạn có điểm tuần thấp.
// rows:    kết quả của planDuty ({ date, student_id, name, group_no, source, reason })
// members: dữ liệu từ hàm class_planner_data (để biết mức vi phạm của từng bạn)

const num = (v) => Number(v) || 0;

function severity(m) {
  if (!m) return 0;
  return num(m.dd_week) * 10 + num(m.dd_prior) * 5 + num(m.week_violations) * 3 + num(m.prior_violations);
}

export function assignYard(rows, members, yardPerDay, yardName) {
  const info = new Map((members || []).map((m) => [m.id, m]));
  const n = Math.max(0, Math.floor(Number(yardPerDay)) || 0);
  const out = rows.map((r) => ({ ...r, area: 'trong_lop' }));
  if (!n) return out;

  const byDate = new Map();
  out.forEach((r, i) => {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(i);
  });

  byDate.forEach((idxs) => {
    if (idxs.length < 2) return; // chỉ 1 bạn thì ở lại trong lớp
    const take = Math.min(n, idxs.length - 1);
    const sorted = [...idxs].sort((a, b) => {
      const ma = info.get(out[a].student_id);
      const mb = info.get(out[b].student_id);
      return (
        severity(mb) - severity(ma) ||
        num(ma?.week_net) - num(mb?.week_net) ||
        String(out[a].name).localeCompare(String(out[b].name), 'vi')
      );
    });
    sorted.slice(0, take).forEach((i) => {
      out[i].area = 'ngoai_san';
      const where = yardName ? `khu vực ${yardName}` : 'khu vực ngoài sân';
      out[i].reason = `${out[i].reason ? `${out[i].reason} ` : ''}Được chia ra lao động ${where}.`.trim();
    });
  });
  return out;
}
