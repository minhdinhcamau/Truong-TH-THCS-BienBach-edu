// Trợ lý gợi ý cách khắc phục cho giáo viên chủ nhiệm: chạy ngay trên trang, không cần khóa AI.
// (Có thêm nút hỏi AI thật để phân tích sâu hơn — xem app/api/ai/class-advice/route.js.)
import { norm } from './tkb';

const RULES = [
  {
    key: 'danh_nhau', test: /danh nhau|xo xat|bao luc/, severity: 3, parent: true,
    actions: [
      'Tách hai bạn ra, gặp riêng từng bạn để nghe nguyên nhân trước khi kết luận.',
      'Tổ chức hòa giải có mặt cả hai bạn; mỗi bạn nêu một cách xử lý khác thay vì đánh nhau.',
      'Báo phụ huynh ngay trong ngày; phối hợp cô Tổng phụ trách hoặc tư vấn học đường nếu tái diễn.',
      'Nhờ tổ trưởng và một bạn thân của em để ý giờ ra chơi trong 2 tuần tới.',
    ],
  },
  {
    key: 'noi_tuc', test: /chui|noi tuc|noi bay|thoi tuc/, severity: 2, parent: false,
    actions: [
      'Nói chuyện riêng: hỏi em nghe lời nói đó ở đâu và cảm thấy thế nào khi bị người khác nói như vậy.',
      'Cùng em chọn 3 câu nói lịch sự để dùng khi tức giận.',
      'Thỏa thuận: mỗi lần tái phạm em viết 3 dòng xin lỗi hoặc làm một việc có ích cho lớp.',
    ],
  },
  {
    key: 'noi_chuyen', test: /noi chuyen|mat trat tu|lam on|on ao/, severity: 1, parent: false,
    actions: [
      'Trao đổi riêng 1–2 phút sau giờ học để hiểu vì sao em hay nói chuyện (chán, chưa theo kịp bài, hay do bạn ngồi cạnh).',
      'Đổi chỗ: xếp em gần bạn gương mẫu, xa nhóm hay nói chuyện (dùng mục Sơ đồ lớp & tổ).',
      'Giao nhiệm vụ nhỏ trong giờ (phát vở, ghi bảng) để em có việc tập trung.',
      'Thỏa thuận “nhắc 1 lần, lần 2 chuyển chỗ” và khen ngay khi em giữ trật tự cả buổi.',
    ],
  },
  {
    key: 'nhac_nho', test: /nhac nho|bi nhac/, severity: 1, parent: false,
    actions: [
      'Hỏi giáo viên bộ môn cụ thể em bị nhắc vì hành vi gì để hỗ trợ đúng chỗ.',
      'Lập phiếu theo dõi 2 tuần: mỗi ngày giáo viên ghi ✓ nếu em không bị nhắc, cuối tuần khen thưởng.',
    ],
  },
  {
    key: 'thieu_do_dung', test: /thieu so|thieu vo|dung cu|do dung|sach vo|khong mang/, severity: 1, parent: false,
    actions: [
      'Cùng em lập danh sách đồ dùng theo thời khóa biểu, dán ở góc bàn học.',
      'Nhờ bạn cùng bàn nhắc soạn sách vở vào tối hôm trước.',
      'Tìm hiểu nguyên nhân (quên hay chưa đủ điều kiện); hỗ trợ sách vở, dụng cụ nếu gia đình khó khăn.',
    ],
  },
  {
    key: 'khan_quang', test: /khan quang|khan do/, severity: 1, parent: false,
    actions: [
      'Nhắc em chuẩn bị khăn quàng cùng đồng phục từ tối hôm trước; để một khăn dự phòng ở lớp.',
      'Nhờ tổ trưởng kiểm tra đầu buổi và nhắc nhẹ nhàng trước giờ chào cờ.',
    ],
  },
  {
    key: 'tac_phong', test: /ao vao quan|bo ao|dong thung|dong phuc|tac phong/, severity: 1, parent: false,
    actions: [
      'Nhắc riêng và nhẹ nhàng (không nhắc trước cả lớp) để em sửa ngay đầu buổi.',
      'Nhờ tổ trưởng kiểm tra tác phong trước giờ chào cờ; trao đổi với phụ huynh nếu tái diễn.',
      'Khen em khi chỉnh tề nhiều ngày liên tiếp.',
    ],
  },
  {
    key: 'khong_hat', test: /khong hat|hat chao co|hat quoc ca/, severity: 1, parent: false,
    actions: [
      'Hỏi riêng xem em có ngại không; tập hát ngắn đầu tuần cùng lớp phó văn nghệ.',
      'Giao em một vai trò nhỏ (cầm cờ, giữ nhịp) để em thấy mình thuộc về tập thể.',
    ],
  },
];

const FALLBACK = {
  key: 'khac', severity: 1, parent: false,
  actions: [
    'Nói chuyện riêng để hiểu nguyên nhân, tránh phê bình trước cả lớp.',
    'Cùng em đặt một mục tiêu nhỏ trong tuần và ghi nhận khi em làm được.',
  ],
};

const ruleOf = (label) => RULES.find((r) => r.test.test(norm(label))) || FALLBACK;

export function adviceForStudent(s) {
  const types = s.types || [];
  const picked = [];
  const seen = new Set();
  [...types].sort((a, b) => b.n - a.n).forEach((t) => {
    const r = ruleOf(t.label);
    if (!seen.has(r.key)) { seen.add(r.key); picked.push(r); }
  });
  const high = s.cnt >= 4 || picked.some((r) => r.severity >= 3);
  const actions = [];
  picked.slice(0, 2).forEach((r) => r.actions.slice(0, picked.length > 1 ? 2 : 3).forEach((a) => actions.push(a)));
  if (high) actions.push('Mời phụ huynh trao đổi trong tuần này để cùng phối hợp; ghi lại thỏa thuận với em.');
  else actions.push('Nhắc riêng, theo dõi 2 tuần và ghi nhận ngay khi em tiến bộ.');
  return { level: high ? 'high' : 'mid', actions };
}

