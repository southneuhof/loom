import { describe, expect, it } from 'vitest'
import { resolveFrameworkFieldDefaults } from '../defaults'

describe('framework field defaults', () => {
  it('merges shared and surface layers with field-layer semantics', () => {
    const input = {
      shared: { renderer: 'text', label: 'Shared' },
      table: { label: null, align: 'end' as const },
    }
    const resolved = resolveFrameworkFieldDefaults(input)
    expect(resolved.table).toEqual({
      renderer: 'text', label: undefined, align: 'end', props: {},
    })
    expect(resolved.detail).toEqual({
      renderer: 'text', label: 'Shared', props: {},
    })
    expect(resolved.fields).toEqual({})
  })

  it('clones keyed field defaults', () => {
    const input = {
      fields: {
        statusCode: {
          label: 'Status',
          display: { renderer: 'chip', props: { dense: true } },
          table: { align: 'center' as const },
        },
      },
    }
    const resolved = resolveFrameworkFieldDefaults(input)

    expect(resolved.fields.statusCode).toEqual(input.fields.statusCode)
    expect(resolved.fields.statusCode).not.toBe(input.fields.statusCode)
    expect(resolved.fields.statusCode.display?.props).not.toBe(input.fields.statusCode.display.props)
  })

  it('returns independent layers and nested props', () => {
    const first = resolveFrameworkFieldDefaults({ shared: { renderer: 'text' } })
    const second = resolveFrameworkFieldDefaults({ shared: { renderer: 'text' } })
    expect(first.table).not.toBe(first.detail)
    expect(first.table.props).not.toBe(first.detail.props)
    expect(first.table.props).not.toBe(second.table.props)
  })
})
