import { describe, expect, it } from 'vitest'
import { encodeCode128B, encodeEAN13, encodeProductBarcode } from '../barcodes'

describe('encodeCode128B', () => {
  it('creates Code 128-B bars for printable product identifiers', () => {
    const encoded = encodeCode128B('ABC-123-XL')
    expect(encoded).not.toBeNull()
    expect(encoded!.bars.length).toBeGreaterThan(10)
    expect(encoded!.width).toBeGreaterThan(20)
    expect(encoded!.text).toBe('ABC-123-XL')
  })

  it('uses the start, checksum, and stop codewords in the right order', () => {
    const encoded = encodeCode128B('ABC123')!
    expect(encoded.codewords[0]).toBe(104)
    expect(encoded.codewords.at(-1)).toBe(106)
    const checksum = encoded.codewords.slice(0, -2).reduce((sum, value, index) => sum + (index === 0 ? value : value * index), 0) % 103
    expect(encoded.codewords.at(-2)).toBe(checksum)
  })

  it('rejects empty, control-character, and non-ASCII values instead of printing a false barcode', () => {
    expect(encodeCode128B('')).toBeNull()
    expect(encodeCode128B('SKU\n123')).toBeNull()
    expect(encodeCode128B('مقاس-كبير')).toBeNull()
  })
  it('keeps valid EAN-13 product codes in EAN-13 symbology', () => {
    const encoded = encodeEAN13('4006381333931')
    expect(encoded).not.toBeNull()
    expect(encoded!.width).toBe(113)
    expect(encoded!.bars.length).toBeGreaterThan(30)
    expect(encodeProductBarcode('4006381333931')?.width).toBe(113)
  })

  it('uses Code 128-B for SKUs and rejects an invalid EAN checksum as EAN-13', () => {
    expect(encodeEAN13('4006381333932')).toBeNull()
    expect(encodeProductBarcode('SKU-42')?.text).toBe('SKU-42')
  })
})
