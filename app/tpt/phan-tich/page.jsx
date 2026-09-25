'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import { addDays, fmtDate, vnTodayIso } from '@/lib/dates';
import { norm } from '@/lib/tkb';
import AppShell, { Toast } from '@/components/AppShell';
import { BarChart, COLORS, Donut, Heatmap, LineChart, RankBars } from '@/components/tpt/Charts';

// Trang /tpt/phan-tich — phân tích thi đua theo tuần / tháng / giữa kì / cuối kì / cả năm,
// biểu đồ toàn trường + từng lớp, và nút nhờ AI đề xuất giải pháp cụ thể.

const PERIODS = [
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'mid1', label: 'Giữa HK1' },
  { key: 'hk1', label: 'Cuối HK1' },
  { key: 'mid2', label: 'Giữa HK2' },
  { key: 'hk2', label: 'Cuối HK2' },
  { key: 'year', label: 'Cả năm' },
];

const GROUP_COLOR = {
  'Vệ sinh': '#c4262e',
  'Chuyên cần': '#f4b73d',
  'Đồng phục & tác phong': '#2f6fb0',
  'Trật tự & kỷ luật': '#1a8a58',
  'Nề nếp khác': '#8a5cc2',
  'Học tập (xếp loại giờ)': '#e07b39',
};

const AI_ICON = { toan_truong: '🏫', lop: '👥', ve_sinh: '🧹', ne_nep: '📋', hoc_tap: '📖', khac: '💡' };
const DOW_LABEL = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'CN' };

// Gộp các lỗi cụ thể thành nhóm vấn đề để nhìn tổng quát (dựa vào tên lỗi)
function groupOf(label, category) {
  if (category === 'hoc_tap') return 'Học tập (xếp loại giờ)';
  const n = norm(label);
  if (/ve sinh|rac|truc nhat|bao ban/.test(n)) return 'Vệ sinh';
  if (/muon|vang|nghi hoc|chuyen can|bo tiet|tre gio/.test(n)) return 'Chuyên cần';
  if (/dong phuc|khan|ao |quan|tac phong|giay|dep|toc/.test(n)) return 'Đồng phục & tác phong';
  if (/noi chuyen|on ao|mat trat tu|chay nhay|dua|danh nhau|chui|noi tuc|dien thoai/.test(n)) return 'Trật tự & kỷ luật';
  return 'Nề nếp khác';
}

const round2 = (n) => (n == null ? null : Math.round(Number(n) * 100) / 100);
const fmt = (n, d = 1) => (n == null ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: d }));

function resolveRange(kind, sel, cal, weeks) {
  if (!cal || weeks.length === 0) return null;
  const byNo = (n) => weeks.find((w) => w.week_no === n);
  const span = (a, b, label) => {
    const wa = byNo(a); const wb = byNo(Math.min(b, weeks[weeks.length - 1].week_no));
    if (!wa || !wb) return null;
    return { from: wa.week_start, to: wb.week_end, nWeeks: wb.week_no - wa.week_no + 1, label: `${label} (tuần ${a}–${wb.week_no})` };
  };
  if (kind === 'week') {
    const w = byNo(Number(sel));
    return w ? { from: w.week_start, to: w.week_end, nWeeks: 1, label: `Tuần ${w.week_no} (${fmtDate(w.week_start)} – ${fmtDate(w.week_end)})` } : null;
  }
  if (kind === 'month') {
    const inMonth = weeks.filter((w) => w.week_start.slice(0, 7) === sel);
    if (inMonth.length === 0) return null;
    return {
      from: inMonth[0].week_start, to: inMonth[inMonth.length - 1].week_end, nWeeks: inMonth.length,
      label: `Tháng ${Number(sel.slice(5))}/${sel.slice(0, 4)}`,
    };
  }
  if (kind === 'mid1') return span(1, cal.mid1_week, 'Giữa học kì 1');
  if (kind === 'hk1') return span(1, cal.hk1_end_week, 'Cả học kì 1');
  if (kind === 'mid2') return span(cal.hk1_end_week + 1, cal.mid2_week, 'Giữa học kì 2');
  if (kind === 'hk2') return span(cal.hk1_end_week + 1, cal.total_weeks, 'Cả học kì 2');
  return span(1, cal.total_weeks, `Cả năm học ${cal.school_year}`);
}

