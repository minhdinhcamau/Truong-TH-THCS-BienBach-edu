'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { ADMIN_NAV } from '@/lib/nav';
import AppShell, { Toast } from '@/components/AppShell';

// Admin: phân công giáo viên chủ nhiệm cho từng lớp.
export default function AdminHomeroomPage() {
  const { profile, ready, logout } = useGuard('admin');
  const [rows, setRows] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const [o, t] = await Promise.all([supabase.rpc('admin_homeroom_overview'), supabase.rpc('list_teachers')]);
    if (o.error) setMsg({ type: 'error', text: o.error.message });
    else setRows(o.data || []);
    setTeachers(t.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  async function assign(row, teacherId) {
    setBusy(row.class_id);
    const { error } = await supabase.rpc('admin_set_homeroom', { p_class_id: row.class_id, p_teacher_id: teacherId || null });
    setBusy('');
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: teacherId ? `Đã phân công chủ nhiệm lớp ${row.class_name}.` : `Đã gỡ chủ nhiệm lớp ${row.class_name}.` });
      load();
    }
  }

  const byGrade = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => { const g = r.grade ?? 0; if (!m.has(g)) m.set(g, []); m.get(g).push(r); });
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [rows]);
  const assigned = rows.filter((r) => r.teacher_id).length;

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Quản trị viên" nav={ADMIN_NAV} activeHref="/admin/gvcn" onLogout={logout}>
      <h1 className="pg-title">Phân công giáo viên chủ nhiệm</h1>
      <p className="pg-sub">
        Giáo viên được phân công sẽ thấy mục “Chủ nhiệm lớp” và “Thi đua lớp” trong khu vực giáo viên: giao chức vụ ban cán sự, xem báo cáo tuần và trình chiếu sinh hoạt lớp.
      </p>

      <div className="chips" style={{ marginBottom: 14 }}>
        <span className="chip">Đã phân công: <b>{assigned}</b>/{rows.length} lớp</span>
        <span className="chip">{teachers.length} tài khoản giáo viên</span>
      </div>

      {loading ? <div className="card"><div className="empty">Đang tải…</div></div> : rows.length === 0 ? (
        <div className="card"><div className="empty">Chưa có lớp nào.</div></div>
      ) : byGrade.map(([grade, list]) => (
        <div className="card" key={grade}>
          <div className="card-h"><h3>{grade ? `Khối ${grade}` : 'Lớp chưa có khối'}</h3></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Lớp</th><th>Giáo viên chủ nhiệm</th><th></th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.class_id}>
                    <td><strong>{r.class_name}</strong></td>
                    <td>
                      <select className="input" style={{ maxWidth: 320 }} disabled={busy === r.class_id} value={r.teacher_id || ''} onChange={(e) => assign(r, e.target.value)} aria-label={`Giáo viên chủ nhiệm lớp ${r.class_name}`}>
                        <option value="">— Chưa phân công —</option>
                        {teachers.map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name}{t.email ? ` · ${t.email}` : ''}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.teacher_id ? <span className="pill ok">Đã phân công</span> : <span className="pill warn">Chưa có</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
