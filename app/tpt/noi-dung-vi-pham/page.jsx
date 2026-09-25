'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import { fmtDate } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

// Trang /tpt/noi-dung-vi-pham - TPT thêm / sửa / xoá các nội dung vi phạm và số điểm trừ.
// Mục hệ thống (xác nhận kiểm tra, xếp loại "Giờ A/B/C") chỉ được đổi số điểm.

const TABS = [
  { key: 'ne_nep', label: 'Nề nếp' },
  { key: 'hoc_tap', label: 'Học tập' },
  { key: 'archived', label: 'Đã ẩn' },
];
const CAT_LABEL = { ne_nep: 'Nề nếp', hoc_tap: 'Học tập' };

const isProtected = (r) =>
  r.category === 'checkin' || r.code === 'da_kiem_tra' || (r.category === 'hoc_tap' && /^giờ /i.test(r.label || ''));

export default function TptViolationCatalogPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const [tab, setTab] = useState('ne_nep');
  const [reasons, setReasons] = useState([]);
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // { code, category, label, kind, amount, locked }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const [r, u] = await Promise.all([
      supabase.from('discipline_reason_types').select('*').order('category').order('sort_order'),
      supabase.rpc('tpt_reason_usage'),
    ]);
    if (r.error) setMsg({ type: 'error', text: r.error.message });
    else setReasons(r.data || []);
    setUsage(Object.fromEntries((u.data || []).map((x) => [x.code, x])));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const list = useMemo(() => {
    const shown = reasons.filter((r) => r.category !== 'checkin');
    if (tab === 'archived') return shown.filter((r) => r.is_active === false);
    return shown.filter((r) => r.is_active !== false && r.category === tab);
  }, [reasons, tab]);

  const archivedCount = reasons.filter((r) => r.category !== 'checkin' && r.is_active === false).length;

  function openNew() {
    setForm({ code: null, category: tab === 'hoc_tap' ? 'hoc_tap' : 'ne_nep', label: '', kind: 'tru', amount: '', locked: false });
  }

  function openEdit(r) {
    const pts = Number(r.points);
    setForm({
      code: r.code, category: r.category, label: r.label, kind: pts > 0 ? 'cong' : 'tru',
      amount: String(Math.abs(pts)), locked: isProtected(r),
    });
  }

  async function save() {
    const amount = Number(form.amount);
    if (!form.label.trim()) {
      setMsg({ type: 'error', text: 'Vui lòng nhập nội dung.' });
      return;
    }
    if (!(amount > 0)) {
      setMsg({ type: 'error', text: 'Số điểm phải lớn hơn 0.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('tpt_upsert_reason_type', {
      p_code: form.code,
      p_category: form.category,
      p_label: form.label,
      p_points: form.kind === 'tru' ? -amount : amount,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: form.code ? 'Đã lưu thay đổi.' : 'Đã thêm nội dung mới.' });
    setForm(null);
    load();
  }

  async function remove(r) {
    const uses = usage[r.code]?.uses || 0;
    const text = uses > 0
      ? `“${r.label}” đã được dùng ${uses} lần.\nSẽ ẨN khỏi danh sách chọn, các báo cáo cũ vẫn giữ nguyên. Tiếp tục?`
      : `Xoá vĩnh viễn “${r.label}”?`;
    if (!window.confirm(text)) return;
    const { data, error } = await supabase.rpc('tpt_delete_reason_type', { p_code: r.code });
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: data === 'archived' ? 'Đã ẩn nội dung này (vì đã có báo cáo dùng nó).' : 'Đã xoá.' });
    load();
  }

  async function restore(r) {
    const { error } = await supabase.rpc('tpt_upsert_reason_type', {
      p_code: r.code, p_category: r.category, p_label: r.label, p_points: r.points, p_active: true,
    });
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: 'Đã khôi phục.' });
      load();
    }
  }

  function pointsPill(p) {
    const n = Number(p);
    if (n < 0) return <span className="pill bad">Trừ {Math.abs(n)} điểm</span>;
    if (n > 0) return <span className="pill ok">Cộng {n} điểm</span>;
    return <span className="pill mute">0 điểm</span>;
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/noi-dung-vi-pham" onLogout={logout}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 className="pg-title">Nội dung vi phạm & điểm trừ</h1>
          <p className="pg-sub" style={{ marginBottom: 0 }}>
            Danh sách này là các mục Sao đỏ và cô chọn khi trừ điểm lớp. Đổi số điểm chỉ áp dụng cho các lần ghi nhận mới; báo cáo cũ giữ điểm đã ghi.
          </p>
        </div>
        <button className="btn btn-red" onClick={openNew}>＋ Thêm nội dung</button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <div className="row" style={{ gap: 6 }}>
            {TABS.map((t) => (
              <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-red' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}{t.key === 'archived' && archivedCount > 0 ? ` (${archivedCount})` : ''}
              </button>
            ))}
          </div>
          <span className="hint" style={{ margin: 0 }}>{list.length} nội dung</span>
        </div>

        {loading ? (
          <div className="empty">Đang tải…</div>
        ) : list.length === 0 ? (
          <div className="empty">{tab === 'archived' ? 'Không có nội dung nào bị ẩn.' : 'Chưa có nội dung nào trong nhóm này. Bấm “＋ Thêm nội dung”.'}</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Nội dung</th>{tab === 'archived' && <th>Nhóm</th>}<th>Điểm</th><th>Đã dùng</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const u = usage[r.code];
                  const locked = isProtected(r);
                  return (
                    <tr key={r.code}>
                      <td>
                        <strong>{r.label}</strong>
                        {locked && <span className="chip" style={{ marginLeft: 8 }} title="Mục hệ thống: chỉ đổi được số điểm">🔒 Hệ thống</span>}
                      </td>
                      {tab === 'archived' && <td>{CAT_LABEL[r.category] || r.category}</td>}
                      <td>{pointsPill(r.points)}</td>
                      <td>{u ? <>{u.uses} lần <span className="hint" style={{ margin: 0 }}>· gần nhất {fmtDate(u.last_used)}</span></> : <span className="hint" style={{ margin: 0 }}>Chưa dùng</span>}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {tab === 'archived' ? (
                          <button className="btn btn-sm" onClick={() => restore(r)}>Khôi phục</button>
                        ) : (
                          <>
                            <button className="btn btn-sm" onClick={() => openEdit(r)}>Sửa</button>{' '}
                            {!locked && <button className="btn btn-sm btn-danger" onClick={() => remove(r)}>Xoá</button>}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <Modal title={form.code ? 'Sửa nội dung' : 'Thêm nội dung vi phạm'} onClose={() => setForm(null)}>
          {form.locked && (
            <p className="hint" style={{ marginTop: 0 }}>Đây là mục hệ thống (dùng cho xếp loại giờ học / xác nhận kiểm tra) nên chỉ đổi được số điểm.</p>
          )}
          <label className="lbl" htmlFor="v-cat" style={{ marginTop: 0 }}>Nhóm</label>
          <select id="v-cat" className="input" value={form.category} disabled={form.locked}
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="ne_nep">Nề nếp</option>
            <option value="hoc_tap">Học tập</option>
          </select>

          <label className="lbl" htmlFor="v-label">Nội dung</label>
          <input id="v-label" className="input" value={form.label} disabled={form.locked} maxLength={120}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="VD: Không mặc đồng phục, Đi học muộn…" />

          <div className="row" style={{ alignItems: 'flex-end', marginTop: 4 }}>
            <div>
              <label className="lbl" htmlFor="v-kind">Loại điểm</label>
              <select id="v-kind" className="input" style={{ width: 130 }} value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="tru">Trừ điểm</option>
                <option value="cong">Cộng điểm</option>
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="v-amt">Số điểm</label>
              <input id="v-amt" type="number" min={0} step="0.5" className="input" style={{ width: 110 }} value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="VD: 2" />
            </div>
          </div>

          <div className="modal-f">
            <button className="btn" onClick={() => setForm(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : form.code ? 'Lưu' : 'Thêm'}</button>
          </div>
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
