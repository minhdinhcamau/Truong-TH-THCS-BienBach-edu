'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).map((w) => w[0]).join('').toUpperCase();
}

const DAY_LABELS = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const TZ = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86400000;

// Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD (không phụ thuộc múi giờ của máy)
function vnTodayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function isoToUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// "Thứ 3 15/9" từ chuỗi YYYY-MM-DD
function fmtIso(iso) {
  const dt = isoToUTC(iso);
  return `${DAY_LABELS[dt.getUTCDay()]} ${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`;
}

// Thứ 2 -> Thứ 6 của tuần hiện tại (CN thì lấy tuần vừa rồi, khớp với server)
function getWeekdays() {
  const todayIso = vnTodayIso();
  const t = isoToUTC(todayIso);
  const dow = t.getUTCDay(); // 0 = CN
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(t.getTime() + (diffToMonday + i) * DAY_MS);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      iso,
      label: DAY_LABELS[d.getUTCDay()],
      shortLabel: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
    });
  }
  return days;
}

// Mặc định = hôm nay; cuối tuần thì lấy ngày học gần nhất (Thứ 6)
function defaultDateIso() {
  const days = getWeekdays();
  const today = days.find((d) => d.isToday);
  if (today) return today.iso;
  const past = days.filter((d) => !d.isFuture);
  return (past.length ? past[past.length - 1] : days[0]).iso;
}

