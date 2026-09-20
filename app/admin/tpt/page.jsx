'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { ADMIN_NAV } from '@/lib/nav';
import { displayLogin } from '@/lib/account';
import AppShell, { Toast } from '@/components/AppShell';

const ROLE_LABEL = { admin: 'Admin', teacher: 'Giáo viên', student: 'Học sinh' };

export default function AdminTptPage() {
  const { profile, ready, logout } = useGuard('admin');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);

  async function load(q = search) {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_accounts', { p_search: q.trim() || null });
    setLoading(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else setRows(data || []);
  }

  useEffect(() => {
    if (ready) load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Tìm kiếm sau khi ngừng gõ 350ms
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function toggle(row) {
    const next = !row.is_tpt;
    const ok = window.confirm(
      next
        ? `Cấp quyền Tổng phụ trách Đội cho "${row.full_name}"?`
        : `Thu hồi quyền Tổng phụ trách của "${row.full_name}"?`
    );
    if (!ok) return;
    setBusyId(row.user_id);
    const { error } = await supabase.rpc('admin_set_tpt', { p_user_id: row.user_id, p_value: next });
    setBusyId(null);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'ok', text: next ? 'Đã cấp quyền Tổng phụ trách.' : 'Đã thu hồi quyền Tổng phụ trách.' });
      load();
    }
  }

  const tptList = useMemo(() => rows.filter((r) => r.is_tpt), [rows]);

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Quản trị viên" nav={ADMIN_NAV} activeHref="/admin/tpt" onLogout={logout}>
      <h1 className="pg-title">Cấp quyền Tổng phụ trách Đội</h1>
      <p className="pg-sub">
        Tài khoản được cấp quyền sẽ vào được khu vực quản lý của cô Tổng phụ trách (thời khóa biểu, phân công Sao đỏ,
        thông báo, trừ điểm lớp, trực nhật).
      </p>

      <div className="card">
        <div className="card-h"><h3>Tổng phụ trách hiện tại</h3></div>
        {tptList.length === 0 ? (
          <div className="empty">Chưa có ai được cấp quyền. Tìm tài khoản ở bên dưới rồi bấm “Cấp quyền”.</div>
        ) : (
          <div className="chips">
            {tptList.map((t) => (
              <span key={t.user_id} className="chip">{t.full_name}{t.email ? ` · ${displayLogin(t.email)}` : ''}</span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Tìm tài khoản</h3>
        </div>
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Gõ tên hoặc email của cô Tổng phụ trách…"
          aria-label="Tìm tài khoản"
        />

        <div className="tbl-wrap" style={{ marginTop: 12 }}>
          {loading && rows.length === 0 ? (
            <div className="empty">Đang tải…</div>
          ) : rows.length === 0 ? (
            <div className="empty">Không tìm thấy tài khoản nào.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Tổng phụ trách</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td><strong>{r.full_name || '—'}</strong>{r.class_name ? <span className="chip" style={{ marginLeft: 8 }}>{r.class_name}</span> : null}</td>
                    <td>{displayLogin(r.email)}</td>
                    <td>{ROLE_LABEL[r.role] || r.role}</td>
                    <td>{r.is_tpt ? <span className="pill ok">Đang là TPT</span> : <span className="pill mute">Không</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={`btn btn-sm ${r.is_tpt ? 'btn-danger' : 'btn-red'}`}
                        disabled={busyId === r.user_id}
                        onClick={() => toggle(r)}
                      >
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

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
