'use client';
// GAME (tách riêng): màn hình tạo nhân vật. Xóa cùng thư mục components/game khi gỡ game.
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_CFG, HAIRS, OPTIONS, SKINS, SIZE, renderCharacter, sanitize, randomCfg } from '../../lib/game/sprites';

const DIRS = [
  { id: 'front', label: 'Nhìn trước' },
  { id: 'side', label: 'Nhìn bên' },
  { id: 'back', label: 'Nhìn sau' },
];

function Chips({ list, value, onPick }) {
  return (
    <div className="gm-row">
      {list.map((o) => (
        <button key={o.id} type="button" className="gm-chip" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ list, value, onPick }) {
  return (
    <div className="gm-row">
      {list.map((o, i) => (
        <button
          key={o.name}
          type="button"
          className="gm-sw"
          title={o.name}
          aria-label={o.name}
          aria-pressed={value === i}
          style={{ background: o.base }}
          onClick={() => onPick(i)}
        />
      ))}
    </div>
  );
}

export default function CharacterCreator({ initial, saving, message, onSave, onCancel }) {
  const [cfg, setCfg] = useState(() => sanitize(initial || DEFAULT_CFG));
  const canvasRef = useRef(null);

  const [dir, setDir] = useState('front');
  const [walk, setWalk] = useState(false);
  const [tick, setTick] = useState(0);
  const [blink, setBlink] = useState(false);

  // chớp mắt định kỳ; bước đi khi bật "Đi thử"
  useEffect(() => {
    let t1;
    let t2;
    const loop = () => {
      t1 = setTimeout(() => {
        setBlink(true);
        t2 = setTimeout(() => {
          setBlink(false);
          loop();
        }, 140);
      }, 2200 + Math.random() * 2500);
    };
    loop();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  useEffect(() => {
    if (!walk) return undefined;
    const id = setInterval(() => setTick((n) => (n + 1) % 4), 170);
    return () => clearInterval(id);
  }, [walk]);

  useEffect(() => {
    renderCharacter(canvasRef.current, cfg, 6, { dir, step: walk ? tick : 0, blink: blink && !walk });
  }, [cfg, dir, walk, tick, blink]);

  const set = (patch) => setCfg((c) => sanitize({ ...c, ...patch }));

  return (
    <div className="gm-wrap">
      <div className="gm-stage">
        <div className="gm-spot">
          <canvas ref={canvasRef} className="gm-canvas" width={SIZE.w * 6} height={SIZE.h * 6} aria-label="Nhân vật của bạn" />
        </div>
        <div className="gm-row" style={{ justifyContent: 'center', marginTop: 10 }}>
          {DIRS.map((d) => (
            <button key={d.id} type="button" className="gm-chip" aria-pressed={dir === d.id} onClick={() => setDir(d.id)}>
              {d.label}
            </button>
          ))}
          <button type="button" className="gm-chip" aria-pressed={walk} onClick={() => setWalk((w) => !w)}>
            Đi thử
          </button>
        </div>
        <div className="gm-name">Nhân vật của bạn</div>
      </div>

      <div className="gm-panel">
        <div className="gm-sec">
          <div className="gm-lbl">Giới tính</div>
          <Chips list={OPTIONS.gender} value={cfg.gender} onPick={(id) => set({ gender: id, hair: id === 'nu' ? 'mau' : 'troc', shoes: id === 'nu' ? 'giay' : 'chan' })} />
        </div>
        <div className="gm-sec">
          <div className="gm-lbl">Màu da</div>
          <Swatches list={SKINS} value={cfg.skin} onPick={(i) => set({ skin: i })} />
        </div>
        <div className="gm-sec">
          <div className="gm-lbl">Kiểu tóc</div>
          <Chips list={OPTIONS.hair[cfg.gender]} value={cfg.hair} onPick={(id) => set({ hair: id })} />
        </div>
        {cfg.hair !== 'troc' && (
          <div className="gm-sec">
            <div className="gm-lbl">Màu tóc</div>
            <Swatches list={HAIRS} value={cfg.hairColor} onPick={(i) => set({ hairColor: i })} />
          </div>
        )}
        <div className="gm-sec">
          <div className="gm-lbl">Trang phục</div>
          <div className="gm-row">
            <button type="button" className="gm-chip" aria-pressed="true">Đồng phục trường</button>
            <button type="button" className="gm-chip" aria-pressed={cfg.scarf} onClick={() => set({ scarf: !cfg.scarf })}>
              Khăn quàng đỏ
            </button>
          </div>
        </div>
        <div className="gm-sec">
          <div className="gm-lbl">Giày dép</div>
          <Chips list={OPTIONS.shoes} value={cfg.shoes} onPick={(id) => set({ shoes: id })} />
        </div>

        <div className="gm-actions">
          {onCancel && <button type="button" className="gm-btn" onClick={onCancel}>Quay lại nhà</button>}
          <button type="button" className="gm-btn" onClick={() => setCfg(randomCfg())}>Ngẫu nhiên</button>
          <button type="button" className="gm-btn main" disabled={saving} onClick={() => onSave(cfg)}>
            {saving ? 'Đang lưu…' : onCancel ? 'Lưu và vào nhà' : 'Lưu và vào game'}
          </button>
        </div>
        {message && <div className={`gm-msg ${message.type}`}>{message.text}</div>}
      </div>
    </div>
  );
}
