import { afterEach, describe, expect, it } from 'vitest'
import type { CollectionResult, WebResourceSchema } from '../../contracts'
import { createFrameworkQueryClient } from '../../query/client'
import { resolveFrameworkAdapters } from '../../adapters/projectAdapters'
import { resolveFrameworkFieldDefaults } from '../../fields/defaults'
import { defineFields } from '../../fields/defineFields'
import { defineResource } from '../defineResource'
import { isStandardRowOperation } from '../actionResource'
import { resetResourceActionRegistry } from '../routeAccess'
import { registerResourceRuntime, resetResourceRuntimeForTests } from '../runtime'

type Row = { id: string; name: string; allowedOperations?: string[] }
type Draft = { name: string }
type Schema = WebResourceSchema<Row, Record<string, never>, Draft, Draft, string>

const schema: Schema = { identity: 'id' }
const fields = defineFields(schema, {
  name: { label: 'Name' },
})

type AccessInput = { allows: (request: { operation: string; permission?: string | null; record?: unknown }) => boolean }

/** Mirrors the app adapter: row arrays gate row ops, otherwise permission wins. */
function rowAdapter(granted: ReadonlySet<string> = new Set()) {
  return {
    allows: ({ operation, permission, record }: { operation: string; permission?: string | null; record?: unknown }) => {
      const declared = (record as { allowedOperations?: unknown } | undefined)?.allowedOperations
      if (isStandardRowOperation(operation) && Array.isArray(declared)) {
        return declared.includes(operation)
      }
      return permission == null || granted.has(permission)
    },
  }
}

function ordersLike(key: string, access: AccessInput) {
  registerResourceRuntime({
    queryClient: createFrameworkQueryClient(),
    adapters: resolveFrameworkAdapters({ access }),
    fieldDefaults: resolveFrameworkFieldDefaults(),
  })
  return defineResource(schema, {
    key,
    actions: {
      list: {
        run: async (): Promise<CollectionResult<Row>> => ({ data: [] }),
        fields: [fields.name],
        permission: 'view-orders',
        route: { name: `${key}-list` },
      },
      detail: {
        run: async ({ id }) => ({ id, name: 'One' }),
        fields: [fields.name],
        permission: 'view-orders',
        route: { name: `${key}-detail`, params: (id) => ({ id }) },
      },
      create: {
        run: async (input) => ({ id: '2', ...input }),
        fields: [fields.name],
        permission: 'create-orders',
        route: { name: `${key}-create` },
      },
      update: {
        run: async (id, input) => ({ id, name: input.name }),
        fields: [fields.name],
        permission: 'update-orders',
        route: { name: `${key}-edit`, params: (id) => ({ id }) },
      },
    },
  })
}

afterEach(() => {
  resetResourceRuntimeForTests()
  resetResourceActionRegistry()
})

describe('standard record ops derived from declared actions', () => {
  it('derives row scope from the standard action set', () => {
    expect(isStandardRowOperation('detail')).toBe(true)
    expect(isStandardRowOperation('update')).toBe(true)
    expect(isStandardRowOperation('delete')).toBe(true)
    expect(isStandardRowOperation('list')).toBe(false)
    expect(isStandardRowOperation('create')).toBe(false)
    expect(isStandardRowOperation('pay')).toBe(false)
    expect(isStandardRowOperation('cancel')).toBe(false)
  })

  it('derives detail and update row validity from declared actions', () => {
    const value = ordersLike('derived-rows', rowAdapter(new Set(['view-orders', 'update-orders'])))
    const list = value.list()
    const readable = { id: '1', name: 'One', allowedOperations: ['detail', 'update'] }
    expect(list.detailRoute?.(readable)).toEqual({ name: 'derived-rows-detail', params: { id: '1' } })
    expect(list.updateRoute?.(readable)).toEqual({ name: 'derived-rows-edit', params: { id: '1' } })

    // Orders-shaped omission: a valid workflow row without 'detail' hides View
    // by explicit omission while Edit still resolves. Hiding stays silent.
    const workflow = { id: '2', name: 'Two', allowedOperations: ['update', 'pay', 'cancel'] }
    expect(list.detailRoute?.(workflow)).toBeUndefined()
    expect(list.updateRoute?.(workflow)).toEqual({ name: 'derived-rows-edit', params: { id: '2' } })
  })

  it('never yields a detail route without a detail declaration', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters({ access: rowAdapter(new Set(['view-orders', 'update-orders'])) }),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'no-detail-declared',
      actions: {
        list: {
          run: async (): Promise<CollectionResult<Row>> => ({ data: [] }),
          fields: [fields.name],
          permission: 'view-orders',
          route: { name: 'no-detail-list' },
        },
        update: {
          run: async (id, input) => ({ id, name: input.name }),
          fields: [fields.name],
          permission: 'update-orders',
          route: { name: 'no-detail-edit', params: (id) => ({ id }) },
        },
      },
    })
    const list = value.list()
    const row = { id: '1', name: 'One', allowedOperations: ['detail', 'update'] }

    expect(list.detailRoute).toBeUndefined()
    expect(list.detailTarget).toBeUndefined()
    expect(list.updateRoute?.(row)).toEqual({ name: 'no-detail-edit', params: { id: '1' } })
  })

  it('ignores row arrays for undeclared standard ops', () => {
    const asked: Array<{ operation: string; permission?: string | null; record?: unknown }> = []
    const value = ordersLike('undeclared-row-op', {
      allows: (request) => {
        asked.push({ operation: request.operation, permission: request.permission ?? null, record: request.record })
        return true
      },
    })
    const row = { id: '1', name: 'One', allowedOperations: ['delete'] }

    // No delete action is declared, so the stray array entry never reaches access.
    const list = value.list()
    asked.length = 0
    expect(list.can?.('delete', row)).toBe(true)
    expect(asked).toHaveLength(1)
    expect(asked[0]?.record).toBeUndefined()
    // A declared row op still forwards the record.
    list.can?.('update', row)
    expect(asked[1]?.record).toBe(row)
  })

  it('never gates list and create by row', () => {
    // Strict adapter that would gate every operation by row when given one.
    const strict = {
      allows: ({ operation, permission, record }: { operation: string; permission?: string | null; record?: unknown }) => {
        const declared = (record as { allowedOperations?: unknown } | undefined)?.allowedOperations
        if (record !== undefined && Array.isArray(declared)) return declared.includes(operation)
        return permission == null || permission === 'view-orders' || permission === 'create-orders'
      },
    }
    const value = ordersLike('collection-ops', strict)
    const list = value.list()
    const row = { id: '1', name: 'One', allowedOperations: ['detail'] }

    expect(list.can?.('list', row)).toBe(true)
    expect(list.can?.('create', row)).toBe(true)
  })

  it('preserves permission fallback for rows without an array', () => {
    const value = ordersLike('no-row-array', rowAdapter(new Set(['view-orders'])))
    const list = value.list()
    const row = { id: '1', name: 'One' }

    expect(list.can?.('detail', row)).toBe(true)
    expect(list.detailRoute?.(row)).toEqual({ name: 'no-row-array-detail', params: { id: '1' } })
  })
})
