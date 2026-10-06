'use client';
// GAME (tách riêng): màn hình tạo nhân vật. Xóa cùng thư mục components/game khi gỡ game.
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_CFG, HAIRS, OPTIONS, SKINS, SIZE, renderCharacter, sanitize, randomCfg } from '../../lib/game/sprites';

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

export default function CharacterCreator({ initial, saving, message, onSave }) {
  const [cfg, setCfg] = useState(() => sanitize(initial || DEFAULT_CFG));
  const canvasRef = useRef(null);

  useEffect(() => {
    renderCharacter(canvasRef.current, cfg, 10);
  }, [cfg]);

  const set = (patch) => setCfg((c) => sanitize({ ...c, ...patch }));
  const pants = OPTIONS.pants.filter((o) => !o.onlyFemale || cfg.gender === 'nu');

  return (
    <div className="gm-wrap">
      <div className="gm-stage">
        <div className="gm-spot">
          <canvas ref={canvasRef} className="gm-canvas" width={SIZE.w * 10} height={SIZE.h * 10} aria-label="Nhân vật của bạn" />
        </div>
        <div className="gm-name">Nhân vật của bạn</div>
      </div>

      <div className="gm-panel">
        <div className="gm-sec">
          <div className="gm-lbl">Giới tính</div>
          <Chips list={OPTIONS.gender} value={cfg.gender} onPick={(id) => set({ gender: id })} />
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
          <div className="gm-lbl">Áo</div>
          <Chips list={OPTIONS.shirt} value={cfg.shirt} onPick={(id) => set({ shirt: id })} />
          <div className="gm-row" style={{ marginTop: 8 }}>
            <button type="button" className="gm-chip" aria-pressed={cfg.scarf} onClick={() => set({ scarf: !cfg.scarf })}>
              Khăn quàng đỏ
            </button>
          </div>
        </div>
        <div className="gm-sec">
          <div className="gm-lbl">Quần, váy</div>
          <Chips list={pants} value={cfg.pants} onPick={(id) => set({ pants: id })} />
        </div>
        <div className="gm-sec">
          <div className="gm-lbl">Giày dép</div>
          <Chips list={OPTIONS.shoes} value={cfg.shoes} onPick={(id) => set({ shoes: id })} />
        </div>

        <div className="gm-actions">
          <button type="button" className="gm-btn" onClick={() => setCfg(randomCfg())}>Ngẫu nhiên</button>
          <button type="button" className="gm-btn main" disabled={saving} onClick={() => onSave(cfg)}>
            {saving ? 'Đang lưu…' : 'Lưu nhân vật'}
          </button>
        </div>
        {message && <div className={`gm-msg ${message.type}`}>{message.text}</div>}
      </div>
    </div>
  );
}
