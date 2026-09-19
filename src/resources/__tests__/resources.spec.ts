import { afterEach, describe, expect, it } from 'vitest'
import type { CollectionResult, WebResourceSchema } from '../../contracts'
import { createFrameworkQueryClient } from '../../query/client'
import { resolveFrameworkAdapters } from '../../adapters/projectAdapters'
import { resolveFrameworkFieldDefaults } from '../../fields/defaults'
import { resolveFields } from '../../fields/resolve'
import { defineFields } from '../../fields/defineFields'
import { createInputPropsRegistry } from '../../renderers/inputProps'
import { defineResource } from '../defineResource'
import { registeredResourceActionNames, resourceActionForRoute, resetResourceActionRegistry } from '../routeAccess'
import { registerResourceRuntime, resetResourceRuntimeForTests } from '../runtime'

type Row = { id: string; name: string }
type Draft = { name: string }
type Schema = WebResourceSchema<Row, Record<string, never>, Draft, Draft, string>

const schema: Schema = { identity: 'id' }
const fields = defineFields(schema, {
  name: { label: 'Name', table: { sortable: true }, form: { renderer: 'text' } },
})

type AssetRecord = { id: string; imgThumbnail: string | null }
type AssetDraft = { imgThumbnail?: string | null }
type AssetSchema = WebResourceSchema<AssetRecord, Record<string, never>, AssetDraft, AssetDraft, string>

const assetSchema: AssetSchema = { identity: 'id' }
const assetFields = defineFields(assetSchema, {
  imgThumbnail: { label: 'Image', form: { renderer: 'image' } },
})

type DefaultRecord = { id: string; name: string; active: boolean }
type DefaultDraft = { name: string; active: boolean }
type DefaultSchema = WebResourceSchema<DefaultRecord, Record<string, never>, DefaultDraft, DefaultDraft, string>

const defaultSchema: DefaultSchema = { identity: 'id' }
const defaultFields = defineFields(defaultSchema, {
  name: { label: 'Name' },
  active: { label: 'Resource active', form: { renderer: 'text' } },
})

function resource(access = { allows: () => true }) {
  registerResourceRuntime({
    queryClient: createFrameworkQueryClient(),
    adapters: resolveFrameworkAdapters({ access }),
    fieldDefaults: resolveFrameworkFieldDefaults(),
  })
  return defineResource(schema, {
    key: 'records',
    actions: {
      list: {
        run: async (): Promise<CollectionResult<Row>> => ({ data: [{ id: '1', name: 'One' }] }),
        fields: [fields.name],
        permission: 'records.list',
        route: { name: 'records-list' },
      },
      detail: {
        run: async ({ id }) => ({ id, name: 'One' }),
        fields: [fields.name],
        permission: 'records.detail',
        route: { name: 'records-detail', params: (id) => ({ id }) },
        title: 'Detail Record',
      },
      create: {
        run: async (input) => ({ id: '2', ...input }),
        fields: [fields.name],
        permission: 'records.create',
        route: { name: 'records-create' },
      },
      update: {
        run: async (id, input) => ({ id, name: input.name }),
        fields: [fields.name],
        permission: 'records.update',
        route: { name: 'records-edit', params: (id) => ({ id }) },
      },
      delete: {
        run: async () => undefined,
        permission: 'records.delete',
      },
      verify: { run: async (id: string, result: 'approved' | 'rejected') => `${id}:${result}`, permission: 'records.verify' },
    },
  })
}

afterEach(() => {
  resetResourceRuntimeForTests()
  resetResourceActionRegistry()
})

