import { afterEach, describe, expect, it } from 'vitest'
import type { CollectionResult, ResourceOperation, WebResourceSchema } from '../../contracts'
import { createFrameworkQueryClient } from '../../query/client'
import { resolveFrameworkAdapters } from '../../adapters/projectAdapters'
import { resolveFrameworkFieldDefaults } from '../../fields/defaults'
import { defineFields } from '../../fields/defineFields'
import { defineResource } from '../defineResource'
import { resetResourceActionRegistry } from '../routeAccess'
import { registerResourceRuntime, resetResourceRuntimeForTests } from '../runtime'

type Row = { id: string; name: string; allowedOperations?: string[] }
type PayInput = { paidAmount: number }
type Draft = { name: string }
type Schema = WebResourceSchema<Row, Record<string, never>, Draft, Draft, string>

const schema: Schema = { identity: 'id' }
const fields = defineFields(schema, {
  name: { label: 'Name' },
})

type AccessInput = { allows: (request: { operation: string; permission?: string | null; record?: unknown }) => boolean }

function ordersResource(key: string, access: AccessInput = { allows: () => true }) {
  registerResourceRuntime({
    queryClient: createFrameworkQueryClient(),
    adapters: resolveFrameworkAdapters({ access }),
    fieldDefaults: resolveFrameworkFieldDefaults(),
  })
  const payReceived: unknown[][] = []
  let cancelCalls = 0
  const value = defineResource(schema, {
    key,
    actions: {
      pay: {
        run: async (id: string, input: PayInput) => {
          payReceived.push([id, input])
          return `${id}:${input.paidAmount}`
        },
        permission: 'pay-orders',
      },
      cancel: {
        run: async (id: string) => {
          cancelCalls += 1
          return `${id}:cancelled`
        },
        permission: 'cancel-orders',
      },
      exportAll: {
        run: async (filter: { format: string; allowedOperations?: string[] }) => filter.format,
        permission: 'export-orders',
      },
      note: {
        run: async (input: { record: string }) => input.record,
        permission: 'note-orders',
      },
    },
  })
  return { value, payReceived, cancelCalls: () => cancelCalls }
}

afterEach(() => {
  resetResourceRuntimeForTests()
  resetResourceActionRegistry()
})

