import { describe, expect, it } from 'vitest'
import { displayValueRequirement } from '../requirements'

describe('display requirements', () => {
  it('checks actual values after access and formatting', () => {
    expect(displayValueRequirement(new Date('2026-01-01T00:00:00Z'), {})).toBe('date-format')
    expect(displayValueRequirement(new Date('2026-01-01T00:00:00Z'), { renderer: 'date' })).toBe('date-format')
    expect(displayValueRequirement('2026-01-01', {})).toBeUndefined()
    expect(displayValueRequirement({ id: 'one' }, {})).toBe('text-or-renderer')
    expect(displayValueRequirement({ id: 'one' }, { renderer: 'asset' })).toBeUndefined()
    expect(displayValueRequirement({ id: 'one' }, { format: 'text' })).toBe('text-or-renderer')
  })
})
