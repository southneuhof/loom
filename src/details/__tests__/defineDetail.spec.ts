import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { defineDetail } from '../defineDetail'

describe('defineDetail', () => {
  it('snapshots ordered field configuration and preserves schema, labels, and accessors', () => {
    const schema = z.object({ id: z.string(), name: z.string() })
    const read = (record: { id: string; name: string }) => record.name.toUpperCase()
    const props = { fallback: '-' }
    const field = { read, span: 2, props }
    const fields = { displayName: field }
    const labels = { displayName: 'Name' }
    const detail = defineDetail({ schema, fields, labels })

    props.fallback = 'Unknown'
    labels.displayName = 'Changed'

    expect(Object.keys(detail)).toEqual(['schema', 'fields', 'labels'])
    expect(detail.schema).toBe(schema)
    expect(Object.keys(detail.fields)).toEqual(['displayName'])
    expect(detail.fields).not.toBe(fields)
    expect(detail.fields.displayName).not.toBe(field)
    expect(detail.fields.displayName.read).toBe(read)
    expect(detail.fields.displayName.props).toEqual({ fallback: '-' })
    expect(detail.labels).toEqual({ displayName: 'Name' })
  })

  it('rejects table-only JavaScript members', () => {
    const schema = z.object({ name: z.string() })
    const invalid = { schema, fields: { name: { sortable: true } } }

    expect(() => Reflect.apply(defineDetail, undefined, [invalid])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Detail member "fields.name.sortable"',
    )
  })
})
