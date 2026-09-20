'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import { displayLogin } from '@/lib/account';
import AppShell, { Modal, Toast } from '@/components/AppShell';

export default function TptSaodoPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const [classes, setClasses] = useState([]);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // Phân công lớp
  const [assigning, setAssigning] = useState(null); // { user_id, full_name }
  const [picked, setPicked] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Danh sách tài khoản (chỉ hiện khi TPT bấm nút cấp quyền)
  const [showAccounts, setShowAccounts] = useState(false);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadRoster = useCallback(async () => {
    const { data, error } = await supabase.rpc('tpt_saodo_roster');
    if (error) setMsg({ type: 'error', text: error.message });
    else setRoster(data || []);
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data } = await supabase.from('classes').select('id, name').order('name');
      setClasses(data || []);
      await loadRoster();
      setLoading(false);
    })();
  }, [ready, loadRoster]);

  const loadAccounts = useCallback(async () => {
    setAccLoading(true);
    const { data, error } = await supabase.rpc('tpt_list_accounts', {
      p_search: search.trim() || null,
      p_class_id: classFilter || null,
      p_only_saodo: false,
    });
    setAccLoading(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else setAccounts(data || []);
  }, [search, classFilter]);

  useEffect(() => {
    if (!showAccounts) return undefined;
    const t = setTimeout(loadAccounts, 300);
    return () => clearTimeout(t);
  }, [showAccounts, loadAccounts]);

  const uncovered = useMemo(() => {
    const covered = new Set(roster.flatMap((r) => r.class_ids || []));
    return classes.filter((c) => !covered.has(c.id));
  }, [roster, classes]);

  function openAssign(r) {
    setAssigning({ user_id: r.user_id, full_name: r.full_name });
    setPicked(new Set(r.class_ids || []));
  }

  function togglePick(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveAssign() {
    if (!assigning) return;
    setSaving(true);
    const { error } = await supabase.rpc('tpt_set_saodo_classes', {
      p_user_id: assigning.user_id,
      p_class_ids: Array.from(picked),
    });
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setAssigning(null);
    setMsg({ type: 'ok', text: 'Đã lưu phân công lớp.' });
    loadRoster();
  }

  async function setSaodo(user, value) {
    const ok = window.confirm(
      value
        ? `Cấp quyền Sao đỏ cho "${user.full_name}"?`
        : `Thu hồi quyền Sao đỏ của "${user.full_name}"? Các lớp đang phụ trách cũng sẽ bị gỡ.`
    );
    if (!ok) return;
    setBusyId(user.user_id);
    const { error } = await supabase.rpc('tpt_set_saodo', { p_user_id: user.user_id, p_value: value });
    setBusyId(null);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: value ? 'Đã cấp quyền Sao đỏ. Hãy phân công lớp cho bạn ấy.' : 'Đã thu hồi quyền Sao đỏ.' });
    loadRoster();
    if (showAccounts) loadAccounts();
  }

  async function changeClass(user, classId) {
    const { error } = await supabase.rpc('tpt_set_student_class', { p_user_id: user.user_id, p_class_id: classId || null });
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: `Đã chuyển ${user.full_name} sang lớp mới.` });
      loadAccounts();
    }
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/phan-cong" onLogout={logout}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 className="pg-title">Đội Sao đỏ</h1>
          <p className="pg-sub" style={{ marginBottom: 0 }}>Cấp quyền Sao đỏ và phân công lớp mà mỗi bạn phải kiểm tra. Sao đỏ chỉ thấy đúng các lớp được phân công.</p>
        </div>
        <button className="btn btn-red" onClick={() => setShowAccounts(true)}>＋ Cấp quyền Sao đỏ mới</button>
      </div>

      {uncovered.length > 0 && !loading && (
        <div className="card" style={{ borderColor: '#f0d28a', background: '#fffaf0', marginTop: 16 }}>
          <strong style={{ color: 'var(--warn)' }}>{uncovered.length} lớp chưa có Sao đỏ phụ trách:</strong>
          <div className="chips" style={{ marginTop: 8 }}>
            {uncovered.map((c) => <span key={c.id} className="chip">{c.name}</span>)}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Danh sách Sao đỏ ({roster.length})</h3></div>
        {loading ? (
          <div className="empty">Đang tải…</div>
        ) : roster.length === 0 ? (
          <div className="empty">Chưa có Sao đỏ nào. Bấm “Cấp quyền Sao đỏ mới” để chọn từ danh sách học sinh.</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Họ tên</th><th>Lớp của bạn</th><th>Lớp được phân công kiểm tra</th><th></th></tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.user_id}>
                    <td><strong>{r.full_name}</strong></td>
                    <td>{r.own_class_name || '—'}</td>
                    <td>
                      {(r.class_names || []).length === 0 ? (
                        <span className="pill warn">Chưa phân công</span>
                      ) : (
                        <div className="chips">{r.class_names.map((n) => <span key={n} className="chip">{n}</span>)}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={() => openAssign(r)}>Phân công lớp</button>{' '}
                      <button className="btn btn-sm btn-danger" disabled={busyId === r.user_id} onClick={() => setSaodo(r, false)}>Thu hồi</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {assigning && (
        <Modal title={`Phân công lớp — ${assigning.full_name}`} onClose={() => setAssigning(null)}>
          <p className="hint">Chọn các lớp bạn này phải kiểm tra mỗi ngày.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {classes.map((c) => (
              <label
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${picked.has(c.id) ? 'var(--red)' : '#d5dbe4'}`,
                  background: picked.has(c.id) ? '#fdeceb' : '#fff', fontWeight: 600, fontSize: 13.5,
                }}
              >
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => togglePick(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
          <div className="modal-f">
            <button className="btn" onClick={() => setAssigning(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={saving} onClick={saveAssign}>
              {saving ? 'Đang lưu…' : `Lưu (${picked.size} lớp)`}
            </button>
          </div>
        </Modal>
      )}

      {showAccounts && (
        <Modal title="Tài khoản học sinh" wide onClose={() => setShowAccounts(false)}>
          <p className="hint">Chỉ cô Tổng phụ trách xem được danh sách này. Chọn học sinh rồi bấm “Cấp Sao đỏ”. Cũng có thể đổi lớp cho học sinh tại đây.</p>
          <div className="row">
            <input
              className="input grow"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc mã học sinh…"
              aria-label="Tìm tài khoản học sinh"
            />
            <select className="input" style={{ width: 150 }} value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Lọc theo lớp">
              <option value="">Tất cả lớp</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="tbl-wrap" style={{ marginTop: 12 }}>
            {accLoading && accounts.length === 0 ? (
              <div className="empty">Đang tải…</div>
            ) : accounts.length === 0 ? (
              <div className="empty">Không có tài khoản phù hợp.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr><th>Họ tên</th><th>Mã học sinh</th><th>Lớp</th><th>Sao đỏ</th></tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.user_id}>
                      <td><strong>{a.full_name || '—'}</strong></td>
                      <td>{displayLogin(a.email)}</td>
                      <td>
                        <select
                          className="input"
                          style={{ width: 110, padding: '5px 8px' }}
                          value={a.class_id || ''}
                          onChange={(e) => changeClass(a, e.target.value)}
                          aria-label={`Lớp của ${a.full_name}`}
                        >
                          <option value="">—</option>
                          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td>
                        {a.is_saodo ? (
                          <button className="btn btn-sm btn-danger" disabled={busyId === a.user_id} onClick={() => setSaodo(a, false)}>Thu hồi</button>
                        ) : (
                          <button className="btn btn-sm btn-red" disabled={busyId === a.user_id} onClick={() => setSaodo(a, true)}>Cấp Sao đỏ</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {accounts.length >= 300 && <div className="hint" style={{ marginTop: 8 }}>Đang hiện 300 tài khoản đầu tiên — hãy lọc theo lớp hoặc gõ tên để thu hẹp.</div>}
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
