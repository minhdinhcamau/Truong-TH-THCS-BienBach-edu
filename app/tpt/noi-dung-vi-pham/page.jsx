'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import { fmtDate } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

// Trang /tpt/noi-dung-vi-pham - TPT thêm / sửa / xoá các nội dung vi phạm và số điểm trừ,
// gom theo NHÓM (Sĩ số, Vệ sinh, Nề nếp, Đạo đức - tác phong...) cho dễ quản lý và dễ tìm.
// Mục hệ thống (xác nhận kiểm tra, xếp loại "Giờ A/B/C") chỉ được đổi số điểm.

const HOC_TAP_TAB = '__hoctap';
const ARCHIVED_TAB = '__archived';
const PRESET_GROUPS = ['Sĩ số', 'Vệ sinh', 'Nề nếp', 'Đạo đức, tác phong', 'Khác'];
const GROUP_ICON = { 'Sĩ số': '🧑‍🎓', 'Vệ sinh': '🧹', 'Nề nếp': '📋', 'Đạo đức, tác phong': '🎯', 'Khác': '🔹' };
const CAT_LABEL = { ne_nep: 'Nề nếp', hoc_tap: 'Học tập' };

const isProtected = (r) =>
  r.category === 'checkin' || r.code === 'da_kiem_tra' || (r.category === 'hoc_tap' && /^giờ /i.test(r.label || ''));

