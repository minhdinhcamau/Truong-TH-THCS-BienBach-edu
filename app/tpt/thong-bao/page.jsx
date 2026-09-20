'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import { fmtDate, mondayOf, vnTodayIso, addDays } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

const KIND_LABEL = { week_plan: 'Kế hoạch tuần', notice: 'Thông báo' };

function emptyForm() {
  return {
    id: null, kind: 'week_plan', title: '', body: '', week_start: mondayOf(vnTodayIso()),
    class_id: '', pinned: false, notify: true,
  };
}

export default function TptAnnouncementsPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = đóng
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, kind, title, body, week_start, class_id, pinned, created_at, classes(name)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) setMsg({ type: 'error', text: error.message });
    else setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data } = await supabase.from('classes').select('id, name').order('name');
      setClasses(data || []);
      load();
    })();
  }, [ready, load]);

  function openNew(kind) {
    setForm({ ...emptyForm(), kind });
  }

  function openEdit(a) {
    setForm({
      id: a.id, kind: a.kind, title: a.title, body: a.body || '',
      week_start: a.week_start || mondayOf(vnTodayIso()), class_id: a.class_id || '',
      pinned: a.pinned, notify: false,
    });
  }

  async function save() {
    if (!form.title.trim()) {
      setMsg({ type: 'error', text: 'Vui lòng nhập tiêu đề.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('tpt_save_announcement', {
      p_id: form.id,
      p_kind: form.kind,
      p_title: form.title,
      p_body: form.body,
      p_week_start: form.kind === 'week_plan' ? form.week_start || null : null,
      p_class_id: form.class_id || null,
      p_pinned: form.pinned,
      p_notify: !form.id && form.notify,
    });
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: form.id ? 'Đã lưu thay đổi.' : 'Đã đăng. Học sinh xem được ngay trong mục Bảng tin.' });
    setForm(null);
    load();
  }

  async function remove(a) {
    if (!window.confirm(`Xoá "${a.title}"?`)) return;
    const { error } = await supabase.rpc('tpt_delete_announcement', { p_id: a.id });
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'ok', text: 'Đã xoá.' });
      load();
    }
  }

  async function togglePin(a) {
    const { error } = await supabase.rpc('tpt_save_announcement', {
      p_id: a.id, p_kind: a.kind, p_title: a.title, p_body: a.body || '',
      p_week_start: a.week_start, p_class_id: a.class_id, p_pinned: !a.pinned, p_notify: false,
    });
    if (error) setMsg({ type: 'error', text: error.message });
    else load();
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/thong-bao" onLogout={logout}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 className="pg-title">Thông báo & kế hoạch</h1>
          <p className="pg-sub" style={{ marginBottom: 0 }}>
            Mọi học sinh xem được trong mục “Bảng tin” của trang học sinh. Có thể gửi riêng cho một lớp.
          </p>
        </div>
        <div className="row">
          <button className="btn btn-red" onClick={() => openNew('week_plan')}>＋ Kế hoạch tuần</button>
          <button className="btn" onClick={() => openNew('notice')}>＋ Thông báo</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div className="card"><div className="empty">Đang tải…</div></div>
        ) : items.length === 0 ? (
          <div className="card"><div className="empty">Chưa có thông báo nào. Bấm “＋ Kế hoạch tuần” để đăng kế hoạch tuần này.</div></div>
        ) : (
          items.map((a) => (
            <div className="card" key={a.id}>
              <div className="card-h" style={{ marginBottom: 6 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className={`pill ${a.kind === 'week_plan' ? 'warn' : 'mute'}`}>{KIND_LABEL[a.kind]}</span>
                  {a.pinned && <span className="pill bad">Ghim</span>}
                  <span className="chip">{a.classes?.name ? `Lớp ${a.classes.name}` : 'Toàn trường'}</span>
                  {a.kind === 'week_plan' && a.week_start && (
                    <span className="chip">Tuần {fmtDate(a.week_start)} – {fmtDate(addDays(a.week_start, 6))}</span>
                  )}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => togglePin(a)}>{a.pinned ? 'Bỏ ghim' : 'Ghim'}</button>
                  <button className="btn btn-sm" onClick={() => openEdit(a)}>Sửa</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(a)}>Xoá</button>
                </div>
              </div>
              <h3 style={{ fontSize: 17 }}>{a.title}</h3>
              <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 6px', fontSize: 14 }}>{a.body}</p>
              <div className="hint" style={{ margin: 0 }}>Đăng {new Date(a.created_at).toLocaleString('vi-VN')}</div>
            </div>
          ))
        )}
      </div>

      {form && (
        <Modal title={form.id ? 'Sửa thông báo' : form.kind === 'week_plan' ? 'Đăng kế hoạch tuần' : 'Đăng thông báo'} wide onClose={() => setForm(null)}>
          <div className="row">
            <div>
              <label className="lbl" htmlFor="a-kind" style={{ marginTop: 0 }}>Loại</label>
              <select id="a-kind" className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="week_plan">Kế hoạch tuần</option>
                <option value="notice">Thông báo</option>
              </select>
            </div>
            {form.kind === 'week_plan' && (
              <div>
                <label className="lbl" htmlFor="a-week" style={{ marginTop: 0 }}>Tuần bắt đầu từ (Thứ 2)</label>
                <input id="a-week" type="date" className="input" value={form.week_start || ''} onChange={(e) => setForm({ ...form, week_start: e.target.value })} />
              </div>
            )}
            <div>
              <label className="lbl" htmlFor="a-cls" style={{ marginTop: 0 }}>Gửi cho</label>
              <select id="a-cls" className="input" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">Toàn trường</option>
                {classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
              </select>
            </div>
          </div>

          <label className="lbl" htmlFor="a-title">Tiêu đề</label>
          <input id="a-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={form.kind === 'week_plan' ? 'VD: Kế hoạch tuần 4 (21/9 – 27/9)' : 'VD: Thông báo họp Chi đội'} />

          <label className="lbl" htmlFor="a-body">Nội dung</label>
          <textarea id="a-body" className="input" rows={9} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={form.kind === 'week_plan'
              ? 'Thứ 2: Chào cờ – lớp 9A1 trực tuần\nThứ 3: Kiểm tra vệ sinh\n…'
              : 'Nội dung thông báo…'} />

          <div className="row" style={{ marginTop: 12 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              Ghim lên đầu
            </label>
            {!form.id && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                <input type="checkbox" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
                Báo cho học sinh ở chuông thông báo
              </label>
            )}
          </div>

          <div className="modal-f">
            <button className="btn" onClick={() => setForm(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : form.id ? 'Lưu thay đổi' : 'Đăng'}</button>
          </div>
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
