'use client';
// components/AvatarFrame.jsx — Avatar có khung theo hạng + hiệu ứng (càng lên cao càng đẹp).
// Cách dùng:
//   <AvatarFrame src={profile.avatar_url} name={profile.full_name} xp={profile.xp} size={72} />
//   Trong bình luận / câu hỏi (Ngôi sao lớp học rực rỡ nhất):
//   <AvatarFrame ... size={44} boost burstKey={lastPostedAt} />
//     - boost: bật chế độ "sặc sỡ" (hạng 6: hào quang bảy sắc, khung đổi màu; hạng 5: ánh vàng mạnh hơn)
//     - burstKey: đổi giá trị này (vd. thời điểm vừa gửi bình luận/câu hỏi) thì bắn pháo sao một lần (hạng 5, 6)
// Ảnh khung nằm ở public/frames/frame-1..6.png (nền trong suốt).
import { getRank } from '../lib/rank';

// Tâm (cx, cy) và bán kính (r) lỗ tròn đặt avatar, tính theo % cạnh ảnh khung (đã đo trên ảnh thật).
const GEO = {
  1: { cx: 49.53, cy: 42.81, r: 31.56 },
  2: { cx: 49.61, cy: 46.25, r: 30.7 },
  3: { cx: 49.77, cy: 47.19, r: 30.08 },
  4: { cx: 49.61, cy: 49.84, r: 34.77 },
  5: { cx: 49.92, cy: 51.56, r: 28.67 },
  6: { cx: 49.77, cy: 51.56, r: 28.05 },
};

// Vị trí các ngôi sao lấp lánh (% trong khung)
const SPARKS = {
  4: [[16, 20], [84, 22], [50, 3]],
  5: [[26, 9], [74, 9], [10, 46], [90, 46], [50, 1]],
  6: [[50, 0], [20, 12], [80, 12], [5, 40], [95, 40], [13, 68], [87, 68], [34, 4], [66, 4]],
};
const BURST_COLORS = ['#ffd54a', '#ff5c8a', '#4dd0ff', '#7cffb0', '#c77dff', '#ffffff', '#ff9a3c'];

function initials(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (w.length ? w[w.length - 1][0] : '?').toUpperCase();
}

