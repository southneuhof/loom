import { afterEach, describe, expect, it } from 'vitest'
import type { CollectionResult, ResourceOperation, WebResourceSchema } from '../../contracts'
import { createFrameworkQueryClient } from '../../query/client'
import { resolveFrameworkAdapters } from '../../adapters/projectAdapters'
import { resolveFrameworkFieldDefaults } from '../../fields/defaults'
import { defineFields } from '../../fields/defineFields'
import { defineResource } from '../defineResource'
import { isDeclaredCustomOperation, resetDeclaredCustomOperationsForTests } from '../actionResource'
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

function payResource(key: string, access: AccessInput = { allows: () => true }) {
  registerResourceRuntime({
    queryClient: createFrameworkQueryClient(),
    adapters: resolveFrameworkAdapters({ access }),
    fieldDefaults: resolveFrameworkFieldDefaults(),
  })
  let calls = 0
  const value = defineResource(schema, {
    key,
    actions: {
      pay: {
        run: async (record: Row, input: PayInput) => {
          calls += 1
          return `${record.id}:${input.paidAmount}`
        },
        permission: 'pay-orders',
      },
      exportAll: {
        run: async (filter: { format: string }) => {
          calls += 1
          return filter.format
        },
        permission: 'export-orders',
      },
    },
  })
  return { value, calls: () => calls }
}

afterEach(() => {
  resetResourceRuntimeForTests()
  resetResourceActionRegistry()
  resetDeclaredCustomOperationsForTests()
})

describe('custom record actions gated by row', () => {
  it('allows a declared custom action whose row array contains its name', async () => {
    const { value, calls } = payResource('custom-row-allow')
    const row = { id: 'o1', name: 'One', allowedOperations: ['detail', 'pay'] }

    expect(value.actions.pay.can(row, { paidAmount: 100 })).toBe(true)
    await expect(value.actions.pay.run(row, { paidAmount: 100 })).resolves.toBe('o1:100')
    expect(calls()).toBe(1)
  })

  it('denies a declared custom action omitted from the row array and blocks run', async () => {
    const { value, calls } = payResource('custom-row-deny')
    const row = { id: 'o2', name: 'Two', allowedOperations: ['detail', 'update'] }

    expect(value.actions.pay.can(row, { paidAmount: 100 })).toBe(false)
    let denial: unknown
    try {
      await value.actions.pay.run(row, { paidAmount: 100 })
    } catch (error: unknown) {
      denial = error
    }
    expect(String((denial as Error).message)).toBe('[loom] Resource "custom-row-deny" action "pay" is not allowed.')
    expect(calls()).toBe(0)
  })

  it('keeps permission-only behavior for calls without an identifiable row', async () => {
    const { value, calls } = payResource('custom-no-row')
    const rowWithoutArray = { id: 'o1', name: 'One' }

    // A passed record without the array marker is not row-gated.
    expect(value.actions.pay.can(rowWithoutArray, { paidAmount: 100 })).toBe(true)
    // Collection-level calls carry inputs without the marker.
    expect(value.actions.exportAll.can({ format: 'csv' })).toBe(true)
    await expect(value.actions.exportAll.run({ format: 'csv' })).resolves.toBe('csv')
    expect(calls()).toBe(1)
  })

  it('denies a malformed row array instead of granting', async () => {
    const { value, calls } = payResource('custom-row-malformed')
    const row = { id: 'o3', name: 'Three', allowedOperations: 'pay' as unknown as string[] }

    expect(value.actions.pay.can(row, { paidAmount: 100 })).toBe(false)
    let denial: unknown
    try {
      await value.actions.pay.run(row, { paidAmount: 100 })
    } catch (error: unknown) {
      denial = error
    }
    expect(String((denial as Error).message)).toBe('[loom] Resource "custom-row-malformed" action "pay" is not allowed.')
    expect(calls()).toBe(0)
  })

  it('still requires permission when the row array allows', () => {
    const { value } = payResource('custom-row-permission', { allows: ({ permission }) => permission !== 'pay-orders' })
    const row = { id: 'o1', name: 'One', allowedOperations: ['pay'] }

    expect(value.actions.pay.can(row, { paidAmount: 100 })).toBe(false)
  })

  it('tracks declared custom names without hard-coded product ops', () => {
    payResource('custom-row-declared')

    expect(isDeclaredCustomOperation('pay')).toBe(true)
    expect(isDeclaredCustomOperation('exportAll')).toBe(true)
    expect(isDeclaredCustomOperation('refund')).toBe(false)
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
          run: async (record: Row, input: PayInput) => `${record.id}:${input.paidAmount}`,
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