function Delta({ cur, prev, lowerBetter = false, digits = 1, suffix = '' }) {
  if (prev == null || cur == null) return <span className="kpi-d muted">Chưa có kỳ trước để so sánh</span>;
  const d = Number(cur) - Number(prev);
  if (Math.abs(d) < 0.005) return <span className="kpi-d muted">Không đổi so với kỳ trước</span>;
  const good = lowerBetter ? d < 0 : d > 0;
  return (
    <span className={`kpi-d ${good ? 'good' : 'bad'}`}>
      {d > 0 ? '▲' : '▼'} {fmt(Math.abs(d), digits)}{suffix} so với kỳ trước
    </span>
  );
}

export default function TptAnalyticsPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const [cal, setCal] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [kind, setKind] = useState('week');
  const [sel, setSel] = useState('');
  const [data, setData] = useState(null);
  const [prev, setPrev] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState('');
  const [ai, setAi] = useState({ busy: false, result: null, error: '', meta: '', focus: '' });
  const [msg, setMsg] = useState(null);
  const reqId = useRef(0);
  const today = vnTodayIso();

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const [c, w] = await Promise.all([supabase.rpc('get_school_calendar'), supabase.rpc('get_school_weeks')]);
      if (c.error || w.error) {
        setMsg({ type: 'error', text: (c.error || w.error).message });
        setLoading(false);
        return;
      }
      const list = w.data || [];
      setCal(c.data?.[0] || null);
      setWeeks(list);
      const started = list.filter((x) => x.week_start <= today);
      const cur = started[started.length - 1] || list[0];
      if (cur) setSel(String(cur.week_no));
      if (!cur) setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const startedWeeks = useMemo(() => weeks.filter((w) => w.week_start <= today), [weeks, today]);
  const months = useMemo(() => Array.from(new Set(startedWeeks.map((w) => w.week_start.slice(0, 7)))), [startedWeeks]);
  const range = useMemo(() => resolveRange(kind, sel, cal, weeks), [kind, sel, cal, weeks]);

  function choosePeriod(k) {
    setKind(k);
    setPick('');
    setAi((a) => ({ ...a, result: null, error: '' }));
    if (k === 'week') {
      const cur = startedWeeks[startedWeeks.length - 1];
      setSel(cur ? String(cur.week_no) : '');
    } else if (k === 'month') {
      setSel(months[months.length - 1] || '');
    } else {
      setSel('');
    }
  }

  const load = useCallback(async (r) => {
    if (!r) {
      setData(null);
      setPrev(null);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const prevTo = addDays(r.from, -1);
    const prevFrom = addDays(r.from, -7 * r.nWeeks);
    const hasPrev = weeks.length > 0 && prevFrom >= weeks[0].week_start;
    const [a, b] = await Promise.all([
      supabase.rpc('tpt_analytics', { p_from: r.from, p_to: r.to }),
      hasPrev ? supabase.rpc('tpt_analytics', { p_from: prevFrom, p_to: prevTo }) : Promise.resolve({ data: null }),
    ]);
    if (id !== reqId.current) return;
    if (a.error) setMsg({ type: 'error', text: a.error.message });
    setData(a.data || null);
    setPrev(b.data && b.data.totals?.week_count > 0 ? b.data : null);
    setLoading(false);
  }, [weeks]);

  useEffect(() => {
    if (ready && range) load(range);
    if (ready && !range && cal) setLoading(false);
  }, [ready, range, load, cal]);

  // ------- số liệu dẫn xuất -------
  const classes = useMemo(() => data?.classes || [], [data]);
  const prevByName = useMemo(() => Object.fromEntries((prev?.classes || []).map((c) => [c.name, c])), [prev]);
  const totals = data?.totals || {};
  const hasData = classes.length > 0 && (totals.week_count || 0) > 0;
  const sortedByName = useMemo(
    () => [...classes].sort((a, b) => (a.grade || 99) - (b.grade || 99) || String(a.name).localeCompare(String(b.name), 'vi', { numeric: true })),
    [classes]
  );
  const weekCols = useMemo(() => (data?.weeks || []).map((w) => (w.week_no ? `T${w.week_no}` : fmtDate(w.week_start).slice(0, -5))), [data]);
  const groups = useMemo(() => {
    const m = new Map();
    (data?.reasons || []).forEach((r) => {
      const g = groupOf(r.label, r.category);
      m.set(g, (m.get(g) || 0) + r.cnt);
    });
    return Array.from(m, ([label, value]) => ({ label, value, color: GROUP_COLOR[label] || '#8a5cc2' })).sort((a, b) => b.value - a.value);
  }, [data]);
  const best = classes[0];
  const worst = classes[classes.length - 1];
  const biggestDrop = useMemo(() => {
    let out = null;
    classes.forEach((c) => {
      const p = prevByName[c.name];
      if (!p) return;
      const d = Number(c.avg_total) - Number(p.avg_total);
      if (d < 0 && (!out || d < out.d)) out = { name: c.name, d };
    });
    return out;
  }, [classes, prevByName]);
  const picked = classes.find((c) => c.name === pick) || null;
  const pickedPrev = picked ? prevByName[picked.name] : null;

  // ------- AI -------
  function buildPayload() {
    const t = totals; const pt = prev?.totals;
    return {
      ky_phan_tich: { ten: range.label, tu_ngay: range.from, den_ngay: range.to, so_tuan: t.week_count, nam_hoc: cal?.school_year },
      toan_truong: {
        diem_tb: t.avg_total, diem_ne_nep: t.avg_ne_nep, diem_hoc_tap: t.avg_hoc_tap,
        tong_diem_bi_tru: t.lost, so_luot_vi_pham: t.violations,
        ky_truoc: pt ? { diem_tb: pt.avg_total, tong_diem_bi_tru: pt.lost, so_luot_vi_pham: pt.violations } : null,
      },
      xu_huong_tuan: (data.weeks || []).map((w) => ({ tuan: w.week_no, diem_tb: w.avg_total, so_luot: w.violations, diem_bi_tru: w.lost })),
      cac_lop: classes.map((c) => {
        const p = prevByName[c.name];
        return {
          lop: c.name, hang: c.rank, diem_tb: c.avg_total,
          chenh_lech_so_voi_ky_truoc: p ? round2(c.avg_total - p.avg_total) : null,
          diem_ne_nep: c.avg_ne_nep, diem_hoc_tap: c.avg_hoc_tap,
          so_luot_vi_pham: c.violations, diem_bi_tru: c.lost,
          loi_hay_gap: (c.top_reasons || []).slice(0, 4).map((r) => ({ muc: r.label, so_lan: r.cnt, nhom: groupOf(r.label, r.category) })),
          chuoi_diem_tuan: c.series,
        };
      }),
      loi_toan_truong: (data.reasons || []).slice(0, 12).map((r) => ({ muc: r.label, so_lan: r.cnt, nhom: groupOf(r.label, r.category) })),
      nhom_van_de: groups.map((g) => ({ nhom: g.label, so_luot: g.value })),
      thu_trong_tuan: (data.weekdays || []).map((d) => ({ thu: DOW_LABEL[d.dow], so_luot: d.cnt })),
    };
  }

  async function runAi(focus) {
    if (!hasData) return;
    setAi({ busy: true, result: null, error: '', meta: '', focus: focus || '' });
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch('/api/ai/tpt-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token}` },
        body: JSON.stringify({ payload: buildPayload(), focus: focus || '' }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 501) throw new Error('Chưa cấu hình khóa AI. Hãy thêm GEMINI_API_KEY (hoặc khóa khác) trong Vercel.');
      if (!res.ok) throw new Error(body.error || 'AI đang bận, hãy thử lại sau ít phút.');
      setAi({ busy: false, result: body.result, error: '', meta: `${body.provider} · ${body.model}`, focus: focus || '' });
    } catch (e) {
      setAi({ busy: false, result: null, error: e.message, meta: '', focus: focus || '' });
    }
  }

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  const weekOptions = [...startedWeeks].reverse();

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/phan-tich" onLogout={logout}>
      <style jsx>{`
        .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .pt-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .pt { border: 1.5px solid var(--line); background: #fff; border-radius: 999px; padding: 7px 15px; font-weight: 700; font-size: 13px; color: var(--muted); cursor: pointer; }
        .pt:hover { border-color: #d5dbe4; color: var(--ink); }
        .pt.on { background: var(--red); border-color: var(--red); color: #fff; }
        .range { font-size: 13.5px; color: var(--muted); margin: 10px 0 0; }
        .range b { color: var(--ink); }
        .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .kpi { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
        .kpi-l { font-size: 12.5px; color: var(--muted); font-weight: 700; }
        .kpi-v { font-family: 'Baloo 2', sans-serif; font-size: 32px; font-weight: 700; line-height: 1.15; }
        .kpi-v small { font-size: 14px; color: var(--muted); font-weight: 600; margin-left: 4px; }
        .kpi-d { font-size: 12.5px; font-weight: 700; display: block; margin-top: 2px; }
        .kpi-d.good { color: var(--ok); }
        .kpi-d.bad { color: var(--bad); }
        .kpi-d.muted { color: var(--muted); font-weight: 600; }
        .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; margin-bottom: 16px; }
        .grid2 :global(.card) { margin-bottom: 0; }
        .sub { font-size: 12.5px; color: var(--muted); margin: -6px 0 8px; }
        .rs { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid #eef1f5; font-size: 13.5px; }
        .rs small { color: var(--muted); display: block; font-size: 12px; }
        .ai-box { border: 2px solid #e6d9f7; background: linear-gradient(180deg, #faf6ff, #fff); border-radius: 16px; padding: 18px; margin-bottom: 16px; }
        .ai-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .ai-h h3 { font-size: 18px; }
        .btn-ai { background: #6d3fc0; border-color: #6d3fc0; color: #fff; }
        .btn-ai:hover:not(:disabled) { background: #57309e; }
        .sum { background: #fff; border: 1px solid #e6d9f7; border-radius: 12px; padding: 12px 14px; margin: 14px 0; font-size: 14.5px; }
        .good-list { margin: 0 0 14px; padding-left: 18px; font-size: 13.5px; color: var(--ok); }
        .sec { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-bottom: 10px; }
        .sec h4 { margin: 0 0 4px; font-size: 15px; font-family: 'Baloo 2', sans-serif; }
        .sec p { margin: 0 0 8px; font-size: 13.5px; }
        .sec ul { margin: 0; padding-left: 18px; font-size: 13.5px; }
        .sec li { margin-bottom: 4px; }
        .pri { display: grid; grid-template-columns: 26px 1fr; gap: 8px 10px; align-items: start; padding: 8px 0; border-bottom: 1px solid #eef1f5; font-size: 13.5px; }
        .pri-n { background: var(--red); color: #fff; border-radius: 50%; width: 24px; height: 24px; display: grid; place-items: center; font-weight: 800; font-size: 12px; }
        .pri small { color: var(--muted); display: block; }
        .tip { font-size: 12.5px; color: var(--muted); }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
      <style jsx global>{`
        @media print {
          .app .bb-masthead, .app .nav { display: none !important; }
          .app { background: #fff !important; }
          .app .card, .app .kpi { break-inside: avoid; }
        }
      `}</style>

      <div className="top">
        <div>
          <h1 className="pg-title">Phân tích thi đua</h1>
          <p className="pg-sub" style={{ marginBottom: 0 }}>
            Xem tình hình toàn trường và từng lớp theo tuần, tháng, giữa kì, cuối kì hoặc cả năm; nhờ AI đề xuất giải pháp cụ thể.
          </p>
        </div>
        <button className="btn no-print" onClick={() => window.print()}>🖨 In / lưu PDF</button>
      </div>

      <div className="card no-print">
        <div className="pt-row" role="tablist" aria-label="Chọn kỳ phân tích">
          {PERIODS.map((p) => (
            <button key={p.key} role="tab" aria-selected={kind === p.key} className={`pt ${kind === p.key ? 'on' : ''}`} onClick={() => choosePeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {(kind === 'week' || kind === 'month') && (
          <div className="row" style={{ marginTop: 10 }}>
            <label className="lbl" htmlFor="ps" style={{ margin: 0 }}>{kind === 'week' ? 'Chọn tuần' : 'Chọn tháng'}</label>
            <select id="ps" className="input" style={{ width: 260 }} value={sel} onChange={(e) => { setSel(e.target.value); setPick(''); setAi((a) => ({ ...a, result: null, error: '' })); }}>
              {kind === 'week'
                ? weekOptions.map((w) => <option key={w.week_no} value={w.week_no}>Tuần {w.week_no} ({fmtDate(w.week_start)} – {fmtDate(w.week_end)})</option>)
                : [...months].reverse().map((m) => <option key={m} value={m}>Tháng {Number(m.slice(5))}/{m.slice(0, 4)}</option>)}
            </select>
          </div>
        )}
        {range && <p className="range">Đang xem: <b>{range.label}</b> · {fmtDate(range.from)} – {fmtDate(range.to)}</p>}
      </div>

      {cal && !cal.confirmed && (
        <div className="card" style={{ borderColor: '#f0d28a', background: '#fffaf0' }}>
          Lịch năm học chưa được xác nhận nên số tuần có thể lệch. Hãy vào mục <strong>Lịch năm học</strong> chọn đúng ngày bắt đầu tuần 1.
        </div>
      )}

      {loading ? (
        <div className="card"><div className="empty">Đang tổng hợp số liệu…</div></div>
      ) : !range ? (
        <div className="card"><div className="empty">Kỳ này chưa bắt đầu hoặc chưa có tuần nào trong lịch năm học.</div></div>
      ) : !hasData ? (
        <div className="card"><div className="empty">Chưa có dữ liệu thi đua trong khoảng này.</div></div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="kpi-l">Điểm thi đua trung bình</div>
              <div className="kpi-v">{fmt(totals.avg_total, 1)}<small>/100</small></div>
              <Delta cur={totals.avg_total} prev={prev?.totals?.avg_total} />
            </div>
            <div className="kpi">
              <div className="kpi-l">Tổng điểm bị trừ</div>
              <div className="kpi-v">{fmt(totals.lost, 0)}<small>điểm</small></div>
              <Delta cur={totals.lost} prev={prev?.totals?.lost} lowerBetter digits={0} />
            </div>
            <div className="kpi">
              <div className="kpi-l">Số lượt vi phạm</div>
              <div className="kpi-v">{fmt(totals.violations, 0)}<small>lượt</small></div>
              <Delta cur={totals.violations} prev={prev?.totals?.violations} lowerBetter digits={0} />
            </div>
            <div className="kpi">
              <div className="kpi-l">Lớp dẫn đầu</div>
              <div className="kpi-v">{best?.name}<small>{fmt(best?.avg_total, 1)} đ</small></div>
              <span className="kpi-d muted">Thấp nhất: {worst?.name} ({fmt(worst?.avg_total, 1)} đ)</span>
            </div>
            {biggestDrop && (
              <div className="kpi">
                <div className="kpi-l">Lớp giảm điểm nhiều nhất</div>
                <div className="kpi-v">{biggestDrop.name}<small>−{fmt(Math.abs(biggestDrop.d), 1)} đ</small></div>
                <span className="kpi-d bad">so với kỳ trước</span>
              </div>
            )}
          </div>

          <div className="grid2">
            <div className="card">
              <div className="card-h"><h3>Điểm trung bình toàn trường theo tuần</h3></div>
              <LineChart id="avg" label="Điểm thi đua trung bình toàn trường theo tuần" data={(data.weeks || []).map((w, i) => ({ label: weekCols[i], value: w.avg_total }))} color={COLORS.blue} />
            </div>
            <div className="card">
              <div className="card-h"><h3>Số lượt vi phạm theo tuần</h3></div>
              <BarChart label="Số lượt vi phạm theo tuần" data={(data.weeks || []).map((w, i) => ({ label: weekCols[i], value: w.violations }))} color={COLORS.red} />
            </div>
          </div>

          <div className="grid2">
            <div className="card">
              <div className="card-h"><h3>Xếp hạng các lớp</h3><span className="hint" style={{ margin: 0 }}>Bấm vào lớp để xem chi tiết</span></div>
              <RankBars items={classes.map((c) => ({ name: c.name, value: c.avg_total }))} activeName={pick} onPick={(n) => setPick(n === pick ? '' : n)} />
            </div>
            <div className="card">
              <div className="card-h"><h3>Vi phạm theo nhóm vấn đề</h3></div>
              <p className="sub">Gộp các lỗi bị trừ điểm thành nhóm để thấy vấn đề nổi bật của trường.</p>
              <Donut items={groups} />
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Bản đồ điểm thi đua: từng lớp theo từng tuần</h3><span className="hint" style={{ margin: 0 }}>Đỏ = điểm thấp, xanh = điểm cao</span></div>
            <Heatmap rows={sortedByName.map((c) => ({ name: c.name, series: c.series }))} cols={weekCols} activeName={pick} onPick={(n) => setPick(n === pick ? '' : n)} />
          </div>

          <div className="grid2">
            <div className="card">
              <div className="card-h"><h3>Lỗi bị trừ nhiều nhất toàn trường</h3></div>
              {(data.reasons || []).length === 0 ? <div className="empty">Chưa có vi phạm nào.</div> : (
                (data.reasons || []).slice(0, 8).map((r) => (
                  <div className="rs" key={`${r.category}-${r.label}`}>
                    <span>{r.label}<small>{groupOf(r.label, r.category)}</small></span>
                    <span style={{ textAlign: 'right' }}><b>{r.cnt}</b> lượt<small>−{fmt(Math.abs(r.points), 0)} điểm</small></span>
                  </div>
                ))
              )}
            </div>
            <div className="card">
              <div className="card-h"><h3>Vi phạm theo thứ trong tuần</h3></div>
              <BarChart label="Số lượt vi phạm theo thứ trong tuần" color={COLORS.gold}
                data={(data.weekdays || []).map((d) => ({ label: DOW_LABEL[d.dow], value: d.cnt }))} />
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>{picked ? `Chi tiết lớp ${picked.name}` : 'Chi tiết từng lớp'}</h3>
              {picked && <button className="btn btn-sm no-print" onClick={() => setPick('')}>Đóng</button>}
            </div>
            {!picked ? (
              <div className="empty">Bấm vào một lớp ở bảng xếp hạng hoặc bản đồ điểm để xem chi tiết và nhờ AI phân tích riêng lớp đó.</div>
            ) : (
              <div className="grid2">
                <div>
                  <div className="chips" style={{ marginBottom: 10 }}>
                    <span className="chip">Hạng {picked.rank}/{classes.length}</span>
                    <span className="chip">TB {fmt(picked.avg_total, 1)} điểm</span>
                    <span className="chip">Nề nếp {fmt(picked.avg_ne_nep, 1)}</span>
                    <span className="chip">Học tập {fmt(picked.avg_hoc_tap, 1)}</span>
                    <span className="chip">{picked.violations} lượt · −{fmt(picked.lost, 0)} điểm</span>
                  </div>
                  {pickedPrev && <Delta cur={picked.avg_total} prev={pickedPrev.avg_total} />}
                  <div style={{ marginTop: 8 }}>
                    <LineChart id="cls" label={`Điểm lớp ${picked.name} theo tuần`} height={200} color={COLORS.red}
                      data={picked.series.map((v, i) => ({ label: weekCols[i], value: v }))} />
                  </div>
                </div>
                <div>
                  <div className="lbl" style={{ marginTop: 0 }}>Lỗi bị trừ nhiều nhất của lớp</div>
                  {(picked.top_reasons || []).length === 0 ? <div className="empty">Lớp không bị trừ điểm nào trong kỳ này. 🎉</div> : (
                    picked.top_reasons.map((r) => (
                      <div className="rs" key={`${r.category}-${r.label}`}>
                        <span>{r.label}<small>{groupOf(r.label, r.category)}</small></span>
                        <span style={{ textAlign: 'right' }}><b>{r.cnt}</b> lượt<small>−{fmt(Math.abs(r.points), 0)} điểm</small></span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="ai-box">
            <div className="ai-h">
              <div>
                <h3>🤖 Trợ lý AI: phân tích & giải pháp</h3>
                <div className="tip">AI đọc số liệu tổng hợp theo lớp (không có tên học sinh) rồi chỉ ra vấn đề cần chú ý và việc nên làm.</div>
              </div>
              <div className="row no-print">
                <button className="btn btn-ai" disabled={ai.busy} onClick={() => runAi('')}>
                  {ai.busy && !ai.focus ? 'Đang phân tích…' : 'Phân tích toàn diện'}
                </button>
                {picked && (
                  <button className="btn" disabled={ai.busy} onClick={() => runAi(picked.name)}>
                    {ai.busy && ai.focus ? 'Đang phân tích…' : `Phân tích riêng lớp ${picked.name}`}
                  </button>
                )}
              </div>
            </div>

            {ai.busy && <div className="empty">AI đang đọc số liệu, thường mất 10–30 giây…</div>}
            {ai.error && <p style={{ color: 'var(--bad)', fontWeight: 600, marginBottom: 0 }}>{ai.error}</p>}

            {ai.result && (
              <div>
                <div className="sum"><strong>{ai.focus ? `Lớp ${ai.focus}: ` : 'Tổng quan: '}</strong>{ai.result.tom_tat}</div>
                {ai.result.diem_sang.length > 0 && (
                  <ul className="good-list">{ai.result.diem_sang.map((g, i) => <li key={i}>{g}</li>)}</ul>
                )}
                {ai.result.muc.map((m, i) => (
                  <div className="sec" key={i}>
                    <h4>{AI_ICON[m.loai] || '💡'} {m.tieu_de}</h4>
                    {m.nhan_dinh && <p>{m.nhan_dinh}</p>}
                    {m.giai_phap.length > 0 && <ul>{m.giai_phap.map((g, j) => <li key={j}>{g}</li>)}</ul>}
                  </div>
                ))}
                {ai.result.uu_tien.length > 0 && (
                  <div className="sec" style={{ borderColor: '#f0b4b7' }}>
                    <h4>✅ Việc cần làm trước</h4>
                    {ai.result.uu_tien.map((u, i) => (
                      <div className="pri" key={i}>
                        <span className="pri-n">{i + 1}</span>
                        <div>{u.viec}<small>{[u.nguoi_lam && `Người làm: ${u.nguoi_lam}`, u.thoi_han && `Thời hạn: ${u.thoi_han}`].filter(Boolean).join(' · ')}</small></div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="tip" style={{ marginTop: 8 }}>
                  Do AI tạo ({ai.meta}). Đây là gợi ý tham khảo, cô hãy điều chỉnh theo tình hình thực tế của từng lớp.
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
