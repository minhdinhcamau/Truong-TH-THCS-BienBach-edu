'use client';
import { useRef } from 'react';
import { DUTY_MAP_BASE, DUTY_VIEWBOX } from '@/lib/tpt/dutyMapBase';

// Bản đồ trường + các khu vực trực nhật. Dùng chung cho trang Tổng phụ trách (sửa) và trang học sinh, giáo viên (chỉ xem).
//
// zones     : [{ id, name, color, points: "x,y x,y ...", x, y }]
// labels    : { [zoneId]: ["6A1", "7A2"] }  lớp trực của khu vực trong tuần đang xem
// mine      : Set các zoneId có lớp của người xem (được tô nổi bật)
// selectedId, onSelect(zoneId)
// Chế độ sửa (edit = true):
//   showEmpty      : vẽ viền các khu vực chưa có lớp
//   editShapeId    : khu vực đang được sửa hình (hiện các điểm kéo được)
//   onVertexMove(zoneId, index, [x, y]), onVertexInsert(zoneId, index, [x, y])
//   selVertex, onSelVertex(index | null)
//   drawing        : null hoặc mảng điểm đang vẽ khu vực mới; onDrawPoint([x, y])
export const parsePts = (s) => String(s || '').trim().split(/\s+/).map((p) => p.split(',').map(Number)).filter((q) => q.length === 2 && q.every(Number.isFinite));
export const ptsToStr = (arr) => arr.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(' ');
export const centerOf = (arr) => {
  const xs = arr.map((q) => q[0]);
  const ys = arr.map((q) => q[1]);
  return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)];
};

