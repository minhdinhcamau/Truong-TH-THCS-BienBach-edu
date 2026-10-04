'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useSchoolWeeks } from '@/lib/useSchoolWeeks';
import { TPT_NAV } from '@/lib/nav';
import { fmtDate } from '@/lib/dates';
import AppShell, { Toast } from '@/components/AppShell';
import DutyMap, { centerOf, parsePts, printDutyMap, ptsToStr } from '@/components/DutyMap';
import { autoAssign } from '@/lib/dutyAssign';

// Trang /tpt/truc-nhat - Bản đồ phân công trực nhật.
//   - Khu vực và phân công lưu trong database (bảng duty_map_*), không còn lưu trong trình duyệt, không còn iframe.
//   - Kéo các điểm của khu vực để chỉnh hình; chạm dấu + giữa hai điểm để thêm điểm.
//   - "Tự phân công theo xếp hạng": lớp điểm thấp được phân trước, không trùng khu vực tuần trước.
//   - "Công bố" để học sinh và giáo viên chủ nhiệm xem được bản đồ của tuần đó.

const PALETTE = ['#e11d48', '#0d9488', '#9333ea', '#ca8a04', '#2563eb', '#ea580c', '#16a34a', '#db2777'];
const TOTAL_FALLBACK = 35;

export default function TptTrucNhatPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const sw = useSchoolWeeks();
  const totalWeeks = sw.weeks.length || TOTAL_FALLBACK;

  const [weekNo, setWeekNo] = useState(null);
  const [classes, setClasses] = useState([]);
  const [zones, setZones] = useState([]); // [{id,name,color,points,x,y}]
  const [assign, setAssign] = useState({}); // { zoneId: [classId] }
  const [published, setPublished] = useState(false);
  const [dirtyZ, setDirtyZ] = useState(false);
  const [dirtyA, setDirtyA] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [shapeEdit, setShapeEdit] = useState(false);
  const [selVertex, setSelVertex] = useState(null);
  const [drawing, setDrawing] = useState(null); // mảng điểm khi đang vẽ khu vực mới
  const [redrawId, setRedrawId] = useState(null);
  const [newName, setNewName] = useState('');
  const [pendingShape, setPendingShape] = useState(null);

  const [rankWeek, setRankWeek] = useState(1);
  const [perZone, setPerZone] = useState(1);
  const [autoNote, setAutoNote] = useState(null);
  const [showWeekGrid, setShowWeekGrid] = useState(false);

  const svgRef = useRef(null);
  const fileRef = useRef(null);

  const dirty = dirtyZ || dirtyA;
  const weekInfo = sw.weeks.find((w) => w.week_no === weekNo);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const grades = useMemo(() => {
    const m = new Map();
    classes.forEach((c) => {
      const g = c.grade ?? 0;
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(c);
    });
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]).map(([g, list]) => [g, list.sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))]);
  }, [classes]);

  const labels = useMemo(() => {
    const o = {};
    Object.entries(assign).forEach(([zid, ids]) => {
      o[zid] = ids.map((id) => classById.get(id)?.name).filter(Boolean);
    });
    return o;
  }, [assign, classById]);

  const zonesOfClass = useCallback((cid) => zones.filter((z) => (assign[z.id] || []).includes(cid)), [zones, assign]);
  const assignedClassCount = useMemo(() => new Set(Object.values(assign).flat()).size, [assign]);
  const zoneCount = useMemo(() => zones.filter((z) => (assign[z.id] || []).length > 0).length, [zones, assign]);
  const sel = zones.find((z) => z.id === selectedId) || null;

  // ----- Tải dữ liệu -----
  const loadWeek = useCallback(async (w) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('duty_map_get', { p_week_no: w });
    if (error) {
      setMsg({ type: 'error', text: error.message });
      setLoading(false);
      return;
    }
    setZones((data.zones || []).map((z) => ({ id: z.id, name: z.name, color: z.color, points: z.points, x: z.x, y: z.y })));
    const a = {};
    (data.assign || []).forEach((r) => { (a[r.zone_id] = a[r.zone_id] || []).push(r.class_id); });
    setAssign(a);
    setPublished(!!data.published);
    setDirtyZ(false);
    setDirtyA(false);
    setAutoNote(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    supabase.from('classes').select('id, name, grade').order('name').then(({ data }) => setClasses(data || []));
  }, [ready]);

  // Tuần đầu tiên: tuần hiện tại theo lịch năm học (nếu chưa có lịch thì tuần 1)
  useEffect(() => {
    if (!ready || !sw.loaded || weekNo !== null) return;
    setWeekNo(sw.currentNo || 1);
  }, [ready, sw.loaded, sw.currentNo, weekNo]);

  useEffect(() => {
    if (!ready || weekNo === null) return;
    loadWeek(weekNo);
    setRankWeek(Math.max(1, weekNo - 1));
  }, [ready, weekNo, loadWeek]);

  function goWeek(w) {
    const n = Math.max(1, Math.min(totalWeeks, w));
    if (n === weekNo) return;
    if (dirty && !window.confirm('Có thay đổi chưa lưu. Chuyển tuần sẽ mất các thay đổi đó. Tiếp tục?')) return;
    setSelectedId(null);
    setShapeEdit(false);
    setDrawing(null);
    setWeekNo(n);
  }

  // ----- Lưu / công bố -----
  async function saveAll() {
    setBusy(true);
    try {
      if (dirtyZ) {
        const { error } = await supabase.rpc('duty_map_save_zones', {
          p_zones: zones.map((z) => ({ id: z.id, name: z.name, color: z.color, points: z.points, x: z.x, y: z.y })),
        });
        if (error) throw error;
      }
      if (dirtyA || dirtyZ) {
        const { error } = await supabase.rpc('duty_map_save_week', {
          p_week_no: weekNo,
          p_assign: zones.map((z) => ({ zone_id: z.id, class_ids: assign[z.id] || [] })).filter((r) => r.class_ids.length),
        });
        if (error) throw error;
      }
      setDirtyZ(false);
      setDirtyA(false);
      setMsg({ type: 'ok', text: `Đã lưu bản đồ tuần ${weekNo}.` });
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Chưa lưu được.' });
    }
    setBusy(false);
  }

  async function togglePublish() {
    if (dirty) {
      setMsg({ type: 'error', text: 'Hãy bấm Lưu trước khi công bố.' });
      return;
    }
    const next = !published;
    if (next && assignedClassCount === 0 && !window.confirm('Tuần này chưa phân công lớp nào. Vẫn công bố?')) return;
    if (!next && !window.confirm('Hủy công bố: học sinh và giáo viên sẽ không còn thấy bản đồ tuần này. Tiếp tục?')) return;
    setBusy(true);
    const { error } = await supabase.rpc('duty_map_publish', { p_week_no: weekNo, p_publish: next });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    setPublished(next);
    setMsg({ type: 'ok', text: next ? `Đã công bố tuần ${weekNo}: học sinh và giáo viên chủ nhiệm xem được bản đồ.` : `Đã hủy công bố tuần ${weekNo}.` });
  }

  // ----- Phân công -----
  function toggleClass(zoneId, classId) {
    setAssign((a) => {
      const cur = a[zoneId] || [];
      const next = cur.includes(classId) ? cur.filter((x) => x !== classId) : [...cur, classId];
      return { ...a, [zoneId]: next };
    });
    setDirtyA(true);
  }

  function clearWeek() {
    if (!window.confirm(`Xóa toàn bộ phân công của tuần ${weekNo}?`)) return;
    setAssign({});
    setDirtyA(true);
    setAutoNote(null);
  }

  async function copyPrevWeek() {
    if (weekNo <= 1) return;
    const { data, error } = await supabase.rpc('duty_map_assign_range', { p_from: weekNo - 1, p_to: weekNo - 1 });
    if (error) {
      setMsg({ type: 'error', text: error.message });
      return;
    }
    if (!data || !data.length) {
      setMsg({ type: 'error', text: `Tuần ${weekNo - 1} chưa có phân công để chép.` });
      return;
    }
    if (Object.keys(assign).length && !window.confirm('Chép phân công tuần trước sẽ thay phân công hiện tại. Tiếp tục?')) return;
    const a = {};
    data.forEach((r) => { if (zones.some((z) => z.id === r.zone_id)) (a[r.zone_id] = a[r.zone_id] || []).push(r.class_id); });
    setAssign(a);
    setDirtyA(true);
    setAutoNote(null);
  }

  async function runAuto() {
    if (zones.length === 0) {
      setMsg({ type: 'error', text: 'Chưa có khu vực nào. Hãy vẽ khu vực trước.' });
      return;
    }
    if (Object.keys(assign).length && !window.confirm('Tự phân công sẽ thay phân công hiện tại của tuần này. Tiếp tục?')) return;
    setBusy(true);
    const ref = sw.weeks.find((w) => w.week_no === rankWeek);
    const [lb, hist] = await Promise.all([
      supabase.rpc('get_class_leaderboard', ref ? { p_week_start: String(ref.week_start) } : {}),
      supabase.rpc('duty_map_assign_range', { p_from: Math.max(1, weekNo - 12), p_to: weekNo - 1 }),
    ]);
    setBusy(false);
    if (lb.error) { setMsg({ type: 'error', text: lb.error.message }); return; }
    if (hist.error) { setMsg({ type: 'error', text: hist.error.message }); return; }
    const ranking = (lb.data || []).map((r) => ({ class_id: r.class_id, class_name: r.class_name, total_score: r.total_score, violation_count: r.violation_count }));
    if (!ranking.length) { setMsg({ type: 'error', text: 'Chưa có dữ liệu xếp hạng để phân công.' }); return; }
    const res = autoAssign({ ranking, zones, history: hist.data || [], weekNo, perZone });
    setAssign(res.assign);
    setDirtyA(true);
    const name = (id) => ranking.find((r) => r.class_id === id)?.class_name || '';
    setAutoNote({
      picked: res.picked.map(name),
      skipped: res.skipped.map(name),
      repeats: res.repeats.map(name),
      rankWeek,
      noHistory: !(hist.data || []).length && weekNo > 1,
    });
  }

  // ----- Khu vực -----
  function patchZone(id, patch) {
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)));
    setDirtyZ(true);
  }

  function onVertexMove(zid, idx, pt) {
    setZones((zs) => zs.map((z) => {
      if (z.id !== zid) return z;
      const pts = parsePts(z.points);
      if (!pts[idx]) return z;
      pts[idx] = pt;
      const [x, y] = centerOf(pts);
      return { ...z, points: ptsToStr(pts), x, y };
    }));
    setDirtyZ(true);
  }
  function onVertexInsert(zid, idx, pt) {
    setZones((zs) => zs.map((z) => {
      if (z.id !== zid) return z;
      const pts = parsePts(z.points);
      pts.splice(idx, 0, pt);
      return { ...z, points: ptsToStr(pts) };
    }));
    setSelVertex(idx);
    setDirtyZ(true);
  }
  function removeVertex() {
    if (!sel || selVertex === null) return;
    const pts = parsePts(sel.points);
    if (pts.length <= 3) {
      setMsg({ type: 'error', text: 'Khu vực cần ít nhất 3 điểm.' });
      return;
    }
    pts.splice(selVertex, 1);
    const [x, y] = centerOf(pts);
    patchZone(sel.id, { points: ptsToStr(pts), x, y });
    setSelVertex(null);
  }

  function startDraw(redrawZoneId = null) {
    setRedrawId(redrawZoneId);
    setSelectedId(null);
    setShapeEdit(false);
    setPendingShape(null);
    setDrawing([]);
    svgRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }
  function finishDraw() {
    if (!drawing || drawing.length < 3) {
      setMsg({ type: 'error', text: 'Cần ít nhất 3 điểm để tạo khu vực.' });
      return;
    }
    if (redrawId) {
      const [x, y] = centerOf(drawing);
      patchZone(redrawId, { points: ptsToStr(drawing), x, y });
      setSelectedId(redrawId);
      setShapeEdit(true);
      setRedrawId(null);
      setDrawing(null);
      return;
    }
    setPendingShape(drawing);
    setDrawing(null);
    setNewName('');
  }
  function saveNewZone() {
    if (!pendingShape) return;
    const [x, y] = centerOf(pendingShape);
    const id = `u${Date.now()}`;
    const z = { id, name: newName.trim() || `Khu vực ${zones.length + 1}`, color: PALETTE[zones.length % PALETTE.length], points: ptsToStr(pendingShape), x, y };
    setZones((zs) => [...zs, z]);
    setDirtyZ(true);
    setPendingShape(null);
    setSelectedId(id);
    setShapeEdit(false);
  }
  function deleteZone() {
    if (!sel) return;
    if (!window.confirm(`Xóa khu vực "${sel.name}"? Phân công của khu vực này ở mọi tuần cũng bị xóa (sau khi bấm Lưu).`)) return;
    setZones((zs) => zs.filter((z) => z.id !== sel.id));
    setAssign((a) => { const n = { ...a }; delete n[sel.id]; return n; });
    setDirtyZ(true);
    setDirtyA(true);
    setSelectedId(null);
    setShapeEdit(false);
  }
  function moveZone(dir) {
    if (!sel) return;
    setZones((zs) => {
      const i = zs.findIndex((z) => z.id === sel.id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= zs.length) return zs;
      const c = zs.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
    setDirtyZ(true);
  }

  function selectZone(id) {
    if (drawing) return;
    setSelectedId(id === selectedId ? null : id);
    setShapeEdit(false);
    setSelVertex(null);
  }

  // ----- Nạp dữ liệu từ bản cũ (lưu trong trình duyệt hoặc file sao lưu) -----
  async function importOld(obj) {
    try {
      const oldZones = Array.isArray(obj?.l) ? obj.l : [];
      const oldData = obj?.d && typeof obj.d === 'object' ? obj.d : {};
      if (!oldZones.length && !Object.keys(oldData).length) {
        setMsg({ type: 'error', text: 'Không thấy dữ liệu khu vực hoặc phân công trong nguồn này.' });
        return;
      }
      const okZones = oldZones.filter((z) => z && z.id && z.p && parsePts(z.p).length >= 3);
      const weeksN = Object.keys(oldData).filter((w) => Object.values(oldData[w] || {}).some((arr) => Array.isArray(arr) && arr.length)).length;
      if (!window.confirm(`Nạp ${okZones.length} khu vực và phân công của ${weeksN} tuần từ bản cũ?\nKhu vực hiện có trong hệ thống sẽ được thay bằng danh sách này.`)) return;
      setBusy(true);
      const zs = okZones.map((z, i) => {
        const pts = parsePts(z.p);
        const [cx, cy] = centerOf(pts);
        return { id: String(z.id), name: z.n || `Khu vực ${i + 1}`, color: /^#[0-9a-fA-F]{6}$/.test(z.c || '') ? z.c : PALETTE[i % PALETTE.length], points: ptsToStr(pts), x: Number.isFinite(+z.x) ? +z.x : cx, y: Number.isFinite(+z.y) ? +z.y : cy };
      });
      const r1 = await supabase.rpc('duty_map_save_zones', { p_zones: zs });
      if (r1.error) throw r1.error;
      const byName = new Map(classes.map((c) => [c.name, c.id]));
      let missing = 0;
      for (const w of Object.keys(oldData)) {
        const n = Number(w);
        if (!(n >= 1 && n <= 60)) continue;
        const rows = [];
        Object.entries(oldData[w] || {}).forEach(([zid, arr]) => {
          if (!Array.isArray(arr) || !zs.some((z) => z.id === zid)) return;
          const ids = arr.map((nm) => { const id = byName.get(nm); if (!id) missing += 1; return id; }).filter(Boolean);
          if (ids.length) rows.push({ zone_id: zid, class_ids: ids });
        });
        if (rows.length) {
          const r2 = await supabase.rpc('duty_map_save_week', { p_week_no: n, p_assign: rows });
          if (r2.error) throw r2.error;
        }
      }
      setMsg({ type: 'ok', text: `Đã nạp ${zs.length} khu vực và ${weeksN} tuần phân công${missing ? ` (bỏ qua ${missing} tên lớp không còn trong hệ thống)` : ''}.` });
      await loadWeek(weekNo);
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Không nạp được dữ liệu cũ.' });
    }
    setBusy(false);
  }
  function importFromBrowser() {
    let raw = null;
    try { raw = localStorage.getItem('tn_v1'); } catch (e) { raw = null; }
    if (!raw) {
      setMsg({ type: 'error', text: 'Trình duyệt này không có dữ liệu bản đồ cũ. Hãy mở trang bằng máy trước đây hay dùng, hoặc chọn file sao lưu .json.' });
      return;
    }
    try { importOld(JSON.parse(raw)); } catch (e) { setMsg({ type: 'error', text: 'Dữ liệu cũ trong trình duyệt bị lỗi.' }); }
  }
  function importFromFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { importOld(JSON.parse(String(r.result))); } catch (x) { setMsg({ type: 'error', text: 'File không hợp lệ.' }); } };
    r.readAsText(f);
  }

  function doPrint() {
    printDutyMap(
      svgRef.current,
      `Sơ đồ phân công trực nhật · Tuần ${weekNo}${weekInfo ? ` (${fmtDate(String(weekInfo.week_start))} – ${fmtDate(String(weekInfo.week_end))})` : ''}`,
      zones.filter((z) => (labels[z.id] || []).length).map((z) => ({ zone: z.name, classes: labels[z.id].join(', ') }))
    );
  }

  if (!ready || weekNo === null) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  const rankOptions = Array.from({ length: totalWeeks }, (_, i) => i + 1).filter((n) => n <= (sw.currentNo || totalWeeks));

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/truc-nhat" onLogout={logout}>
      <style jsx global>{`
        .dm-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
        @media (min-width: 980px) { .dm-grid { grid-template-columns: minmax(0, 1.45fr) minmax(340px, 1fr); align-items: start; } .dm-sticky { position: sticky; top: 12px; } }
        .dm-week { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .dm-wt { flex: 1; min-width: 190px; text-align: center; }
        .dm-wt b { font-size: 20px; display: block; line-height: 1.2; }
        .dm-wt span { font-size: 12.5px; color: var(--muted); }
        .dm-nav { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: #fff; font-size: 22px; cursor: pointer; }
        .dm-nav:disabled { opacity: .35; cursor: default; }
        .dm-wgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(42px, 1fr)); gap: 6px; margin-top: 12px; }
        .dm-wgrid button { height: 36px; border-radius: 10px; border: 1px solid var(--line); background: #fff; cursor: pointer; font-weight: 600; }
        .dm-wgrid button.on { background: var(--red); border-color: var(--red); color: #fff; }
        .dm-wgrid button.cur { border-color: var(--red); }
        .dm-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
        .dm-stats div { background: #f3f5f8; border-radius: 12px; padding: 8px; text-align: center; }
        .dm-stats b { display: block; font-size: 20px; }
        .dm-stats span { font-size: 12px; color: var(--muted); }
        .dm-tools { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }
        .dm-kh { font-size: 12.5px; font-weight: 700; color: var(--muted); margin: 14px 2px 6px; text-transform: uppercase; letter-spacing: .4px; }
        .dm-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
        .dm-cc { border: 1px solid var(--line); border-top: 4px solid var(--line); border-radius: 12px; padding: 8px 6px; text-align: center; min-height: 64px; background: #fff; }
        .dm-cc b { display: block; font-size: 16px; }
        .dm-cc .zn { display: block; font-size: 12px; font-weight: 600; margin-top: 3px; line-height: 1.25; }
        .dm-cc.e { background: #f6f7f9; color: var(--muted); }
        .dm-cc.e .zn { font-weight: 400; }
        .dm-zl { display: flex; flex-wrap: wrap; gap: 6px; }
        .dm-zc { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 8px 12px; cursor: pointer; font-size: 13px; min-height: 40px; }
        .dm-zc i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
        .dm-zc.on { outline: 2px solid var(--red); font-weight: 700; }
        .dm-kg { display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); gap: 8px; margin-top: 6px; }
        .dm-cb { font: inherit; font-weight: 700; height: 42px; border: 1px solid var(--line); background: #fff; border-radius: 10px; cursor: pointer; }
        .dm-sw { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
        .dm-sw button { width: 34px; height: 34px; border-radius: 10px; border: 3px solid #fff; box-shadow: 0 0 0 1px var(--line); cursor: pointer; }
        .dm-sw button.on { box-shadow: 0 0 0 3px var(--ink); }
        .dm-note { font-size: 13px; background: #f3f8ff; border: 1px solid #cfe0fa; border-radius: 12px; padding: 10px 12px; margin-top: 10px; line-height: 1.5; }
        .dm-note.warn { background: #fff7e6; border-color: #f0d28a; }
        .dm-draw { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; font-size: 13.5px; }
        .dm-ok { color: #15803d; font-weight: 700; }
      `}</style>

      <h1 className="pg-title">Trực nhật</h1>
      <p className="pg-sub">Vẽ khu vực trên bản đồ trường, phân công lớp trực theo tuần (tự động theo xếp hạng Sao đỏ hoặc tự chọn), rồi công bố cho học sinh và giáo viên chủ nhiệm xem.</p>

      <div className="card">
        <div className="dm-week">
          <button className="dm-nav" onClick={() => goWeek(weekNo - 1)} disabled={weekNo <= 1} aria-label="Tuần trước">‹</button>
          <div className="dm-wt">
            <b>Tuần {weekNo}{sw.currentNo === weekNo ? ' · hiện tại' : ''}</b>
            <span>{weekInfo ? `${fmtDate(String(weekInfo.week_start))} – ${fmtDate(String(weekInfo.week_end))}` : 'Chưa có lịch năm học'}</span>
          </div>
          <button className="dm-nav" onClick={() => goWeek(weekNo + 1)} disabled={weekNo >= totalWeeks} aria-label="Tuần sau">›</button>
        </div>
        <div className="dm-tools" style={{ justifyContent: 'center' }}>
          {sw.currentNo && sw.currentNo !== weekNo && <button className="btn btn-sm" onClick={() => goWeek(sw.currentNo)}>↩ Về tuần hiện tại</button>}
          <button className="btn btn-sm" onClick={() => setShowWeekGrid((v) => !v)}>{showWeekGrid ? '✕ Đóng' : 'Chọn tuần khác'}</button>
          <span className={`pill ${published ? 'ok' : 'mute'}`}>{published ? 'Đã công bố' : 'Chưa công bố'}</span>
          {dirty && <span className="pill warn">Chưa lưu</span>}
        </div>
        {showWeekGrid && (
          <div className="dm-wgrid">
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((n) => (
              <button key={n} className={`${n === weekNo ? 'on' : ''} ${n === sw.currentNo ? 'cur' : ''}`} onClick={() => { goWeek(n); setShowWeekGrid(false); }}>{n}</button>
            ))}
          </div>
        )}
        <div className="dm-stats">
          <div><b>{zoneCount}/{zones.length}</b><span>Khu vực có lớp trực</span></div>
          <div><b>{assignedClassCount}/{classes.length}</b><span>Lớp đã phân công</span></div>
        </div>
        <div className="dm-tools" style={{ justifyContent: 'center' }}>
          <button className="btn btn-red" disabled={busy || !dirty} onClick={saveAll}>{busy ? 'Đang lưu…' : '💾 Lưu'}</button>
          <button className="btn" disabled={busy} onClick={togglePublish}>{published ? 'Hủy công bố' : '📢 Công bố cho học sinh và giáo viên'}</button>
          <button className="btn" onClick={doPrint}>🖨️ In sơ đồ</button>
        </div>
      </div>

      <div className="dm-grid" style={{ marginTop: 14 }}>
        <div>
          <div className="card" style={{ padding: 12 }}>
            {loading ? (
              <div className="empty">Đang tải bản đồ…</div>
            ) : (
              <DutyMap
                svgRef={svgRef}
                zones={zones}
                labels={labels}
                selectedId={selectedId}
                onSelect={selectZone}
                edit
                showEmpty
                editShapeId={shapeEdit ? selectedId : null}
                onVertexMove={onVertexMove}
                onVertexInsert={onVertexInsert}
                selVertex={selVertex}
                onSelVertex={setSelVertex}
                drawing={drawing}
                onDrawPoint={(pt) => setDrawing((d) => (d ? [...d, pt] : d))}
              />
            )}

            {drawing ? (
              <div className="dm-draw">
                <span>{redrawId ? 'Vẽ lại hình: chạm các điểm mới trên bản đồ' : 'Chạm lên bản đồ để đặt các điểm của khu vực'} · <b>{drawing.length}</b> điểm</span>
                <button className="btn btn-sm btn-red" onClick={finishDraw}>✔ Xong</button>
                <button className="btn btn-sm" onClick={() => setDrawing((d) => d.slice(0, -1))} disabled={!drawing.length}>↶ Bỏ điểm</button>
                <button className="btn btn-sm" onClick={() => { setDrawing(null); setRedrawId(null); }}>Hủy</button>
              </div>
            ) : pendingShape ? (
              <div className="dm-draw">
                <input className="input" style={{ maxWidth: 260 }} value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} placeholder="Tên khu vực, VD: Hành lang dãy trái" autoFocus />
                <button className="btn btn-sm btn-red" onClick={saveNewZone}>Thêm khu vực</button>
                <button className="btn btn-sm" onClick={() => setPendingShape(null)}>Hủy</button>
              </div>
            ) : (
              <div className="dm-tools">
                <button className="btn btn-sm btn-red" onClick={() => startDraw()}>✏️ Vẽ khu vực mới</button>
                <span className="hint" style={{ margin: 0 }}>Chạm vào khu vực trên bản đồ để chọn lớp trực hoặc chỉnh hình.</span>
              </div>
            )}
          </div>

          {zones.length === 0 && !loading && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Chưa có khu vực nào</h3>
              <p className="hint">Bấm “Vẽ khu vực mới” để khoanh vùng trên bản đồ. Nếu trước đây bạn đã vẽ khu vực bằng công cụ cũ, bấm nút dưới để chuyển dữ liệu đó vào hệ thống.</p>
              <div className="dm-tools">
                <button className="btn" disabled={busy} onClick={importFromBrowser}>📥 Nạp dữ liệu cũ từ trình duyệt này</button>
                <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>📂 Chọn file sao lưu (.json)</button>
                <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFromFile} />
              </div>
            </div>
          )}
        </div>

        <div className="dm-sticky">
          {sel && (
            <div className="card" style={{ borderColor: sel.color }}>
              <div className="card-h"><h3><span style={{ color: sel.color }}>●</span> {sel.name}</h3><button className="btn btn-sm" onClick={() => { setSelectedId(null); setShapeEdit(false); }}>Xong</button></div>

              <div className="dm-kh" style={{ marginTop: 0 }}>Lớp trực tuần {weekNo}</div>
              {grades.map(([g, list]) => (
                <div key={g} className="dm-kg">
                  {list.map((c) => {
                    const on = (assign[sel.id] || []).includes(c.id);
                    const other = !on && zones.some((z) => z.id !== sel.id && (assign[z.id] || []).includes(c.id));
                    return (
                      <button key={c.id} className="dm-cb" style={on ? { background: sel.color, color: '#fff', borderColor: sel.color } : other ? { opacity: 0.55 } : undefined} onClick={() => toggleClass(sel.id, c.id)} title={other ? 'Lớp này đang trực khu vực khác' : ''}>{c.name}</button>
                    );
                  })}
                </div>
              ))}

              <div className="dm-kh">Hình và tên khu vực</div>
              <label className="lbl" htmlFor="zn" style={{ marginTop: 0 }}>Tên khu vực</label>
              <input id="zn" className="input" maxLength={40} value={sel.name} onChange={(e) => patchZone(sel.id, { name: e.target.value })} />
              <div className="lbl">Màu</div>
              <div className="dm-sw">
                {PALETTE.map((c) => <button key={c} style={{ background: c }} className={sel.color === c ? 'on' : ''} onClick={() => patchZone(sel.id, { color: c })} aria-label={`Màu ${c}`} />)}
              </div>
              <div className="dm-tools">
                <button className={`btn btn-sm ${shapeEdit ? 'btn-red' : ''}`} onClick={() => { setShapeEdit((v) => !v); setSelVertex(null); }}>{shapeEdit ? '✔ Xong chỉnh hình' : '🔧 Chỉnh hình (kéo điểm)'}</button>
                <button className="btn btn-sm" onClick={() => startDraw(sel.id)}>✏️ Vẽ lại hình</button>
                <button className="btn btn-sm" onClick={() => moveZone(-1)} aria-label="Lên trước">↑</button>
                <button className="btn btn-sm" onClick={() => moveZone(1)} aria-label="Xuống sau">↓</button>
                <button className="btn btn-sm btn-danger" onClick={deleteZone}>🗑 Xóa khu vực</button>
              </div>
              {shapeEdit && (
                <div className="dm-note">
                  Kéo các chấm cam để chỉnh hình. Chạm dấu <b>+</b> giữa hai điểm để thêm điểm mới.
                  {selVertex !== null && <> Đang chọn điểm {selVertex + 1}: <button className="btn btn-sm btn-danger" style={{ marginLeft: 6 }} onClick={removeVertex}>Xóa điểm này</button></>}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="card-h"><h3>Phân công</h3></div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
              <div>
                <label className="lbl" htmlFor="rk" style={{ marginTop: 0 }}>Lấy xếp hạng của tuần</label>
                <select id="rk" className="input" style={{ width: 120 }} value={rankWeek} onChange={(e) => setRankWeek(Number(e.target.value))}>
                  {(rankOptions.length ? rankOptions : [1]).map((n) => <option key={n} value={n}>Tuần {n}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="pz" style={{ marginTop: 0 }}>Số lớp / khu vực</label>
                <select id="pz" className="input" style={{ width: 90 }} value={perZone} onChange={(e) => setPerZone(Number(e.target.value))}>
                  {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="dm-tools">
              <button className="btn btn-red" disabled={busy || zones.length === 0} onClick={runAuto}>⚡ Tự phân công theo xếp hạng</button>
              {weekNo > 1 && <button className="btn btn-sm" onClick={copyPrevWeek}>📋 Chép tuần trước</button>}
              {assignedClassCount > 0 && <button className="btn btn-sm btn-danger" onClick={clearWeek}>🗑 Xóa phân công tuần</button>}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Lớp điểm thấp được phân trước, đủ khu vực thì dừng; lớp không trực lại khu vực của tuần trước. Sau khi tự phân, vẫn bấm vào khu vực để đổi lớp cho đúng ý rồi bấm Lưu.</p>
            {autoNote && (
              <div className={`dm-note ${autoNote.repeats.length || autoNote.noHistory ? 'warn' : ''}`}>
                Đã phân <b>{autoNote.picked.length}</b> lớp điểm thấp nhất (theo xếp hạng tuần {autoNote.rankWeek}): {autoNote.picked.join(', ')}.
                {autoNote.skipped.length > 0 && <> Chưa có khu vực cho: {autoNote.skipped.join(', ')}.</>}
                {autoNote.repeats.length > 0 && <> <b>Lưu ý:</b> {autoNote.repeats.join(', ')} phải trực lại khu vực tuần trước vì không còn chỗ khác.</>}
                {autoNote.noHistory && <> Tuần trước chưa có phân công nào lưu trong hệ thống nên chưa kiểm tra được việc trùng khu vực.</>}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-h"><h3>Khu vực</h3></div>
            {zones.length === 0 ? <div className="empty">Chưa có khu vực.</div> : (
              <div className="dm-zl">
                {zones.map((z) => (
                  <button key={z.id} className={`dm-zc ${z.id === selectedId ? 'on' : ''}`} onClick={() => selectZone(z.id)}>
                    <i style={{ background: z.color }} />{z.name}{(labels[z.id] || []).length > 0 && <span className="hint" style={{ margin: 0 }}>· {(labels[z.id] || []).join(', ')}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-h"><h3>Phân công theo lớp</h3></div>
            {grades.map(([g, list]) => (
              <div key={g}>
                <div className="dm-kh" style={{ marginTop: 6 }}>{g ? `Khối ${g}` : 'Lớp'}</div>
                <div className="dm-cards">
                  {list.map((c) => {
                    const zs = zonesOfClass(c.id);
                    return zs.length ? (
                      <div key={c.id} className="dm-cc" style={{ borderTopColor: zs[0].color }}>
                        <b>{c.name}</b>
                        {zs.map((z) => <span key={z.id} className="zn" onClick={() => selectZone(z.id)} style={{ cursor: 'pointer' }}><i style={{ color: z.color, fontStyle: 'normal' }}>●</i> {z.name}</span>)}
                      </div>
                    ) : (
                      <div key={c.id} className="dm-cc e"><b>{c.name}</b><span className="zn">Chưa phân công</span></div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {zones.length > 0 && (
            <details className="card">
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Nạp dữ liệu từ bản cũ</summary>
              <p className="hint">Chỉ dùng khi cần chuyển dữ liệu từ công cụ bản đồ cũ. Khu vực hiện có sẽ được thay bằng danh sách trong bản cũ.</p>
              <div className="dm-tools">
                <button className="btn btn-sm" disabled={busy} onClick={importFromBrowser}>📥 Từ trình duyệt này</button>
                <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>📂 Từ file sao lưu</button>
                <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFromFile} />
              </div>
            </details>
          )}
        </div>
      </div>

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