export default function SaoDoPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]); // lop duoc phan cong
  const [reasons, setReasons] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [note, setNote] = useState('');
  const [studentName, setStudentName] = useState('');
  const weekdays = useMemo(() => getWeekdays(), []);
  const [selectedDate, setSelectedDate] = useState(defaultDateIso); // ngay dang bao cao / dang xem
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [weekRows, setWeekRows] = useState([]);
  const [confirmReason, setConfirmReason] = useState(null); // { code, label, points, category }
  const [editingRow, setEditingRow] = useState(null); // dong dang sua
  const [classScore, setClassScore] = useState(null); // { ne_nep_score, hoc_tap_score, total_score, rank }
  const [alerts, setAlerts] = useState([]); // lop bo sot kiem tra

  async function loadAll() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_saodo')
      .eq('id', session.user.id)
      .single();

    if (!prof || (!prof.is_saodo && prof.role !== 'admin')) {
      alert('Tài khoản của bạn chưa được cấp quyền Sao đỏ.');
      router.replace('/student');
      return;
    }
    setProfile(prof);

    const [{ data: asg }, { data: reasonTypes }] = await Promise.all([
      supabase
        .from('saodo_assignments')
        .select('class_id, classes(id, name, grade)')
        .eq('saodo_student_id', prof.id),
      supabase.from('discipline_reason_types').select('*').order('category').order('sort_order'),
    ]);

    const myClasses = (asg || []).map((a) => a.classes).filter(Boolean);
    setClasses(myClasses);
    if (myClasses.length === 1) setSelectedClass(myClasses[0].id);
    setReasons(reasonTypes || []);

    await loadAlerts();
    setLoading(false);
  }

  async function loadWeek(classId) {
    if (!classId) {
      setWeekRows([]);
      return;
    }
    const { data } = await supabase.rpc('get_class_deductions', { p_class_id: classId });
    setWeekRows(data || []);
  }

  async function loadClassScore(classId) {
    if (!classId) {
      setClassScore(null);
      return;
    }
    const { data } = await supabase.rpc('get_class_ranking');
    const row = (data || []).find((r) => r.class_id === classId);
    setClassScore(row || null);
  }

  async function loadAlerts() {
    const { data, error } = await supabase.rpc('get_missing_checkins', { p_days_back: 10 });
    if (!error) setAlerts(data || []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadWeek(selectedClass);
      loadClassScore(selectedClass);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass]);

  // Thong bao tu an sau vai giay
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const neNepReasons = useMemo(() => reasons.filter((r) => r.category === 'ne_nep'), [reasons]);
  const hocTapReasons = useMemo(() => reasons.filter((r) => r.category === 'hoc_tap'), [reasons]);
  const filteredWeekRows = useMemo(
    () => weekRows.filter((r) => r.occurred_date === selectedDate),
    [weekRows, selectedDate]
  );

  const selectedDay = weekdays.find((d) => d.iso === selectedDate) || weekdays[0];
  const selectedDayText = `${selectedDay.label} (${selectedDay.shortLabel})`;
  const isBackfill = !selectedDay.isToday;
  const checkedInSelected = filteredWeekRows.some((r) => r.reason_code === 'da_kiem_tra');
  const selectedClassName = classes.find((c) => c.id === selectedClass)?.name;

  // Ngay nao trong tuan da co bao cao (de danh dau tren tab)
  const datesWithRows = useMemo(() => new Set(weekRows.map((r) => r.occurred_date)), [weekRows]);
  const checkedDaysCount = weekdays.filter((d) => datesWithRows.has(d.iso)).length;

  // Canh bao bo sot: chi hien cac lop minh phu trach, gom theo lop
  const alertGroups = useMemo(() => {
    const map = new Map();
    alerts.forEach((a) => {
      if (!classes.some((c) => c.id === a.class_id)) return;
      if (!map.has(a.class_id)) map.set(a.class_id, { class_id: a.class_id, class_name: a.class_name, dates: [] });
      map.get(a.class_id).dates.push(a.alert_date);
    });
    return Array.from(map.values());
  }, [alerts, classes]);

  function jumpToAlert(classId, dateIso) {
    setSelectedClass(classId);
    if (weekdays.some((d) => d.iso === dateIso)) {
      setSelectedDate(dateIso);
    } else {
      setMsg({ type: 'error', text: `${fmtIso(dateIso)} đã quá tuần hiện tại — liên hệ cô Tổng phụ trách để xử lý.` });
    }
  }

  function canEditRow(r) {
    if (profile?.role === 'admin') return true;
    // Neu he thong khong tra ve nguoi bao cao thi de server quyet dinh
    if (r.reported_by === undefined || r.reported_by === null) return true;
    return r.reported_by === profile?.id;
  }

  async function refreshAfterChange() {
    await Promise.all([loadWeek(selectedClass), loadClassScore(selectedClass), loadAlerts()]);
  }

  async function submitDeduction(reason) {
    if (!selectedClass) {
      setMsg({ type: 'error', text: 'Vui lòng chọn lớp trước.' });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    const { error } = await supabase.rpc('saodo_report_deduction', {
      p_class_id: selectedClass,
      p_reason_code: reason.code,
      p_note: note.trim() || null,
      p_student_name: studentName.trim() || null,
      p_occurred_date: selectedDate,
    });
    setSubmitting(false);
    setConfirmReason(null);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'ok', text: `Đã ghi nhận ${selectedDayText}: ${reason.label} (${reason.points} điểm).` });
      setNote('');
      setStudentName('');
      refreshAfterChange();
    }
  }

  async function submitCheckin() {
    if (!selectedClass) {
      setMsg({ type: 'error', text: 'Vui lòng chọn lớp trước.' });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    const { error } = await supabase.rpc('saodo_checkin', {
      p_class_id: selectedClass,
      p_note: note.trim() || null,
      p_occurred_date: selectedDate,
    });
    setSubmitting(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'ok', text: `Đã xác nhận ${selectedDayText}: kiểm tra xong, không có vi phạm.` });
      setNote('');
      refreshAfterChange();
    }
  }

  async function deleteRow(row) {
    if (!window.confirm(`Xoá báo cáo "${row.reason_label}" (${row.points} điểm)?`)) return;
    const { error } = await supabase.rpc('saodo_delete_deduction', { p_id: row.id });
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'ok', text: 'Đã xoá báo cáo.' });
      refreshAfterChange();
    }
  }

  async function saveEdit() {
    if (!editingRow) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('saodo_edit_deduction', {
      p_id: editingRow.id,
      p_reason_code: editingRow.reason_code,
      p_note: editingRow.note || null,
      p_student_name: editingRow.student_name || null,
    });
    setSubmitting(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setEditingRow(null);
      setMsg({ type: 'ok', text: 'Đã lưu thay đổi.' });
      refreshAfterChange();
    }
  }

  if (loading) {
    return <div className="wrap"><div className="center-loading">Đang tải…</div></div>;
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap {
          --bg: #eff5f3; --card: #ffffff; --ink: #17302d; --ink-soft: #527169;
          --masthead-bg: #e9f2fc; --masthead-border: #cfe2f7; --masthead-ink: #1b3a63; --masthead-soft: #5c7a9c;
          max-width: 900px; margin: 0 auto; padding: 24px 18px 64px;
          background: var(--bg); color: var(--ink); font-family: 'Be Vietnam Pro', sans-serif; line-height: 1.5;
          min-height: 100vh; box-sizing: border-box;
        }
        .center-loading { text-align: center; padding: 80px 0; color: var(--ink-soft); }
        header.masthead {
          background: var(--masthead-bg); border: 1px solid var(--masthead-border); border-radius: 20px;
          padding: 18px 24px; margin-bottom: 20px; display: flex; justify-content: space-between;
          align-items: center; gap: 16px; flex-wrap: wrap;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .emblem {
          width: 44px; height: 44px; border-radius: 12px; background: #fff; border: 1.5px solid #d8930f;
          color: #8a5b0a; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px;
        }
        .brand-name { font-weight: 700; font-size: 16px; color: var(--masthead-ink); font-family: 'Baloo 2', sans-serif; }
        .brand-sub { font-size: 12px; color: var(--masthead-soft); }
        .profile-row { display: flex; align-items: center; gap: 10px; }
        .profile { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid var(--masthead-border);
          border-radius: 999px; padding: 5px 14px 5px 5px; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: #d8930f; color: #fff; display: flex;
          align-items: center; justify-content: center; font-weight: 700; font-size: 12.5px; }
        .profile-name { font-weight: 600; font-size: 13px; }
        .profile-role { font-size: 11px; color: var(--masthead-soft); }
        .logout-btn { border: 1px solid var(--masthead-border); background: #fff; color: var(--masthead-ink);
          padding: 8px 16px; border-radius: 999px; font-weight: 600; font-size: 12.5px; cursor: pointer; }

        .card { background: var(--card); border-radius: 18px; padding: 20px; margin-bottom: 18px;
          box-shadow: 0 8px 24px -12px rgba(0,0,0,0.12); }
        .card h3 { margin: 0 0 12px; font-family: 'Baloo 2', sans-serif; font-size: 16px; }

        .alert-banner {
          background: #fff1f0; border: 2px solid #e63946; border-radius: 18px; padding: 16px 18px; margin-bottom: 18px;
          animation: alertPulse 2.4s ease-in-out infinite;
        }
        @keyframes alertPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(230,57,70,0.35); }
          50% { box-shadow: 0 0 0 8px rgba(230,57,70,0); }
        }
        .alert-title { font-weight: 800; font-size: 15px; color: #a02a1f; font-family: 'Baloo 2', sans-serif; }
        .alert-sub { font-size: 12.5px; color: #7a3a33; margin: 2px 0 10px; }
        .alert-class { margin-top: 8px; font-size: 13.5px; font-weight: 700; color: #7a1f16; }
        .alert-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .alert-chip {
          border: 1.5px solid #e63946; background: #fff; color: #a02a1f; border-radius: 999px;
          padding: 5px 12px; font-weight: 700; font-size: 12.5px; cursor: pointer;
        }
        .alert-chip:hover { background: #ffe0da; }

        .date-note { margin-top: 10px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
        .date-note.backfill {
          color: #8a5b0a; background: #fff6e0; border: 1px solid #f0d28a; border-radius: 10px; padding: 8px 12px;
        }

        .class-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .class-chip {
          padding: 10px 20px; border-radius: 12px; border: 2px solid #dce8e4; background: #fff;
          font-weight: 700; font-size: 14.5px; cursor: pointer; transition: all 0.15s ease;
        }
        .class-chip.active { border-color: #1b6fb8; background: #eaf4fc; color: #0f4c82; }
        .no-class { color: #c0392b; font-size: 13.5px; }

        .reason-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .reason-btn {
          text-align: left; padding: 12px 14px; border-radius: 12px; border: 1.5px solid #eee0d4;
          background: #fffaf4; cursor: pointer; transition: transform 0.1s ease, box-shadow 0.1s ease;
          display: flex; justify-content: space-between; align-items: center; gap: 8px;
        }
        .reason-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 14px -6px rgba(0,0,0,0.18); }
        .reason-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .reason-label { font-weight: 600; font-size: 13.5px; }
        .reason-points { font-weight: 800; font-size: 13px; color: #c0392b; white-space: nowrap; }
        .reason-points.zero { color: #219a69; }

        .hoc-tap-grid { display: flex; gap: 10px; flex-wrap: wrap; }
        .hoc-tap-btn {
          flex: 1; min-width: 140px; padding: 18px 14px; border-radius: 14px; border: 2px solid #dce3f0;
          background: #f5f8ff; cursor: pointer; text-align: center; font-weight: 800; font-size: 17px;
          transition: transform 0.1s ease;
        }
        .hoc-tap-btn:hover { transform: translateY(-1px); }
        .hoc-tap-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .hoc-tap-sub { display: block; font-size: 12px; font-weight: 600; margin-top: 4px; color: #6b7a99; }

        .note-input {
          width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #ddd; margin-top: 10px;
          font-size: 13.5px; box-sizing: border-box; font-family: inherit;
        }

        .toast {
          position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 400;
          max-width: calc(100% - 32px); padding: 12px 20px; border-radius: 999px; text-align: center;
          font-weight: 700; font-size: 13.5px; color: #fff; box-shadow: 0 12px 28px -8px rgba(0,0,0,0.35);
        }
        .toast.ok { background: #219a69; }
        .toast.error { background: #c0392b; }

        .score-card { background: linear-gradient(135deg,#0f4c82,#1b6fb8); color: #fff; }
        .score-card h3 { color: #fff; }
        .score-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
        .score-box { background: rgba(255,255,255,0.14); border-radius: 12px; padding: 12px; text-align: center; }
        .score-box-total { background: rgba(255,255,255,0.24); }
        .score-box-rank { background: linear-gradient(135deg,#e8af2e,#b9820e); }
        .score-label { font-size: 11.5px; opacity: 0.85; }
        .score-num { font-size: 22px; font-weight: 800; font-family: 'Baloo 2', sans-serif; }

        .checkin-btn {
          width: 100%; padding: 14px; border-radius: 14px; border: 2px solid #219a69; background: #eafff5;
          color: #14754f; font-weight: 800; font-size: 15px; cursor: pointer;
        }
        .checkin-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .checkin-btn:hover:not(:disabled) { background: #d8ffef; }

        .stat-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .stat-chip { background: #f0f6f4; border-radius: 10px; padding: 8px 14px; font-size: 12.5px; color: var(--ink-soft); }
        .stat-chip strong { color: var(--ink); font-size: 14px; }

        .row-actions { display: flex; gap: 4px; white-space: nowrap; }
        .row-action-btn {
          border: none; background: #f1f1f1; border-radius: 6px; padding: 4px 7px; cursor: pointer; font-size: 12px;
        }
        .row-action-del:hover { background: #ffe0da; }
        .row-action-btn:hover { background: #e2e8f0; }

        .today-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: #e63946; margin-left: 5px; vertical-align: middle;
        }

        .day-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .day-tab {
          padding: 8px 14px; border-radius: 12px; border: 1.5px solid #dce3e0; background: #fff;
          font-weight: 700; font-size: 12.5px; cursor: pointer; text-align: center; line-height: 1.3;
        }
        .day-tab small { display: block; font-weight: 600; font-size: 11px; opacity: 0.8; }
        .day-tab.active { background: #1b6fb8; border-color: #1b6fb8; color: #fff; }
        .day-tab.missing:not(.active) { border-color: #e63946; color: #a02a1f; background: #fff5f4; }
        .day-tab.done:not(.active) { border-color: #219a69; color: #14754f; }
        .day-tab:disabled { opacity: 0.4; cursor: not-allowed; }

        .week-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .week-table th {
          text-align: left; padding: 7px 8px; border-bottom: 2px solid #e4e9e7; color: var(--ink-soft);
          font-weight: 700; white-space: nowrap;
        }
        .week-table td { padding: 8px; border-bottom: 1px solid #eef2f0; vertical-align: top; }
        .week-note { color: var(--ink-soft); font-size: 11px; margin-top: 2px; }
        .week-pts-neg { font-weight: 800; color: #c0392b; white-space: nowrap; }
        .week-pts-zero { font-weight: 800; color: #219a69; white-space: nowrap; }

        .confirm-backdrop { position: fixed; inset: 0; background: rgba(11,32,52,0.5); z-index: 300;
          display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; }
        .confirm-card { background: #fff; border-radius: 20px; padding: 26px 24px; max-width: 380px; width: 100%;
          text-align: center; box-shadow: 0 30px 60px -14px rgba(0,0,0,0.45); }
        .confirm-title { font-weight: 800; font-size: 17px; font-family: 'Baloo 2', sans-serif; margin-bottom: 6px; }
        .confirm-pts { font-size: 26px; font-weight: 800; color: #c0392b; margin: 10px 0; }
        .confirm-date { font-size: 13px; font-weight: 700; color: #527169; margin-top: 2px; }
        .confirm-date.backfill { color: #8a5b0a; }
        .confirm-actions { display: flex; gap: 10px; margin-top: 16px; }
        .confirm-actions button {
          flex: 1; padding: 11px; border-radius: 999px; border: none; font-weight: 700; font-size: 14px; cursor: pointer;
        }
        .confirm-yes { background: linear-gradient(135deg,#a02a1f,#c0392b); color: #fff; }
        .confirm-no { background: #f1f1f1; color: #444; }
      `}</style>

      <header className="masthead">
        <div className="brand">
          <div className="emblem">⭐</div>
          <div>
            <div className="brand-name">Sao đỏ</div>
            <div className="brand-sub">Trường TH - THCS Biển Bạch</div>
          </div>
        </div>
        <div className="profile-row">
          <div className="profile">
            <div className="avatar">{initialsOf(profile?.full_name)}</div>
            <div>
              <div className="profile-name">{profile?.full_name}</div>
              <div className="profile-role">Đội Sao đỏ</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </header>

      {alertGroups.length > 0 && (
        <div className="alert-banner" role="alert">
          <div className="alert-title">⚠️ Có ngày chưa báo cáo kiểm tra</div>
          <div className="alert-sub">
            Bấm vào ngày để mở đúng lớp và ngày đó, rồi báo cáo hoặc bấm “Đã kiểm tra”. Cô Tổng phụ trách cũng nhận được cảnh báo này.
          </div>
          {alertGroups.map((g) => (
            <div key={g.class_id}>
              <div className="alert-class">Lớp {g.class_name}</div>
              <div className="alert-chips">
                {g.dates.map((dt) => (
                  <button key={dt} className="alert-chip" onClick={() => jumpToAlert(g.class_id, dt)}>
                    {fmtIso(dt)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>1. Chọn ngày báo cáo</h3>
        <div className="day-tabs">
          {weekdays.map((d) => {
            const hasRows = datesWithRows.has(d.iso);
            const missing = !!selectedClass && !hasRows && !d.isFuture && !d.isToday;
            const done = !!selectedClass && hasRows;
            return (
              <button
                key={d.iso}
                disabled={d.isFuture}
                className={`day-tab ${selectedDate === d.iso ? 'active' : ''} ${missing ? 'missing' : ''} ${done ? 'done' : ''}`}
                onClick={() => setSelectedDate(d.iso)}
              >
                {d.label}
                {d.isToday && <span className="today-dot" />}
                <small>{d.shortLabel}{done ? ' ✓' : ''}{missing ? ' ⚠' : ''}</small>
              </button>
            );
          })}
        </div>
        {isBackfill ? (
          <div className="date-note backfill">
            Đang báo cáo BỔ SUNG cho {selectedDayText} — không phải hôm nay.
          </div>
        ) : (
          <div className="date-note">Hôm nay: {selectedDayText}. Mọi báo cáo sẽ ghi vào ngày này.</div>
        )}
      </div>

      <div className="card">
        <h3>2. Chọn lớp</h3>
        {classes.length === 0 ? (
          <div className="no-class">Bạn chưa được phân công phụ trách lớp nào. Liên hệ cô Tổng phụ trách Đội.</div>
        ) : (
          <div className="class-chips">
            {classes.map((c) => (
              <button
                key={c.id}
                className={`class-chip ${selectedClass === c.id ? 'active' : ''}`}
                onClick={() => setSelectedClass(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedClass && classScore && (
        <div className="card score-card">
          <h3>Điểm hiện tại — {selectedClassName}</h3>
          <div className="score-grid">
            <div className="score-box">
              <div className="score-label">Nề nếp</div>
              <div className="score-num">{classScore.ne_nep_score}</div>
            </div>
            <div className="score-box">
              <div className="score-label">Học tập</div>
              <div className="score-num">{classScore.hoc_tap_score}</div>
            </div>
            <div className="score-box score-box-total">
              <div className="score-label">Tổng điểm</div>
              <div className="score-num">{classScore.total_score}</div>
            </div>
            <div className="score-box score-box-rank">
              <div className="score-label">Đang xếp hạng</div>
              <div className="score-num">#{classScore.rank}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>3. {selectedDayText} — không có vi phạm?</h3>
        <p style={{ fontSize: 13, color: '#527169', margin: '0 0 10px' }}>
          Nếu đã kiểm tra sổ đầu bài và nề nếp lớp mà không có lỗi nào, bấm xác nhận để hệ thống ghi nhận là bạn ĐÃ kiểm tra ngày này (tránh bị nhắc nhở bỏ sót).
        </p>
        <button
          className="checkin-btn"
          disabled={!selectedClass || submitting || checkedInSelected}
          onClick={submitCheckin}
        >
          {checkedInSelected ? '✅ Ngày này đã xác nhận kiểm tra' : '✅ Đã kiểm tra - Không có vi phạm'}
        </button>
      </div>

      <div className="card">
        <h3>4. Tên học sinh vi phạm (nếu là lỗi cá nhân)</h3>
        <input
          className="note-input"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="VD: Nguyễn Văn A — để trống nếu lỗi áp dụng cho cả lớp"
        />
      </div>

      <div className="card">
        <h3>5. Nề nếp — chọn lỗi vi phạm</h3>
        <div className="reason-grid">
          {neNepReasons.map((r) => (
            <button
              key={r.code}
              className="reason-btn"
              disabled={!selectedClass || submitting}
              onClick={() => setConfirmReason(r)}
            >
              <span className="reason-label">{r.label}</span>
              <span className="reason-points">{r.points} đ</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>6. Học tập — xếp loại giờ học (theo sổ đầu bài)</h3>
        <div className="hoc-tap-grid">
          {hocTapReasons.map((r) => (
            <button
              key={r.code}
              className="hoc-tap-btn"
              disabled={!selectedClass || submitting}
              onClick={() => setConfirmReason(r)}
            >
              {r.label.replace('Giờ ', '').replace(' (tốt)', '')}
              <span className="hoc-tap-sub">{r.points === 0 ? 'Không trừ' : `${r.points} điểm`}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Ghi chú thêm (không bắt buộc)</h3>
        <input
          className="note-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="VD: tiết mấy, hoàn cảnh cụ thể..."
        />
      </div>

      {selectedClass && (
        <div className="card">
          <h3>Bảng thống kê tuần này — {selectedClassName}</h3>

          <div className="stat-row">
            <div className="stat-chip">
              Tổng lượt vi phạm Nề nếp: <strong>{weekRows.filter((r) => r.category === 'ne_nep').length}</strong>
            </div>
            <div className="stat-chip">
              Tổng lượt Giờ B/C: <strong>{weekRows.filter((r) => r.category === 'hoc_tap' && r.points < 0).length}</strong>
            </div>
            <div className="stat-chip">
              Ngày đã kiểm tra: <strong>{checkedDaysCount}</strong>/5
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>
            Báo cáo {selectedDayText}
          </div>

          {filteredWeekRows.length === 0 ? (
            <div className="no-class" style={{ color: '#8aa39c', marginTop: 10 }}>
              Chưa có dữ liệu ngày này — bấm mục 3 để xác nhận đã kiểm tra, hoặc chọn lỗi bên trên nếu có vi phạm.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="week-table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Nội dung</th>
                    <th>Học sinh</th>
                    <th>Điểm</th>
                    <th>Người báo cáo</th>
                    <th>Giờ báo cáo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWeekRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.category === 'ne_nep' ? 'Nề nếp' : r.category === 'hoc_tap' ? 'Học tập' : 'Kiểm tra'}</td>
                      <td>
                        {r.reason_label}
                        {r.note && <div className="week-note">{r.note}</div>}
                      </td>
                      <td>{r.student_name || '—'}</td>
                      <td className={r.points < 0 ? 'week-pts-neg' : 'week-pts-zero'}>{r.points}</td>
                      <td>{r.reported_by_name || '—'}</td>
                      <td>{new Date(r.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}</td>
                      <td className="row-actions">
                        {canEditRow(r) && (
                          <>
                            <button
                              className="row-action-btn"
                              title="Sửa"
                              onClick={() => setEditingRow({ id: r.id, reason_code: r.reason_code, note: r.note || '', student_name: r.student_name || '' })}
                            >
                              ✎
                            </button>
                            <button className="row-action-btn row-action-del" title="Xoá" onClick={() => deleteRow(r)}>
                              🗑
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editingRow && (
        <div className="confirm-backdrop" onClick={() => setEditingRow(null)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'left' }}>
            <div className="confirm-title" style={{ textAlign: 'center' }}>Sửa báo cáo</div>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Loại lỗi</label>
            <select
              className="note-input"
              value={editingRow.reason_code}
              onChange={(e) => setEditingRow({ ...editingRow, reason_code: e.target.value })}
            >
              {reasons.map((r) => (
                <option key={r.code} value={r.code}>{r.label} ({r.points} đ)</option>
              ))}
            </select>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Tên học sinh</label>
            <input
              className="note-input"
              value={editingRow.student_name}
              onChange={(e) => setEditingRow({ ...editingRow, student_name: e.target.value })}
            />
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Ghi chú</label>
            <input
              className="note-input"
              value={editingRow.note}
              onChange={(e) => setEditingRow({ ...editingRow, note: e.target.value })}
            />
            <div className="confirm-actions">
              <button className="confirm-no" onClick={() => setEditingRow(null)}>Huỷ</button>
              <button className="confirm-yes" style={{ background: '#1b6fb8' }} disabled={submitting} onClick={saveEdit}>
                {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmReason && (
        <div className="confirm-backdrop" onClick={() => setConfirmReason(null)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-title">Xác nhận báo cáo</div>
            <div>
              Lớp <strong>{selectedClassName}</strong>
            </div>
            <div className={`confirm-date ${isBackfill ? 'backfill' : ''}`}>
              {isBackfill ? `Bổ sung cho ${selectedDayText}` : `Hôm nay — ${selectedDayText}`}
            </div>
            <div style={{ marginTop: 8 }}>{confirmReason.label}</div>
            <div className="confirm-pts">{confirmReason.points} điểm</div>
            <div className="confirm-actions">
              <button className="confirm-no" onClick={() => setConfirmReason(null)}>Huỷ</button>
              <button className="confirm-yes" disabled={submitting} onClick={() => submitDeduction(confirmReason)}>
                {submitting ? 'Đang gửi...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && <div className={`toast ${msg.type}`} role="status">{msg.text}</div>}
    </div>
  );
}