export default function AvatarFrame({ src, name = '', xp = 0, level, size = 64, boost = false, burstKey = 0, className = '', style }) {
  const lv = level || getRank(xp).rank.level;
  const g = GEO[lv];
  const r = g.r + 1.2; // chui nhẹ xuống dưới viền khung cho khít
  const frameUrl = `/frames/frame-${lv}.png`;
  const mask = lv >= 3 ? { WebkitMaskImage: `url(${frameUrl})`, maskImage: `url(${frameUrl})` } : undefined;
  const sparks = SPARKS[lv] || [];
  const small = size < 40;

  return (
    <span className={`afr ${className}`} data-lv={lv} data-boost={boost ? 1 : 0} data-small={small ? 1 : 0}
      style={{ width: size, height: size, ...style }} aria-label={name ? `Ảnh đại diện của ${name}` : undefined}>
      {lv === 6 && <span className="afr-aura" />}
      <span className="afr-av" style={{ left: `${g.cx - r}%`, top: `${g.cy - r}%`, width: `${2 * r}%`, height: `${2 * r}%`, fontSize: size * 0.3 }}>
        {src ? <img src={src} alt="" draggable={false} /> : <b>{initials(name)}</b>}
      </span>
      <img className="afr-frame" src={frameUrl} alt="" draggable={false} />
      {lv >= 3 && <span className="afr-shine" style={mask} />}
      {!small && sparks.map(([x, y], i) => (
        <i key={i} className="afr-sp" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i * 0.37) % 2.4}s`, '--c': lv === 4 ? '#e8f1ff' : lv === 5 ? '#ffe27a' : BURST_COLORS[i % BURST_COLORS.length] }} />
      ))}
      {burstKey ? (
        <span key={burstKey} className="afr-burst" aria-hidden="true">
          {lv >= 5 && Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return <i key={i} style={{ '--dx': `${Math.cos(a) * size * 0.62}px`, '--dy': `${Math.sin(a) * size * 0.62}px`, '--c': BURST_COLORS[i % BURST_COLORS.length], animationDelay: `${(i % 3) * 0.03}s` }} />;
          })}
        </span>
      ) : null}

      <style jsx global>{`
/*CSS-START*/
.afr{position:relative;display:inline-block;flex:none;line-height:0;vertical-align:middle}
.afr-av{position:absolute;z-index:1;border-radius:50%;overflow:hidden;background:#dbe4f0;display:flex;align-items:center;justify-content:center;color:#3a4a66}
.afr-av img{width:100%;height:100%;object-fit:cover;display:block}
.afr-av b{font-weight:800;line-height:1}
.afr-frame{position:absolute;inset:0;z-index:2;width:100%;height:100%;pointer-events:none;user-select:none}
.afr-shine{position:absolute;inset:0;z-index:3;pointer-events:none;-webkit-mask-size:100% 100%;mask-size:100% 100%;
  background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.9) 50%,transparent 62%);background-size:260% 100%;background-position:160% 0;
  animation:afr-shine 5s ease-in-out infinite}
.afr-sp{position:absolute;z-index:4;width:14%;height:14%;margin:-7% 0 0 -7%;background:var(--c,#fff);pointer-events:none;opacity:0;
  clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);animation:afr-twinkle 2.4s ease-in-out infinite}

/* Hạng 3 — Khá: ánh sáng xanh nhẹ + vệt sáng */
.afr[data-lv='3'] .afr-frame{filter:drop-shadow(0 0 3px rgba(90,150,255,.55))}

/* Hạng 4 — Giỏi: viền sáng bạc xanh nhấp nháy + sao */
.afr[data-lv='4'] .afr-frame{animation:afr-glow-b 2.8s ease-in-out infinite}
.afr[data-lv='4'] .afr-shine{animation-duration:4s}

/* Hạng 5 — Xuất sắc: ánh vàng toả sáng + sao bay lên */
.afr[data-lv='5'] .afr-frame{animation:afr-glow-g 2.2s ease-in-out infinite}
.afr[data-lv='5'] .afr-shine{animation-duration:3.2s}
.afr[data-lv='5'] .afr-sp{animation-name:afr-rise;animation-duration:2.8s}
.afr[data-lv='5'][data-boost='1'] .afr-frame{animation-duration:1.2s}

/* Hạng 6 — Ngôi sao lớp học: hào quang bảy sắc */
.afr-aura{position:absolute;inset:-6%;z-index:0;border-radius:50%;pointer-events:none;opacity:.5;filter:blur(7px);
  background:conic-gradient(#ff3d71,#ffb300,#ffee00,#3ddc84,#00c8ff,#6a5cff,#d500f9,#ff3d71);animation:afr-spin 8s linear infinite}
.afr[data-lv='6'] .afr-frame{animation:afr-glow-g 2s ease-in-out infinite}
.afr[data-lv='6'] .afr-shine{animation-duration:2.6s}
.afr[data-lv='6'] .afr-sp{animation-duration:2s}
/* boost = đang bình luận / hỏi bài: sặc sỡ hết cỡ */
.afr[data-lv='6'][data-boost='1'] .afr-aura{inset:-11%;opacity:.95;filter:blur(5px);animation:afr-spin 2.6s linear infinite,afr-pulse 1.3s ease-in-out infinite}
.afr[data-lv='6'][data-boost='1'] .afr-frame{animation:afr-glow-g 1s ease-in-out infinite,afr-hue 3.2s ease-in-out infinite}
.afr[data-lv='6'][data-boost='1'] .afr-sp{animation-duration:1.2s}

/* Pháo sao khi vừa gửi bình luận / câu hỏi */
.afr-burst{position:absolute;left:50%;top:50%;z-index:5;width:0;height:0;pointer-events:none}
.afr-burst i{position:absolute;left:0;top:0;width:11%;height:11%;min-width:6px;min-height:6px;background:var(--c);
  clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);transform:translate(-50%,-50%);opacity:0;
  animation:afr-burst .9s ease-out forwards}

@keyframes afr-shine{0%{background-position:160% 0}30%{background-position:-60% 0}100%{background-position:-60% 0}}
@keyframes afr-glow-b{0%,100%{filter:drop-shadow(0 0 2px rgba(110,165,255,.5))}50%{filter:drop-shadow(0 0 8px rgba(170,215,255,1))}}
@keyframes afr-glow-g{0%,100%{filter:drop-shadow(0 0 3px rgba(255,200,40,.55))}50%{filter:drop-shadow(0 0 11px rgba(255,225,90,1))}}
@keyframes afr-hue{0%,100%{filter:hue-rotate(-30deg) saturate(1.25) drop-shadow(0 0 8px rgba(255,120,200,.9))}50%{filter:hue-rotate(40deg) saturate(1.35) drop-shadow(0 0 10px rgba(80,220,255,.95))}}
@keyframes afr-spin{to{transform:rotate(360deg)}}
@keyframes afr-pulse{0%,100%{scale:1}50%{scale:1.08}}
@keyframes afr-twinkle{0%,100%{opacity:0;transform:scale(.2)}50%{opacity:1;transform:scale(1)}}
@keyframes afr-rise{0%{opacity:0;transform:translateY(8%) scale(.4)}40%{opacity:1;transform:translateY(-4%) scale(1)}100%{opacity:0;transform:translateY(-22%) scale(.3)}}
@keyframes afr-burst{0%{opacity:1;transform:translate(-50%,-50%) scale(.3)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.1)}}

@media (prefers-reduced-motion:reduce){
  .afr *{animation:none!important}
  .afr-sp{display:none}
}
/*CSS-END*/
      `}</style>
    </span>
  );
}
