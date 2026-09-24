import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { defineTable } from '../defineTable'

describe('defineTable', () => {
  it('snapshots ordered column configuration and preserves schema and accessors', () => {
    const schema = z.object({ id: z.string(), amount: z.number() })
    const read = (record: { id: string; amount: number }) => record.amount * 2
    const props = { currency: 'USD' }
    const column = { read, sortable: true, sortKey: 'amount' as const, props }
    const columns = { total: column, id: {} }
    const labels = { total: 'Total' }
    const table = defineTable({ schema, columns, labels })

    props.currency = 'EUR'
    labels.total = 'Changed'

    expect(Object.keys(table)).toEqual(['schema', 'columns', 'labels'])
    expect(table.schema).toBe(schema)
    expect(Object.keys(table.columns)).toEqual(['total', 'id'])
    expect(table.columns).not.toBe(columns)
    expect(table.columns.total).not.toBe(column)
    expect(table.columns.total.read).toBe(read)
    expect(table.columns.total.props).toEqual({ currency: 'USD' })
    expect(table.labels).toEqual({ total: 'Total' })
  })

  it('rejects invalid JavaScript column shapes and sortable custom accessors without sort keys', () => {
    const schema = z.object({ id: z.string(), amount: z.number() })
    const badAccessor = {
      schema,
      columns: { total: { read: (record: { amount: number }) => record.amount, sortable: true } },
    }
    const badMember = { schema, columns: { amount: { sortable: true, options: [] } } }

    expect(() => Reflect.apply(defineTable, undefined, [badAccessor])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Table member "columns.total.sortKey" must be present for a sortable accessor.',
    )
    expect(() => Reflect.apply(defineTable, undefined, [badMember])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Table member "columns.amount.options"',
    )
  })

  it('allows application formatter keys without app configuration context', () => {
    const schema = z.object({ status: z.string() })

    expect(() => defineTable({ schema, columns: { status: { format: 'projectStatus' } } })).not.toThrow()
  })
})
