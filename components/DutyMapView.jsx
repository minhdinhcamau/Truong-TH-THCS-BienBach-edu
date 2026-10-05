'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fmtDate } from '@/lib/dates';
import DutyMap, { printDutyMap } from '@/components/DutyMap';

// Bản đồ trực nhật CHỈ XEM, dùng cho học sinh (/student/truc-nhat) và giáo viên (/teacher/truc-nhat).
// Chỉ thấy các tuần Tổng phụ trách đã công bố. Lớp của mình (học sinh: lớp mình; giáo viên: lớp chủ nhiệm) được tô nổi bật.
// accent: màu nhấn của khu vực người dùng (xanh dương cho học sinh, xanh lá cho giáo viên).
//
// Bố cục:
//   - Điện thoại: một cột (tuần, thông báo lớp mình, bản đồ, danh sách lớp).
//   - Máy tính (từ 960px): thông báo lớp mình ở trên cùng; bên trái là bản đồ; bên phải là chọn tuần, chú giải khu vực và danh sách lớp.
export default function DutyMapView({ accent = '#2563eb', title = 'Bản đồ trực nhật' }) {
  const [meta, setMeta] = useState(null); // { published_weeks, current_week, my_class_ids }
  const [weekNo, setWeekNo] = useState(null);
  const [data, setData] = useState(null);
  const [weeks, setWeeks] = useState([]); // lịch năm học để hiện ngày
  const [selectedId, setSelectedId] = useState(null);
  const [err, setErr] = useState(null);
  const svgRef = useRef(null);

  // Lần đầu: hỏi tuần 0 chỉ để biết danh sách tuần đã công bố và tuần hiện tại
  useEffect(() => {
    let on = true;
    (async () => {
      const [m, w] = await Promise.all([supabase.rpc('duty_map_get', { p_week_no: 0 }), supabase.rpc('get_school_weeks')]);
      if (!on) return;
      if (m.error) { setErr(m.error.message); return; }
      setWeeks(w.data || []);
      const pubs = m.data.published_weeks || [];
      const cur = m.data.current_week;
      setMeta({ published_weeks: pubs, current_week: cur, my_class_ids: m.data.my_class_ids || [] });
      let pick = null;
      if (pubs.length) {
        if (cur && pubs.includes(cur)) pick = cur;
        else pick = [...pubs].filter((n) => !cur || n <= cur).pop() || pubs[0];
      }
      setWeekNo(pick);
    })();
    return () => { on = false; };
  }, []);

  const load = useCallback(async (w) => {
    setData(null);
    setSelectedId(null);
    const { data: d, error } = await supabase.rpc('duty_map_get', { p_week_no: w });
    if (error) { setErr(error.message); return; }
    setData(d);
  }, []);

  useEffect(() => { if (weekNo) load(weekNo); }, [weekNo, load]);

  const pubs = meta?.published_weeks || [];
  const idx = pubs.indexOf(weekNo);
  const weekInfo = weeks.find((x) => x.week_no === weekNo);

  const labels = useMemo(() => {
    const o = {};
    (data?.assign || []).forEach((r) => { (o[r.zone_id] = o[r.zone_id] || []).push(r.class_name); });
    return o;
  }, [data]);
  const mineIds = useMemo(() => new Set(meta?.my_class_ids || []), [meta]);
  const mineZones = useMemo(() => {
    const s = new Set();
    (data?.assign || []).forEach((r) => { if (mineIds.has(r.class_id)) s.add(r.zone_id); });
    return s;
  }, [data, mineIds]);
  const zones = data?.zones || [];
  const myZoneNames = zones.filter((z) => mineZones.has(z.id)).map((z) => z.name);
  const usedZones = zones.filter((z) => (labels[z.id] || []).length > 0);
  const classRows = useMemo(() => {
    const m = new Map();
    (data?.assign || []).forEach((r) => {
      if (!m.has(r.class_id)) m.set(r.class_id, { name: r.class_name, zones: [] });
      const z = zones.find((x) => x.id === r.zone_id);
      if (z) m.get(r.class_id).zones.push(z);
    });
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
  }, [data, zones]);
  const selZone = zones.find((z) => z.id === selectedId);

  return (
    <div className="dmv" style={{ '--dmv': accent }}>
      <style jsx global>{`
        .dmv { font-family: inherit; }
        .dmv h1 { margin: 0 0 4px; font-size: 24px; }
        .dmv .sub { color: #5b6b7a; font-size: 13.5px; margin: 0 0 14px; }
        .dmv .c { background: #fff; border: 1px solid #dbe3ec; border-radius: 16px; padding: 14px; min-width: 0; }
        .dmv .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
        .dmv .wk { display: flex; align-items: center; gap: 8px; }
        .dmv .wk button { width: 44px; height: 44px; border-radius: 12px; border: 1px solid #dbe3ec; background: #fff; font-size: 22px; cursor: pointer; flex: none; }
        .dmv .wk button:hover:not(:disabled) { background: #f3f6fa; }
        .dmv .wk button:disabled { opacity: .35; cursor: default; }
        .dmv .wt { flex: 1; text-align: center; min-width: 0; }
        .dmv .wt b { display: block; font-size: 20px; line-height: 1.2; }
        .dmv .wt span { font-size: 12.5px; color: #5b6b7a; }
        .dmv .me { display: flex; align-items: center; gap: 12px; background: var(--dmv); color: #fff; border-radius: 16px; padding: 14px 16px; font-size: 14.5px; line-height: 1.45; }
        .dmv .me .ic { width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,.22); display: grid; place-items: center; font-size: 22px; flex: none; }
        .dmv .me b { font-size: 17px; }
        .dmv .me.none { background: #eef2f6; color: #3d4b59; }
        .dmv .me.none .ic { background: #e1e8ef; }
        .dmv .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .dmv .cc { border: 1px solid #dbe3ec; border-left: 6px solid #dbe3ec; border-radius: 12px; padding: 9px 11px; background: #fff; }
        .dmv .cc.mine { box-shadow: 0 0 0 2px var(--dmv) inset; }
        .dmv .cc b { display: block; font-size: 15px; }
        .dmv .cc span { display: block; font-size: 13px; color: #3d4b59; margin-top: 2px; }
        .dmv .btn { font: inherit; font-size: 14px; padding: 10px 14px; border: 1px solid #dbe3ec; background: #fff; border-radius: 10px; cursor: pointer; min-height: 44px; }
        .dmv .btn:hover { background: #f3f6fa; }
        .dmv .empty { color: #5b6b7a; text-align: center; padding: 26px 8px; font-size: 14px; }
        .dmv .h { font-size: 15px; margin: 0 0 8px; }
        .dmv .zinfo { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: #f3f6fa; font-size: 14px; }
        .dmv .legend { display: flex; flex-wrap: wrap; gap: 8px; }
        .dmv .lg { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #dbe3ec; background: #fff; border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 13px; cursor: pointer; min-height: 38px; text-align: left; }
        .dmv .lg i { width: 12px; height: 12px; border-radius: 4px; flex: none; }
        .dmv .lg em { font-style: normal; color: #5b6b7a; }
        .dmv .lg.on { outline: 2px solid var(--dmv); font-weight: 700; }
        .dmv .lg.mine { background: #f1f6ff; }
        .dmv .mapc { padding: 10px; }
        .dmv .tools { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }

        @media (min-width: 960px) {
          .dmv h1 { font-size: 28px; }
          .dmv .grid {
            grid-template-columns: minmax(0, 1.55fr) minmax(320px, 1fr);
            grid-template-areas: 'banner banner' 'map week' 'map legend' 'map list';
            grid-template-rows: auto auto auto 1fr;
            align-items: start;
          }
          .dmv .g-banner { grid-area: banner; }
          .dmv .g-map { grid-area: map; position: sticky; top: 76px; }
          .dmv .g-week { grid-area: week; }
          .dmv .g-legend { grid-area: legend; }
          .dmv .g-list { grid-area: list; }
          .dmv .mapc { padding: 14px; }
          .dmv .cards { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
        }
      `}</style>

      <h1>{title}</h1>
      <p className="sub">Khu vực trực nhật của từng lớp theo tuần. Chạm vào khu vực có màu để xem lớp nào trực.</p>

      {err && <div className="c empty">{err}</div>}

      {!err && meta === null && <div className="c empty">Đang tải…</div>}

      {!err && meta && pubs.length === 0 && (
        <div className="c empty">Tổng phụ trách chưa công bố bản đồ trực nhật nào. Khi có, bản đồ sẽ hiện ở đây.</div>
      )}

      {!err && meta && pubs.length > 0 && weekNo && (
        <div className="grid">
          <div className="c g-week">
            <div className="wk">
              <button onClick={() => idx > 0 && setWeekNo(pubs[idx - 1])} disabled={idx <= 0} aria-label="Tuần trước">‹</button>
              <div className="wt">
                <b>Tuần {weekNo}{meta.current_week === weekNo ? ' · hiện tại' : ''}</b>
                <span>{weekInfo ? `${fmtDate(String(weekInfo.week_start))} – ${fmtDate(String(weekInfo.week_end))}` : ''}</span>
              </div>
              <button onClick={() => idx < pubs.length - 1 && setWeekNo(pubs[idx + 1])} disabled={idx >= pubs.length - 1} aria-label="Tuần sau">›</button>
            </div>
          </div>

          <div className="g-banner">
            {!data ? (
              <div className="me none"><span className="ic" aria-hidden="true">⏳</span><span>Đang tải…</span></div>
            ) : myZoneNames.length > 0 ? (
              <div className="me">
                <span className="ic" aria-hidden="true">🧹</span>
                <span><b>Lớp của bạn trực: {myZoneNames.join(', ')}</b><br />Khu vực này được tô nổi bật trên bản đồ.</span>
              </div>
            ) : (
              <div className="me none">
                <span className="ic" aria-hidden="true">✓</span>
                <span>Tuần này lớp của bạn không có khu vực trực nhật trên bản đồ.</span>
              </div>
            )}
          </div>

          <div className="c mapc g-map">
            {!data ? <div className="empty">Đang tải bản đồ…</div> : (
              <DutyMap svgRef={svgRef} zones={zones} labels={labels} mine={mineZones} selectedId={selectedId} onSelect={(id) => setSelectedId(id === selectedId ? null : id)} />
            )}
            {selZone && (
              <div className="zinfo">
                <b>{selZone.name}</b>: {(labels[selZone.id] || []).length ? `lớp ${(labels[selZone.id] || []).join(', ')} trực.` : 'tuần này chưa có lớp trực.'}
              </div>
            )}
            {data && (
              <div className="tools">
                <button className="btn" onClick={() => printDutyMap(svgRef.current, `Sơ đồ phân công trực nhật · Tuần ${weekNo}`, zones.filter((z) => (labels[z.id] || []).length).map((z) => ({ zone: z.name, classes: labels[z.id].join(', ') })))}>🖨️ In sơ đồ</button>
              </div>
            )}
          </div>

          {data && usedZones.length > 0 && (
            <div className="c g-legend">
              <h2 className="h">Khu vực và lớp trực</h2>
              <div className="legend">
                {usedZones.map((z) => (
                  <button key={z.id} className={`lg ${z.id === selectedId ? 'on' : ''} ${mineZones.has(z.id) ? 'mine' : ''}`} onClick={() => setSelectedId(z.id === selectedId ? null : z.id)}>
                    <i style={{ background: z.color }} />
                    <span><b>{z.name}</b> <em>{(labels[z.id] || []).join(', ')}</em></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {data && (
            <div className="c g-list">
              <h2 className="h">Các lớp trực tuần {weekNo}</h2>
              {classRows.length === 0 ? <div className="empty">Tuần này chưa có lớp nào được phân công.</div> : (
                <div className="cards">
                  {classRows.map((c) => (
                    <div key={c.id} className={`cc ${mineIds.has(c.id) ? 'mine' : ''}`} style={{ borderLeftColor: c.zones[0]?.color || '#dbe3ec' }}>
                      <b>Lớp {c.name}</b>
                      {c.zones.map((z) => <span key={z.id}>{z.name}</span>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
