import { describe, expect, it } from 'vitest'
import { formatTimeValue, parseTimeValue } from '../timeInput.utils'

describe('TimeInput value normalization', () => {
  it('defaults missing seconds to zero', () => {
    expect(parseTimeValue('09:30')).toEqual({ hours: 9, minutes: 30, seconds: 0 })
    expect(formatTimeValue(parseTimeValue('09:30'))).toBe('09:30:00')
  })

  it('preserves a complete time value', () => {
    expect(formatTimeValue(parseTimeValue('09:30:45'))).toBe('09:30:45')
  })

  it('formats missing or invalid parts as zero', () => {
    expect(formatTimeValue({ hours: 9, minutes: Number.NaN })).toBe('09:00:00')
  })
})
