import { describe, expect, it } from 'vitest'
import { defineSchema } from '../defineSchema'

describe('defineSchema', () => {
  it('returns the exact schema value without transport behavior', () => {
    const schema = { identity: 'id' as const, record: {} }
    expect(defineSchema(schema)).toBe(schema)
  })
})
