'use client';
import { useMemo, useState } from 'react';
import { vnTodayIso } from '@/lib/dates';

// Thời khóa biểu riêng của từng lớp: bảng đẹp (màu theo môn), xem theo ngày trên điện thoại,
// nút In (khổ A4 ngang) và Lưu ảnh PNG. Không cần thư viện ngoài: ảnh được vẽ bằng canvas.
//   rows: [{ weekday: 2..7, session: 'sang'|'chieu', period, subject, teacher }]

const SESS = [
  { key: 'sang', label: 'Buổi sáng' },
  { key: 'chieu', label: 'Buổi chiều' },
];
const SCHOOL = 'TRƯỜNG TH - THCS BIỂN BẠCH';
const PLACE = 'Xã Biển Bạch, tỉnh Cà Mau';

const dayName = (d) => `Thứ ${d}`;
const fmtVN = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const todayWeekday = () => new Date(`${vnTodayIso()}T00:00:00Z`).getUTCDay() + 1; // 2 = Thứ 2 ... 7 = Thứ 7, 1 = Chủ nhật

// Màu pastel cố định cho từng môn (cùng tên môn luôn cùng màu)
function hueOf(subject) {
  const s = String(subject || '').trim().toLowerCase();
  let h = 7;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
export function subjectColors(subject) {
  const h = hueOf(subject);
  return { bg: `hsl(${h} 72% 93%)`, bd: `hsl(${h} 55% 82%)`, fg: `hsl(${h} 50% 22%)` };
}

export function buildModel(rows) {
  const map = new Map();
  const maxP = { sang: 0, chieu: 0 };
  let has7 = false;
  (rows || []).forEach((r) => {
    map.set(`${r.weekday}-${r.session}-${r.period}`, r);
    maxP[r.session] = Math.max(maxP[r.session] || 0, Number(r.period) || 0);
    if (Number(r.weekday) === 7) has7 = true;
  });
  return {
    map,
    days: has7 ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6],
    sessions: SESS.filter((s) => maxP[s.key] > 0).map((s) => ({ ...s, periods: Array.from({ length: maxP[s.key] }, (_, i) => i + 1) })),
    empty: !(rows || []).length,
  };
}

// ---------- In: mở cửa sổ riêng khổ A4 ngang ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function printHtml(model, className, effectiveFrom, logoUrl) {
  const head = `<tr><th class="t">Tiết</th>${model.days.map((d) => `<th>${dayName(d)}</th>`).join('')}</tr>`;
  const body = model.sessions.map((s) => {
    const rows = s.periods.map((p) => `<tr><td class="t">${p}</td>${model.days.map((d) => {
      const r = model.map.get(`${d}-${s.key}-${p}`);
      if (!r) return '<td class="e">·</td>';
      const c = subjectColors(r.subject);
      return `<td style="background:${c.bg};border-color:${c.bd};color:${c.fg}"><b>${esc(r.subject)}</b>${r.teacher ? `<small>${esc(r.teacher)}</small>` : ''}</td>`;
    }).join('')}</tr>`).join('');
    return `<tr class="sess"><td colspan="${model.days.length + 1}">${s.label}</td></tr>${rows}`;
  }).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Thời khóa biểu lớp ${esc(className)}</title>
