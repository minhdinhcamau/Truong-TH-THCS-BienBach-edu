'use client'
import { useEffect, useRef, useState } from 'react'
import {
  W, H, SKINS, HAIR_COLORS, OPTIONS, defaultConfig, sanitize, drawCharacter,
} from '@/lib/game/sprites'

const SCALE = 12

export default function CharacterCreator({ initial, onSave }) {
  const [cfg, setCfg] = useState(() => sanitize(initial || defaultConfig('nam')))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    ctx.clearRect(0, 0, W * SCALE, H * SCALE)
    drawCharacter(ctx, cfg, SCALE)
  }, [cfg])

  const set = (patch) => { setMsg(null); setCfg((c) => sanitize({ ...c, ...patch })) }
  const setGender = (g) => { setMsg(null); setCfg((c) => sanitize({ ...defaultConfig(g), skin: c.skin, hairColor: c.hairColor })) }

  async function save() {
    setSaving(true); setMsg(null)
    try { await onSave(cfg); setMsg({ ok: true, text: 'Đã lưu nhân vật' }) }
    catch (e) { setMsg({ ok: false, text: 'Chưa lưu được: ' + (e?.message || 'lỗi không rõ') }) }
    setSaving(false)
  }

  const Chips = ({ list, value, onPick }) => (
    <div className="gm-row">
      {list.map((o) => (
        <button key={o.id} type="button" className={'gm-chip' + (value === o.id ? ' on' : '')} onClick={() => onPick(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
  const Swatches = ({ colors, value, onPick, label }) => (
    <div className="gm-row">
      {colors.map((col, i) => (
        <button key={col} type="button" aria-label={label + ' ' + (i + 1)} className={'gm-sw' + (value === i ? ' on' : '')} style={{ background: col }} onClick={() => onPick(i)} />
      ))}
    </div>
  )

  return (
    <div className="gm-wrap">
      <style>{css}</style>
      <div className="gm-stage">
        <canvas ref={ref} width={W * SCALE} height={H * SCALE} className="gm-canvas" />
      </div>
      <div className="gm-panel">
        <h2>Tạo nhân vật</h2>
        <label>Giới tính</label>
        <Chips list={[{ id: 'nam', label: 'Nam' }, { id: 'nu', label: 'Nữ' }]} value={cfg.gender} onPick={setGender} />
        <label>Màu da</label>
        <Swatches colors={SKINS} value={cfg.skin} onPick={(i) => set({ skin: i })} label="Màu da" />
        <label>Kiểu tóc</label>
        <Chips list={OPTIONS.hair[cfg.gender]} value={cfg.hair} onPick={(id) => set({ hair: id })} />
        <label>Màu tóc</label>
        <Swatches colors={HAIR_COLORS} value={cfg.hairColor} onPick={(i) => set({ hairColor: i })} label="Màu tóc" />
        <label>Áo</label>
        <Chips list={OPTIONS.shirt} value={cfg.shirt} onPick={(id) => set({ shirt: id })} />
        {cfg.shirt === 'dong_phuc' && (
          <button type="button" className={'gm-chip' + (cfg.scarf ? ' on' : '')} onClick={() => set({ scarf: !cfg.scarf })}>
            {cfg.scarf ? 'Đang đeo khăn quàng đỏ' : 'Đeo khăn quàng đỏ'}
          </button>
        )}
        <label>Quần, váy</label>
        <Chips list={OPTIONS.pants[cfg.gender]} value={cfg.pants} onPick={(id) => set({ pants: id })} />
        <label>Giày dép</label>
        <Chips list={OPTIONS.shoes} value={cfg.shoes} onPick={(id) => set({ shoes: id })} />
        <button type="button" className="gm-save" onClick={save} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu nhân vật'}
        </button>
        {msg && <p className={'gm-msg ' + (msg.ok ? 'ok' : 'bad')}>{msg.text}</p>}
      </div>
    </div>
  )
}

const css = `
.gm-wrap{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;max-width:760px;margin:0 auto;padding:16px;font-family:inherit;color:#16324f}
.gm-wrap button{font-family:inherit}
.gm-stage{flex:0 0 auto;display:flex;align-items:center;justify-content:center;padding:20px;border-radius:16px;background:linear-gradient(#cfe8ff 0 70%,#9fd18b 70% 100%);border:2px solid #16324f}
.gm-canvas{width:192px;height:288px;image-rendering:pixelated;display:block}
.gm-panel{flex:1 1 280px;min-width:260px}
.gm-panel h2{margin:0 0 4px;font-size:20px}
.gm-panel label{display:block;margin:12px 0 6px;font-size:14px;font-weight:600}
.gm-row{display:flex;flex-wrap:wrap;gap:8px}
.gm-chip{padding:8px 12px;border-radius:8px;border:2px solid #b8c7d9;background:#fff;color:#16324f;font-size:14px;cursor:pointer}
.gm-chip.on{border-color:#1a6fd4;background:#e6f0fd;font-weight:700}
.gm-sw{width:34px;height:34px;border-radius:8px;border:2px solid #b8c7d9;cursor:pointer}
.gm-sw.on{border-color:#1a6fd4;outline:2px solid #1a6fd4;outline-offset:2px}
.gm-chip:focus-visible,.gm-sw:focus-visible,.gm-save:focus-visible{outline:3px solid #1a6fd4;outline-offset:2px}
.gm-save{margin-top:18px;width:100%;padding:12px;border:0;border-radius:10px;background:#1a6fd4;color:#fff;font-size:16px;font-weight:700;cursor:pointer}
.gm-save:disabled{opacity:.6}
.gm-msg{margin:10px 0 0;font-size:14px}.gm-msg.ok{color:#14803c}.gm-msg.bad{color:#b3261e}
`
