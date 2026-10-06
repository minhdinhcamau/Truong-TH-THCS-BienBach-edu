'use client';
// components/AvatarFrame.jsx — Avatar có khung theo hạng.
//   <AvatarFrame src name xp size={64} />            tự lấy khung theo hạng
//   <AvatarFrame ... frame={3} />                    ép dùng khung số 3 (người dùng tự chọn, đã kiểm hạng)
// Mọi hiệu ứng nằm TRONG hộp vuông của avatar (overflow: hidden) nên không tràn ra làm vỡ bố cục trên điện thoại.
// Hạng 6 (Ngôi sao lớp học): chùm sáng cực quang chạy quanh khung kim loại + sao lấp lánh bay quanh. Không còn hào quang bảy sắc.
// Ảnh khung: public/frames/frame-1..6.png.
import { getRank } from '../lib/rank';

const GEO = {
  1: { cx: 49.53, cy: 42.81, r: 31.56 },
  2: { cx: 49.61, cy: 46.25, r: 30.7 },
  3: { cx: 49.77, cy: 47.19, r: 30.08 },
  4: { cx: 49.61, cy: 49.84, r: 34.77 },
  5: { cx: 49.92, cy: 51.56, r: 28.67 },
  6: { cx: 49.77, cy: 51.56, r: 28.05 },
};
const SPARKS = {
  4: [[18, 22], [82, 24], [50, 8]],
  5: [[26, 14], [74, 14], [12, 46], [88, 46]],
  6: [[50, 6], [22, 16], [78, 16], [10, 42], [90, 42], [30, 70], [70, 70]],
};
const SPARK_COLORS = { 4: '#e8f1ff', 5: '#ffe27a', 6: '#fff3b0' };

function initials(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (w.length ? w[w.length - 1][0] : '?').toUpperCase();
}

export default function AvatarFrame({ src, name = '', xp = 0, level, frame, size = 64, className = '', style }) {
  const own = level || getRank(xp).rank.level;
  const lv = frame || own; // khung hiển thị
  const g = GEO[lv] || GEO[1];
  const r = g.r + 1.2;
  const frameUrl = `/frames/frame-${lv}.png`;
  const mask = lv >= 3 ? { WebkitMaskImage: `url(${frameUrl})`, maskImage: `url(${frameUrl})` } : undefined;
  const sparks = size < 44 ? [] : SPARKS[lv] || [];

  return (
    <span className={`afr ${className}`} data-lv={lv} style={{ width: size, height: size, ...style }}
      aria-label={name ? `Ảnh đại diện của ${name}` : undefined}>
      <span className="afr-av" style={{ left: `${g.cx - r}%`, top: `${g.cy - r}%`, width: `${2 * r}%`, height: `${2 * r}%`, fontSize: size * 0.3 }}>
        {src ? <img src={src} alt="" draggable={false} /> : <b>{initials(name)}</b>}
      </span>
      <img className="afr-frame" src={frameUrl} alt="" draggable={false} />
      {lv >= 3 && <span className="afr-shine" style={mask} />}
      {lv === 6 && (
        <span className="afr-beam-mask" style={mask}>
          <span className="afr-beam" />
        </span>
      )}
      {sparks.map(([x, y], i) => (
        <i key={i} className="afr-sp" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i * 0.41) % 2.6}s`, '--c': SPARK_COLORS[lv] || '#fff' }} />
      ))}

      <style jsx global>{`
.afr{position:relative;display:inline-block;flex:none;line-height:0;vertical-align:middle;overflow:hidden;isolation:isolate;contain:paint}
.afr-av{position:absolute;z-index:1;border-radius:50%;overflow:hidden;background:#dbe4f0;display:flex;align-items:center;justify-content:center;color:#3a4a66}
.afr-av img{width:100%;height:100%;object-fit:cover;display:block}
.afr-av b{font-weight:800;line-height:1}
.afr-frame{position:absolute;inset:0;z-index:2;width:100%;height:100%;pointer-events:none;user-select:none}
.afr-shine{position:absolute;inset:0;z-index:3;pointer-events:none;-webkit-mask-size:100% 100%;mask-size:100% 100%;
  background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.9) 50%,transparent 62%);background-size:260% 100%;background-position:160% 0;
  animation:afr-shine 5s ease-in-out infinite}
.afr-sp{position:absolute;z-index:4;width:13%;height:13%;margin:-6.5% 0 0 -6.5%;background:var(--c,#fff);pointer-events:none;opacity:0;
  clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);animation:afr-twinkle 2.6s ease-in-out infinite}

.afr[data-lv='3'] .afr-frame{filter:drop-shadow(0 0 2px rgba(90,150,255,.5))}
.afr[data-lv='4'] .afr-frame{animation:afr-glow-b 2.8s ease-in-out infinite}
.afr[data-lv='5'] .afr-frame{animation:afr-glow-g 2.4s ease-in-out infinite}
.afr[data-lv='5'] .afr-shine{animation-duration:3.4s}
.afr[data-lv='5'] .afr-sp{animation-name:afr-rise;animation-duration:3s}

/* Hạng 6: chùm sáng cực quang quét quanh khung (chỉ hiện trên phần kim loại của khung) */
.afr-beam-mask{position:absolute;inset:0;z-index:3;pointer-events:none;-webkit-mask-size:100% 100%;mask-size:100% 100%;mix-blend-mode:screen}
.afr-beam{position:absolute;left:-50%;top:-50%;width:200%;height:200%;
  background:conic-gradient(from 0deg,transparent 0 58%,rgba(120,220,255,.0) 62%,rgba(255,255,255,.95) 72%,rgba(255,210,90,.95) 80%,rgba(255,120,220,.7) 88%,transparent 95%);
  animation:afr-spin 3.6s linear infinite}
.afr[data-lv='6'] .afr-frame{animation:afr-glow-g 2.2s ease-in-out infinite}
.afr[data-lv='6'] .afr-shine{animation-duration:2.8s}
.afr[data-lv='6'] .afr-sp{animation-duration:2.2s}

@keyframes afr-shine{0%{background-position:160% 0}30%{background-position:-60% 0}100%{background-position:-60% 0}}
@keyframes afr-glow-b{0%,100%{filter:drop-shadow(0 0 1px rgba(110,165,255,.5))}50%{filter:drop-shadow(0 0 4px rgba(170,215,255,1))}}
@keyframes afr-glow-g{0%,100%{filter:drop-shadow(0 0 1px rgba(255,200,40,.55))}50%{filter:drop-shadow(0 0 5px rgba(255,225,90,1))}}
@keyframes afr-spin{to{transform:rotate(360deg)}}
@keyframes afr-twinkle{0%,100%{opacity:0;transform:scale(.2)}50%{opacity:1;transform:scale(1)}}
@keyframes afr-rise{0%{opacity:0;transform:translateY(8%) scale(.4)}40%{opacity:1;transform:translateY(-4%) scale(1)}100%{opacity:0;transform:translateY(-18%) scale(.3)}}

@media (prefers-reduced-motion:reduce){
  .afr *{animation:none!important}
  .afr-sp,.afr-beam-mask{display:none}
}
      `}</style>
    </span>
  );
}