export function buildAdvice(rep) {
  const c = rep.class || {};
  const tips = [];
  const totalViol = rep.totals?.violations || 0;

  if (c.prev_rank && c.rank) {
    if (c.rank > c.prev_rank) tips.push({ icon: '📉', title: `Lớp tụt ${c.rank - c.prev_rank} hạng`, text: 'Họp lớp 10 phút, cùng chọn 1–2 lỗi bị Sao đỏ trừ nhiều nhất để khắc phục trong tuần tới; giao tổ trưởng nhắc trước mỗi buổi.' });
    else if (c.rank < c.prev_rank) tips.push({ icon: '📈', title: `Lớp lên ${c.prev_rank - c.rank} hạng`, text: 'Khen cả lớp trước tập thể, hỏi cả lớp “điều gì đã giúp mình tiến bộ?” để duy trì.' });
  }

  const reasons = [...(rep.sao_do_by_reason || [])].sort((a, b) => b.cnt - a.cnt);
  if (reasons[0]) tips.push({ icon: '🎯', title: `Lỗi Sao đỏ trừ nhiều nhất: ${reasons[0].label} (${reasons[0].cnt} lần)`, text: 'Đặt mục tiêu giảm một nửa số lần trong tuần tới; giao một tổ chịu trách nhiệm nhắc nhở và báo cáo mỗi ngày.' });

  const groups = (rep.groups || []).filter((g) => g.group_no > 0);
  if (groups.length > 1) {
    const low = [...groups].sort((a, b) => a.net - b.net)[0];
    const high = [...groups].sort((a, b) => b.net - a.net)[0];
    if (low.group_no !== high.group_no) tips.push({ icon: '🤝', title: `Tổ ${low.group_no} cần hỗ trợ`, text: `Tổ trưởng họp tổ 5 phút đầu tuần; ghép cặp “bạn giúp bạn” với Tổ ${high.group_no} (tổ điểm cao nhất) và chia sẻ cách làm tốt.` });
  }

  const nRepeat = (rep.repeat_violators || []).length;
  if (nRepeat >= 3) tips.push({ icon: '🧭', title: `${nRepeat} bạn vi phạm từ 2 lần`, text: 'Không xử lý chung một cách: gặp riêng từng bạn, tìm nguyên nhân, đặt mục tiêu nhỏ cho từng người và theo dõi 2 tuần.' });
  else if (nRepeat > 0) tips.push({ icon: '🧭', title: `${nRepeat} bạn vi phạm từ 2 lần`, text: 'Gặp riêng từng bạn (không phê bình trước lớp), tìm nguyên nhân và đặt mục tiêu nhỏ trong tuần tới.' });

  if ((rep.top_students || []).length) tips.push({ icon: '🏅', title: 'Tuyên dương đúng lúc', text: 'Khen các bạn điểm cao trước lớp, có thể tặng thẻ khen hoặc giao vai trò nhỏ; khen cụ thể hành vi tốt để các bạn khác noi theo.' });
  if (totalViol === 0 && !nRepeat) tips.push({ icon: '🌟', title: 'Tuần rất tốt', text: 'Ghi nhận cả lớp, đề nghị các bạn nêu điều đã giữ được để duy trì sang tuần sau.' });

  const students = (rep.repeat_violators || []).map((r) => ({
    student_id: r.student_id, name: r.name, cnt: r.cnt,
    issues: (r.types || []).map((t) => `${t.label} ×${t.n}`).join(', '),
    ...adviceForStudent(r),
  }));

  return { tips, students };
}

// Thay tên học sinh bằng mã (HS1, HS2…) trước khi gửi cho AI bên ngoài; tên thật KHÔNG rời khỏi trình duyệt.
export function anonymizeReport(rep) {
  const codes = new Map();
  const names = {};
  const code = (id, name) => {
    if (!codes.has(id)) { const c = `HS${codes.size + 1}`; codes.set(id, c); names[c] = name; }
    return codes.get(id);
  };
  const c = rep.class || {};
  const payload = {
    tuan_bat_dau: rep.week_start,
    lop: { hang: c.rank, tong_so_lop: c.of, diem: c.total, diem_ne_nep: c.ne_nep, diem_hoc_tap: c.hoc_tap, hang_tuan_truoc: c.prev_rank },
    sao_do_tru_diem: (rep.sao_do_by_reason || []).map((r) => ({ muc: r.label, so_lan: r.cnt })),
    thong_ke: rep.totals,
    to: (rep.groups || []).filter((g) => g.group_no > 0).map((g) => ({ to: g.group_no, diem: g.net, so_vi_pham: g.violations })),
    hoc_sinh_vi_pham_nhieu_lan: (rep.repeat_violators || []).map((r) => ({ ma: code(r.student_id, r.name), so_lan: r.cnt, loai: (r.types || []).map((t) => ({ loai: t.label, so_lan: t.n })) })),
    hoc_sinh_tien_bo: (rep.improvers || []).map((s) => ({ ma: code(s.student_id, s.name), tang_diem: s.delta })),
    hoc_sinh_duoc_khen: (rep.top_students || []).map((s) => ({ ma: code(s.student_id, s.name), diem: s.net })),
  };
  return { payload, restore: (text) => String(text || '').replace(/\bHS(\d+)\b/g, (m) => names[m] || m) };
}