export default function DutyMap({
  svgRef, zones, labels = {}, mine, selectedId, onSelect, edit = false, showEmpty = false,
  editShapeId = null, onVertexMove, onVertexInsert, selVertex = null, onSelVertex,
  drawing = null, onDrawPoint,
}) {
  const localRef = useRef(null);
  const ref = svgRef || localRef;
  const drag = useRef(null);

  const toSvg = (e) => {
    const sv = ref.current;
    const p = sv.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(sv.getScreenCTM().inverse());
    return [Math.round(q.x), Math.round(q.y)];
  };

  const onSvgDown = (e) => {
    if (!drawing || !onDrawPoint) return;
    e.preventDefault();
    onDrawPoint(toSvg(e));
  };

  const startDrag = (e, zoneId, idx) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { zoneId, idx, moved: false };
  };
  const moveDrag = (e) => {
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    onVertexMove?.(d.zoneId, d.idx, toSvg(e));
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) onSelVertex?.(d.idx);
  };

  const sorted = zones;
  const shape = zones.find((z) => z.id === editShapeId);
  const shapePts = shape ? parsePts(shape.points) : [];

  return (
    <svg
      ref={ref}
      viewBox={DUTY_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, touchAction: drawing ? 'none' : undefined, cursor: drawing ? 'crosshair' : undefined, userSelect: 'none' }}
      onPointerDown={onSvgDown}
      role="img"
      aria-label="Bản đồ khu vực trực nhật của trường"
    >
      <g dangerouslySetInnerHTML={{ __html: DUTY_MAP_BASE }} />

      <g>
        {sorted.map((z) => {
          const names = labels[z.id] || [];
          const has = names.length > 0;
          const on = z.id === selectedId;
          const isMine = mine && mine.has(z.id);
          if (!has && !edit && !on) return null;
          if (!has && edit && !showEmpty && !on) return null;
          return (
            <polygon
              key={z.id}
              points={z.points}
              fill={has ? z.color : '#ffffff'}
              fillOpacity={has ? (on ? 0.6 : isMine ? 0.55 : 0.4) : on ? 0.35 : 0.001}
              stroke={on || isMine ? '#ffffff' : has ? z.color : '#ffffff'}
              strokeOpacity={has || on ? 1 : 0.7}
              strokeWidth={on ? 7 : isMine ? 7 : has ? 3 : 2.5}
              strokeDasharray={has && !on ? undefined : '10 8'}
              strokeLinejoin="round"
              style={{ cursor: drawing ? 'crosshair' : 'pointer' }}
              onClick={() => { if (!drawing) onSelect?.(z.id); }}
            />
          );
        })}
      </g>

      <g style={{ pointerEvents: 'none' }}>
        {sorted.map((z) => {
          const names = (labels[z.id] || []).join(', ');
          const on = z.id === selectedId;
          if (!names && !(edit && on)) return null;
          const w = z.name.length * 15.5 + 26;
          const cls = names.length > 20 ? `${names.slice(0, 19)}…` : names;
          const w2 = cls.length * 13 + 26;
          return (
            <g key={z.id} transform={`translate(${z.x} ${z.y})`}>
              <rect x={-w / 2} y={-20} width={w} height={38} rx={19} fill="#fff" fillOpacity={0.96} stroke={z.color} strokeWidth={3} />
              <text y={7} textAnchor="middle" fontSize={22} fontWeight={700} fill="#1f2937">{z.name}</text>
              {names && (
                <>
                  <rect x={-w2 / 2} y={24} width={w2} height={34} rx={17} fill={z.color} />
                  <text y={48} textAnchor="middle" fontSize={21} fontWeight={700} fill="#fff">{cls}</text>
                </>
              )}
            </g>
          );
        })}
      </g>

      {/* Các điểm kéo được của khu vực đang sửa hình */}
      {edit && shape && shapePts.length > 0 && (
        <g>
          <polygon points={shape.points} fill="none" stroke="#f97316" strokeWidth={4} strokeDasharray="10 7" style={{ pointerEvents: 'none' }} />
          {shapePts.map((q, i) => {
            const n = shapePts[(i + 1) % shapePts.length];
            const mid = [Math.round((q[0] + n[0]) / 2), Math.round((q[1] + n[1]) / 2)];
            return (
              <g
                key={`m${i}`}
                style={{ cursor: 'copy', touchAction: 'none' }}
                onPointerDown={(e) => {
                  onVertexInsert?.(shape.id, i + 1, mid);
                  startDrag(e, shape.id, i + 1);
                  drag.current.moved = true; // điểm mới thêm: không coi là "chạm chọn"
                }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <circle cx={mid[0]} cy={mid[1]} r={24} fill="transparent" />
                <circle cx={mid[0]} cy={mid[1]} r={9} fill="#fff" stroke="#f97316" strokeWidth={3} fillOpacity={0.9} />
                <path d={`M${mid[0] - 4} ${mid[1]}h8M${mid[0]} ${mid[1] - 4}v8`} stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" />
              </g>
            );
          })}
          {shapePts.map((q, i) => (
            <g
              key={`v${i}`}
              style={{ cursor: 'grab', touchAction: 'none' }}
              onPointerDown={(e) => startDrag(e, shape.id, i)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <circle cx={q[0]} cy={q[1]} r={28} fill="transparent" />
              <circle cx={q[0]} cy={q[1]} r={14} fill={selVertex === i ? '#ef4444' : '#f97316'} stroke="#fff" strokeWidth={4} />
            </g>
          ))}
        </g>
      )}

      {/* Khu vực mới đang vẽ */}
      {drawing && drawing.length > 0 && (
        <g style={{ pointerEvents: 'none' }}>
          <polygon points={drawing.map((q) => q.join(',')).join(' ')} fill="#f97316" fillOpacity={0.25} stroke="#f97316" strokeWidth={5} strokeDasharray="12 8" />
          {drawing.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={9} fill="#f97316" stroke="#fff" strokeWidth={3} />)}
        </g>
      )}
    </svg>
  );
}

// In sơ đồ: mở cửa sổ in riêng chỉ gồm tiêu đề, bản đồ và danh sách lớp
export function printDutyMap(svgEl, title, rows) {
  if (!svgEl) return;
  const w = window.open('', '_blank');
  if (!w) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const list = (rows || []).map((r) => `<tr><td>${esc(r.zone)}</td><td>${esc(r.classes)}</td></tr>`).join('');
  w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;margin:16px;color:#111}h1{font-size:20px;margin:0 0 10px}svg{width:100%;max-height:78vh;height:auto}
table{border-collapse:collapse;margin-top:10px;font-size:14px}td{border:1px solid #bbb;padding:5px 10px}@page{size:A4 portrait;margin:10mm}</style></head><body>
<h1>${esc(title)}</h1>${svgEl.outerHTML}<table>${list}</table></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