describe('custom record actions with explicit row context', () => {
  it('checks pay by permission alone without a row', async () => {
    const { value, payReceived } = ordersResource('custom-pay-no-row')

    expect(value.actions.pay.can('o1', { paidAmount: 100 })).toBe(true)
    await expect(value.actions.pay.run('o1', { paidAmount: 100 })).resolves.toBe('o1:100')
    expect(payReceived).toEqual([['o1', { paidAmount: 100 }]])
  })

  it('gates pay by row through trailing context and strips it before run', async () => {
    const { value, payReceived } = ordersResource('custom-pay-row')
    const row = { id: 'o1', name: 'One', allowedOperations: ['detail', 'pay'] }

    expect(value.actions.pay.can('o1', { paidAmount: 100 }, { record: row })).toBe(true)
    await expect(value.actions.pay.run('o1', { paidAmount: 100 }, { record: row })).resolves.toBe('o1:100')
    expect(payReceived).toEqual([['o1', { paidAmount: 100 }]])
  })

  it('denies pay omitted from the row array and blocks run', async () => {
    const { value, payReceived } = ordersResource('custom-pay-deny')
    const row = { id: 'o2', name: 'Two', allowedOperations: ['detail', 'update'] }

    expect(value.actions.pay.can('o2', { paidAmount: 100 }, { record: row })).toBe(false)
    let denial: unknown
    try {
      await value.actions.pay.run('o2', { paidAmount: 100 }, { record: row })
    } catch (error: unknown) {
      denial = error
    }
    expect(String((denial as Error).message)).toBe('[loom] Resource "custom-pay-deny" action "pay" is not allowed.')
    expect(payReceived).toEqual([])
  })

  it('denies malformed row arrays but keeps array-absent records permission-only', async () => {
    const { value } = ordersResource('custom-pay-malformed')

    expect(value.actions.pay.can('o3', { paidAmount: 100 }, { record: { id: 'o3', allowedOperations: 'pay' } })).toBe(false)
    let denial: unknown
    try {
      await value.actions.pay.run('o3', { paidAmount: 100 }, { record: { id: 'o3', allowedOperations: 'pay' } })
    } catch (error: unknown) {
      denial = error
    }
    expect(String((denial as Error).message)).toBe('[loom] Resource "custom-pay-malformed" action "pay" is not allowed.')
    expect(value.actions.pay.can('o1', { paidAmount: 100 }, { record: { id: 'o1' } })).toBe(true)
  })

  it('gates cancel with and without a row', async () => {
    const { value, cancelCalls } = ordersResource('custom-cancel-row')

    expect(value.actions.cancel.can('o1')).toBe(true)
    expect(value.actions.cancel.can('o1', { record: { id: 'o1', allowedOperations: ['cancel'] } })).toBe(true)
    expect(value.actions.cancel.can('o1', { record: { id: 'o2', allowedOperations: ['detail'] } })).toBe(false)
    let denial: unknown
    try {
      await value.actions.cancel.run('o2', { record: { id: 'o2', allowedOperations: ['detail'] } })
    } catch (error: unknown) {
      denial = error
    }
    expect(String((denial as Error).message)).toBe('[loom] Resource "custom-cancel-row" action "cancel" is not allowed.')
    expect(cancelCalls()).toBe(0)
    await expect(value.actions.cancel.run('o1', { record: { id: 'o1', allowedOperations: ['cancel'] } })).resolves.toBe('o1:cancelled')
    expect(cancelCalls()).toBe(1)
  })

  it('ignores row-like inputs that are not trailing context', async () => {
    const { value } = ordersResource('custom-no-false-positive')

    // The filter carries its own array without this action: the old
    // scan-every-arg rule denied it, the context rule leaves it alone.
    expect(value.actions.exportAll.can({ format: 'csv', allowedOperations: ['detail'] })).toBe(true)
    await expect(value.actions.exportAll.run({ format: 'csv', allowedOperations: ['detail'] })).resolves.toBe('csv')
    // A `record` key with a non-record value is an ordinary input.
    expect(value.actions.note.can({ record: 'o1' })).toBe(true)
    await expect(value.actions.note.run({ record: 'o1' })).resolves.toBe('o1')
  })

  it('still requires permission when the row array allows', () => {
    const { value } = ordersResource('custom-row-permission', { allows: ({ permission }) => permission !== 'pay-orders' })

    expect(value.actions.pay.can('o1', { paidAmount: 100 }, { record: { id: 'o1', allowedOperations: ['pay'] } })).toBe(false)
  })

  it('resolves permission over declared args without the context', () => {
    const seen: unknown[][] = []
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'custom-resolver-args',
      actions: {
        pay: {
          run: async (id: string, input: PayInput) => `${id}:${input.paidAmount}`,
          permission: (id: string, input: PayInput) => {
            seen.push([id, input])
            return 'pay-orders'
          },
        },
      },
    })

    expect(value.actions.pay.can('o1', { paidAmount: 100 }, { record: { id: 'o1', allowedOperations: ['pay'] } })).toBe(true)
    expect(seen).toEqual([['o1', { paidAmount: 100 }]])
  })

  it('ignores row arrays for undeclared custom names at the Loom layer', () => {
    const asked: Array<{ operation: string; permission?: string | null; record?: unknown }> = []
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters({
        access: {
          allows: (request) => {
            asked.push({ operation: request.operation, permission: request.permission ?? null, record: request.record })
            return true
          },
        },
      }),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'custom-undeclared-name',
      actions: {
        list: {
          run: async (): Promise<CollectionResult<Row>> => ({ data: [] }),
          fields: [fields.name],
          permission: 'view-orders',
          route: { name: 'custom-undeclared-name-list' },
        },
        pay: {
          run: async (id: string, input: PayInput) => `${id}:${input.paidAmount}`,
          permission: 'pay-orders',
        },
      },
    })
    const row = { id: 'o1', name: 'One', allowedOperations: ['pay'] }

    // `refund` is never declared, so Loom adds no row check of its own: the
    // permission verdict stands and the record still reaches access.
    expect(value.list().can?.('refund' as ResourceOperation, row)).toBe(true)
    expect(asked).toHaveLength(1)
    expect(asked[0]?.record).toBe(row)
  })
})
