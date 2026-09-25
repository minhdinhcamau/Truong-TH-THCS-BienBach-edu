// Bộ biểu đồ SVG thuần (không dùng thư viện) cho trang Phân tích của Tổng phụ trách.
// Nhẹ hơn hẳn recharts/chart.js: không thêm gói nào vào bundle của web.
// Mọi biểu đồ co giãn theo chiều rộng khung chứa (viewBox) và có role="img" + aria-label.

export const COLORS = {
  red: '#c4262e', redD: '#8f1a20', gold: '#f4b73d', ok: '#1a8a58', okL: '#d9f0e4',
  blue: '#2f6fb0', ink: '#1b2430', muted: '#627083', line: '#e2e7ee', grid: '#eef1f5', warn: '#e0a020',
};

const FONT = "'Be Vietnam Pro', system-ui, sans-serif";
const fmt = (n, d = 1) => (n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: d }));

function niceStep(range, ticks) {
  const raw = range / Math.max(1, ticks);
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return f * pow;
}

function axisScale(min, max, ticks = 4) {
  if (min === max) { min -= 1; max += 1; }
  const step = niceStep(max - min, ticks);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const vals = [];
  for (let v = lo; v <= hi + step / 2; v += step) vals.push(Number(v.toFixed(6)));
  return { lo, hi, vals };
}