describe('action resources', () => {
  it('resolves typed default-only keys and keeps resource overrides', () => {
    const fieldDefaults = resolveFrameworkFieldDefaults({
      fields: {
        active: { label: 'Status', form: { renderer: 'switch', initialValue: () => true } },
      },
    })
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults,
    })
    const value = defineResource(defaultSchema, {
      key: 'default-only-fields',
      actions: {
        create: {
          run: async (input) => ({ id: '1', ...input }),
          fields: [defaultFields.name, 'active'],
        },
        update: {
          run: async (id, input) => ({ id, ...input }),
          fields: [defaultFields.name, 'active'],
        },
      },
    })

    const createFields = value.create().fields
    expect(createFields).toEqual([
      expect.objectContaining({ key: 'name' }),
      { key: 'active' },
    ])
    const resolved = resolveFields({ fields: createFields, surface: 'form', defaultFields: fieldDefaults.fields })
    expect(resolved.find((field) => field.key === 'active')).toMatchObject({ label: 'Status', renderer: 'switch' })
    expect(resolved.find((field) => field.key === 'active')?.initialValue?.()).toBe(true)

    const override = defineResource(defaultSchema, {
      key: 'resource-field-override',
      actions: {
        create: {
          run: async (input) => ({ id: '1', ...input }),
          fields: [defaultFields.active.override({ form: { renderer: 'radio' } })],
        },
      },
    })
    const overrideField = resolveFields({ fields: override.create().fields, surface: 'form', defaultFields: fieldDefaults.fields })[0]
    expect(overrideField).toMatchObject({ label: 'Resource active', renderer: 'radio' })
  })

  it('rejects mixed duplicate field selections', () => {
    const value = defineResource(defaultSchema, {
      key: 'duplicate-mixed-fields',
      actions: {
        create: {
          run: async (input) => ({ id: '1', ...input }),
          fields: [defaultFields.name.override({ label: 'Override' }), 'name'],
        },
      },
    })

    expect(() => value.create()).toThrow('duplicate field "name"')
  })

  it('allows equivalent route access contracts and keeps the latest resource key', () => {
    const routeName = 'records-equivalent-route'
    defineResource(schema, {
      key: 'records-project-a',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.detail',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })
    defineResource(schema, {
      key: 'records-project-b',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.detail',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })

    expect(resourceActionForRoute(routeName)).toEqual({
      resourceKey: 'records-project-b',
      action: 'detail',
      permission: 'records.detail',
    })
  })

  it('rejects route access contracts with different permissions', () => {
    const routeName = 'records-permission-conflict-route'
    defineResource(schema, {
      key: 'records-permission-a',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.detail.read',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })

    expect(() => defineResource(schema, {
      key: 'records-permission-b',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.detail.write',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })).toThrowError(`[loom] Route action conflict for "${routeName}".`)
  })

  it('rejects route access contracts with different actions', () => {
    const routeName = 'records-action-conflict-route'
    defineResource(schema, {
      key: 'records-action-a',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.access',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })

    expect(() => defineResource(schema, {
      key: 'records-action-b',
      actions: {
        list: {
          run: async () => ({ data: [] }),
          permission: 'records.access',
          route: { name: routeName },
        },
      },
    })).toThrowError(`[loom] Route action conflict for "${routeName}".`)
  })

  it('reads wire asset values before resource records reach the UI', async () => {
    const read = (value: unknown) => typeof value === 'string'
      ? { kind: 'file', id: value, url: `https://files.test/${value}`, name: value.split('/').pop() }
      : value
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
      inputProps: createInputPropsRegistry({ image: { value: { hydrate: read } } }),
    })
    const value = defineResource(assetSchema, {
      key: 'asset-records',
      actions: {
        detail: {
          run: async () => ({ id: '1', imgThumbnail: 'uploads/cover.png' }),
          fields: [assetFields.imgThumbnail],
        },
      },
    })

    await expect(value.detail({ id: '1' }).run()).resolves.toMatchObject({
      imgThumbnail: { kind: 'file', id: 'uploads/cover.png', name: 'cover.png' },
    })
  })

  it('builds standard surfaces and keeps custom actions explicit', async () => {
    const value = resource()
    const list = value.list()
    const record = { id: '1', name: 'One' }

    expect(list.fields).toEqual([expect.objectContaining({ key: 'name', label: 'Name', table: { sortable: true }, form: { renderer: 'text' } })])
    expect(list.resource).toBe('records')
    expect(list.createRoute).toEqual({ name: 'records-create' })
    expect(list.detailRoute?.(record)).toEqual({ name: 'records-detail', params: { id: '1' } })
    expect(list.updateRoute?.(record)).toEqual({ name: 'records-edit', params: { id: '1' } })
    expect(list.can?.('delete', record)).toBe(true)
    expect(list.can?.('update', record)).toBe(true)
    const detail = value.detail({ id: '1' })
    expect(detail.resource).toBe('records')
    expect(detail.title).toBe('Detail Record')
    expect(detail.backTo).toEqual({ name: 'records-list' })
    await expect(value.actions.verify.run('1', 'approved')).resolves.toBe('1:approved')
    expect(value.create().resource).toBe('records')
    expect(value.update({ id: '1' }).resource).toBe('records')
    await expect(value.create().run({ name: 'Two' })).resolves.toEqual({ id: '2', name: 'Two' })
    expect(value.create().defaultTo?.({ id: '2', name: 'Two' })).toEqual({ name: 'records-detail', params: { id: '2' } })
    expect(value.update({ id: '1' }).defaultTo?.({ id: '1', name: 'One' })).toEqual({ name: 'records-detail', params: { id: '1' } })
  })

  it('lets create and update replace or clear the detail defaultTo', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const list = { name: 'records-list' }
    const value = defineResource(schema, {
      key: 'records-override',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          route: { name: 'records-detail', params: (id) => ({ id }) },
        },
        create: {
          run: async (input) => ({ id: '2', ...input }),
          defaultTo: list,
        },
        update: {
          run: async (id, input) => ({ id, name: input.name }),
          defaultTo: false,
        },
      },
    })

    expect(value.create().defaultTo?.({ id: '2', name: 'Two' })).toEqual(list)
    expect(value.update({ id: '1' }).defaultTo).toBeUndefined()
  })

  it('falls back to the list route when no detail action exists', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-list-fallback',
      actions: {
        list: {
          run: async () => ({ data: [] }),
          route: { name: 'records-list' },
        },
        create: {
          run: async (input) => ({ id: '2', ...input }),
        },
        update: {
          run: async (id, input) => ({ id, name: input.name }),
        },
      },
    })

    expect(value.create().defaultTo?.({ id: '2', name: 'Two' })).toEqual({ name: 'records-list' })
    expect(value.update({ id: '1' }).defaultTo?.({ id: '1', name: 'One' })).toEqual({ name: 'records-list' })
  })

  it('stays on the page when neither detail nor list routes exist', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-no-fallback',
      actions: {
        create: {
          run: async (input) => ({ id: '2', ...input }),
        },
        update: {
          run: async (id, input) => ({ id, name: input.name }),
        },
      },
    })

    expect(value.create().defaultTo).toBeUndefined()
    expect(value.update({ id: '1' }).defaultTo).toBeUndefined()
  })

  it('prefers a declared detail backTo over the inferred list route', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-backto',
      actions: {
        list: { run: async () => ({ data: [] }), route: { name: 'records-list' } },
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          route: { name: 'records-detail', params: (id) => ({ id }) },
          title: 'Custom Detail',
          backTo: { name: 'parent-tab' },
        },
      },
    })

    expect(value.detail({ id: '1' }).backTo).toEqual({ name: 'parent-tab' })
    expect(value.detail({ id: '1' }).title).toBe('Custom Detail')
  })

  it('infers detail backTo from a parameterized sibling list route', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-nested',
      actions: {
        list: { run: async () => ({ data: [] }), route: { name: 'parent-tab', params: { parentId: 'p1' } } },
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          route: { name: 'parent-tab-detail', params: (id) => ({ parentId: 'p1', id: String(id) }) },
        },
      },
    })

    expect(value.detail({ id: '1' }).backTo).toEqual({ name: 'parent-tab', params: { parentId: 'p1' } })
  })

  it('filters standard routes and row actions through access', () => {
    const value = resource({ allows: ({ operation }: { operation: string }) => operation === 'list' })
    const list = value.list()
    const record = { id: '1', name: 'One' }

    expect(list.createRoute).toBeUndefined()
    expect(list.detailRoute?.(record)).toBeUndefined()
    expect(list.updateRoute?.(record)).toBeUndefined()
    expect(list.can?.('create')).toBe(false)
  })

  it('answers undeclared operations through access on list and detail bags', () => {
    const asked: { operation: string; permission: string | null; record?: unknown }[] = []
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters({
        access: {
          allows: ({ operation, permission, record }) => {
            asked.push({ operation, permission: permission ?? null, record })
            return Array.isArray((record as { allowedOperations?: string[] } | undefined)?.allowedOperations)
              ? (record as { allowedOperations: string[] }).allowedOperations.includes(operation)
              : false
          },
        },
      }),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-bare',
      actions: {
        list: {
          run: async (): Promise<CollectionResult<Row>> => ({ data: [] }),
          fields: [fields.name],
          route: { name: 'records-list' },
        },
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          fields: [fields.name],
          route: { name: 'records-detail', params: (id) => ({ id }) },
        },
      },
    })

    const record = { id: '1', name: 'One', allowedOperations: ['update', 'delete'] }
    // Undeclared standard row ops ignore the row array: a stray entry must
    // not grant an operation the resource never declared.
    expect(value.list().can?.('delete', record)).toBe(false)
    expect(value.list().can?.('update', { id: '2', name: 'Two' })).toBe(false)
    expect(value.list().can?.('delete', { id: '2', name: 'Two' })).toBe(false)
    const detail = value.detail({ id: '1' })
    expect(typeof detail.can).toBe('function')
    expect(detail.can?.('delete', record)).toBe(false)
    expect(asked.every((call) => call.permission === null)).toBe(true)
    expect(asked.filter((call) => call.operation === 'delete' || call.operation === 'update').every((call) => call.record === undefined)).toBe(true)
  })

  it('injects operation and declared permission into form field context', () => {
    const value = resource()

    expect(value.create().context).toEqual({ operation: 'create', permission: 'records.create' })
    expect(value.update({ id: '1' }).context).toEqual({ operation: 'update', permission: 'records.update' })
  })

  it('keeps caller context keys and wins over reserved action keys', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-context',
      actions: {
        create: {
          run: async (input) => ({ id: '2', ...input }),
          fields: [fields.name],
          permission: 'records.create',
        },
        update: {
          run: async (id, input) => ({ id, name: input.name }),
          fields: [fields.name],
          permission: null,
        },
      },
    })

    expect(value.create({ context: { ticket: 't-1', operation: 'delete', permission: 'records.delete' } }).context).toEqual({
      ticket: 't-1',
      operation: 'create',
      permission: 'records.create',
    })
    expect(value.update({ id: '1', context: { ticket: 't-2', permission: 'records.delete' } }).context).toEqual({
      ticket: 't-2',
      operation: 'update',
      permission: null,
    })
  })

  it('composes form context even when the caller supplies none', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-no-permission',
      actions: {
        create: { run: async (input) => ({ id: '2', ...input }), fields: [fields.name] },
        update: { run: async (id, input) => ({ id, name: input.name }), fields: [fields.name] },
      },
    })

    expect(value.create().context).toEqual({ operation: 'create', permission: null })
    expect(value.update({ id: '1' }).context).toEqual({ operation: 'update', permission: null })
  })
})

