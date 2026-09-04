import { describe, expect, it } from 'vitest'
import {
  alphaPercentToHex,
  hexAlphaToPercent,
  hsvaToHex,
  normalizeHexColor,
  sanitizeHexInput,
  sanitizePercentInput,
} from '../color.utils'

describe('color utils', () => {
  it('normalizes 6-digit hex values to uppercase opaque 8-digit hex', () => {
    expect(normalizeHexColor('#a1b2c3')).toBe('#A1B2C3FF')
  })

  it('preserves valid 8-digit hex values while uppercasing them', () => {
    expect(normalizeHexColor('#a1b2c380')).toBe('#A1B2C380')
  })

  it('rejects invalid values', () => {
    expect(normalizeHexColor('rgb(0,0,0)')).toBe('')
    expect(normalizeHexColor('#12345')).toBe('')
  })

  it('maps alpha percentages to hex channels and back', () => {
    expect(alphaPercentToHex(0)).toBe('00')
    expect(alphaPercentToHex(1)).toBe('03')
    expect(alphaPercentToHex(50)).toBe('80')
    expect(alphaPercentToHex(100)).toBe('FF')

    expect(hexAlphaToPercent('00')).toBe(0)
    expect(hexAlphaToPercent('03')).toBe(1)
    expect(hexAlphaToPercent('80')).toBe(50)
    expect(hexAlphaToPercent('FF')).toBe(100)
  })

  it('sanitizes editable hex and percent inputs', () => {
    expect(sanitizeHexInput('#ab cd!12')).toBe('ABCD12')
    expect(sanitizePercentInput('120%')).toBe('100')
    expect(sanitizePercentInput('09')).toBe('9')
  })

  it('converts hsva values back to canonical hex', () => {
    expect(hsvaToHex({ hue: 0, saturation: 100, value: 100, alpha: 0.5 })).toBe('#FF000080')
  })
})
