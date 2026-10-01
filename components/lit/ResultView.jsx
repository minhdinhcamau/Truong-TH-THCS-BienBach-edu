'use client';
import { useMemo, useState } from 'react';
import { toneFor } from '@/lib/litConfig';

// Cắt bài văn thành các đoạn, đoạn nào được AI trích dẫn thì gắn chỉ số highlight
export function buildSegments(content, highlights = []) {
  const found = [];
  highlights.forEach((h, i) => {
    const q = (h.quote || '').trim();
    if (!q) return;
    const idx = content.indexOf(q);
    if (idx >= 0) found.push({ start: idx, end: idx + q.length, i });
  });
  found.sort((a, b) => a.start - b.start);
  const segs = [];
  let pos = 0;
  for (const f of found) {
    if (f.start < pos) continue; // bỏ đoạn chồng lấn
    if (f.start > pos) segs.push({ text: content.slice(pos, f.start) });
    segs.push({ text: content.slice(f.start, f.end), h: f.i });
    pos = f.end;
  }
  if (pos < content.length) segs.push({ text: content.slice(pos) });
  return segs;
}

export function ScoreRing({ score, max, size = 132 }) {
  const tone = toneFor(max ? score / max : 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.min(1, score / max) : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#eef3f2" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={tone.color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 60 60)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.27, fontWeight: 800, color: tone.color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 12, color: '#6b7f7a', marginTop: 2 }}>/ {max} điểm</span>
      </div>
    </div>
  );
}

// Bài văn với các đoạn được tô: xanh = viết tốt, gạch đỏ lượn sóng = cần sửa (như cô giáo chấm bút đỏ)
export function AnnotatedEssay({ content, highlights, activeIdx, onPick, fontSize = 17 }) {
  const segs = useMemo(() => buildSegments(content, highlights), [content, highlights]);
  return (
    <div className="essay" style={{ fontSize }}>
      <style jsx>{`
        .essay { font-family: 'Noto Serif', Georgia, 'Times New Roman', serif; line-height: 1.95; color: #1f2937; white-space: pre-wrap; word-break: break-word; }
        .hl { cursor: pointer; background: transparent; color: inherit; border-radius: 3px; padding: 1px 0; transition: background 0.15s; }
        .hl.good { background: linear-gradient(transparent 52%, #bdeccb 52%); }
        .hl.fix { text-decoration: underline wavy #c0392b; text-decoration-thickness: 1.5px; text-underline-offset: 5px; background: #fff3f1; }
        .hl.on { outline: 2px solid #225da3; outline-offset: 2px; }
        .hl:focus-visible { outline: 2px solid #225da3; outline-offset: 2px; }
      `}</style>
      {segs.map((s, i) =>
        s.h == null ? (
          <span key={i}>{s.text}</span>
        ) : (
          <mark key={i} className={`hl ${highlights[s.h].type} ${activeIdx === s.h ? 'on' : ''}`}
            role="button" tabIndex={0} onClick={() => onPick?.(s.h)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(s.h); } }}>
            {s.text}
          </mark>
        )
      )}
    </div>
  );
}

