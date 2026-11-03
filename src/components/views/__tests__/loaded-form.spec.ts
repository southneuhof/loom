import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { RecordLoadContext } from '../../../contracts'
import { defineResource } from '../../../resources/defineResource'
import { defineForm } from '../../../forms/defineForm'
import { resetResourceActionRegistry } from '../../../resources/routeAccess'
import { resetResourceRuntimeForTests } from '../../../resources/runtime'
import FormView from '../FormView.vue'
import { deferred, flush, mountCore } from '../../core/__tests__/harness'

afterEach(() => { resetResourceRuntimeForTests(); resetResourceActionRegistry() })

describe('resource-loaded edit forms', () => {
  it('loads before configuration and pins the immutable original across edits, refresh and write invalidation', async () => {
    const pending = deferred<{ id: number; name: string; version: number }>()
    let firstLoad = true
    const load = vi.fn((_context: RecordLoadContext) => {
      if (!firstLoad) return Promise.resolve({ id: 1, name: 'Remote changed', version: 8 })
      firstLoad = false
      return pending.promise
    })
    const write = vi.fn(async (value: { id: number; name: string; version: number }) => value)
    const configured = vi.fn()
    const resource = defineResource({
      key: 'loaded-edit',
      identity: (record: { id: number }) => record.id,
      update: {
        permission: 'update-record',
        load,
        form: ({ record }) => {
          configured(record)
          expect(Object.isFrozen(record)).toBe(true)
          return defineForm({
            schema: z.object({ name: z.string().min(1).transform((name) => name.toUpperCase()) }),
            fields: { name: { renderer: 'text' } },
            submit: (output) => write({ id: record.id, version: record.version, ...output }),
          })
        },
      },
    })
    const view = mountCore(FormView, { ...resource.update({ id: 1 }), defaultTo: false })
    await flush()
    expect(configured).not.toHaveBeenCalled()
    expect(view.find('input')).toBeNull()
    expect(view.text()).toContain('Memuat')
    pending.resolve({ id: 1, name: 'Original', version: 7 })
    await flush(20)
    expect(configured).toHaveBeenCalledOnce()
    expect(view.find<HTMLInputElement>('input')?.value).toBe('Original')
    expect(load.mock.calls[0]?.[0]).toMatchObject({ id: 1, signal: expect.any(AbortSignal) })
    const input = view.find<HTMLInputElement>('input')!
    input.value = 'Changed'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    expect(view.exposed().dirty).toBe(true)
    const refresh = view.exposed().refresh
    if (typeof refresh !== 'function') throw new Error('Missing refresh')
    await refresh()
    await flush()
    expect(view.find<HTMLInputElement>('input')?.value).toBe('Changed')
    expect(view.exposed().record).toMatchObject({ version: 7, name: 'Original' })
    view.find('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush(20)
    expect(write).toHaveBeenCalledExactlyOnceWith({ id: 1, version: 7, name: 'CHANGED' })
    expect(configured).toHaveBeenCalledOnce()
    expect(view.find<HTMLInputElement>('input')?.value).toBe('Changed')
    view.unmount()
  })

  it('uses standard load errors and retry, and denies a loaded record before constructing its form', async () => {
    let allowed = false
    const load = vi.fn(async () => ({ id: 1, name: 'Protected' }))
    const write = vi.fn(async (value: { id: number; name: string }) => value)
    const configured = vi.fn()
    const resource = defineResource({
      key: 'protected-edit',
      identity: (record: { id: number }) => record.id,
      update: {
        permission: 'update-record',
        load,
        visible: ({ record }) => Boolean(record && allowed),
        form: ({ record }) => {
          configured()
          return defineForm({ schema: z.object({ name: z.string() }), fields: { name: { renderer: 'text' } }, submit: (value) => write({ id: record.id, ...value }) })
        },
      },
    })
    const view = mountCore(FormView, resource.update({ id: 1 }))
    await flush(20)
    expect(view.find('[role="alert"]')).not.toBeNull()
    expect(configured).not.toHaveBeenCalled()
    allowed = true
    const refresh = view.exposed().refresh
    if (typeof refresh !== 'function') throw new Error('Missing refresh')
    await refresh()
    await flush(20)
    expect(configured).toHaveBeenCalledOnce()
    expect(view.find<HTMLInputElement>('input')?.value).toBe('Protected')
    allowed = false
    view.find('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush(20)
    expect(write).not.toHaveBeenCalled()
    view.unmount()
  })
  it('rejects missing, mismatched and unauthorized deep-link records without configuring a form', async () => {
    let grant = false
    let loaded: { id: number; name: string } | undefined
    const load = vi.fn(async () => loaded)
    const configured = vi.fn()
    const resource = defineResource({
      key: 'identity-edit',
      identity: (record: { id: number }) => record.id,
      update: {
        permission: 'update-record',
        load,
        form: ({ record }) => {
          configured()
          return defineForm({ schema: z.object({ name: z.string() }), fields: { name: { renderer: 'text' } }, submit: async (value) => ({ id: record.id, ...value }) })
        },
      },
    })
    const view = mountCore(FormView, resource.update({ id: 1 }), { adapters: { access: { allows: () => grant } } })
    await flush(20)
    expect(load).not.toHaveBeenCalled()
    expect(configured).not.toHaveBeenCalled()
    const refresh = view.exposed().refresh
    if (typeof refresh !== 'function') throw new Error('Missing refresh')
    grant = true
    await refresh()
    await flush(20)
    expect(view.text()).toContain('Data tidak ditemukan')
    expect(configured).not.toHaveBeenCalled()
    loaded = { id: 2, name: 'Wrong identity' }
    await expect(refresh()).rejects.toThrow('conflicts with its bound id')
    await flush(20)
    expect(configured).not.toHaveBeenCalled()
    expect(view.find('[role="alert"]')).not.toBeNull()
    view.unmount()
  })

})

describe('editor context propagation', () => {
  it('keeps independent create contexts in field resolution, validation and submission', async () => {
    type Editor = { label: string; seen: string[] }
    const resource = defineResource({
      key: 'context-create',
      identity: (record: { id: number }) => record.id,
      create: {
        permission: null,
        form: defineForm({
          schema: z.object({ name: z.string() }),
          fields: { name: ({ context }: { draft: object; context: Editor }) => ({ renderer: 'text', label: context.label } as const) },
          validators: [{ validate: ({ context }) => { context.seen.push('validated') } }],
          submit: (output, { context }) => { context.seen.push(output.name); return { id: 1 } },
        }),
      },
    })
    const left = { label: 'Left editor', seen: [] as string[] }
    const right = { label: 'Right editor', seen: [] as string[] }
    const first = mountCore(FormView, { ...resource.create({ context: left, initialData: { name: 'Ada' } }), defaultTo: false })
    const second = mountCore(FormView, { ...resource.create({ context: right, initialData: { name: 'Bea' } }), defaultTo: false })
    await flush(20)
    expect(first.text()).toContain('Left editor')
    expect(second.text()).toContain('Right editor')
    first.find('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush(20)
    expect(left.seen).toEqual(['validated', 'Ada'])
    expect(right.seen).toEqual([])
    second.find('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush(20)
    expect(right.seen).toEqual(['validated', 'Bea'])
    first.unmount()
    second.unmount()
  })

  it('supplies the bound context to the loaded factory and all form callbacks', async () => {
    type Editor = { label: string; seen: string[] }
    const context: Editor = { label: 'Loaded editor', seen: [] }
    const resource = defineResource({
      key: 'context-update',
      identity: (record: { id: number }) => record.id,
      update: {
        permission: null,
        load: async () => ({ id: 7, name: 'Ada', version: 4 }),
        form: ({ record, context: factoryContext }: { record: { id: number; name: string; version: number }; context: Editor }) => {
          expect(factoryContext).toBe(context)
          return defineForm({
            schema: z.object({ name: z.string() }),
            fields: { name: ({ context }: { draft: object; context: Editor }) => ({ renderer: 'text', label: context.label } as const) },
            validators: [{ validate: ({ context }) => { context.seen.push('validated') } }],
            submit: (output, { context }) => { context.seen.push(`${record.version}:${output.name}`); return { id: record.id } },
          })
        },
      },
    })
    const view = mountCore(FormView, { ...resource.update({ id: 7, context }), defaultTo: false })
    await flush(20)
    expect(view.text()).toContain('Loaded editor')
    view.find('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush(20)
    expect(context.seen).toEqual(['validated', '4:Ada'])
    view.unmount()
  })
})


describe('default resource completion', () => {
  it('retains a successful write when navigation fails and retries navigation without another mutation', async () => {
    const write = vi.fn(async () => ({ id: 1 }))
    const resource = defineResource({
      key: 'completion-record', identity: (record: { id: number }) => record.id,
      list: { permission: null, route: { name: 'test-route', params: { pathMatch: 'destination' } }, table: { schema: z.object({ id: z.number() }), columns: { id: {} }, load: async () => ({ data: [] }) } },
      create: { permission: null, defaultTo: { name: 'explicit-completion' }, form: defineForm({ schema: z.object({ name: z.string() }), fields: { name: { renderer: 'text' } }, submit: write }) },
    })
    const view = mountCore(FormView, resource.create({ initialData: { name: 'Ada' } }))
    await flush(20)
    const navigation = vi.spyOn(view.router, 'replace').mockRejectedValue(new Error('Navigation failed'))
    const submit = view.exposed().submit
    if (typeof submit !== 'function') throw new Error('Missing submit')
    await submit()
    await flush(20)
    expect(view.text()).toContain('Changes saved.')
    expect(navigation).toHaveBeenCalledWith({ name: 'explicit-completion' })
    expect(view.find('form')).toBeNull()
    view.find<HTMLButtonElement>('button[type="button"]')?.click()
    await flush(20)
    await submit()
    expect(navigation).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('uses the accessible list destination when detail is denied and shows confirmation when all destinations are denied', async () => {
    let listAllowed = true
    const write = vi.fn(async () => ({ id: 1, project_id: 9 }))
    const resource = defineResource({
      key: 'completion-access', identity: (record: { id: number }) => record.id,
      list: { permission: 'view-records', route: { name: 'test-route', params: { pathMatch: 'list' } }, table: { schema: z.object({ id: z.number() }), columns: { id: {} }, load: async () => ({ data: [] }) } },
      detail: { permission: 'show-records', route: { name: 'denied-detail' }, detail: () => ({ schema: z.object({ id: z.number() }), fields: { id: {} }, load: async () => ({ id: 1 }) }) },
      create: { permission: 'create-records', form: defineForm({ schema: z.object({ name: z.string() }), fields: { name: { renderer: 'text' } }, submit: write }) },
    })
    const adapters = { access: { allows: ({ permission }: { permission?: string | null }) => permission === 'create-records' || permission === 'view-records' && listAllowed } }
    const view = mountCore(FormView, resource.create({ initialData: { name: 'Ada' } }), { adapters })
    const replace = vi.spyOn(view.router, 'replace')
    await flush(20)
    const submit = view.exposed().submit
    if (typeof submit !== 'function') throw new Error('Missing submit')
    await submit()
    await flush(20)
    expect(replace).toHaveBeenCalledWith(expect.objectContaining({ name: 'test-route' }))
    expect(replace).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'denied-detail' }))
    view.unmount()
    listAllowed = false
    const denied = mountCore(FormView, resource.create({ initialData: { name: 'Bea' } }), { adapters })
    await flush(20)
    const deniedSubmit = denied.exposed().submit
    if (typeof deniedSubmit !== 'function') throw new Error('Missing submit')
    await deniedSubmit()
    await flush(20)
    expect(denied.text()).toContain('Changes saved.')
    expect(denied.text()).not.toContain('Continue')
    denied.unmount()
  })
  it('uses original record scope for completion after an identity-only edit', async () => {
    const resource = defineResource({
      key: 'identity-completion',
      identity: (record: { id: number; project_id?: number }) => record.id,
      detail: {
        permission: null,
        route: { name: 'test-route', params: { pathMatch: 'detail' } },
        visible: ({ record }) => record?.project_id === 9,
        detail: () => ({ schema: z.object({ id: z.number() }), fields: { id: {} }, load: async () => ({ id: 1 }) }),
      },
      update: {
        permission: null,
        load: async () => ({ id: 1, project_id: 9, name: 'Ada' }),
        form: () => defineForm({ schema: z.object({ name: z.string() }), fields: { name: { renderer: 'text' } }, submit: async () => ({ id: 1 }) }),
      },
    })
    const view = mountCore(FormView, resource.update({ id: 1 }))
    const replace = vi.spyOn(view.router, 'replace')
    await flush(20)
    const submit = view.exposed().submit
    if (typeof submit !== 'function') throw new Error('Missing submit')
    await submit()
    await flush(20)
    expect(replace).toHaveBeenCalledWith(expect.objectContaining({ name: 'test-route' }))
    view.unmount()
  })

})