<style>
@page{size:A4 landscape;margin:9mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Be Vietnam Pro',system-ui,Arial,sans-serif;color:#16324f}
.head{display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:14px;background:linear-gradient(135deg,#dcecfb,#bfd9f5);margin-bottom:10px}
.head img{width:56px;height:56px;border-radius:50%;background:#fff;padding:3px;object-fit:contain}
.head .s{font-size:11px;font-weight:700;letter-spacing:.4px;color:#2c5d93}
.head h1{margin:2px 0 0;font-size:24px;color:#173f6b}
.head .r{margin-left:auto;text-align:right}
.head .cls{display:inline-block;background:#fff;color:#1f5a96;font-weight:800;font-size:22px;border-radius:12px;padding:4px 16px}
.head .ap{font-size:11px;color:#2c5d93;margin-top:4px}
table{width:100%;border-collapse:separate;border-spacing:4px}
th{background:#e6f1fd;color:#1f5a96;font-size:12.5px;padding:7px 4px;border-radius:8px}
th.t,td.t{width:42px;text-align:center;font-weight:800;color:#2c5d93;background:#eef5fd;border-radius:8px}
td{border:1px solid #e1ebf7;border-radius:8px;padding:6px 7px;text-align:center;vertical-align:middle;height:46px;font-size:12.5px}
td b{display:block;font-size:13px;line-height:1.2}
td small{display:block;font-size:10.5px;opacity:.8;margin-top:2px}
td.e{color:#c2d0e2;background:#fafcff}
tr.sess td{background:#4a8fd6;color:#fff;font-weight:800;text-align:left;padding:5px 12px;height:auto;border:0;font-size:12.5px}
.foot{text-align:center;font-size:10.5px;color:#6a86a6;margin-top:8px}
</style></head><body>
<div class="head"><img src="${esc(logoUrl)}" alt="" onerror="this.style.display='none'">
<div><div class="s">${SCHOOL}</div><h1>THỜI KHÓA BIỂU</h1></div>
<div class="r"><span class="cls">Lớp ${esc(className)}</span>${effectiveFrom ? `<div class="ap">Áp dụng từ ${fmtVN(effectiveFrom)}</div>` : ''}</div></div>
<table>${head}${body}</table>
<div class="foot">${SCHOOL} · ${PLACE}</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350)}<\/script>
</body></html>`;
}

function doPrint(model, className, effectiveFrom) {
  const html = printHtml(model, className, effectiveFrom, `${window.location.origin}/logo-truong.png`);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi bấm In lại.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---------- Lưu ảnh PNG: vẽ bằng canvas ----------
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function exportPng(model, className, effectiveFrom) {
  const FONT = '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  const S = 2; // độ nét
  const W = 1240;
  const PAD = 34;
  const TCOL = 70;
  const nDays = model.days.length;
  const colW = (W - PAD * 2 - TCOL) / nDays;
  const HEAD = 130;
  const SESS_H = 38;
  const TH_H = 40;
  const ROW_H = 68;
  const GAP = 6;
  let H = HEAD + 18;
  model.sessions.forEach((s) => { H += SESS_H + TH_H + s.periods.length * (ROW_H + GAP) + 16; });
  H += 44;

  const canvas = document.createElement('canvas');
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // đầu trang
  const g = ctx.createLinearGradient(0, 0, W, HEAD);
  g.addColorStop(0, '#dcecfb');
  g.addColorStop(1, '#bcd8f5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HEAD);
  const logo = await loadImage('/logo-truong.png');
  const cx = PAD + 40;
  const cy = HEAD / 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fill();
  if (logo) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 35, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logo, cx - 35, cy - 35, 70, 70);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2c5d93';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(SCHOOL, PAD + 98, cy - 24);
  ctx.fillStyle = '#173f6b';
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText('THỜI KHÓA BIỂU', PAD + 98, cy + 10);
  ctx.fillStyle = '#2c5d93';
  ctx.font = `500 14px ${FONT}`;
  ctx.fillText(PLACE, PAD + 98, cy + 40);

  const label = `Lớp ${className}`;
  ctx.font = `800 32px ${FONT}`;
  const lw = ctx.measureText(label).width + 44;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, W - PAD - lw, cy - 30, lw, 52, 16); ctx.fill();
  ctx.fillStyle = '#1f5a96';
  ctx.textAlign = 'center';
  ctx.fillText(label, W - PAD - lw / 2, cy - 3);
  if (effectiveFrom) {
    ctx.fillStyle = '#2c5d93';
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`Áp dụng từ ${fmtVN(effectiveFrom)}`, W - PAD - lw / 2, cy + 40);
  }

  // các buổi
  let y = HEAD + 18;
  model.sessions.forEach((s) => {
    ctx.fillStyle = '#4a8fd6';
    roundRect(ctx, PAD, y, W - PAD * 2, SESS_H, 12); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(s.label, PAD + 16, y + SESS_H / 2);
    y += SESS_H + 6;

    ctx.font = `800 14px ${FONT}`;
    ctx.fillStyle = '#eef5fd';
    roundRect(ctx, PAD, y, TCOL - GAP, TH_H - 4, 10); ctx.fill();
    ctx.fillStyle = '#1f5a96';
    ctx.textAlign = 'center';
    ctx.fillText('Tiết', PAD + (TCOL - GAP) / 2, y + (TH_H - 4) / 2);
    model.days.forEach((d, i) => {
      const x = PAD + TCOL + i * colW;
      ctx.fillStyle = '#e6f1fd';
      roundRect(ctx, x, y, colW - GAP, TH_H - 4, 10); ctx.fill();
      ctx.fillStyle = '#1f5a96';
      ctx.fillText(dayName(d), x + (colW - GAP) / 2, y + (TH_H - 4) / 2);
    });
    y += TH_H;

    s.periods.forEach((p) => {
      ctx.fillStyle = '#eef5fd';
      roundRect(ctx, PAD, y, TCOL - GAP, ROW_H, 12); ctx.fill();
      ctx.fillStyle = '#2c5d93';
      ctx.font = `800 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(p), PAD + (TCOL - GAP) / 2, y + ROW_H / 2);
      model.days.forEach((d, i) => {
        const x = PAD + TCOL + i * colW;
        const r = model.map.get(`${d}-${s.key}-${p}`);
        if (!r) {
          ctx.fillStyle = '#f8fbff';
          roundRect(ctx, x, y, colW - GAP, ROW_H, 12); ctx.fill();
          return;
        }
        const c = subjectColors(r.subject);
        ctx.fillStyle = c.bg;
        roundRect(ctx, x, y, colW - GAP, ROW_H, 12); ctx.fill();
        ctx.strokeStyle = c.bd;
        ctx.lineWidth = 1;
        roundRect(ctx, x + 0.5, y + 0.5, colW - GAP - 1, ROW_H - 1, 12); ctx.stroke();
        ctx.fillStyle = c.fg;
        ctx.textAlign = 'center';
        ctx.font = `800 15px ${FONT}`;
        const lines = wrapLines(ctx, r.subject, colW - GAP - 16, 2);
        const tH = r.teacher ? 15 : 0;
        const total = lines.length * 18 + tH;
        let ty = y + (ROW_H - total) / 2 + 9;
        lines.forEach((ln) => { ctx.fillText(ln, x + (colW - GAP) / 2, ty); ty += 18; });
        if (r.teacher) {
          ctx.font = `500 12px ${FONT}`;
          ctx.globalAlpha = 0.8;
          const tl = wrapLines(ctx, r.teacher, colW - GAP - 16, 1)[0];
          ctx.fillText(tl, x + (colW - GAP) / 2, ty + 2);
          ctx.globalAlpha = 1;
        }
      });
      y += ROW_H + GAP;
    });
    y += 16;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#6a86a6';
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText(`${SCHOOL} · ${PLACE}`, W / 2, H - 24);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Không tạo được ảnh');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TKB-lop-${String(className).replace(/[^\w-]+/g, '')}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------- Giao diện ----------
export default function ClassTimetable({ rows, className, effectiveFrom, compact = false }) {
  const model = useMemo(() => buildModel(rows), [rows]);
  const tw = todayWeekday();
  const [mobileDay, setMobileDay] = useState(model.days.includes(tw) ? tw : 2);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    try {
      await exportPng(model, className, effectiveFrom);
    } catch (e) {
      alert(`Không lưu được ảnh: ${e.message}`);
    }
    setBusy(false);
  }

  if (model.empty) {
    return <div className="tt-empty">Lớp này chưa có thời khóa biểu.</div>;
  }

  const day = model.days.includes(mobileDay) ? mobileDay : model.days[0];

  return (
    <div className="tt-root">
      <style>{CSS}</style>
      <div className="tt-sheet">
        <div className="tt-head">
          <img src="/logo-truong.png" alt="" width="52" height="52" />
          <div className="tt-head-t">
            <small>{SCHOOL}</small>
            <h3>THỜI KHÓA BIỂU</h3>
          </div>
          <div className="tt-head-r">
            <span className="tt-cls">Lớp {className}</span>
            {effectiveFrom ? <small>Áp dụng từ {fmtVN(effectiveFrom)}</small> : null}
          </div>
        </div>

        {/* Bảng đầy đủ (máy tính, máy tính bảng) */}
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th className="tt-t">Tiết</th>
                {model.days.map((d) => <th key={d} className={d === tw ? 'tt-today' : ''}>{dayName(d)}</th>)}
              </tr>
            </thead>
            <tbody>
              {model.sessions.map((s) => [
                <tr key={`${s.key}-h`} className="tt-sess"><td colSpan={model.days.length + 1}>{s.label}</td></tr>,
                ...s.periods.map((p) => (
                  <tr key={`${s.key}-${p}`}>
                    <td className="tt-t">{p}</td>
                    {model.days.map((d) => {
                      const r = model.map.get(`${d}-${s.key}-${p}`);
                      if (!r) return <td key={d} className="tt-e">·</td>;
                      const c = subjectColors(r.subject);
                      return (
                        <td key={d} style={{ background: c.bg, borderColor: c.bd, color: c.fg }}>
                          <b>{r.subject}</b>
                          {r.teacher ? <small>{r.teacher}</small> : null}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>

        {/* Xem theo ngày (điện thoại) */}
        <div className="tt-day-view">
          <div className="tt-day-tabs" role="tablist" aria-label="Chọn thứ">
            {model.days.map((d) => (
              <button key={d} role="tab" aria-selected={d === day} className={`tt-day-tab ${d === day ? 'on' : ''}`} onClick={() => setMobileDay(d)}>
                {dayName(d)}{d === tw ? <i>Hôm nay</i> : null}
              </button>
            ))}
          </div>
          {model.sessions.map((s) => {
            const list = s.periods.map((p) => ({ p, r: model.map.get(`${day}-${s.key}-${p}`) })).filter((x) => x.r);
            if (!list.length) return null;
            return (
              <div key={s.key} className="tt-day-sess">
                <div className="tt-day-sess-h">{s.label}</div>
                {list.map(({ p, r }) => {
                  const c = subjectColors(r.subject);
                  return (
                    <div key={p} className="tt-day-row" style={{ background: c.bg, borderColor: c.bd, color: c.fg }}>
                      <span className="tt-day-n">{p}</span>
                      <div><b>{r.subject}</b>{r.teacher ? <small>{r.teacher}</small> : null}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {model.sessions.every((s) => !s.periods.some((p) => model.map.get(`${day}-${s.key}-${p}`))) && <div className="tt-empty">{dayName(day)} không có tiết học.</div>}
        </div>
      </div>

      <div className={`tt-actions ${compact ? 'compact' : ''}`}>
        <button type="button" className="tt-btn" onClick={() => doPrint(model, className, effectiveFrom)}>🖨 In thời khóa biểu</button>
        <button type="button" className="tt-btn solid" disabled={busy} onClick={onExport}>{busy ? 'Đang tạo ảnh…' : '🖼 Lưu ảnh (PNG)'}</button>
      </div>
    </div>
  );
}

const CSS = `
.tt-root{--tt-ink:#16324f;--tt-blue:#3478b8;--tt-line:#d9e7f6;color:var(--tt-ink);font-family:'Be Vietnam Pro',system-ui,sans-serif}
.tt-sheet{background:#fff;border:1px solid var(--tt-line);border-radius:20px;padding:14px;box-shadow:0 10px 26px -20px rgba(40,90,150,.45)}
.tt-head{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#e1effc,#c6dff7);border-radius:16px;padding:12px 16px;margin-bottom:12px}
.tt-head img{width:52px;height:52px;border-radius:50%;background:#fff;padding:3px;object-fit:contain;flex:none}
.tt-head-t small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.4px;color:#2c5d93}
.tt-head-t h3{margin:2px 0 0;font-size:20px;color:#173f6b;font-weight:800}
.tt-head-r{margin-left:auto;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px}
.tt-head-r small{font-size:11px;color:#2c5d93;font-weight:600}
.tt-cls{background:#fff;color:#1f5a96;font-weight:800;font-size:18px;border-radius:12px;padding:3px 14px;white-space:nowrap}
.tt-table-wrap{overflow-x:auto}
.tt-table{width:100%;border-collapse:separate;border-spacing:4px;min-width:640px}
.tt-table th{background:#e6f1fd;color:#1f5a96;font-size:13px;padding:8px 4px;border-radius:10px;font-weight:800}
.tt-table th.tt-today{background:#4a8fd6;color:#fff}
.tt-table td{border:1px solid #e1ebf7;border-radius:10px;padding:7px 6px;text-align:center;vertical-align:middle;height:52px;font-size:13px}
.tt-table td b{display:block;font-size:13.5px;line-height:1.2;font-weight:800}
.tt-table td small{display:block;font-size:11px;opacity:.8;margin-top:2px}
.tt-table td.tt-t,.tt-table th.tt-t{width:46px;text-align:center;font-weight:800;color:#2c5d93;background:#eef5fd}
.tt-table td.tt-e{color:#c2d0e2;background:#fafcff}
.tt-table tr.tt-sess td{background:#4a8fd6;color:#fff;font-weight:800;text-align:left;padding:6px 14px;height:auto;border:0;font-size:13px;border-radius:10px}
.tt-day-view{display:none}
.tt-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px}
.tt-btn{border:1.5px solid #bcd6f2;background:#fff;color:#1f5a96;border-radius:12px;padding:11px 18px;font-weight:700;font-size:14px;cursor:pointer;min-height:44px;font-family:inherit}
.tt-btn.solid{background:var(--tt-blue);border-color:var(--tt-blue);color:#fff}
.tt-btn:disabled{opacity:.6;cursor:wait}
.tt-empty{text-align:center;color:#6a86a6;font-size:14px;padding:22px 8px}
@media (max-width:720px){
  .tt-sheet{padding:10px;border-radius:18px}
  .tt-table-wrap{display:none}
  .tt-day-view{display:block}
  .tt-head{padding:10px 12px;gap:10px}
  .tt-head img{width:42px;height:42px}
  .tt-head-t h3{font-size:16px}
  .tt-cls{font-size:15px;padding:2px 11px}
  .tt-actions{justify-content:stretch}
  .tt-actions .tt-btn{flex:1 1 140px}
  .tt-day-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px;scrollbar-width:none}
  .tt-day-tabs::-webkit-scrollbar{display:none}
  .tt-day-tab{flex:1 0 auto;border:1.5px solid #d3e4f6;background:#f4f9ff;color:#2c5d93;border-radius:12px;padding:8px 12px;font-weight:800;font-size:13px;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:1px;min-height:44px;cursor:pointer}
  .tt-day-tab i{font-style:normal;font-size:9.5px;font-weight:700;opacity:.85}
  .tt-day-tab.on{background:#4a8fd6;border-color:#4a8fd6;color:#fff}
  .tt-day-sess-h{font-size:12px;font-weight:800;color:#2c5d93;margin:10px 2px 6px;text-transform:uppercase;letter-spacing:.4px}
  .tt-day-row{display:flex;align-items:center;gap:12px;border:1px solid;border-radius:14px;padding:11px 13px;margin-bottom:7px}
  .tt-day-n{flex:none;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.75);display:grid;place-items:center;font-weight:800;font-size:14px}
  .tt-day-row b{display:block;font-size:15px;line-height:1.25}
  .tt-day-row small{display:block;font-size:12px;opacity:.8;margin-top:1px}
}
`;
