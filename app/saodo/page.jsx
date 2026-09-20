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

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// Tra ve mang { iso, label, isToday } cho Thu 2 -> Thu 6 cua tuan hien tai
function getWeekdays() {
  const now = new Date();
  const day = now.getDay(); // 0 = CN
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday);

  const todayIso = toISODate(now);
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = toISODate(d);
    days.push({ iso, label: DAY_LABELS[d.getDay()], shortLabel: `${d.getDate()}/${d.getMonth() + 1}`, isToday: iso === todayIso });
  }
  return days;
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
  const [selectedDay, setSelectedDay] = useState(() => getWeekdays().find((d) => d.isToday)?.iso || getWeekdays()[0].iso);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [weekRows, setWeekRows] = useState([]);
  const [weekDayFilter, setWeekDayFilter] = useState('all'); // 'all' hoac 1 ngay iso
  const [confirmReason, setConfirmReason] = useState(null); // { code, label, points, category }

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

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClass) loadWeek(selectedClass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const neNepReasons = useMemo(() => reasons.filter((r) => r.category === 'ne_nep'), [reasons]);
  const hocTapReasons = useMemo(() => reasons.filter((r) => r.category === 'hoc_tap'), [reasons]);
  const filteredWeekRows = useMemo(
    () => (weekDayFilter === 'all' ? weekRows : weekRows.filter((r) => r.occurred_date === weekDayFilter)),
    [weekRows, weekDayFilter]
  );

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
      p_occurred_date: selectedDay,
      p_student_name: studentName.trim() || null,
    });
    setSubmitting(false);
    setConfirmReason(null);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'ok', text: `Đã ghi nhận: ${reason.label} (${reason.points} điểm).` });
      setNote('');
      setStudentName('');
      loadWeek(selectedClass);
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

        .msg { margin-top: 10px; font-size: 13.5px; font-weight: 600; }
        .msg.ok { color: #219a69; }
        .msg.error { color: #c0392b; }

        .today-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: #e63946; margin-left: 5px; vertical-align: middle;
        }

        .day-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
        .day-tab {
          padding: 6px 14px; border-radius: 999px; border: 1px solid #dce3e0; background: #fff;
          font-weight: 600; font-size: 12.5px; cursor: pointer;
        }
        .day-tab.active { background: #1b6fb8; border-color: #1b6fb8; color: #fff; }

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

      <div className="card">
        <h3>1. Chọn lớp</h3>
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

      <div className="card">
        <h3>2. Chọn ngày vi phạm</h3>
        <div className="class-chips">
          {weekdays.map((d) => (
            <button
              key={d.iso}
              className={`class-chip ${selectedDay === d.iso ? 'active' : ''}`}
              onClick={() => setSelectedDay(d.iso)}
            >
              {d.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>({d.shortLabel})</span>
              {d.isToday && <span className="today-dot" title="Hôm nay" />}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>3. Tên học sinh vi phạm (nếu là lỗi cá nhân)</h3>
        <input
          className="note-input"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="VD: Nguyễn Văn A — để trống nếu lỗi áp dụng cho cả lớp"
        />
      </div>

      <div className="card">
        <h3>4. Nề nếp — chọn lỗi vi phạm</h3>
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
        <h3>5. Học tập — xếp loại giờ học (theo sổ đầu bài)</h3>
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
        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      </div>

      {selectedClass && (
        <div className="card">
          <h3>Bảng trừ điểm tuần này — {classes.find((c) => c.id === selectedClass)?.name}</h3>
          <div className="day-tabs">
            <button
              className={`day-tab ${weekDayFilter === 'all' ? 'active' : ''}`}
              onClick={() => setWeekDayFilter('all')}
            >
              Cả tuần
            </button>
            {weekdays.map((d) => (
              <button
                key={d.iso}
                className={`day-tab ${weekDayFilter === d.iso ? 'active' : ''}`}
                onClick={() => setWeekDayFilter(d.iso)}
              >
                {d.label}
              </button>
            ))}
          </div>

          {filteredWeekRows.length === 0 ? (
            <div className="no-class" style={{ color: '#8aa39c', marginTop: 10 }}>
              Chưa có dữ liệu trừ điểm nào {weekDayFilter === 'all' ? 'trong tuần này' : ''}.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table className="week-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Loại</th>
                  <th>Nội dung</th>
                  <th>Học sinh</th>
                  <th>Điểm</th>
                  <th>Người báo cáo</th>
                </tr>
              </thead>
              <tbody>
                {filteredWeekRows.map((r) => {
                  const d = weekdays.find((w) => w.iso === r.occurred_date);
                  return (
                    <tr key={r.id}>
                      <td>{d ? `${d.label} (${d.shortLabel})` : r.occurred_date}</td>
                      <td>{r.category === 'ne_nep' ? 'Nề nếp' : 'Học tập'}</td>
                      <td>
                        {r.reason_label}
                        {r.note && <div className="week-note">{r.note}</div>}
                      </td>
                      <td>{r.student_name || '—'}</td>
                      <td className={r.points < 0 ? 'week-pts-neg' : 'week-pts-zero'}>{r.points}</td>
                      <td>{r.reported_by_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {confirmReason && (
        <div className="confirm-backdrop" onClick={() => setConfirmReason(null)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-title">Xác nhận báo cáo</div>
            <div>
              Lớp <strong>{classes.find((c) => c.id === selectedClass)?.name}</strong>
            </div>
            <div>{confirmReason.label}</div>
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
    </div>
  );
}
