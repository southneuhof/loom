export type RgbaColor = {
  red: number
  green: number
  blue: number
  alpha: number
}

export type HsvaColor = {
  hue: number
  saturation: number
  value: number
  alpha: number
}

const DEFAULT_RGBA: RgbaColor = { red: 255, green: 255, blue: 255, alpha: 1 }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toHexChannel(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0').toUpperCase()
}

export function alphaPercentToUnit(percent: number) {
  return clamp(percent, 0, 100) / 100
}

export function unitAlphaToPercent(alpha: number) {
  return clamp(Math.round(alpha * 100), 0, 100)
}

export function alphaPercentToHex(percent: number) {
  return toHexChannel(alphaPercentToUnit(percent) * 255)
}

export function hexAlphaToPercent(alphaHex: string) {
  const alpha = Number.parseInt(alphaHex, 16)
  if (Number.isNaN(alpha)) return 100
  return unitAlphaToPercent(alpha / 255)
}

export function normalizeHexColor(value: unknown) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  const normalized = trimmed.toUpperCase()
  if (/^#[0-9A-F]{6}$/.test(normalized)) return `${normalized}FF`
  if (/^#[0-9A-F]{8}$/.test(normalized)) return normalized

  return ''
}

export function hexToRgba(value: unknown): RgbaColor | null {
  const normalized = normalizeHexColor(value)
  if (!normalized) return null

  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
    alpha: Number.parseInt(normalized.slice(7, 9), 16) / 255,
  }
}

export function rgbaToHex(color: RgbaColor) {
  return `#${toHexChannel(color.red)}${toHexChannel(color.green)}${toHexChannel(color.blue)}${toHexChannel(color.alpha * 255)}`
}

export function rgbaToHsva(color: RgbaColor): HsvaColor {
  const red = clamp(color.red, 0, 255) / 255
  const green = clamp(color.green, 0, 255) / 255
  const blue = clamp(color.blue, 0, 255) / 255
  const alpha = clamp(color.alpha, 0, 1)

  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min

  let hue = 0
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }

  if (hue < 0) hue += 360

  return {
    hue,
    saturation: max === 0 ? 0 : (delta / max) * 100,
    value: max * 100,
    alpha,
  }
}

export function hsvaToRgba(color: HsvaColor): RgbaColor {
  const hue = ((color.hue % 360) + 360) % 360
  const saturation = clamp(color.saturation, 0, 100) / 100
  const value = clamp(color.value, 0, 100) / 100
  const alpha = clamp(color.alpha, 0, 1)

  const chroma = value * saturation
  const segment = hue / 60
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1))
  const match = value - chroma

  let red = 0
  let green = 0
  let blue = 0

  if (segment >= 0 && segment < 1) {
    red = chroma
    green = secondary
  } else if (segment >= 1 && segment < 2) {
    red = secondary
    green = chroma
  } else if (segment >= 2 && segment < 3) {
    green = chroma
    blue = secondary
  } else if (segment >= 3 && segment < 4) {
    green = secondary
    blue = chroma
  } else if (segment >= 4 && segment < 5) {
    red = secondary
    blue = chroma
  } else {
    red = chroma
    blue = secondary
  }

  return {
    red: (red + match) * 255,
    green: (green + match) * 255,
    blue: (blue + match) * 255,
    alpha,
  }
}

export function hexToHsva(value: unknown): HsvaColor {
  return rgbaToHsva(hexToRgba(value) ?? DEFAULT_RGBA)
}

export function hsvaToHex(color: HsvaColor) {
  return rgbaToHex(hsvaToRgba(color))
}

export function sanitizeHexInput(value: unknown) {
  return String(value ?? '')
    .replace(/[^0-9a-fA-F]/g, '')
    .slice(0, 6)
    .toUpperCase()
}

export function sanitizePercentInput(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return String(clamp(Number(digits), 0, 100))
}
