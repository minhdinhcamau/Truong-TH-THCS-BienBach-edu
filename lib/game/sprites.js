// Vẽ nhân vật pixel 16x24 bằng canvas. Không cần ảnh, không cần thư viện.
// Muốn thêm trang phục sau này: thêm mục vào OPTIONS và một nhánh vẽ trong drawCharacter.
export const W = 16
export const H = 24
export const SKINS = ['#f7d6b8', '#e6b88a', '#c48a5c']
export const HAIR_COLORS = ['#1c1b20', '#3d2b1f', '#6b4423']

const PANTS_BASE = { id: 'co_so', label: 'Quần đùi xám' }
const PANTS_LONG = { id: 'dai', label: 'Quần dài đen' }

export const OPTIONS = {
  hair: {
    nam: [
      { id: 'ngan', label: 'Tóc ngắn' },
      { id: 'rem', label: 'Tóc cua' },
      { id: 'xu', label: 'Tóc xù nhẹ' },
    ],
    nu: [
      { id: 'duoi', label: 'Buộc đuôi' },
      { id: 'xoa', label: 'Xõa dài' },
      { id: 'bim', label: 'Hai bím' },
    ],
  },
  shirt: [
    { id: 'ba_lo', label: 'Áo ba lỗ trắng' },
    { id: 'dong_phuc', label: 'Áo đồng phục' },
  ],
  pants: {
    nam: [PANTS_BASE, PANTS_LONG],
    nu: [PANTS_BASE, PANTS_LONG, { id: 'vay', label: 'Váy đen' }],
  },
  shoes: [
    { id: 'chan', label: 'Chân trần' },
    { id: 'giay', label: 'Giày trắng' },
    { id: 'dep', label: 'Dép quai hậu' },
  ],
}

export function defaultConfig(gender = 'nam') {
  const g = gender === 'nu' ? 'nu' : 'nam'
  return {
    gender: g, skin: 0, hair: OPTIONS.hair[g][0].id, hairColor: 0,
    shirt: 'ba_lo', scarf: false, pants: 'co_so', shoes: 'chan',
  }
}

const pick = (list, id) => (list.some((o) => o.id === id) ? id : list[0].id)
const idx = (n, max) => (Number.isInteger(n) && n >= 0 && n < max ? n : 0)

// Chấp nhận dữ liệu lỗi hoặc cũ, luôn trả về cấu hình hợp lệ.
export function sanitize(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {}
  const g = c.gender === 'nu' ? 'nu' : 'nam'
  const shirt = pick(OPTIONS.shirt, c.shirt)
  return {
    gender: g,
    skin: idx(c.skin, SKINS.length),
    hair: pick(OPTIONS.hair[g], c.hair),
    hairColor: idx(c.hairColor, HAIR_COLORS.length),
    shirt,
    scarf: shirt === 'dong_phuc' && !!c.scarf,
    pants: pick(OPTIONS.pants[g], c.pants),
    shoes: pick(OPTIONS.shoes, c.shoes),
  }
}

export function drawCharacter(ctx, cfg, s = 1, ox = 0, oy = 0) {
  const c = sanitize(cfg)
  const skin = SKINS[c.skin]
  const hc = HAIR_COLORS[c.hairColor]
  const dark = '#25262b'
  const red = '#d8232a'
  const r = (x, y, w, h, col) => {
    ctx.fillStyle = col
    ctx.fillRect(ox + x * s, oy + y * s, w * s, h * s)
  }

  // 1. Tóc phía sau
  if (c.hair === 'xoa') r(3, 2, 10, 11, hc)

  // 2. Chân + quần
  r(5, 16, 3, 6, skin)
  r(8, 16, 3, 6, skin)
  if (c.pants === 'co_so') r(5, 16, 6, 2, '#8e949b')
  if (c.pants === 'dai') { r(5, 16, 3, 6, dark); r(8, 16, 3, 6, dark) }
  if (c.pants === 'vay') r(4, 16, 8, 4, dark)

  // 3. Giày dép
  if (c.shoes === 'giay') {
    r(4, 22, 4, 2, '#f4f5f7'); r(8, 22, 4, 2, '#f4f5f7')
    r(4, 23, 4, 1, '#c3c8cf'); r(8, 23, 4, 1, '#c3c8cf')
  }
  if (c.shoes === 'dep') { r(5, 23, 3, 1, '#2a2a2a'); r(8, 23, 3, 1, '#2a2a2a') }

  // 4. Thân + tay
  r(2, 10, 2, 6, skin)
  r(12, 10, 2, 6, skin)
  r(4, 10, 8, 6, skin)
  if (c.shirt === 'ba_lo') {
    r(5, 10, 6, 6, '#ffffff')
    r(7, 10, 2, 1, skin)
  } else {
    r(4, 10, 8, 6, '#ffffff')
    r(4, 15, 8, 1, '#e3e6ea')
    r(2, 10, 2, 3, '#ffffff'); r(12, 10, 2, 3, '#ffffff')
    for (let x = 5; x <= 10; x++) r(x, 10, 1, 1, x % 2 ? dark : '#ffffff')
    for (let x = 6; x <= 9; x++) r(x, 11, 1, 1, x % 2 ? '#ffffff' : dark)
    if (c.scarf) {
      r(6, 10, 4, 1, red); r(7, 11, 2, 1, red); r(7, 12, 2, 2, '#b81c22')
    }
  }

  // 5. Đầu + mặt
  r(4, 2, 8, 8, skin)
  r(6, 6, 1, 2, '#222'); r(9, 6, 1, 2, '#222')
  r(7, 8, 2, 1, '#c0625a')
  if (c.gender === 'nu') { r(5, 8, 1, 1, '#f2a09a'); r(10, 8, 1, 1, '#f2a09a') }

  // 6. Tóc phía trước
  if (c.hair === 'rem') { r(4, 1, 8, 4, hc); r(4, 5, 1, 2, hc); r(11, 5, 1, 2, hc) }
  else if (c.hair === 'xu') { r(3, 0, 10, 4, hc); r(3, 4, 2, 2, hc); r(11, 4, 2, 2, hc) }
  else {
    r(4, 1, 8, 3, hc); r(4, 4, 1, 2, hc); r(11, 4, 1, 2, hc)
    if (c.hair === 'duoi') { r(12, 3, 2, 7, hc); r(12, 3, 2, 1, '#e53935') }
    if (c.hair === 'bim') {
      r(2, 4, 2, 7, hc); r(12, 4, 2, 7, hc)
      r(2, 11, 2, 1, '#e53935'); r(12, 11, 2, 1, '#e53935')
    }
  }
}
