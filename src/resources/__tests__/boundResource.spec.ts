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
        form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submit: async (input: Draft) => ({ id: '2', ...input, status: 'new' }) },
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
          fields: { name: { renderer: 'text' } },
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
          fields: { name: { renderer: 'text' } },
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
    expect(requests.filter((request) => request.record !== undefined)).toHaveLength(6)
    expect(requests[0].record).not.toBe(row)
    expect(requests[0].record).toEqual(row)
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('checks null permissions at the access adapter and retains row policy', async () => {
    const accessCalls: string[] = []
    installRuntime({ allows: ({ operation, permission, record }) => {
      accessCalls.push(operation)
      if (permission !== null) return false
      if (['detail', 'update', 'delete'].includes(operation) && record && Object.hasOwn(record, 'allowedOperations')) {
        const allowedOperations = record.allowedOperations
        return Array.isArray(allowedOperations) && allowedOperations.includes(operation)
      }
      return true
    } })
    const load = vi.fn(async () => ({ data: [{ id: '1', name: 'One', status: 'new' }] }))
    let createVisible = false
    const remove = vi.fn(async (id: string) => id)
    const records = defineResource({
      key: 'open-records',
      identity: (record: Row) => record.id,
      list: { permission: null, visible: () => true, table: { schema: rowSchema, columns: { name: {} }, load } },
      create: { permission: null, visible: () => createVisible, form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submit: async (input: Draft) => ({ id: '1', ...input, status: 'new' }) } },
      delete: { permission: null, visible: ({ record }) => record?.status === 'new', run: remove },
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
    const denied = records.delete({ id: '2', record: { id: '2', name: 'Two', status: 'new', allowedOperations: ['detail'] } })
    expect(denied.can()).toBe(false)
    await expect(denied.run()).rejects.toThrow('[loom] Resource "open-records" action "delete" is not allowed.')
    expect(remove).toHaveBeenCalledOnce()
    expect(accessCalls).toEqual(['list', 'create', 'create', 'create', 'create', 'delete', 'delete', 'delete', 'delete'])
  })

  it('allows a null-permission set command while retaining row checks and invalidation', async () => {
    const accessCalls: Array<{ operation: string; permission?: string | null }> = []
    const queryClient = installRuntime({ allows: (request) => { accessCalls.push(request); return request.permission === null } })
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

    const command = records.actions.set.withContext({ record: row })
    expect(command.can('1', { enabled: true })).toBe(false)
    await expect(command.run('1', { enabled: true })).rejects.toThrow('[loom] Resource "open-set-records" action "set" is not allowed.')
    expect(set).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()

    row.status = 'new'
    expect(command.can('1', { enabled: true })).toBe(false)
    const rebound = records.actions.set.withContext({ record: row })
    expect(rebound.can('1', { enabled: true })).toBe(true)
    await expect(rebound.run('1', { enabled: true })).resolves.toEqual({ id: '1', enabled: true })
    expect(set).toHaveBeenCalledOnce()
    expect(invalidate).toHaveBeenCalledOnce()
    expect(accessCalls.map(({ operation, permission }) => ({ operation, permission }))).toEqual(
      Array.from({ length: 5 }, () => ({ operation: 'set', permission: null })),
    )
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

    const command = records.actions.set.withContext({ record: row })
    expect(command.can('1', { enabled: true })).toBe(false)
    await expect(command.run('1', { enabled: true })).rejects.toThrow('[loom] Resource "set-records" action "set" is not allowed.')
    expect(set).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()

    allowed = true
    await expect(command.run('1', { enabled: true })).resolves.toEqual({ id: '1', enabled: true })
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
          fields: { name: { renderer: 'text' } },
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

  it('keeps scalar and composite bindings on detached identities and record snapshots', async () => {
    const accessRequests: Array<{ operation: string; permission?: string | null; record?: object }> = []
    const queryClient = installRuntime({ allows: (request) => {
      accessRequests.push(request)
      const record = request.record as Row | undefined
      return request.permission === null && (!record?.allowedOperations || record.allowedOperations.includes(request.operation))
    } })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const remove = vi.fn(async (id: string) => id)
    const records = defineResource({
      key: 'captured-scalar',
      identity: (record: Row) => record.id,
      delete: { permission: null, run: remove },
    })
    const sourceRecord: Row = { id: 'first', name: 'First', status: 'ready', allowedOperations: ['delete'] }
    const sourceBinding = { id: 'first', record: sourceRecord }
    const deletion = records.delete(sourceBinding)
    sourceBinding.id = 'second'
    sourceRecord.id = 'second'
    sourceRecord.allowedOperations[0] = 'update'

    expect(deletion.can()).toBe(true)
    await expect(deletion.run()).resolves.toBe('first')
    expect(remove).toHaveBeenCalledWith('first')
    const policyRecord = accessRequests[0].record as Row
    expect(policyRecord).toEqual({ id: 'first', name: 'First', status: 'ready', allowedOperations: ['delete'] })
    expect(policyRecord).not.toBe(sourceRecord)
    expect(Object.isFrozen(policyRecord)).toBe(true)
    expect(Object.isFrozen(policyRecord.allowedOperations)).toBe(true)
    expect(invalidate.mock.calls.map(([filter]) => filter.queryKey)).toEqual([
      ['resource', 'captured-scalar', 'list'],
      ['resource', 'captured-scalar', 'detail', 'first'],
    ])

    type CompositeRecord = { tenantId: string; userId: number; name: string; status: string }
    invalidate.mockClear()
    const load = vi.fn(async () => ({ name: 'First' }))
    const save = vi.fn(async (input: Draft) => ({ tenantId: 'north', userId: 7, ...input }))
    const composite = defineResource({
      key: 'captured-composite',
      identity: (record: CompositeRecord) => ({ tenantId: record.tenantId, userId: record.userId }),
      update: {
        permission: null,
        visible: ({ record }) => record?.status === 'ready',
        form: ({ id }) => ({ schema: draftSchema, fields: { name: { renderer: 'text' } }, load, submit: save }),
      },
    })
    const compositeId = { tenantId: 'north', userId: 7 }
    const compositeRecord: CompositeRecord = { ...compositeId, name: 'First', status: 'ready' }
    const compositeBinding = { id: compositeId, record: compositeRecord }
    const form = composite.update(compositeBinding).form
    compositeId.tenantId = 'south'
    compositeRecord.tenantId = 'south'
    compositeRecord.status = 'locked'

    expect(form.id).toEqual({ tenantId: 'north', userId: 7 })
    expect(form.id).not.toBe(compositeId)
    expect(Object.isFrozen(form.id)).toBe(true)
    await expect(form.load({ id: { tenantId: 'south', userId: 7 } })).rejects.toThrow('loader identity conflicts')
    expect(load).not.toHaveBeenCalled()
    await expect(form.load({ id: { tenantId: 'north', userId: 7 } })).resolves.toEqual({ name: 'First' })
    await expect(form.submit({ name: 'Changed' })).resolves.toEqual({ tenantId: 'north', userId: 7, name: 'Changed' })
    expect(save).toHaveBeenCalledOnce()
    expect(accessRequests.at(-1)?.record).toMatchObject({ tenantId: 'north', status: 'ready' })
    expect(invalidate.mock.calls.map(([filter]) => filter.queryKey)).toEqual([
      ['resource', 'captured-composite', 'list'],
      ['resource', 'captured-composite', 'detail', { tenantId: 'north', userId: 7 }],
    ])
  })

  it('binds custom command context separately from default and record-bearing payloads', async () => {
    type Payload = { record: { id: string }; note: string }
    const defaultPayload: Payload = { record: { id: 'default-business-record' }, note: 'default' }
    const runCalls: unknown[][] = []
    const permissionCalls: unknown[][] = []
    installRuntime({ allows: ({ permission }) => permission === null })
    const records = defineResource({
      key: 'command-context',
      identity: (record: Row) => record.id,
      actions: {
        review: {
          permission: (payload: Payload = defaultPayload, ...flags: boolean[]) => {
            permissionCalls.push([payload, ...flags])
            return null
          },
          visible: ({ record }) => record?.status === 'ready',
          run: async (payload: Payload = defaultPayload, ...flags: boolean[]) => {
            runCalls.push([payload, ...flags])
            return payload.note
          },
        },
      },
    })
    const firstRecord: Row = { id: 'first', name: 'First', status: 'ready' }
    const nextRecord: Row = { id: 'next', name: 'Next', status: 'locked' }
    const payload: Payload = { record: { id: 'payload-record' }, note: 'keep the full payload' }
    const rootCommand = records.actions.review
    const rowCommand = rootCommand.withContext({ record: firstRecord })
    const reboundCommand = rowCommand.withContext({ record: nextRecord })

    expect(rootCommand.can()).toBe(false)
    expect(rowCommand.can(payload, true)).toBe(true)
    expect(reboundCommand.can(payload, true)).toBe(false)
    await expect(reboundCommand.run(payload, true)).rejects.toThrow('is not allowed')
    await expect(rowCommand.run(payload, true)).resolves.toBe('keep the full payload')
    expect(runCalls).toEqual([[payload, true]])
    expect(permissionCalls).toEqual([[defaultPayload], [payload, true], [payload, true], [payload, true], [payload, true]])
    expect(() => rootCommand.withContext({ record: { name: 'Missing identity', status: 'ready' } as Row })).toThrow('identity "review" is malformed')
  })

  it('denies malformed explicit custom row restrictions before a write', async () => {
    installRuntime({ allows: ({ permission }) => permission === null })
    const run = vi.fn(async () => 'rejected')
    const records = defineResource({
      key: 'custom-row-policy',
      identity: (record: Row) => record.id,
      actions: {
        reject: { permission: null, run },
      },
    })
    const command = records.actions.reject.withContext({ record: { id: 'one', name: 'One', status: 'ready', allowedOperations: ['reject', null] } as unknown as Row })

    expect(command.can()).toBe(false)
    await expect(command.run()).rejects.toThrow('is not allowed')
    expect(run).not.toHaveBeenCalled()

    const allowed = records.actions.reject.withContext({ record: { id: 'two', name: 'Two', status: 'ready', allowedOperations: ['reject'] } })
    expect(allowed.can()).toBe(true)
    await expect(allowed.run()).resolves.toBe('rejected')
    expect(run).toHaveBeenCalledOnce()
  })

  it('validates mutation result identity and reports post-write failures without retrying', async () => {
    const queryClient = installRuntime()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const minimalCreateSubmit = vi.fn(async (_input: Draft) => ({ id: 'minimal' }))
    const minimalCreate = defineResource({
      key: 'minimal-create-result',
      identity: (record: { id: string }) => record.id,
      create: {
        permission: null,
        defaultTo: false,
        form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submit: minimalCreateSubmit },
      },
    })

    await expect(minimalCreate.create.form.submit({ name: 'Minimal' })).resolves.toEqual({ id: 'minimal' })
    expect(minimalCreateSubmit).toHaveBeenCalledOnce()
    expect(invalidate.mock.calls.map(([filter]) => filter.queryKey)).toEqual([['resource', 'minimal-create-result']])

    invalidate.mockClear()
    const createSubmit = vi.fn(async (_input: Draft) => ({ name: 'Created without an id' }))
    const create = defineResource({
      key: 'invalid-create-result',
      identity: (record: { id?: string }) => record.id as string,
      create: {
        permission: null,
        defaultTo: false,
        form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submit: createSubmit },
      },
    })
    const createError = await create.create.form.submit({ name: 'Created' }).then(
      () => undefined,
      (error: unknown) => error,
    )

    expect(createError).toMatchObject({ code: 'RESOURCE_RESULT_INVALID', operation: 'create', retryable: false, postWrite: true })
    expect((createError as Error).message).toContain('may have completed')
    expect(resolveFrameworkAdapters().data.normalizeError(createError)).toMatchObject({
      code: 'RESOURCE_RESULT_INVALID',
      operation: 'create',
      retryable: false,
      postWrite: true,
    })
    expect(createSubmit).toHaveBeenCalledOnce()
    expect(create.create.defaultTo).toBe(false)
    expect(invalidate.mock.calls.map(([filter]) => filter.queryKey)).toEqual([['resource', 'invalid-create-result']])

    invalidate.mockClear()
    const updateSubmit = vi.fn(async (_input: Draft) => ({ id: 'other', name: 'Changed' }))
    const update = defineResource({
      key: 'invalid-update-result',
      identity: (record: { id: string }) => record.id,
      update: {
        permission: null,
        form: ({ id }) => ({ schema: draftSchema, fields: { name: { renderer: 'text' } }, load: async () => ({ name: id }), submit: updateSubmit }),
      },
    })
    const updateError = await update.update({ id: 'bound' }).form.submit({ name: 'Changed' }).then(
      () => undefined,
      (error: unknown) => error,
    )

    expect(updateError).toMatchObject({ code: 'RESOURCE_RESULT_INVALID', operation: 'update', retryable: false, postWrite: true })
    expect(updateSubmit).toHaveBeenCalledOnce()
    expect(invalidate.mock.calls.map(([filter]) => filter.queryKey)).toEqual([
      ['resource', 'invalid-update-result', 'list'],
      ['resource', 'invalid-update-result', 'detail', 'bound'],
    ])

    invalidate.mockRejectedValue(new Error('Query client unavailable'))
    const validSubmit = vi.fn(async (_input: Draft) => ({ id: 'valid-result' }))
    const validCreate = defineResource({
      key: 'invalidation-failure',
      identity: (record: { id: string }) => record.id,
      create: { permission: null, form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submit: validSubmit } },
    })
    const invalidationError = await validCreate.create.form.submit({ name: 'Write accepted' }).then(
      () => undefined,
      (error: unknown) => error,
    )

    expect(invalidationError).toMatchObject({ code: 'RESOURCE_POST_WRITE_INVALIDATION_FAILED', operation: 'create', retryable: false, postWrite: true })
    expect(validSubmit).toHaveBeenCalledOnce()
  })

  it('forwards canonical list and form View props while binding primitives', async () => {
    installRuntime()
    const filters = {
      schema: {
        _input: null as unknown as { status?: string },
        _output: null as unknown as { status?: string },
        parseAsync: async (input: unknown) => input as { status?: string },
      },
      fields: { status: { renderer: 'text' } },
      defaults: { status: 'open' },
    }
    const exportOptions = { filename: 'records', sheetName: 'Records', pageSize: 50 }
    const afterSubmit = vi.fn()
    const records = defineResource({
      key: 'complete-view-props',
      identity: (record: { id: string }) => record.id,
      list: {
        permission: null,
        title: 'Records',
        description: 'Current records',
        table: { schema: rowSchema, columns: { name: {} }, load: async () => ({ data: [] }) },
        filters,
        export: exportOptions,
        createRoute: false,
        detailRoute: false,
        updateRoute: false,
      },
      create: {
        permission: null,
        title: 'Create record',
        description: 'Add one record',
        backTo: false,
        defaultTo: false,
        afterSubmit,
        successMessage: false,
        form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submitLabel: 'Create record', submit: async (input: Draft) => ({ id: 'new', ...input }) },
      },
      detail: {
        permission: null,
        backTo: false,
        detail: ({ id }) => ({ schema: rowSchema, fields: { name: {} }, load: async () => ({ id, name: 'One', status: 'new' }) }),
      },
    })

    expect(records.list).toMatchObject({ title: 'Records', description: 'Current records', filters, export: exportOptions })
    expect(records.list.createRoute).toBe(false)
    expect(records.list.detailRoute).toBe(false)
    expect(records.list.updateRoute).toBe(false)
    expect(records.list.table.resource).toBe('complete-view-props')
    expect(records.create).toMatchObject({ title: 'Create record', description: 'Add one record', backTo: false, defaultTo: false, successMessage: false })
    expect(records.create.afterSubmit).toBe(afterSubmit)
    expect(records.create.form.submitLabel).toBe('Create record')
    expect(records.detail({ id: 'one' }).backTo).toBe(false)
  })
})
