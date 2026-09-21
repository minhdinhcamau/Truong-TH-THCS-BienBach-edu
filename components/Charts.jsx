'use client';
// Biểu đồ nhỏ vẽ bằng SVG/HTML thuần (không cần thư viện), dùng để chiếu sinh hoạt lớp.

const PALETTE = ['#c4262e', '#2563a8', '#1a8a58', '#d99a1c', '#7a4bb0', '#0e8a94', '#b9473c', '#4b5d73'];
export const groupColor = (g) => PALETTE[((g || 1) - 1) % PALETTE.length];

// Thanh ngang: items = [{ label, value, color?, sub? }]
export function BarList({ items, unit = '', big = false, emptyText = 'Chưa có dữ liệu.' }) {
  if (!items || items.length === 0) return <div style={{ color: '#5f6f83', padding: '14px 0', fontSize: big ? 22 : 13.5 }}>{emptyText}</div>;
  const max = Math.max(...items.map((i) => Math.abs(Number(i.value)) || 0), 1);
  return (
    <div style={{ display: 'grid', gap: big ? 14 : 8 }}>
      {items.map((it, i) => (
        <div key={`${it.label}-${i}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: big ? 24 : 13, fontWeight: 600 }}>
            <span>{it.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{it.sub || `${Number(it.value).toLocaleString('vi-VN')}${unit}`}</span>
          </div>
          <div style={{ background: '#eaeff5', borderRadius: 999, height: big ? 20 : 10, overflow: 'hidden', marginTop: 4 }}>
            <div style={{ width: `${Math.max(3, (Math.abs(Number(it.value)) / max) * 100)}%`, height: '100%', background: it.color || PALETTE[i % PALETTE.length], borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Cột đứng: items = [{ label, value, color? }]
export function ColumnChart({ items, height = 170, big = false }) {
  if (!items || items.length === 0) return <div style={{ color: '#5f6f83', padding: '14px 0', fontSize: big ? 22 : 13.5 }}>Chưa có dữ liệu.</div>;
  const max = Math.max(...items.map((i) => Math.abs(Number(i.value)) || 0), 1);
  const h = big ? height * 1.5 : height;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: big ? 18 : 10, height: h + 46 }}>
      {items.map((it, i) => (
        <div key={`${it.label}-${i}`} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: big ? 22 : 13, fontVariantNumeric: 'tabular-nums' }}>{Number(it.value).toLocaleString('vi-VN')}</div>
          <div style={{ height: (Math.abs(Number(it.value)) / max) * h + 2, background: it.color || PALETTE[i % PALETTE.length], borderRadius: '8px 8px 0 0', marginTop: 4 }} />
          <div style={{ fontSize: big ? 18 : 12, color: '#5f6f83', marginTop: 6, fontWeight: 600 }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

// Đường xu hướng: points = [{ label, value }]; invert = true khi số càng nhỏ càng tốt (như hạng)
export function LineChart({ points, height = 170, color = '#c4262e', big = false, invert = false }) {
  if (!points || points.length === 0) return <div style={{ color: '#5f6f83', padding: '14px 0' }}>Chưa có dữ liệu.</div>;
  const W = 520;
  const H = big ? height * 1.5 : height;
  const pad = { l: 34, r: 16, t: 22, b: 30 };
  const vals = points.map((p) => Number(p.value));
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const x = (i) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v) => {
    const t = (v - min) / (max - min);
    return pad.t + (invert ? t : 1 - t) * (H - pad.t - pad.b);
  };
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(p.value)).toFixed(1)}`).join(' ');
  const fs = big ? 15 : 11.5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Biểu đồ xu hướng" style={{ display: 'block' }}>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#dbe3ec" />
      <path d={path} fill="none" stroke={color} strokeWidth={big ? 4 : 3} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(Number(p.value))} r={big ? 6 : 4.5} fill="#fff" stroke={color} strokeWidth="2.5" />
          <text x={x(i)} y={y(Number(p.value)) - 10} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#14263d">
            {Number(p.value).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
          </text>
          <text x={x(i)} y={H - 9} textAnchor="middle" fontSize={fs - 1} fill="#5f6f83">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}
