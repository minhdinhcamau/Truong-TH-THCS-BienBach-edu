'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import { addDays, fmtDate, fmtIso, mondayOf, vnTodayIso } from '@/lib/dates';
import AppShell, { Modal, Toast } from '@/components/AppShell';

const DEFAULT_AREA = 'Trực nhật chung';

export default function TptDutyPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const thisMonday = mondayOf(vnTodayIso());
  const [weekStart, setWeekStart] = useState(thisMonday);
  const [classes, setClasses] = useState([]);
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [adding, setAdding] = useState(null); // { date, class_id, area, note }
  const [rotation, setRotation] = useState(null); // { start, weeks, area, picked: [] }
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_duty_range', { p_from: weekStart, p_to: addDays(weekStart, 6) });
    if (error) setMsg({ type: 'error', text: error.message });
    else setDuties(data || []);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    if (!ready) return;
    supabase.from('classes').select('id, name').order('name').then(({ data }) => setClasses(data || []));
  }, [ready]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const knownAreas = useMemo(() => Array.from(new Set([DEFAULT_AREA, ...duties.map((d) => d.area)])), [duties]);

  async function saveAdd() {
    if (!adding.class_id) {
      setMsg({ type: 'error', text: 'Hãy chọn lớp.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('tpt_set_duty', {
      p_date: adding.date, p_class_id: adding.class_id, p_area: adding.area || DEFAULT_AREA, p_note: adding.note || null,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setAdding(null);
    setMsg({ type: 'ok', text: 'Đã phân công trực nhật.' });
    load();
  }

  async function clearDuty(d) {
    const { error } = await supabase.rpc('tpt_clear_duty', { p_id: d.id });
    if (error) setMsg({ type: 'error', text: error.message });
    else load();
  }

  function togglePick(id) {
    setRotation((r) => ({ ...r, picked: r.picked.includes(id) ? r.picked.filter((x) => x !== id) : [...r.picked, id] }));
  }

  async function runRotation() {
    if (!rotation.start) {
      setMsg({ type: 'error', text: 'Hãy chọn ngày bắt đầu.' });
      return;
    }
    if (rotation.picked.length === 0) {
      setMsg({ type: 'error', text: 'Hãy chọn ít nhất một lớp.' });
      return;
    }
    const area = rotation.area.trim() || DEFAULT_AREA;
    if (!window.confirm(`Xếp xoay vòng ${rotation.picked.length} lớp trong ${rotation.weeks} tuần từ ${fmtDate(rotation.start)}?\nLịch cũ của khu vực “${area}” trong khoảng này sẽ bị thay thế.`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('tpt_generate_duty_rotation', {
      p_start: rotation.start, p_weeks: Number(rotation.weeks), p_class_ids: rotation.picked, p_area: area,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setRotation(null);
    setWeekStart(mondayOf(rotation.start));
    setMsg({ type: 'ok', text: `Đã xếp ${data} lượt trực nhật.` });
    load();
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/truc-nhat" onLogout={logout}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 className="pg-title">Lớp trực nhật</h1>
          <p className="pg-sub" style={{ marginBottom: 0 }}>Phân công từng ngày, hoặc để hệ thống tự xếp xoay vòng nhiều tuần. Học sinh thấy lịch trong mục Bảng tin.</p>
        </div>
        <button
          className="btn btn-red"
          onClick={() => setRotation({ start: weekStart, weeks: 4, area: DEFAULT_AREA, picked: classes.map((c) => c.id) })}
        >
          ⟳ Xếp xoay vòng tự động
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <h3>Tuần {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}</h3>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹ Tuần trước</button>
            <button className="btn btn-sm" disabled={weekStart === thisMonday} onClick={() => setWeekStart(thisMonday)}>Tuần này</button>
            <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>Tuần sau ›</button>
          </div>
        </div>

        {loading ? (
          <div className="empty">Đang tải…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            {days.map((iso) => {
              const list = duties.filter((d) => d.duty_date === iso);
              return (
                <div key={iso} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: iso === vnTodayIso() ? '#fff8f7' : '#fff' }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{fmtIso(iso)}{iso === vnTodayIso() ? ' •' : ''}</div>
                  <div style={{ minHeight: 56, marginTop: 8 }}>
                    {list.length === 0 && <div className="hint" style={{ margin: 0 }}>Chưa phân công</div>}
                    {list.map((d) => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>Lớp {d.class_name}</div>
                          <div className="hint" style={{ margin: 0, fontSize: 12 }}>{d.area}{d.note ? ` · ${d.note}` : ''}</div>
                        </div>
                        <button className="btn btn-sm btn-danger" title="Bỏ phân công" onClick={() => clearDuty(d)}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-sm" style={{ marginTop: 6, width: '100%' }} onClick={() => setAdding({ date: iso, class_id: '', area: DEFAULT_AREA, note: '' })}>＋ Thêm lớp</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {adding && (
        <Modal title={`Phân công trực nhật — ${fmtIso(adding.date)}`} onClose={() => setAdding(null)}>
          <label className="lbl" htmlFor="d-cls" style={{ marginTop: 0 }}>Lớp</label>
          <select id="d-cls" className="input" value={adding.class_id} onChange={(e) => setAdding({ ...adding, class_id: e.target.value })}>
            <option value="">— Chọn lớp —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="lbl" htmlFor="d-area">Khu vực</label>
          <input id="d-area" className="input" list="areas" value={adding.area} onChange={(e) => setAdding({ ...adding, area: e.target.value })} />
          <datalist id="areas">{knownAreas.map((a) => <option key={a} value={a} />)}</datalist>
          <label className="lbl" htmlFor="d-note">Ghi chú (không bắt buộc)</label>
          <input id="d-note" className="input" value={adding.note} onChange={(e) => setAdding({ ...adding, note: e.target.value })} />
          <div className="modal-f">
            <button className="btn" onClick={() => setAdding(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={busy} onClick={saveAdd}>{busy ? 'Đang lưu…' : 'Phân công'}</button>
          </div>
        </Modal>
      )}

      {rotation && (
        <Modal title="Xếp lịch xoay vòng" wide onClose={() => setRotation(null)}>
          <p className="hint">Mỗi ngày học (Thứ 2 – Thứ 6) một lớp, lần lượt theo thứ tự bạn bấm chọn. Số trên mỗi lớp là thứ tự trực.</p>
          <div className="row">
            <div>
              <label className="lbl" htmlFor="r-start" style={{ marginTop: 0 }}>Bắt đầu từ tuần</label>
              <input id="r-start" type="date" className="input" style={{ width: 170 }} value={rotation.start} onChange={(e) => setRotation({ ...rotation, start: e.target.value })} />
            </div>
            <div>
              <label className="lbl" htmlFor="r-weeks" style={{ marginTop: 0 }}>Số tuần (tối đa 20)</label>
              <input id="r-weeks" type="number" min={1} max={20} className="input" style={{ width: 110 }} value={rotation.weeks} onChange={(e) => setRotation({ ...rotation, weeks: e.target.value })} />
            </div>
            <div className="grow">
              <label className="lbl" htmlFor="r-area" style={{ marginTop: 0 }}>Khu vực</label>
              <input id="r-area" className="input" value={rotation.area} onChange={(e) => setRotation({ ...rotation, area: e.target.value })} />
            </div>
          </div>

          <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            <div className="lbl" style={{ margin: 0 }}>Các lớp tham gia ({rotation.picked.length})</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setRotation({ ...rotation, picked: classes.map((c) => c.id) })}>Chọn tất cả</button>
              <button className="btn btn-sm" onClick={() => setRotation({ ...rotation, picked: [] })}>Bỏ chọn hết</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, marginTop: 8 }}>
            {classes.map((c) => {
              const idx = rotation.picked.indexOf(c.id);
              const on = idx >= 0;
              return (
                <button
                  key={c.id}
                  onClick={() => togglePick(c.id)}
                  aria-pressed={on}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                    fontWeight: 700, fontSize: 13.5, color: 'var(--ink)',
                    border: `1.5px solid ${on ? 'var(--red)' : '#d5dbe4'}`, background: on ? '#fdeceb' : '#fff',
                  }}
                >
                  {c.name}
                  {on && <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 999, fontSize: 11, padding: '1px 7px' }}>{idx + 1}</span>}
                </button>
              );
            })}
          </div>

          <div className="modal-f">
            <button className="btn" onClick={() => setRotation(null)}>Huỷ</button>
            <button className="btn btn-red" disabled={busy} onClick={runRotation}>{busy ? 'Đang xếp…' : 'Xếp lịch'}</button>
          </div>
        </Modal>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
