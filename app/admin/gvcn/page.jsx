'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import styles from '../admin.module.css';

// Admin: phân công giáo viên chủ nhiệm cho từng lớp (giao diện trang quản trị, không dùng giao diện Đội TNTP).
export default function AdminHomeroomPage() {
  const { ready, logout } = useGuard('admin');
  const [rows, setRows] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ text: '', isError: false });
  const [q, setQ] = useState('');
  const [onlyEmpty, setOnlyEmpty] = useState(false);

  const load = useCallback(async () => {
    const [o, t] = await Promise.all([supabase.rpc('admin_homeroom_overview'), supabase.rpc('list_teachers')]);
    if (o.error) setMsg({ text: o.error.message, isError: true });
    else setRows(o.data || []);
    setTeachers(t.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  async function assign(row, teacherId) {
    setBusy(row.class_id);
    setMsg({ text: '', isError: false });
    const { error } = await supabase.rpc('admin_set_homeroom', { p_class_id: row.class_id, p_teacher_id: teacherId || null });
    setBusy('');
    if (error) setMsg({ text: error.message, isError: true });
    else {
      setMsg({ text: teacherId ? `Đã phân công chủ nhiệm lớp ${row.class_name}.` : `Đã gỡ chủ nhiệm lớp ${row.class_name}.`, isError: false });
      load();
    }
  }

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return rows.filter((r) => (!onlyEmpty || !r.teacher_id) && (!k || `${r.class_name} ${r.teacher_name || ''}`.toLowerCase().includes(k)));
  }, [rows, q, onlyEmpty]);

  const byGrade = useMemo(() => {
    const m = new Map();
    shown.forEach((r) => { const g = r.grade ?? 0; if (!m.has(g)) m.set(g, []); m.get(g).push(r); });
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [shown]);

  const assigned = rows.filter((r) => r.teacher_id).length;

  if (!ready) return <div className={styles.loadingScreen}>Đang tải…</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Phân công giáo viên chủ nhiệm</h1>
        <div className={styles.headerActions}>
          <Link href="/admin" className={styles.navBtn}>← Trang quản trị</Link>
          <Link href="/admin/tpt" className={styles.navBtn}>Cấp quyền TPT</Link>
          <button className={styles.logout} onClick={logout}>Đăng xuất</button>
        </div>
      </header>

      <div className={styles.bottomWrap} style={{ paddingTop: 24 }}>
        <div className={styles.statsBar} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className={styles.statChip}><span className={styles.statChipValue}>{rows.length}</span><span className={styles.statChipLabel}>Tổng số lớp</span></div>
          <div className={styles.statChip}><span className={styles.statChipValue}>{assigned}</span><span className={styles.statChipLabel}>Đã có giáo viên chủ nhiệm</span></div>
          <div className={styles.statChip}><span className={styles.statChipValue}>{rows.length - assigned}</span><span className={styles.statChipLabel}>Chưa phân công</span></div>
        </div>

        <div className={styles.listCard}>
          <div className={styles.listHeader}>
            <div className={styles.listControls}>
              <input className={styles.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm lớp hoặc giáo viên…" aria-label="Tìm lớp hoặc giáo viên" />
              <div className={styles.filterTabs}>
                <button className={!onlyEmpty ? styles.filterActive : styles.filterTab} onClick={() => setOnlyEmpty(false)}>Tất cả</button>
                <button className={onlyEmpty ? styles.filterActive : styles.filterTab} onClick={() => setOnlyEmpty(true)}>Chưa phân công</button>
              </div>
            </div>
            <p className={styles.muted} style={{ padding: 0, margin: 0 }}>
              Giáo viên được phân công sẽ thấy mục “Chủ nhiệm lớp” và “Thi đua lớp” trong khu vực giáo viên. Chỉ quản trị viên được thay đổi phần này.
            </p>
            {msg.text && <p className={msg.isError ? styles.rowError : styles.rowOk} style={{ margin: 0 }}>{msg.text}</p>}
          </div>

          {loading ? <p className={styles.muted}>Đang tải…</p> : byGrade.length === 0 ? <p className={styles.muted}>Không có lớp phù hợp.</p> : byGrade.map(([grade, list]) => (
            <div key={grade} style={{ marginBottom: 22 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 15 }}>{grade ? `Khối ${grade}` : 'Lớp chưa có khối'}</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Lớp</th><th>Giáo viên chủ nhiệm</th><th>Trạng thái</th></tr></thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.class_id}>
                        <td><b>{r.class_name}</b></td>
                        <td>
                          <select
                            className={styles.inlineInput}
                            style={{ width: 'min(100%, 340px)', padding: '8px 10px' }}
                            disabled={busy === r.class_id}
                            value={r.teacher_id || ''}
                            onChange={(e) => assign(r, e.target.value)}
                            aria-label={`Giáo viên chủ nhiệm lớp ${r.class_name}`}
                          >
                            <option value="">— Chưa phân công —</option>
                            {teachers.map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name}{t.email ? ` · ${t.email}` : ''}</option>)}
                          </select>
                        </td>
                        <td>{r.teacher_id ? <span className={styles.rowOk} style={{ margin: 0 }}>✓ Đã phân công</span> : <span className={styles.expiring}>Chưa có</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