describe('defineActionResource delete permission invariant', () => {
  it('throws when a delete action omits permission', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    expect(() =>
      defineResource(schema, {
        key: 'records-delete-ungated',
        actions: {
          // @ts-expect-error delete permission is required
          delete: { run: async (id: string) => id },
        },
      }),
    ).toThrowError(/action "delete" needs an explicit permission/)
  })

  it('accepts an explicit null permission as allow-all', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-delete-null',
      actions: { delete: { run: async (id: string) => id, permission: null } },
    })
    expect(value.delete({ id: '1' })).toBeDefined()
  })
})

describe('custom action declarations', () => {
  function customResource(
    verify: unknown,
    access: { allows: (request: { operation: string; permission?: string }) => boolean } = { allows: () => true },
  ) {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters({ access }),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    return defineResource(schema, {
      key: 'custom-records',
      actions: {
        verify: verify as { run: (id: string, result: 'approved' | 'rejected') => Promise<string>; permission: 'records.verify' },
        udpate: { run: async (id: string, result: 'approved' | 'rejected') => `${id}:${result}`, permission: null },
      },
    })
  }

  it('accepts a custom action named udpate and returns it through resource.actions', async () => {
    const value = customResource({ run: async (id: string, result: 'approved' | 'rejected') => `${id}:${result}`, permission: 'records.verify' })

    await expect(value.actions.udpate.run('1', 'approved')).resolves.toBe('1:approved')
    expect(value.actions.udpate.can('1', 'approved')).toBe(true)
  })

  it('rejects an unknown definition key before registering routes', () => {
    const before = registeredResourceActionNames().length

    expect(() =>
      customResource({ run: async () => undefined, permission: 'records.verify' }, { allows: () => true }),
    ).not.toThrow()
    expect(() =>
      defineResource(schema, {
        key: 'custom-bad-top',
        actions: { verify: { run: async () => undefined, permission: 'records.verify' } },
        extra: true,
      } as unknown as { key: string; actions: Record<string, { run: () => Promise<undefined>; permission: string }> }),
    ).toThrowError('[loom] Resource "custom-bad-top" property "extra" is not a supported option.')
    expect(registeredResourceActionNames()).toHaveLength(before)
  })

  it('rejects unknown action options, malformed entries, and invalid permissions', () => {
    const cases: [string, unknown][] = [
      ['unknown-option', { run: async () => undefined, permission: 'records.verify', extra: true }],
      ['missing-run', { permission: 'records.verify' }],
      ['non-function-run', { run: 'verify', permission: 'records.verify' }],
      ['missing-permission', { run: async () => undefined }],
      ['empty-permission', { run: async () => undefined, permission: '' }],
      ['empty-array-permission', { run: async () => undefined, permission: [] }],
      ['bad-value-permission', { run: async () => undefined, permission: 42 }],
    ]
    for (const [name, entry] of cases) {
      expect(() =>
        defineResource(schema, {
          key: `custom-bad-${name}`,
          actions: { verify: entry },
        } as unknown as { key: string; actions: Record<string, unknown> }),
      ).toThrowError(`[loom] Resource "custom-bad-${name}" action "verify"`)
    }
  })

  it('rejects a delete action without an explicit permission and keeps null open', () => {
    expect(() =>
      defineResource(schema, {
        key: 'custom-delete-missing',
        actions: { delete: { run: async () => undefined } },
      } as unknown as { key: string; actions: Record<string, unknown> }),
    ).toThrowError('[loom] Resource "custom-delete-missing" action "delete" needs an explicit permission')
    const open = customResource({ run: async () => undefined, permission: null })
    expect(open.actions.verify.can('1', 'approved')).toBe(true)
  })

  it('leaves the route registry unchanged and runs no callback on a bad later action', async () => {
    let calls = 0
    const before = registeredResourceActionNames().length
    const actions = {
      verify: { run: async () => { calls += 1 }, permission: 'records.verify' },
      broken: { run: async () => undefined, permission: 42 },
    }

    expect(() =>
      defineResource(schema, {
        key: 'custom-bad-later',
        actions,
      } as unknown as { key: string; actions: Record<string, unknown> }),
    ).toThrowError('[loom] Resource "custom-bad-later" action "broken"')
    expect(calls).toBe(0)
    expect(registeredResourceActionNames()).toHaveLength(before)
  })

  it('checks static, array, resolver, and null permissions through can and run', async () => {
    const asked: { operation: string; permission?: string }[] = []
    const access = {
      allows: ({ operation, permission }: { operation: string; permission?: string }) => {
        asked.push({ operation, permission })
        return permission !== 'denied-action'
      },
    }
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters({ access }),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    let calls = 0
    const value = defineResource(schema, {
      key: 'custom-checks',
      actions: {
        one: { run: async () => { calls += 1; return 'one' }, permission: 'records.one' },
        many: { run: async () => { calls += 1; return 'many' }, permission: ['records.one', 'records.many'] as const },
        conditional: {
          run: async (id: string, result: 'approved' | 'rejected') => { calls += 1; return `${id}:${result}` },
          permission: (id: string, result: 'approved' | 'rejected') => (result === 'approved' ? 'records.conditional' : null),
        },
        open: { run: async () => { calls += 1; return 'open' }, permission: null },
        shut: { run: async () => { calls += 1; return 'shut' }, permission: 'denied-action' },
      },
    })

    expect(value.actions.one.can()).toBe(true)
    expect(value.actions.many.can()).toBe(true)
    expect(value.actions.conditional.can('1', 'approved')).toBe(true)
    expect(value.actions.conditional.can('1', 'rejected')).toBe(true)
    expect(value.actions.open.can()).toBe(true)
    expect(value.actions.shut.can()).toBe(false)
    expect(asked.filter((call) => call.operation === 'conditional').length).toBeGreaterThan(0)
    expect(asked.every((call) => call.operation === 'one' || call.operation === 'many' || call.operation === 'conditional' || call.operation === 'open' || call.operation === 'shut')).toBe(true)

    await expect(value.actions.one.run()).resolves.toBe('one')
    await expect(value.actions.many.run()).resolves.toBe('many')
    await expect(value.actions.conditional.run('1', 'approved')).resolves.toBe('1:approved')
    await expect(value.actions.open.run()).resolves.toBe('open')
    expect(calls).toBe(4)
  })

  it('requires every listed permission before a denied array entry blocks run', async () => {
    let calls = 0
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters({ access: { allows: ({ permission }) => permission === 'records.one' } }),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'custom-partial-array',
      actions: {
        many: { run: async () => { calls += 1; return 'many' }, permission: ['records.one', 'records.many'] as const },
      },
    })

    expect(value.actions.many.can()).toBe(false)
    let denial: unknown
    try {
      await value.actions.many.run()
    } catch (error: unknown) {
      denial = error
    }
    expect(String((denial as Error).message)).toBe('[loom] Resource "custom-partial-array" action "many" is not allowed.')
    expect(calls).toBe(0)
  })

  it('blocks a denied run before the application callback and hides arguments', async () => {
    let calls = 0
    const access = { allows: () => false }
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters({ access }),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'custom-denied',
      actions: {
        verify: {
          run: async (id: string, secret: string) => { calls += 1; return `${id}:${secret}` },
          permission: 'records.verify',
        },
      },
    })

    expect(value.actions.verify.can('1', 'top-secret')).toBe(false)
    let denial: unknown
    try {
      await value.actions.verify.run('1', 'top-secret')
    } catch (error: unknown) {
      denial = error
    }
    expect(denial).toBeInstanceOf(Error)
    expect(String((denial as Error).message)).toBe('[loom] Resource "custom-denied" action "verify" is not allowed.')
    expect(String((denial as Error).message)).not.toContain('top-secret')
    expect(calls).toBe(0)
  })

  it('fails a malformed resolver result before the application callback', async () => {
    let calls = 0
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'custom-bad-resolver',
      actions: {
        verify: {
          run: async () => { calls += 1; return 'verify' },
          permission: (() => 42) as unknown as 'records.verify',
        },
      },
    })

    expect(() => value.actions.verify.can()).toThrowError('[loom] Resource "custom-bad-resolver" action "verify" property "permission"')
    let failure: unknown
    try {
      await value.actions.verify.run()
    } catch (error: unknown) {
      failure = error
    }
    expect(String((failure as Error).message)).toContain('[loom] Resource "custom-bad-resolver" action "verify" property "permission"')
    expect(calls).toBe(0)
  })
})

