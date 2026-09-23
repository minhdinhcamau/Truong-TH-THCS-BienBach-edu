'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { displayLogin } from '@/lib/account';
import styles from '../admin.module.css';

// Admin: cấp / thu hồi quyền Tổng phụ trách — CHỈ cho tài khoản giáo viên (không cấp cho học sinh).
export default function AdminTptPage() {
  const { ready, logout } = useGuard('admin');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState({ text: '', isError: false });

  async function load(q = search) {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_teacher_accounts', { p_search: q.trim() || null });
    setLoading(false);
    if (error) setMsg({ text: error.message, isError: true });
    else setRows(data || []);
  }

  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => load(search), search ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, search]);

  async function toggle(row) {
    const next = !row.is_tpt;
    if (!window.confirm(next ? `Cấp quyền Tổng phụ trách Đội cho "${row.full_name}"?` : `Thu hồi quyền Tổng phụ trách của "${row.full_name}"?`)) return;
    setBusyId(row.user_id);
    setMsg({ text: '', isError: false });
    const { error } = await supabase.rpc('admin_set_tpt', { p_user_id: row.user_id, p_value: next });
    setBusyId(null);
    if (error) setMsg({ text: error.message, isError: true });
    else {
      setMsg({ text: next ? 'Đã cấp quyền Tổng phụ trách.' : 'Đã thu hồi quyền Tổng phụ trách.', isError: false });
      load();
    }
  }

  const tptList = useMemo(() => rows.filter((r) => r.is_tpt), [rows]);

  if (!ready) return <div className={styles.loadingScreen}>Đang tải…</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Cấp quyền Tổng phụ trách Đội</h1>
        <div className={styles.headerActions}>
          <Link href="/admin" className={styles.navBtn}>← Trang quản trị</Link>
          <Link href="/admin/gvcn" className={styles.navBtn}>Phân công chủ nhiệm</Link>
          <button className={styles.logout} onClick={logout}>Đăng xuất</button>
        </div>
      </header>

      <div className={styles.bottomWrap} style={{ paddingTop: 24 }}>
        <p className={styles.muted} style={{ padding: 0, margin: '0 0 16px' }}>
          Chỉ cấp được cho tài khoản <b>giáo viên</b> — danh sách dưới đây không hiện tài khoản học sinh hay admin khác.
        </p>

        <div className={styles.listCard} style={{ marginBottom: 20 }}>
          <h2>Tổng phụ trách hiện tại</h2>
          {tptList.length === 0 ? (
            <p className={styles.muted} style={{ padding: 0 }}>Chưa có ai được cấp quyền. Tìm giáo viên bên dưới rồi bấm “Cấp quyền TPT”.</p>
          ) : (
            <div className={styles.filterTabs}>
              {tptList.map((t) => <span key={t.user_id} className={styles.filterActive} style={{ cursor: 'default' }}>{t.full_name}{t.email ? ` · ${displayLogin(t.email)}` : ''}</span>)}
            </div>
          )}
        </div>

        <div className={styles.listCard}>
          <div className={styles.listHeader}>
            <h2 style={{ margin: 0 }}>Tìm giáo viên</h2>
            <input className={styles.search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Gõ tên hoặc email của giáo viên…" aria-label="Tìm giáo viên" />
            {msg.text && <p className={msg.isError ? styles.rowError : styles.rowOk} style={{ margin: 0 }}>{msg.text}</p>}
          </div>
          <div className={styles.tableWrap}>
            {loading && rows.length === 0 ? <p className={styles.muted}>Đang tải…</p> : rows.length === 0 ? <p className={styles.muted}>Không tìm thấy giáo viên nào phù hợp.</p> : (
              <table className={styles.table}>
                <thead><tr><th>Họ tên</th><th>Đăng nhập bằng</th><th>Tổng phụ trách</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.user_id}>
                      <td><b>{r.full_name || '—'}</b></td>
                      <td>{displayLogin(r.email)}</td>
                      <td>{r.is_tpt ? <span className={styles.rowOk} style={{ margin: 0 }}>✓ Đang là TPT</span> : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className={r.is_tpt ? styles.smallCancel : styles.smallConfirm} disabled={busyId === r.user_id} onClick={() => toggle(r)}>
                          {r.is_tpt ? 'Thu hồi' : 'Cấp quyền TPT'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