// Màn hình kết quả dành cho học sinh
export default function ResultView({ result, content }) {
  const [active, setActive] = useState(null);
  const max = Number(result.max_score) || 10;
  const total = Number(result.total) || 0;
  const tone = toneFor(max ? total / max : 0);
  const hl = result.highlights || [];
  const note = active != null ? hl[active] : null;
  const noteCrit = note?.criterion != null ? result.criteria?.[note.criterion] : null;

  return (
    <div className="rv">
      <style jsx>{`
        .rv { display: grid; gap: 18px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .card { background: #fff; border: 1px solid #e5eeec; border-radius: 18px; padding: 22px 24px; box-shadow: 0 2px 10px rgba(23,48,45,0.04); }
        .hero { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
        .hero-text { flex: 1; min-width: 240px; }
        .badge { display: inline-block; font-weight: 800; font-size: 13px; padding: 4px 12px; border-radius: 999px; margin-bottom: 10px; }
        .overall { margin: 0; font-size: 15.5px; line-height: 1.7; color: #1f2937; }
        .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .pair h4 { margin: 0 0 10px; font-size: 15px; }
        .pair ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 14px; line-height: 1.6; }
        .good-card { border-top: 4px solid #1a7f4e; }
        .good-card h4 { color: #1a7f4e; }
        .fix-card { border-top: 4px solid #c0392b; }
        .fix-card h4 { color: #c0392b; }
        .cols { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 18px; align-items: start; }
        .cols h3 { margin: 0 0 12px; font-size: 17px; color: #17302d; }
        .legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12.5px; color: #6b7f7a; margin-bottom: 12px; }
        .dot { display: inline-block; width: 22px; height: 10px; border-radius: 3px; vertical-align: middle; margin-right: 6px; }
        .dot.g { background: #bdeccb; }
        .dot.f { background: #fff3f1; border-bottom: 2px solid #c0392b; }
        .note { border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; font-size: 14px; line-height: 1.6; }
        .note.good { background: #EAFBEA; border: 1px solid #bdeccb; }
        .note.fix { background: #fff3f1; border: 1px solid #f3c4bd; }
        .note b { display: block; margin-bottom: 4px; }
        .hint { font-size: 13px; color: #9ca3af; margin: 0 0 12px; }
        .crit { padding: 14px 0; border-top: 1px solid #eef3f2; }
        .crit:first-of-type { border-top: none; padding-top: 0; }
        .crit-head { display: flex; justify-content: space-between; gap: 10px; font-weight: 700; font-size: 14.5px; }
        .bar { height: 8px; background: #eef3f2; border-radius: 999px; margin: 8px 0 10px; overflow: hidden; }
        .bar > i { display: block; height: 100%; border-radius: 999px; }
        .crit p { margin: 0 0 6px; font-size: 13.5px; line-height: 1.65; color: #374151; }
        .tip { background: #f5faff; border-left: 3px solid #225da3; padding: 7px 10px; border-radius: 0 8px 8px 0; font-size: 13px; color: #1b3a63; }
        @media (max-width: 860px) { .cols, .pair { grid-template-columns: 1fr; } }
      `}</style>

      <section className="card hero">
        <ScoreRing score={total} max={max} />
        <div className="hero-text">
          <span className="badge" style={{ color: tone.color, background: tone.soft }}>{tone.label}</span>
          <p className="overall">{result.overall}</p>
        </div>
      </section>

      {(result.strengths?.length > 0 || result.improvements?.length > 0) && (
        <div className="pair">
          <section className="card good-card">
            <h4>Em làm tốt</h4>
            <ul>{(result.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
          <section className="card fix-card">
            <h4>Em cần cải thiện</h4>
            <ul>{(result.improvements || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        </div>
      )}

      <div className="cols">
        <section className="card">
          <h3>Bài làm của em</h3>
          <div className="legend">
            <span><i className="dot g" />Viết tốt</span>
            <span><i className="dot f" />Cần sửa</span>
          </div>
          {hl.length > 0 && !note && <p className="hint">Bấm vào đoạn được tô màu để đọc nhận xét.</p>}
          {note && (
            <div className={`note ${note.type}`}>
              <b>{note.type === 'good' ? 'Viết tốt' : 'Cần sửa'}{noteCrit ? ` · ${noteCrit.name}` : ''}</b>
              {note.note || (note.type === 'good' ? 'Đoạn này viết tốt.' : 'Đoạn này cần xem lại.')}
            </div>
          )}
          <AnnotatedEssay content={content} highlights={hl} activeIdx={active}
            onPick={(i) => setActive(active === i ? null : i)} />
        </section>

        <section className="card">
          <h3>Điểm theo từng tiêu chí</h3>
          {(result.criteria || []).map((c, i) => {
            const t = toneFor(c.max_points ? c.score / c.max_points : 0);
            return (
              <div className="crit" key={c.criterion_id || i}>
                <div className="crit-head">
                  <span>{c.name}</span>
                  <span style={{ color: t.color }}>{c.score}/{c.max_points}</span>
                </div>
                <div className="bar"><i style={{ width: `${c.max_points ? (c.score / c.max_points) * 100 : 0}%`, background: t.color }} /></div>
                {c.comment && <p>{c.comment}</p>}
                {c.suggestion && <div className="tip"><b>Cách sửa: </b>{c.suggestion}</div>}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
