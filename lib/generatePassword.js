// Sinh mat khau manh: 12 ky tu, dam bao co chu hoa, chu thuong, so, ky tu dac biet.
// Ham nay khong dung DB nen dung duoc ca o client (nut "Tao mat khau manh")
// lan o server neu can.
export function generateStrongPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // bo I, O de nham voi 1, 0
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const numbers = '23456789'
  const symbols = '!@#$%*?'
  const all = upper + lower + numbers + symbols

  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)]

  const passwordChars = [pick(upper), pick(lower), pick(numbers), pick(symbols)]

  for (let i = passwordChars.length; i < length; i++) {
    passwordChars.push(pick(all))
  }

  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]]
  }

  return passwordChars.join('')
}
