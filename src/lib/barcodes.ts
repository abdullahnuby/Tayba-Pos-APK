export type BarcodeBar = { x: number; width: number }
export type BarcodeEncoding = { text: string; width: number; bars: BarcodeBar[] }
export type Code128Encoding = BarcodeEncoding & { codewords: number[] }
const CODE128_PATTERNS = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"] as const
const EAN_L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"] as const
const EAN_G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"] as const
const EAN_R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"] as const
const EAN_PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"] as const

export function encodeEAN13(value: string): BarcodeEncoding | null {
  const text = String(value ?? '').trim()
  if (!/^\\d{13}$/.test(text)) return null
  const digits = Array.from(text, Number)
  const checksum = digits.slice(0, 12).reduce((sum, digit, index) => sum + digit * (index % 2 ? 3 : 1), 0)
  if ((10 - (checksum % 10)) % 10 !== digits[12]) return null
  const left = digits.slice(1, 7).map((digit, index) => EAN_PARITY[digits[0]][index] === 'L' ? EAN_L[digit] : EAN_G[digit]).join('')
  const right = digits.slice(7).map(digit => EAN_R[digit]).join('')
  const bits = '101' + left + '01010' + right + '101'
  const bars: BarcodeBar[] = []
  for (let index = 0; index < bits.length; index++) if (bits[index] === '1') bars.push({ x: index + 9, width: 1 })
  return { text, width: 113, bars }
}

export function encodeCode128B(value: string): Code128Encoding | null {
  const text = String(value ?? '').trim()
  if (!text || !/^[\x20-\x7E]+$/.test(text)) return null
  const data = Array.from(text, char => char.charCodeAt(0) - 32)
  let checksum = 104
  data.forEach((code, index) => { checksum += code * (index + 1) })
  checksum %= 103
  const codewords = [104, ...data, checksum, 106]
  const bars: BarcodeBar[] = []
  let x = 10
  for (const codeword of codewords) {
    const pattern = CODE128_PATTERNS[codeword]
    for (let index = 0; index < pattern.length; index++) {
      const width = Number(pattern[index])
      if (index % 2 === 0) bars.push({ x, width })
      x += width
    }
  }
  return { text, width: x + 10, bars, codewords }
}

export function encodeProductBarcode(value: string): BarcodeEncoding | null {
  return encodeEAN13(value) || encodeCode128B(value)
}