export default function TptViolationCatalogPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const [tab, setTab] = useState('Sĩ số');
  const [reasons, setReasons] = useState([]);
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // { code, category, group, label, kind, amount, locked }
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
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

  // Nhom "Nề nếp" theo group_label; muc cu chua co group_label thi rot vao "Nề nếp" (mac dinh).
  const groupOf = (r) => r.group_label || 'Nề nếp';

  const extraGroups = useMemo(() => {
    const s = new Set();
    reasons.forEach((r) => {
      if (r.category === 'ne_nep' && r.is_active !== false) {
        const g = groupOf(r);
        if (!PRESET_GROUPS.includes(g)) s.add(g);
      }
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [reasons]);

  const groupTabs = useMemo(() => [...PRESET_GROUPS, ...extraGroups], [extraGroups]);
  const archivedCount = reasons.filter((r) => r.category !== 'checkin' && r.is_active === false).length;
  const countOf = (g) => reasons.filter((r) => r.category === 'ne_nep' && r.is_active !== false && groupOf(r) === g).length;
  const hocTapCount = reasons.filter((r) => r.category === 'hoc_tap' && r.is_active !== false).length;

  const list = useMemo(() => {
    if (tab === ARCHIVED_TAB) return reasons.filter((r) => r.category !== 'checkin' && r.is_active === false);
    if (tab === HOC_TAP_TAB) return reasons.filter((r) => r.category === 'hoc_tap' && r.is_active !== false);
    return reasons.filter((r) => r.category === 'ne_nep' && r.is_active !== false && groupOf(r) === tab);
  }, [reasons, tab]);

  function openNew() {
    setForm({
      code: null, category: 'ne_nep', group: PRESET_GROUPS.includes(tab) ? tab : 'Nề nếp',
      label: '', kind: 'tru', amount: '', locked: false,
    });
  }

  function openEdit(r) {
    const pts = Number(r.points);
    setForm({
      code: r.code, category: r.category, group: groupOf(r), label: r.label, kind: pts > 0 ? 'cong' : 'tru',
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
      p_group_label: form.category === 'hoc_tap' ? 'Học tập (xếp loại giờ)' : form.group,
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
      ? `"${r.label}" đã được dùng ${uses} lần.\nSẽ ẨN khỏi danh sách chọn, các báo cáo cũ vẫn giữ nguyên. Tiếp tục?`
      : `Xoá vĩnh viễn "${r.label}"?`;
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
      p_group_label: groupOf(r),
    });
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: 'Đã khôi phục.' });
      load();
    }
  }

  async function seedSample() {
    if (!window.confirm('Nạp nhanh danh mục mẫu theo bảng điểm THCS (Sĩ số, Vệ sinh, Nề nếp, Đạo đức - tác phong)?\nMục nào trùng tên với mục đã có sẽ tự bỏ qua, không tạo trùng.')) return;
    setSeeding(true);
    const { data, error } = await supabase.rpc('tpt_seed_catalog_mau');
    setSeeding(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({
      type: 'ok',
      text: data.inserted > 0
        ? `Đã thêm ${data.inserted} nội dung mới${data.skipped > 0 ? `, bỏ qua ${data.skipped} mục đã có sẵn` : ''}.`
        : 'Danh mục mẫu đã có đủ trong hệ thống, không thêm mục nào mới.',
    });
    load();
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
      <style jsx>{`
        .grp-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .grp { border: 1.5px solid var(--line); background: #fff; border-radius: 999px; padding: 8px 15px; font-weight: 700;
          font-size: 13px; color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
        .grp:hover { border-color: #d5dbe4; color: var(--ink); }
        .grp.on { background: var(--red); border-color: var(--red); color: #fff; }
        .grp .n { background: rgba(0,0,0,0.08); border-radius: 999px; padding: 0 7px; font-size: 11.5px; }
        .grp.on .n { background: rgba(255,255,255,0.28); }
        .seed-btn { background: #fff; border: 1.5px dashed #b9c3d0; color: var(--ink); }
        .seed-btn:hover:not(:disabled) { border-color: var(--red); color: var(--red); background: #fff7f6; }
      `}</style>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 className="pg-title">Nội dung vi phạm & điểm trừ</h1>
          <p className="pg-sub" style={{ marginBottom: 0 }}>
            Danh sách này là các mục Sao đỏ và cô chọn khi trừ điểm lớp, gom theo nhóm cho dễ tìm. Đổi số điểm chỉ áp dụng cho các lần ghi nhận mới; báo cáo cũ giữ điểm đã ghi.
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn seed-btn" disabled={seeding} onClick={seedSample}>
            {seeding ? 'Đang nạp…' : '🌱 Nạp danh mục mẫu'}
          </button>
          <button className="btn btn-red" onClick={openNew}>＋ Thêm nội dung</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="grp-row" role="tablist" aria-label="Chọn nhóm nội dung">
          {groupTabs.map((g) => (
            <button key={g} role="tab" aria-selected={tab === g} className={`grp ${tab === g ? 'on' : ''}`} onClick={() => setTab(g)}>
              {GROUP_ICON[g] || '📁'} {g} <span className="n">{countOf(g)}</span>
            </button>
          ))}
          <button role="tab" aria-selected={tab === HOC_TAP_TAB} className={`grp ${tab === HOC_TAP_TAB ? 'on' : ''}`} onClick={() => setTab(HOC_TAP_TAB)}>
            📖 Học tập (xếp loại giờ) <span className="n">{hocTapCount}</span>
          </button>
          {archivedCount > 0 && (
            <button role="tab" aria-selected={tab === ARCHIVED_TAB} className={`grp ${tab === ARCHIVED_TAB ? 'on' : ''}`} onClick={() => setTab(ARCHIVED_TAB)}>
              🗄 Đã ẩn <span className="n">{archivedCount}</span>
            </button>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div className="empty">Đang tải…</div>
          ) : list.length === 0 ? (
            <div className="empty">
              {tab === ARCHIVED_TAB ? 'Không có nội dung nào bị ẩn.' : (
                <>
                  Nhóm này chưa có nội dung nào.{' '}
                  <button className="btn btn-sm" onClick={openNew} style={{ marginLeft: 4 }}>＋ Thêm nội dung</button>
                  {' hoặc bấm '}<button className="btn btn-sm seed-btn" disabled={seeding} onClick={seedSample}>🌱 Nạp danh mục mẫu</button>
                </>
              )}
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Nội dung</th>{tab === ARCHIVED_TAB && <th>Nhóm</th>}<th>Điểm</th><th>Đã dùng</th><th></th></tr>
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
                        {tab === ARCHIVED_TAB && <td>{groupOf(r)} · {CAT_LABEL[r.category] || r.category}</td>}
                        <td>{pointsPill(r.points)}</td>
                        <td>{u ? <>{u.uses} lần <span className="hint" style={{ margin: 0 }}>· gần nhất {fmtDate(u.last_used)}</span></> : <span className="hint" style={{ margin: 0 }}>Chưa dùng</span>}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {tab === ARCHIVED_TAB ? (
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
      </div>

      {form && (
        <Modal title={form.code ? 'Sửa nội dung' : 'Thêm nội dung vi phạm'} onClose={() => setForm(null)}>
          {form.locked && (
            <p className="hint" style={{ marginTop: 0 }}>Đây là mục hệ thống (dùng cho xếp loại giờ học / xác nhận kiểm tra) nên chỉ đổi được số điểm.</p>
          )}
          <label className="lbl" htmlFor="v-cat" style={{ marginTop: 0 }}>Trục tính điểm</label>
          <select id="v-cat" className="input" value={form.category} disabled={form.locked}
            onChange={(e) => setForm({ ...form, category: e.target.value, group: e.target.value === 'hoc_tap' ? 'Học tập (xếp loại giờ)' : 'Nề nếp' })}>
            <option value="ne_nep">Nề nếp</option>
            <option value="hoc_tap">Học tập</option>
          </select>

          {form.category === 'ne_nep' && (
            <>
              <label className="lbl" htmlFor="v-grp">Nhóm hiển thị</label>
              <select id="v-grp" className="input" value={form.group} disabled={form.locked}
                onChange={(e) => setForm({ ...form, group: e.target.value })}>
                {PRESET_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                {extraGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </>
          )}

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