// ---------------------------------------------------------------------------
// Biểu đồ đường + vùng tô. data: [{ label, value }]
// ---------------------------------------------------------------------------
export function LineChart({ data, color = COLORS.blue, height = 220, unit = '', min, max, label = 'Biểu đồ đường', id = 'lc' }) {
  const W = 560; const H = height;
  const m = { t: 18, r: 16, b: 30, l: 40 };
  const pts = (data || []).filter((d) => d.value != null);
  if (pts.length === 0) return <Empty height={H} />;
  const vals = pts.map((d) => Number(d.value));
  const { lo, hi, vals: ticks } = axisScale(min ?? Math.min(...vals) - 1, max ?? Math.max(...vals) + 1, 4);
  const iw = W - m.l - m.r; const ih = H - m.t - m.b;
  const x = (i) => m.l + (pts.length === 1 ? iw / 2 : (i * iw) / (pts.length - 1));
  const y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
  const line = pts.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${(m.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(m.t + ih).toFixed(1)} Z`;
  const every = Math.ceil(pts.length / 10);
  const showVals = pts.length <= 12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block', fontFamily: FONT }}>
      <title>{label}</title>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={COLORS.grid} strokeWidth="1" />
          <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={COLORS.muted}>{fmt(t, 1)}{unit}</text>
        </g>
      ))}
      <path d={area} fill={`url(#${id}-g)`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((d, i) => (
        <g key={`${d.label}-${i}`}>
          <circle cx={x(i)} cy={y(d.value)} r="4" fill="#fff" stroke={color} strokeWidth="2.4" />
          {showVals && (
            <text x={x(i)} y={y(d.value) - 10} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={COLORS.ink}>{fmt(d.value, 1)}</text>
          )}
          {i % every === 0 && (
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill={COLORS.muted}>{d.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Biểu đồ cột đứng. data: [{ label, value, color? }]
// ---------------------------------------------------------------------------
export function BarChart({ data, color = COLORS.red, height = 220, label = 'Biểu đồ cột', unit = '' }) {
  const W = 560; const H = height;
  const m = { t: 20, r: 16, b: 30, l: 40 };
  const list = data || [];
  if (list.length === 0 || list.every((d) => !d.value)) return <Empty height={H} text="Chưa có vi phạm nào trong khoảng này." />;
  const { hi, vals: ticks } = axisScale(0, Math.max(...list.map((d) => Number(d.value) || 0), 1), 4);
  const iw = W - m.l - m.r; const ih = H - m.t - m.b;
  const slot = iw / list.length; const bw = Math.min(46, slot * 0.62);
  const y = (v) => m.t + ih - (v / hi) * ih;
  const every = Math.ceil(list.length / 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block', fontFamily: FONT }}>
      <title>{label}</title>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={COLORS.grid} strokeWidth="1" />
          <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={COLORS.muted}>{fmt(t, 0)}{unit}</text>
        </g>
      ))}
      {list.map((d, i) => {
        const cx = m.l + slot * i + slot / 2; const h = (m.t + ih) - y(Number(d.value) || 0);
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={cx - bw / 2} y={y(Number(d.value) || 0)} width={bw} height={Math.max(h, 0)} rx="5" fill={d.color || color} />
            {Number(d.value) > 0 && list.length <= 14 && (
              <text x={cx} y={y(d.value) - 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={COLORS.ink}>{fmt(d.value, 0)}</text>
            )}
            {i % every === 0 && <text x={cx} y={H - 10} textAnchor="middle" fontSize="11" fill={COLORS.muted}>{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Xếp hạng các lớp (thanh ngang). classes: [{ name, value }] đã sắp xếp giảm dần
// ---------------------------------------------------------------------------
export function RankBars({ items, onPick, activeName, label = 'Xếp hạng các lớp' }) {
  const list = items || [];
  if (list.length === 0) return <Empty height={120} />;
  const W = 560; const rowH = 30; const m = { t: 8, r: 54, b: 22, l: 58 };
  const H = m.t + m.b + list.length * rowH;
  const vals = list.map((d) => Number(d.value) || 0);
  const top = Math.max(100, ...vals);
  const base = Math.max(0, Math.floor((Math.min(...vals) - 4) / 5) * 5);
  const iw = W - m.l - m.r;
  const w = (v) => Math.max(4, ((v - base) / (top - base || 1)) * iw);
  const n = list.length;
  const tone = (i) => (i < Math.min(3, Math.floor(n / 2)) ? COLORS.ok : i >= n - Math.min(3, Math.floor(n / 2)) ? COLORS.red : COLORS.blue);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block', fontFamily: FONT }}>
      <title>{label}</title>
      {list.map((d, i) => {
        const yy = m.t + i * rowH; const on = activeName === d.name;
        return (
          <g key={d.name} onClick={onPick ? () => onPick(d.name) : undefined} style={onPick ? { cursor: 'pointer' } : undefined}>
            <rect x="0" y={yy} width={W} height={rowH} fill={on ? '#fdeceb' : 'transparent'} rx="6" />
            <text x={m.l - 10} y={yy + rowH / 2 + 4} textAnchor="end" fontSize="12.5" fontWeight="700" fill={COLORS.ink}>{d.name}</text>
            <rect x={m.l} y={yy + 6} width={iw} height={rowH - 12} rx="6" fill={COLORS.grid} />
            <rect x={m.l} y={yy + 6} width={w(Number(d.value) || 0)} height={rowH - 12} rx="6" fill={tone(i)} />
            <text x={m.l + w(Number(d.value) || 0) + 8} y={yy + rowH / 2 + 4} fontSize="12" fontWeight="700" fill={COLORS.ink}>{fmt(d.value, 1)}</text>
          </g>
        );
      })}
      <text x={m.l} y={H - 5} fontSize="10.5" fill={COLORS.muted}>Trục bắt đầu từ {base} điểm để thấy rõ chênh lệch giữa các lớp</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Bánh vòng (donut) kèm chú thích. items: [{ label, value, color }]
// ---------------------------------------------------------------------------
export function Donut({ items, centerLabel = 'lượt', label = 'Tỉ lệ theo nhóm vấn đề' }) {
  const list = (items || []).filter((d) => Number(d.value) > 0);
  const total = list.reduce((s, d) => s + Number(d.value), 0);
  if (!total) return <Empty height={160} text="Chưa có vi phạm nào trong khoảng này." />;
  const S = 190; const R = 84; const r = 52; const c = S / 2;
  let acc = -Math.PI / 2;
  const arcs = list.map((d) => {
    const frac = Number(d.value) / total; const a0 = acc; const a1 = acc + frac * Math.PI * 2; acc = a1;
    const p = (rad, ang) => [c + rad * Math.cos(ang), c + rad * Math.sin(ang)];
    const [x0, y0] = p(R, a0); const [x1, y1] = p(R, a1); const [x2, y2] = p(r, a1); const [x3, y3] = p(r, a0);
    const large = frac > 0.5 ? 1 : 0;
    const full = frac > 0.9999;
    const path = full
      ? `M${c},${c - R} A${R},${R} 0 1 1 ${c - 0.01},${c - R} L${c - 0.01},${c - r} A${r},${r} 0 1 0 ${c},${c - r} Z`
      : `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
    return { ...d, path, frac };
  });
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${S} ${S}`} width="190" height="190" role="img" aria-label={label} style={{ flex: 'none', fontFamily: FONT }}>
        <title>{label}</title>
        {arcs.map((a) => <path key={a.label} d={a.path} fill={a.color} stroke="#fff" strokeWidth="2" />)}
        <text x={c} y={c - 2} textAnchor="middle" fontSize="26" fontWeight="800" fill={COLORS.ink}>{fmt(total, 0)}</text>
        <text x={c} y={c + 16} textAnchor="middle" fontSize="11.5" fill={COLORS.muted}>{centerLabel}</text>
      </svg>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, minWidth: 190 }}>
        {arcs.map((a) => (
          <li key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: a.color, flex: 'none' }} />
            <span style={{ flex: 1 }}>{a.label}</span>
            <b>{fmt(a.value, 0)}</b>
            <span style={{ color: COLORS.muted, width: 42, textAlign: 'right' }}>{fmt(a.frac * 100, 0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bản đồ nhiệt: hàng = lớp, cột = tuần. rows: [{ name, series: [số...] }], cols: ['T1', ...]
// ---------------------------------------------------------------------------
function heat(v, lo, hi) {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));
  const mix = (a, b, k) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
  const R = [214, 64, 64]; const Y = [244, 200, 90]; const G = [56, 160, 110];
  const rgb = t < 0.5 ? mix(R, Y, t / 0.5) : mix(Y, G, (t - 0.5) / 0.5);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export function Heatmap({ rows, cols, onPick, activeName, label = 'Điểm thi đua từng lớp theo tuần' }) {
  const list = rows || [];
  if (!list.length || !cols?.length) return <Empty height={120} />;
  const rowH = 26; const labelW = 56; const headH = 24;
  // Nham 1 chieu rong hop ly (~640px) roi suy ra kich thuoc o; gioi han trong khoang
  // 26-64px de it cot khong bi phong qua to, nhieu cot van cuon ngang duoc.
  const TARGET_W = 640;
  const cell = Math.max(26, Math.min(64, Math.round((TARGET_W - labelW) / cols.length)));
  const W = labelW + cols.length * cell + 4; const H = headH + list.length * rowH + 30;
  const all = list.flatMap((r) => r.series.map(Number));
  const lo = Math.min(...all); const hi = Math.max(100, ...all);
  // width = chinh W (ty le 1:1 voi viewBox) de chu khong bi phong to/thu nho sai; container
  // co overflow-x rieng nen chi cuon ngang khi W vuot qua be rong khung, khong keo gian chu.
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} style={{ display: 'block', fontFamily: FONT, maxWidth: '100%' }}>
        <title>{label}</title>
        {cols.map((c, i) => (
          <text key={c + i} x={labelW + i * cell + cell / 2} y={16} textAnchor="middle" fontSize="10.5" fill={COLORS.muted}>{c}</text>
        ))}
        {list.map((r, ri) => {
          const yy = headH + ri * rowH; const on = activeName === r.name;
          return (
            <g key={r.name} onClick={onPick ? () => onPick(r.name) : undefined} style={onPick ? { cursor: 'pointer' } : undefined}>
              <text x={labelW - 8} y={yy + rowH / 2 + 4} textAnchor="end" fontSize="12" fontWeight={on ? 800 : 700} fill={on ? COLORS.red : COLORS.ink}>{r.name}</text>
              {r.series.map((v, ci) => (
                <g key={ci}>
                  <rect x={labelW + ci * cell + 1} y={yy + 1} width={cell - 2} height={rowH - 2} rx="4" fill={heat(Number(v), lo, hi)} />
                  {cell >= 28 && <text x={labelW + ci * cell + cell / 2} y={yy + rowH / 2 + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{fmt(v, 0)}</text>}
                </g>
              ))}
            </g>
          );
        })}
        <g transform={`translate(${labelW}, ${H - 18})`}>
          <text x="0" y="9" fontSize="10.5" fill={COLORS.muted}>Thấp</text>
          {[0, 0.25, 0.5, 0.75, 1].map((k, i) => <rect key={k} x={32 + i * 26} y="0" width="26" height="11" fill={heat(lo + (hi - lo) * k, lo, hi)} />)}
          <text x="168" y="9" fontSize="10.5" fill={COLORS.muted}>Cao ({fmt(lo, 0)} – {fmt(hi, 0)} điểm)</text>
        </g>
      </svg>
    </div>
  );
}

function Empty({ height = 160, text = 'Chưa có dữ liệu trong khoảng này.' }) {
  return (
    <div style={{ height, display: 'grid', placeItems: 'center', color: COLORS.muted, fontSize: 13.5, textAlign: 'center' }}>{text}</div>
  );
}
