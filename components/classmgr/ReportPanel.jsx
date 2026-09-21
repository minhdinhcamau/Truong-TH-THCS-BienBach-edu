'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { addDays, fmtDate, fmtIso, mondayOf, vnTodayIso } from '@/lib/dates';
import { BarList, ColumnChart, LineChart, groupColor } from '@/components/Charts';
import { buildAdvice } from '@/lib/adviceRules';
import AdvicePanel from './AdvicePanel';
import PresentationMode from './PresentationMode';

const n1 = (v) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const shortDate = (iso) => { const [, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}`; };
const dayName = (iso) => fmtIso(iso).split(' ').slice(0, 2).join(' ');

// Báo cáo tuần của lớp: thi đua lớp, học sinh vi phạm nhiều lần, tuyên dương, tiến bộ, thống kê tổ + chế độ trình chiếu sinh hoạt lớp.
export default function ReportPanel({ classId, className, toast }) {
  const thisMonday = mondayOf(vnTodayIso());
  const [ws, setWs] = useState(thisMonday);
  const [rep, setRep] = useState(null);
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    setRep(null);
    const { data, error } = await supabase.rpc('class_weekly_report', { p_class_id: classId, p_week_start: ws });
    if (error) toast({ type: 'error', text: error.message });
    else setRep(data);
  }, [classId, ws, toast]);

  useEffect(() => { load(); }, [load]);

  const view = useMemo(() => {
    if (!rep) return null;
    const c = rep.class || {};
    const rankDelta = c.prev_rank && c.rank ? c.prev_rank - c.rank : null; // dương = lên hạng
    return {
      c, rankDelta,
      hist: (rep.history || []).map((h) => ({ label: shortDate(h.week_start), value: h.total, rank: h.rank })),
      reasons: (rep.sao_do_by_reason || []).map((r) => ({ label: r.label, value: r.cnt, sub: `${r.cnt} lần · ${n1(r.points)} đ` })),
      days: (rep.sao_do_by_day || []).map((d) => ({ label: dayName(d.date), value: d.cnt })),
      groups: (rep.groups || []).filter((g) => g.group_no > 0).map((g) => ({ label: `Tổ ${g.group_no}`, value: Math.round(g.net * 10) / 10, color: groupColor(g.group_no), violations: g.violations })),
      repeat: rep.repeat_violators || [], top: rep.top_students || [], impr: rep.improvers || [], tot: rep.totals || {},
    };
  }, [rep]);

  const advice = useMemo(() => (rep ? buildAdvice(rep) : { tips: [], students: [] }), [rep]);

  return (
    <>
      <div className="cm-card">
        <div className="cm-h">
          <h3>Báo cáo tuần {fmtDate(ws)} – {fmtDate(addDays(ws, 6))}</h3>
          <div className="cm-row" style={{ gap: 6 }}>
            <button className="cm-btn cm-btn-sm" onClick={() => setWs(addDays(ws, -7))}>‹ Tuần trước</button>
            <button className="cm-btn cm-btn-sm" disabled={ws === thisMonday} onClick={() => setWs(addDays(ws, 7))}>Tuần sau ›</button>
            <button className="cm-btn cm-btn-main" disabled={!view} onClick={() => setShow(true)}>▶ Trình chiếu sinh hoạt lớp</button>
          </div>
        </div>
        <p className="cm-hint" style={{ margin: 0 }}>
          Tự động tổng hợp từ điểm thi đua của Sao đỏ và các ghi nhận trong lớp. Mỗi sáng thứ Hai hệ thống còn gửi bản tóm tắt tuần trước vào mục Thông báo.
        </p>
      </div>

      {!view ? <div className="cm-card"><div className="cm-empty">Đang tổng hợp…</div></div> : <Body v={view} rep={rep} classId={classId} advice={advice} />}

      {show && view && <PresentationMode v={view} advice={advice} className={className} weekLabel={`${fmtDate(ws)} – ${fmtDate(addDays(ws, 6))}`} onClose={() => setShow(false)} />}
    </>
  );
}

function Kpi({ label, value, sub, tone }) {
  return (
    <div style={{ flex: '1 1 150px', background: '#fff', border: '1px solid var(--cm-line)', borderRadius: 14, padding: '12px 16px' }}>
      <div className="cm-hint" style={{ margin: 0 }}>{label}</div>
      <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: tone || 'inherit' }}>{value}</div>
      {sub ? <div className="cm-hint" style={{ margin: 0 }}>{sub}</div> : null}
    </div>
  );
}

function trendText(d) {
  if (d === null) return 'chưa có tuần trước để so sánh';
  if (d > 0) return `▲ tăng ${d} hạng so với tuần trước`;
  if (d < 0) return `▼ giảm ${-d} hạng so với tuần trước`;
  return 'giữ nguyên hạng so với tuần trước';
}

function Body({ v, rep, classId, advice }) {
  const { c, tot } = v;
  return (
    <>
      <div className="cm-row" style={{ alignItems: 'stretch', marginBottom: 14 }}>
        <Kpi label="Xếp hạng thi đua lớp" value={`${c.rank ?? '—'}/${c.of ?? '—'}`} sub={trendText(v.rankDelta)} tone="var(--cm-accent, #2f6f5e)" />
        <Kpi label="Điểm thi đua tuần" value={c.total != null ? n1(c.total) : '—'} sub={`Nề nếp ${c.ne_nep != null ? n1(c.ne_nep) : '—'} · Học tập ${c.hoc_tap != null ? n1(c.hoc_tap) : '—'}`} />
        <Kpi label="Lượt vi phạm trong lớp" value={tot.violations ?? 0} sub={`${tot.students_with_violation ?? 0}/${tot.students ?? 0} bạn có vi phạm`} />
        <Kpi label="Điểm cộng tuần" value={`+${n1(tot.plus_points ?? 0)}`} tone="var(--cm-ok)" />
      </div>

      <div className="cm-card">
        <div className="cm-h"><h3>Điểm thi đua lớp 6 tuần gần đây</h3></div>
        <LineChart points={v.hist} />
      </div>

      <div className="cm-row" style={{ alignItems: 'stretch' }}>
        <div className="cm-card cm-grow"><div className="cm-h"><h3>Sao đỏ trừ điểm theo mục</h3></div><BarList items={v.reasons} emptyText="Tuần này Sao đỏ chưa trừ điểm lớp." /></div>
        <div className="cm-card cm-grow"><div className="cm-h"><h3>Số lượt trừ điểm theo ngày</h3></div><ColumnChart items={v.days} /></div>
      </div>

      <div className="cm-row" style={{ alignItems: 'stretch' }}>
        <div className="cm-card cm-grow">
          <div className="cm-h"><h3>⚠ Vi phạm nhiều lần</h3></div>
          {v.repeat.length === 0 ? <div className="cm-empty">Không có bạn nào vi phạm từ 2 lần. Rất tốt!</div> : v.repeat.map((r) => (
            <div key={r.student_id} style={{ padding: '6px 0', borderBottom: '1px solid #eef1f5' }}>
              <b>{r.name}</b> <span className="cm-pill bad">{r.cnt} lần</span>
              <div className="cm-hint" style={{ margin: 0 }}>{(r.types || []).map((t) => `${t.label} ×${t.n}`).join(', ')}</div>
            </div>
          ))}
        </div>
        <div className="cm-card cm-grow">
          <div className="cm-h"><h3>🏅 Tuyên dương</h3></div>
          {v.top.length === 0 ? <div className="cm-empty">Chưa có điểm cộng trong tuần.</div> : v.top.map((s, i) => (
            <div key={s.student_id} style={{ padding: '6px 0', borderBottom: '1px solid #eef1f5', display: 'flex', justifyContent: 'space-between' }}>
              <span><b>{i + 1}. {s.name}</b></span><span className="cm-pill ok">+{n1(s.net)} điểm</span>
            </div>
          ))}
        </div>
        <div className="cm-card cm-grow">
          <div className="cm-h"><h3>🌱 Có tiến bộ</h3></div>
          {v.impr.length === 0 ? <div className="cm-empty">Chưa ghi nhận bạn nào tiến bộ rõ rệt.</div> : v.impr.map((s) => (
            <div key={s.student_id} style={{ padding: '6px 0', borderBottom: '1px solid #eef1f5' }}>
              <b>{s.name}</b> <span className="cm-pill ok">+{n1(s.delta)} so với tuần trước</span>
              <div className="cm-hint" style={{ margin: 0 }}>Vi phạm {s.prev_violations} → {s.violations} lần</div>
            </div>
          ))}
        </div>
      </div>

      <AdvicePanel classId={classId} rep={rep} advice={advice} />

      <div className="cm-card">
        <div className="cm-h"><h3>Điểm của các tổ (điểm cộng trừ vi phạm)</h3></div>
        {v.groups.length === 0 ? <div className="cm-empty">Lớp chưa chia tổ — hãy lưu sơ đồ lớp để có thống kê theo tổ.</div> : <ColumnChart items={v.groups} />}
      </div>
    </>
  );
}
