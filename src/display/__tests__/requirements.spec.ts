import { describe, expect, it } from 'vitest'
import { displayRequirement, displayValueRequirement } from '../requirements'

describe('display requirements', () => {
  it('allows scalar fallbacks and unknown schema kinds', () => {
    expect(displayRequirement('string', {})).toBeUndefined()
    expect(displayRequirement('number', {})).toBeUndefined()
    expect(displayRequirement('boolean', {})).toBeUndefined()
    expect(displayRequirement('enum', {})).toBeUndefined()
    expect(displayRequirement('unknown', {})).toBeUndefined()
  })

  it('requires a formatter for date schema values', () => {
    expect(displayRequirement('date', {})).toBe('date-format')
    expect(displayRequirement('date', { renderer: 'date' })).toBe('date-format')
    expect(displayRequirement('date', { format: 'date' })).toBeUndefined()
  })

  it('requires an explicit display choice for structured schema values', () => {
    expect(displayRequirement('object', {})).toBe('text-or-renderer')
    expect(displayRequirement('array', {})).toBe('text-or-renderer')
    expect(displayRequirement('object', { read: () => 'Caption' })).toBeUndefined()
    expect(displayRequirement('array', { renderer: 'list' })).toBeUndefined()
    expect(displayRequirement('object', { format: 'json' })).toBeUndefined()
  })

  it('checks actual values after access and formatting', () => {
    expect(displayValueRequirement(new Date('2026-01-01T00:00:00Z'), {})).toBe('date-format')
    expect(displayValueRequirement(new Date('2026-01-01T00:00:00Z'), { renderer: 'date' })).toBe('date-format')
    expect(displayValueRequirement('2026-01-01', {})).toBeUndefined()
    expect(displayValueRequirement({ id: 'one' }, {})).toBe('text-or-renderer')
    expect(displayValueRequirement({ id: 'one' }, { renderer: 'asset' })).toBeUndefined()
    expect(displayValueRequirement({ id: 'one' }, { format: 'text' })).toBe('text-or-renderer')
  })
})
