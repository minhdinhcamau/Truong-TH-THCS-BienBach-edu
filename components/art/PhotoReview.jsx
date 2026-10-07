'use client';
// Bước kiểm tra ảnh bài vẽ trước khi gửi: xem trước, xoay, cắt, chỉnh sáng, làm trắng nền giấy,
// và báo chất lượng bằng lời (✅ / ⚠️ / ❌). Chạy hoàn toàn ở trình duyệt, KHÔNG dùng AI.
import { useEffect, useMemo, useRef, useState } from 'react';
import './photo-review.css';
import { compressImage } from '@/lib/compressImage';
import {
  openImage, rotatedSize, drawRegion, scaleFor, paperLevels,
  makeLut, isIdentityLut, applyLut, measureCanvas, canvasToFile,
} from '@/lib/photoEdit';

const PREVIEW_SIDE = 1000;
const FINAL_SIDE = 1600;
const MIN_CROP = 0.15;
const FULL = { x: 0, y: 0, w: 1, h: 1 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Cắt một vùng (theo tỉ lệ 0..1) của canvas ra canvas mới.
function cropFrom(canvas, crop) {
  const sx = Math.round(crop.x * canvas.width);
  const sy = Math.round(crop.y * canvas.height);
  const sw = Math.max(1, Math.round(crop.w * canvas.width));
  const sh = Math.max(1, Math.round(crop.h * canvas.height));
  const out = document.createElement('canvas');
  out.width = sw; out.height = sh;
  out.getContext('2d', { willReadFrequently: true }).drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

const VERDICT_UI = {
  ok: { icon: '✅', title: 'Ảnh đạt', cls: 'ok' },
  warn: { icon: '⚠️', title: 'Nên xem lại', cls: 'warn' },
  bad: { icon: '❌', title: 'Ảnh chưa đạt', cls: 'bad' },
};

export default function PhotoReview({ file, title, onCancel, onSubmit }) {
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [rot, setRot] = useState(0);
  const [crop, setCrop] = useState(FULL);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [whiten, setWhiten] = useState(false);
  const [report, setReport] = useState(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const baseRef = useRef({ key: '', canvas: null });
  const drag = useRef(null);

  // Mở ảnh
  useEffect(() => {
    let alive = true;
    setInfo(null); setLoadError('');
    openImage(file)
      .then((r) => { if (alive) setInfo(r); })
      .catch(() => { if (alive) setLoadError('Không mở được ảnh. Em hãy chụp lại bằng camera hoặc chọn ảnh JPG/PNG khác.'); });
    return () => { alive = false; };
  }, [file]);

  // Khóa cuộn trang phía sau
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const adjust = useMemo(() => ({ brightness, contrast, whiten }), [brightness, contrast, whiten]);

  // Vẽ xem trước + đo chất lượng (đo trên ảnh ĐÃ chỉnh, đúng vùng đã cắt)
  useEffect(() => {
    if (!info || !canvasRef.current) return undefined;
    const { source, width, height } = info;
    const key = `${rot}`;
    if (baseRef.current.key !== key || baseRef.current.info !== info) {
      baseRef.current = { key, info, canvas: drawRegion(source, width, height, rot, null, scaleFor(width, height, rot, null, PREVIEW_SIDE)) };
    }
    const base = baseRef.current.canvas;
    const show = canvasRef.current;
    show.width = base.width; show.height = base.height;
    const ctx = show.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(base, 0, 0);
    const levels = adjust.whiten ? paperLevels(cropFrom(base, crop)) : null;
    const opts = { brightness: adjust.brightness, contrast: adjust.contrast, levels };
    if (!isIdentityLut(opts)) applyLut(show, makeLut(opts));

    setReport(null);
    const t = setTimeout(() => {
      try {
        const r = rotatedSize(width, height, rot);
        const longSide = Math.max(crop.w * r.w, crop.h * r.h);
        setReport(measureCanvas(cropFrom(show, crop), longSide));
      } catch (e) { setReport({ verdict: 'warn', issues: [], metrics: {}, failed: true }); }
    }, 250);
    return () => clearTimeout(t);
  }, [info, rot, crop, adjust]);

  // Đổi bài/điều chỉnh thì bỏ tick "vẫn muốn gửi"
  useEffect(() => { setAck(false); }, [report && report.verdict]);

  function rotate(delta) {
    setRot((r) => (r + delta + 360) % 360);
    setCrop(FULL);
  }
  function reset() {
    setRot(0); setCrop(FULL); setBrightness(0); setContrast(0); setWhiten(false); setErr('');
  }

  // Kéo khung cắt
  function onDown(e, mode) {
    e.preventDefault(); e.stopPropagation();
    const rect = stageRef.current.getBoundingClientRect();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, rect, start: { ...crop } };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* bỏ qua */ }
  }
  function onMove(e) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / d.rect.width;
    const dy = (e.clientY - d.sy) / d.rect.height;
    const s = d.start;
    if (d.mode === 'move') {
      setCrop({ x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h), w: s.w, h: s.h });
      return;
    }
    let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
    if (d.mode.includes('w')) x0 = clamp(s.x + dx, 0, x1 - MIN_CROP);
    if (d.mode.includes('e')) x1 = clamp(s.x + s.w + dx, x0 + MIN_CROP, 1);
    if (d.mode.includes('n')) y0 = clamp(s.y + dy, 0, y1 - MIN_CROP);
    if (d.mode.includes('s')) y1 = clamp(s.y + s.h + dy, y0 + MIN_CROP, 1);
    setCrop({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  function onUp() { drag.current = null; }

  const verdict = report ? report.verdict : null;
  const ui = verdict ? VERDICT_UI[verdict] : null;
  const canSend = !!report && !busy && (verdict !== 'bad' || ack);
  const sendLabel = busy ? 'Đang gửi…' : verdict === 'ok' ? 'Gửi bài' : 'Vẫn gửi ảnh này';

  async function send() {
    if (!canSend || !info) return;
    setBusy(true); setErr('');
    try {
      const { source, width, height } = info;
      const s = scaleFor(width, height, rot, crop, FINAL_SIDE);
      const canvas = drawRegion(source, width, height, rot, crop, s);
      const levels = whiten ? paperLevels(canvas) : null;
      const opts = { brightness, contrast, levels };
      if (!isIdentityLut(opts)) applyLut(canvas, makeLut(opts));
      const raw = await canvasToFile(canvas, 'bai-ve.jpg', 0.9);
      const out = await compressImage(raw, { maxWidth: FINAL_SIDE, maxHeight: FINAL_SIDE, quality: 0.85, maxSizeKB: 900 });
      const r3 = (v) => Math.round(v * 1000) / 1000;
      await onSubmit({
        file: out,
        quality: {
          verdict,
          sentAnyway: verdict !== 'ok',
          ack: verdict === 'bad' && ack,
          codes: (report.issues || []).map((i) => i.code),
          metrics: report.metrics || {},
          edits: { rot, crop: { x: r3(crop.x), y: r3(crop.y), w: r3(crop.w), h: r3(crop.h) }, brightness, contrast, whiten },
        },
      });
    } catch (e) {
      setErr((e && e.message) || 'Không gửi được, em thử lại nhé.');
      setBusy(false);
    }
  }

  const pct = (v) => `${v * 100}%`;

  return (
    <div className="pr-overlay" role="dialog" aria-modal="true" aria-label="Kiểm tra ảnh bài vẽ">
      <div className="pr-sheet">
        <header className="pr-head">
          <div>
            <h2>Kiểm tra ảnh bài vẽ</h2>
            {title && <p>{title}</p>}
          </div>
          <button type="button" className="pr-x" onClick={onCancel} disabled={busy} aria-label="Đóng">✕</button>
        </header>

        {loadError ? (
          <div className="pr-fail">
            <p>{loadError}</p>
            <button type="button" className="pr-btn pr-primary" onClick={onCancel}>Đóng</button>
          </div>
        ) : !info ? (
          <div className="pr-loading">Đang mở ảnh…</div>
        ) : (
          <div className="pr-body">
            <div className="pr-left">
              <div className="pr-stage-wrap">
                <div className="pr-stage" ref={stageRef}>
                  <canvas ref={canvasRef} className="pr-canvas" />
                  <div
                    className="pr-crop"
                    style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
                    onPointerDown={(e) => onDown(e, 'move')}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                  >
                    {['nw', 'ne', 'sw', 'se'].map((m) => (
                      <span
                        key={m}
                        className={`pr-h pr-h-${m}`}
                        onPointerDown={(e) => onDown(e, m)}
                        onPointerMove={onMove}
                        onPointerUp={onUp}
                        onPointerCancel={onUp}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <p className="pr-hint">Kéo khung và 4 góc để cắt bỏ phần thừa quanh tờ giấy.</p>
            </div>

            <div className="pr-right">
              <div className={`pr-report ${ui ? ui.cls : 'wait'}`} aria-live="polite">
                {!report ? (
                  <b>Đang kiểm tra ảnh…</b>
                ) : (
                  <>
                    <b>{ui.icon} {ui.title}{verdict === 'ok' ? ': đủ sáng và rõ nét' : ''}</b>
                    {report.failed && <p>Máy chưa kiểm tra được ảnh này, em tự xem lại giúp cô nhé.</p>}
                    {(report.issues || []).map((i) => (
                      <div key={i.code} className="pr-issue">
                        <span>{i.level === 'bad' ? '❌' : '⚠️'} {i.text}</span>
                        <small>{i.tip}</small>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {verdict === 'bad' && (
                <label className="pr-ack">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={busy} />
                  <span>Em hiểu ảnh chưa rõ nhưng vẫn muốn gửi</span>
                </label>
              )}

              {err && <div className="pr-err">{err}</div>}
              <div className="pr-tools">
                <div className="pr-row">
                  <button type="button" className="pr-btn" onClick={() => rotate(-90)} disabled={busy}>↺ Xoay trái</button>
                  <button type="button" className="pr-btn" onClick={() => rotate(90)} disabled={busy}>↻ Xoay phải</button>
                  <button type="button" className="pr-btn pr-ghost" onClick={reset} disabled={busy}>Đặt lại</button>
                </div>
                <label className="pr-slide">
                  <span>Độ sáng <b>{brightness}</b></span>
                  <input type="range" min="-100" max="100" step="1" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} disabled={busy} />
                </label>
                <label className="pr-slide">
                  <span>Độ tương phản <b>{contrast}</b></span>
                  <input type="range" min="-100" max="100" step="1" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} disabled={busy} />
                </label>
                <button type="button" className={`pr-btn pr-whiten${whiten ? ' on' : ''}`} onClick={() => setWhiten((v) => !v)} disabled={busy} aria-pressed={whiten}>
                  {whiten ? '✓ Đã làm trắng nền giấy' : 'Làm trắng nền giấy'}
                </button>
              </div>

            </div>
          </div>
        )}

        {!loadError && (
          <footer className="pr-foot">
            <button type="button" className="pr-btn" onClick={onCancel} disabled={busy}>Chọn ảnh khác</button>
            <button type="button" className="pr-btn pr-primary" onClick={send} disabled={!canSend}>{sendLabel}</button>
          </footer>
        )}
      </div>
    </div>
  );
}
