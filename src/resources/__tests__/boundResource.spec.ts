import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createFrameworkQueryClient } from '../../query/client'
import { resolveFrameworkAdapters } from '../../adapters/projectAdapters'
import { defineResource } from '../defineResource'
import { resourceActionForRoute, resetResourceActionRegistry } from '../routeAccess'
import { registerResourceRuntime, resetResourceRuntimeForTests } from '../runtime'

type Row = { id: string; name: string; status: string; allowedOperations?: string[] }
type Draft = { name: string }

const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  allowedOperations: z.array(z.string()).optional(),
})
const draftSchema = z.object({ name: z.string() })

function installRuntime(access: { allows: (request: { operation: string; permission?: string | null; record?: unknown }) => boolean } = { allows: () => true }) {
  const queryClient = createFrameworkQueryClient({ retry: 0, staleTime: 0 })
  registerResourceRuntime({
    queryClient,
    adapters: resolveFrameworkAdapters({ access }),
  })
  return queryClient
}

afterEach(() => {
  resetResourceRuntimeForTests()
  resetResourceActionRegistry()
})

describe('bound resource operations', () => {
  it('returns complete stable primitive bags and preserves route and permission metadata', async () => {
    installRuntime()
    const loadRows = vi.fn(async () => ({ data: [{ id: '1', name: 'One', status: 'new' }] }))
    const loadRecord = vi.fn(async ({ id }: { id: string }) => ({ id, name: 'One', status: 'new' }))
    const records = defineResource({
      key: 'records',
      identity: (record: Row) => record.id,
      list: {
        permission: 'records.list',
        route: { name: 'records-list' },
        table: { schema: rowSchema, columns: { name: { label: 'Name' } }, load: loadRows },
      },
      create: {
        permission: 'records.create',
        route: { name: 'records-create' },
        form: { schema: draftSchema, fields: { name: {} }, submit: async (input: Draft) => ({ id: '2', ...input, status: 'new' }) },
      },
      detail: {
        permission: 'records.detail',
        route: { name: 'records-detail', params: (id) => ({ id }) },
        detail: ({ id }) => ({ schema: rowSchema, fields: { name: {} }, load: loadRecord }),
      },
      update: {
        permission: 'records.update',
        route: { name: 'records-update', params: (id) => ({ id }) },
        form: ({ id }) => ({
          schema: draftSchema,
          fields: { name: {} },
          load: async () => ({ name: `Row ${id}` }),
          submit: async (input: Draft) => ({ id, ...input, status: 'updated' }),
        }),
      },
      delete: { permission: 'records.delete', run: async (id) => id },
      actions: {
        audit: {
          permission: ['records.audit', 'records.read'],
          route: { name: 'custom-set', params: (id) => ({ id }) },
          run: async (id: string) => id,
        },
      },
    })

    const list = records.list
    const row: Row = { id: '1', name: 'One', status: 'new' }
    expect(list.createRoute).toEqual({ name: 'records-create' })
    expect(resourceActionForRoute('records-detail')).toEqual({
      resourceKey: 'records',
      action: 'detail',
      permission: 'records.detail',
    })
    expect(list.detailRoute?.(row)).toEqual({ name: 'records-detail', params: { id: '1' } })
    expect(list.updateRoute?.(row)).toEqual({ name: 'records-update', params: { id: '1' } })
    expect(records.actions.audit.route?.name).toBe('custom-set')
    expect(resourceActionForRoute('custom-set')).toEqual({
      resourceKey: 'records',
      action: 'audit',
      permission: null,
      permissions: ['records.audit', 'records.read'],
    })
    expect(records.actions.audit.can('1')).toBe(true)
    await expect(list.table.load({ query: {} })).resolves.toMatchObject({ data: [{ id: '1', name: 'One' }] })
    expect(loadRows).toHaveBeenCalledOnce()
    const detail = records.detail({ id: '1' })
    await expect(detail.detail.load({ id: '1' })).resolves.toEqual(row)
    expect(detail.backTo).toEqual({ name: 'records-list' })
    expect(loadRecord).toHaveBeenCalledOnce()
    await expect(records.create.form.submit({ name: 'Two' })).resolves.toEqual({ id: '2', name: 'Two', status: 'new' })
    expect(records.create.defaultTo?.({ id: '2', name: 'Two', status: 'new' })).toEqual({ name: 'records-detail', params: { id: '2' } })
    const update = records.update({ id: '1', record: row })
    await expect(update.form.load({ id: '1' })).resolves.toEqual({ name: 'Row 1' })
    await expect(update.form.submit({ name: 'Changed' })).resolves.toEqual({ id: '1', name: 'Changed', status: 'updated' })
    await expect(records.delete({ id: '1', record: row }).run()).resolves.toBe('1')
  })

  it('resolves runtime access only when extracted operations execute and carries the bound row', async () => {
    let allowed = false
    const requests: Array<{ operation: string; permission?: string | null; record?: unknown }> = []
    const loadRecord = vi.fn(async ({ id }: { id: string }) => ({ id, name: 'One', status: 'new' }))
    const queryClient = createFrameworkQueryClient({ retry: 0, staleTime: 0 })
    const access = {
      allows: (request: { operation: string; permission?: string | null; record?: unknown }) => {
        requests.push(request)
        return allowed
      },
    }
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const records = defineResource({
      key: 'lazy-access',
      identity: (record: Row) => record.id,
      detail: {
        permission: 'records.detail',
        visible: ({ record }) => record?.status === 'new',
        detail: ({ id }) => ({ schema: rowSchema, fields: { name: {} }, load: loadRecord }),
      },
      update: {
        permission: 'records.update',
        visible: ({ record }) => record?.status === 'new',
        form: ({ id }) => ({
          schema: draftSchema,
          fields: { name: {} },
          load: async () => ({ name: id }),
          submit: async (input: Draft) => ({ id, ...input, status: 'updated' }),
        }),
      },
    })
    registerResourceRuntime({ queryClient, adapters: resolveFrameworkAdapters({ access }) })
    const row: Row = { id: '1', name: 'One', status: 'new' }
    const detail = records.detail({ id: '1', record: row }).detail
    const update = records.update({ id: '1', record: row }).form

    await expect(detail.load({ id: '1' })).rejects.toThrow('[loom] Resource "lazy-access" action "detail" is not allowed.')
    await expect(update.load({ id: '1' })).rejects.toThrow('[loom] Resource "lazy-access" action "update" is not allowed.')
    await expect(update.submit({ name: 'Updated' })).rejects.toThrow('[loom] Resource "lazy-access" action "update" is not allowed.')
    expect(loadRecord).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()

    allowed = true
    await expect(detail.load({ id: '1' })).resolves.toMatchObject({ id: '1', name: 'One' })
    await expect(update.load({ id: '1' })).resolves.toEqual({ name: '1' })
    await expect(update.submit({ name: 'Updated' })).resolves.toEqual({ id: '1', name: 'Updated', status: 'updated' })
    expect(requests.filter((request) => request.record === row)).toHaveLength(6)
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('lets null permissions skip the access adapter while retaining visibility checks', async () => {
    const accessCalls: string[] = []
    installRuntime({ allows: ({ operation }) => { accessCalls.push(operation); return false } })
    const load = vi.fn(async () => ({ data: [{ id: '1', name: 'One', status: 'new' }] }))
    let createVisible = false
    const records = defineResource({
      key: 'open-records',
      identity: (record: Row) => record.id,
      list: { permission: null, visible: () => true, table: { schema: rowSchema, columns: { name: {} }, load } },
      create: { permission: null, visible: () => createVisible, form: { schema: draftSchema, fields: { name: {} }, submit: async (input: Draft) => ({ id: '1', ...input, status: 'new' }) } },
      delete: { permission: null, visible: ({ record }) => record?.status === 'new', run: async (id) => id },
    })

    await expect(records.list.table.load({ query: {} })).resolves.toMatchObject({ data: [{ id: '1' }] })
    expect(records.list.can('create')).toBe(false)
    await expect(records.create.form.submit({ name: 'One' })).rejects.toThrow('[loom] Resource "open-records" action "create" is not allowed.')
    createVisible = true
    expect(records.list.can('create')).toBe(true)
    await expect(records.create.form.submit({ name: 'One' })).resolves.toMatchObject({ id: '1' })
    const deletion = records.delete({ id: '1', record: { id: '1', name: 'One', status: 'new' } })
    expect(deletion.can()).toBe(true)
    await expect(deletion.run()).resolves.toBe('1')
    expect(accessCalls).toEqual([])
  })

  it('allows a null-permission set command while retaining row checks and invalidation', async () => {
    const accessCalls: string[] = []
    const queryClient = installRuntime({ allows: ({ operation }) => { accessCalls.push(operation); return false } })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const set = vi.fn(async (id: string, input: { enabled: boolean }) => ({ id, enabled: input.enabled }))
    const records = defineResource({
      key: 'open-set-records',
      identity: (record: Row) => record.id,
      actions: {
        set: {
          permission: null,
          visible: ({ record }) => record?.status === 'new',
          run: set,
        },
      },
    })
    const row: Row = { id: '1', name: 'One', status: 'locked', allowedOperations: ['set'] }

    expect(records.actions.set.can('1', { enabled: true }, { record: row })).toBe(false)
    await expect(records.actions.set.run('1', { enabled: true }, { record: row })).rejects.toThrow('[loom] Resource "open-set-records" action "set" is not allowed.')
    expect(set).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()

    row.status = 'new'
    expect(records.actions.set.can('1', { enabled: true }, { record: row })).toBe(true)
    await expect(records.actions.set.run('1', { enabled: true }, { record: row })).resolves.toEqual({ id: '1', enabled: true })
    expect(set).toHaveBeenCalledOnce()
    expect(invalidate).toHaveBeenCalledOnce()
    expect(accessCalls).toEqual([])
  })

  it('denies a set command before dispatch and invalidates once after its successful result', async () => {
    let allowed = false
    const permissionRequests: Array<string | null | undefined> = []
    const queryClient = installRuntime({ allows: ({ permission }) => { permissionRequests.push(permission); return allowed } })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const set = vi.fn(async (id: string, input: { enabled: boolean }) => ({ id, enabled: input.enabled }))
    const records = defineResource({
      key: 'set-records',
      identity: (record: Row) => record.id,
      actions: {
        set: {
          permission: ['records.set', 'records.audit'] as const,
          visible: ({ record }) => record?.allowedOperations?.includes('set') === true,
          route: { name: 'custom-set', params: (id) => ({ id }) },
          run: set,
        },
      },
    })
    const row: Row = { id: '1', name: 'One', status: 'new', allowedOperations: ['set'] }

    expect(records.actions.set.can('1', { enabled: true }, { record: row })).toBe(false)
    await expect(records.actions.set.run('1', { enabled: true }, { record: row })).rejects.toThrow('[loom] Resource "set-records" action "set" is not allowed.')
    expect(set).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()

    allowed = true
    await expect(records.actions.set.run('1', { enabled: true }, { record: row })).resolves.toEqual({ id: '1', enabled: true })
    expect(set).toHaveBeenCalledOnce()
    expect(set).toHaveBeenCalledWith('1', { enabled: true })
    expect(invalidate).toHaveBeenCalledOnce()
    expect(permissionRequests).toEqual(['records.set', 'records.set', 'records.set', 'records.audit'])
  })

  it('supports update-only resources with a technical form loader and no detail page', async () => {
    const records = defineResource({
      key: 'update-only',
      identity: (record: Row) => record.id,
      update: {
        permission: null,
        form: ({ id, record }) => ({
          schema: draftSchema,
          fields: { name: {} },
          load: async () => ({ name: record?.name ?? `Row ${id}` }),
          submit: async (input: Draft) => ({ id, ...input, status: 'updated' }),
        }),
      },
    })
    const row = { id: '1', name: 'One', status: 'new' }
    const update = records.update({ id: '1', record: row })

    expect('detail' in records).toBe(false)
    expect(update.form.id).toBe('1')
    await expect(update.form.load({ id: '1' })).resolves.toEqual({ name: 'One' })
    await expect(update.form.submit({ name: 'Changed' })).resolves.toEqual({ id: '1', name: 'Changed', status: 'updated' })
  })

  it('keeps scalar and composite identity checks on the bound operations', async () => {
    type CompositeRow = { tenantId: string; userId: number; name: string; status: string }
    const compositeSchema = z.object({ tenantId: z.string(), userId: z.number(), name: z.string(), status: z.string() })
    const records = defineResource({
      key: 'composite-records',
      identity: (record: CompositeRow) => ({ tenantId: record.tenantId, userId: record.userId }),
      detail: {
        permission: null,
        route: { name: 'records-detail', params: (id) => ({ id: `${id.tenantId}-${id.userId}` }) },
        detail: ({ id }) => ({ schema: compositeSchema, fields: { name: {} }, load: async () => ({ tenantId: id.tenantId, userId: id.userId, name: 'One', status: 'new' }) }),
      },
    })
    const page = records.detail({ id: { tenantId: 'tenant', userId: 0 } })

    expect(page.detail.namespace).toContain('tenant')
    await expect(page.detail.load({ id: { tenantId: 'tenant', userId: 0 } })).resolves.toMatchObject({ userId: 0 })
    expect(() => records.detail({ id: { tenantId: 'other', userId: 0 }, record: { tenantId: 'tenant', userId: 0, name: 'One', status: 'new' } })).toThrow('record identity conflicts')
  })
})