describe('action-bag cache bound', () => {
  it('evicts oldest bags once the cache limit is exceeded', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-cache-bound',
      actions: {
        detail: { run: async ({ id }) => ({ id: String(id), name: 'One' }), fields: [fields.name] },
        delete: { run: async (id) => id, permission: null },
      },
    })
    const first = value.detail({ id: '0' })
    expect(value.detail({ id: '0' })).toBe(first)
    for (let i = 1; i <= 200; i += 1) value.detail({ id: String(i) })
    expect(value.detail({ id: '0' })).not.toBe(first)
  })
})

describe('resource identity checks', () => {
  function identityResource(key: string, spies: { write: () => void; invalidate: () => void }) {
    const queryClient = createFrameworkQueryClient()
    const invalidateSpy = queryClient.invalidateQueries.bind(queryClient)
    const watched = { ...queryClient, invalidateQueries: (...args: never[]) => { spies.invalidate(); return (invalidateSpy as (...callArgs: never[]) => unknown)(...args) } }
    registerResourceRuntime({
      queryClient: watched as ReturnType<typeof createFrameworkQueryClient>,
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    return defineResource(schema, {
      key,
      actions: {
        list: {
          run: async (): Promise<CollectionResult<Row>> => ({ data: [{ id: '1', name: 'One' }] }),
          fields: [fields.name],
          route: { name: 'records-list' },
        },
        detail: {
          run: async ({ id }) => ({ id: String(id), name: 'One' }),
          fields: [fields.name],
          permission: 'records.detail',
          route: { name: 'records-detail', params: (id) => ({ id: String(id) }) },
        },
        update: {
          run: async (id, input) => { spies.write(); return ({ id: String(id), name: input.name }) },
          fields: [fields.name],
          permission: 'records.update',
          route: { name: 'records-edit', params: (id) => ({ id: String(id) }) },
        },
        delete: {
          run: async () => { spies.write(); return undefined },
          permission: 'records.delete',
        },
      },
    })
  }

  it('rejects empty and duplicate key-array declarations at construction', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    expect(() => defineResource({ identity: [], record: {} } as unknown as Schema, {
      key: 'identity-empty',
      actions: { list: { run: async () => ({ data: [] }) } },
    })).toThrowError('[loom] Resource "identity-empty" identity needs a nonempty key or key array.')
    expect(() => defineResource({ identity: ['id', 'id'], record: {} } as unknown as Schema, {
      key: 'identity-duplicate',
      actions: { list: { run: async () => ({ data: [] }) } },
    })).toThrowError('[loom] Resource "identity-duplicate" identity has a duplicate key.')
  })

  it('fails malformed record identities before navigation targets resolve', () => {
    let writes = 0
    let invalidations = 0
    const value = identityResource('identity-malformed-row', { write: () => { writes += 1 }, invalidate: () => { invalidations += 1 } })
    const malformed = { id: undefined, name: 'Broken' } as unknown as Row

    expect(() => value.list().detailRoute?.(malformed)).toThrowError('[loom] Resource "identity-malformed-row" identity "id" is malformed.')
    expect(() => value.list().updateRoute?.(malformed)).toThrowError('[loom] Resource "identity-malformed-row" identity "id" is malformed.')
    expect(writes).toBe(0)
    expect(invalidations).toBe(0)
  })

  it('fails malformed detail, update, and delete IDs before their work starts', async () => {
    let writes = 0
    let invalidations = 0
    const value = identityResource('identity-malformed-args', { write: () => { writes += 1 }, invalidate: () => { invalidations += 1 } })
    const badId = undefined as unknown as string

    expect(() => value.detail({ id: badId })).toThrowError('[loom] Resource "identity-malformed-args" identity "detail" is malformed.')
    expect(() => value.update({ id: badId })).toThrowError('[loom] Resource "identity-malformed-args" identity "update" is malformed.')
    expect(() => value.delete({ id: badId })).toThrowError('[loom] Resource "identity-malformed-args" identity "delete" is malformed.')
    await expect(value.invalidate({ id: badId })).rejects.toThrowError('[loom] Resource "identity-malformed-args" identity "invalidate" is malformed.')
    expect(writes).toBe(0)
    expect(invalidations).toBe(0)
    await expect(value.invalidate()).resolves.toBeUndefined()
  })

  it('keeps valid zero, empty-string, composite, and global identities working', async () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    type CompositeRow = { tenantId: string; userId: number; name: string }
    type CompositeSchema = WebResourceSchema<CompositeRow, Record<string, never>, Draft, Draft, { tenantId: string; userId: number }>
    const compositeSchema: CompositeSchema = { identity: ['tenantId', 'userId'] }
    const compositeFields = defineFields(compositeSchema, { name: { label: 'Name' } })
    let writes = 0
    const composite = defineResource(compositeSchema, {
      key: 'identity-composite',
      actions: {
        detail: {
          run: async ({ id }) => ({ tenantId: String(id.tenantId), userId: Number(id.userId), name: 'One' }),
          fields: [compositeFields.name],
        },
        update: {
          run: async (id, input) => { writes += 1; return ({ tenantId: String(id.tenantId), userId: Number(id.userId), name: input.name }) },
          fields: [compositeFields.name],
        },
      },
    })

    await expect(composite.detail({ id: { tenantId: 't', userId: 0 } }).run()).resolves.toEqual({ tenantId: 't', userId: 0, name: 'One' })
    await expect(composite.update({ id: { tenantId: '', userId: 7 } }).run({ name: 'Updated' })).resolves.toEqual({ tenantId: '', userId: 7, name: 'Updated' })
    expect(writes).toBe(1)
    await expect(composite.invalidate({ id: { tenantId: 't', userId: 7 } })).resolves.toBeUndefined()
    await expect(composite.invalidate()).resolves.toBeUndefined()
  })
})
