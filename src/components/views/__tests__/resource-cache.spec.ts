import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { z } from 'zod'
import { FrameworkPlugin } from '../../../adapters/plugin'
import type { FrameworkPluginOptions } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import { defineResource, resetResourceRuntimeForTests } from '../../../resources'
import { createInputPropsRegistry } from '../../../renderers/inputProps'
import DetailView from '../DetailView.vue'
import FormView from '../FormView.vue'
import ListView from '../ListView.vue'

type RecordRow = { id: number; name: string }
type Draft = { name: string }
const rowSchema = z.object({ id: z.number(), name: z.string() })
const draftSchema = z.object({ name: z.string() })
const displayFields = { name: { label: 'Name' } }
const formFields = { name: { renderer: 'text' } }

afterEach(() => resetResourceRuntimeForTests())

async function flush() {
  for (let count = 0; count < 8; count += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

function mount(render: () => ReturnType<typeof h>, options: FrameworkPluginOptions = {}) {
  const queryClient = createFrameworkQueryClient({ retry: 0, staleTime: Infinity })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(defineComponent({ setup: () => render }))
  app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'dashboard', component: { render: () => null } }] }))
  app.use(FrameworkPlugin, { ...options, queryClient })
  app.mount(host)
  return { host, queryClient, unmount: () => { app.unmount(); host.remove(); queryClient.clear() } }
}

function typeName(host: HTMLElement, value: string) {
  const input = host.querySelector<HTMLInputElement>('input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
}

describe('resource cache ownership', () => {
  it('refetches a mounted detail after a standard update', async () => {
    let name = 'Tax ID'
    const read = vi.fn(async () => ({ id: 1, name }))
    const records = defineResource({
      key: 'document-types',
      identity: (record: RecordRow) => record.id,
      detail: {
        permission: null,
        detail: () => ({ schema: rowSchema, fields: displayFields, load: async () => read() }),
      },
      update: {
        permission: null,
        form: ({ id }) => ({
          schema: draftSchema,
          fields: formFields,
          load: async () => ({ name: (await read()).name }),
          submit: async (draft: Draft) => ({ id, ...draft }),
        }),
      },
    })
    const view = mount(() => h(DetailView, records.detail({ id: 1 })))

    await vi.waitFor(() => expect(view.host.textContent).toContain('Tax ID'))
    name = 'Tax ID Card'
    await records.update({ id: 1 }).form.submit({ name })
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledTimes(2)
      expect(view.host.textContent).toContain('Tax ID Card')
    })
    view.unmount()
  })

  it('refreshes inactive detail and reopened form data while preserving a mounted draft', async () => {
    let name = 'Tax ID'
    const read = vi.fn(async () => ({ id: 1, name }))
    const records = defineResource({
      key: 'documents',
      identity: (record: RecordRow) => record.id,
      detail: {
        permission: null,
        detail: () => ({ schema: rowSchema, fields: displayFields, load: read }),
      },
      update: {
        permission: null,
        form: ({ id }) => ({
          schema: draftSchema,
          fields: formFields,
          load: async () => ({ name: (await read()).name }),
          submit: async (draft: Draft) => { name = draft.name; return { id, name } },
        }),
      },
    })
    const surface = ref<'detail' | 'form' | 'empty'>('detail')
    const component = () => surface.value === 'detail'
      ? h(DetailView, records.detail({ id: 1 }))
      : surface.value === 'form' ? h(FormView, records.update({ id: 1 })) : h('div')
    const view = mount(component)

    await vi.waitFor(() => expect(view.host.textContent).toContain('Tax ID'))
    surface.value = 'form'
    await vi.waitFor(() => expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('Tax ID'))
    typeName(view.host, 'Tax ID Card')
    view.host.querySelector('form')!.dispatchEvent(new Event('submit'))
    await vi.waitFor(() => expect(name).toBe('Tax ID Card'))
    surface.value = 'detail'
    await vi.waitFor(() => expect(view.host.textContent).toContain('Tax ID Card'))
    expect(read).toHaveBeenCalledTimes(4)

    surface.value = 'form'
    await vi.waitFor(() => expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('Tax ID Card'))
    surface.value = 'empty'
    await flush()
    await records.update({ id: 1 }).form.submit({ name: 'Tax ID Document' })
    surface.value = 'form'
    await vi.waitFor(() => expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('Tax ID Document'))
    typeName(view.host, 'Unsaved name')
    await records.update({ id: 1 }).form.submit({ name: 'Server name' })
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(6))
    expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('Unsaved name')
    view.unmount()
  })

  it('refetches two custom lists and keeps their query values separate', async () => {
    const calls: number[] = []
    const records = defineResource({
      key: 'list-records',
      identity: (record: RecordRow) => record.id,
      list: {
        permission: null,
        table: {
          schema: rowSchema,
          columns: displayFields,
          load: async ({ query }) => { calls.push(Number(query.page)); return { data: [{ id: 1, name: `Page ${query.page}` }] } },
        },
      },
      update: {
        permission: null,
        form: ({ id }) => ({ schema: draftSchema, fields: formFields, load: async () => ({ name: 'Changed' }), submit: async (draft: Draft) => ({ id, ...draft }) }),
      },
    })
    const view = mount(() => h('div', [
      h(ListView as Component, { ...records.list, table: { ...records.list.table, namespace: 'first', query: { page: 1 } }, key: 'first' }),
      h(ListView as Component, { ...records.list, table: { ...records.list.table, namespace: 'second', query: { page: 2 } }, key: 'second' }),
    ]))
    await vi.waitFor(() => {
      expect(calls).toEqual([1, 2])
      expect(view.host.textContent).toContain('Page 1')
      expect(view.host.textContent).toContain('Page 2')
    })
    expect(view.queryClient.getQueryCache().getAll().every((query) => query.isActive())).toBe(true)
    await records.update({ id: 1 }).form.submit({ name: 'Changed' })
    await vi.waitFor(() => expect(calls).toEqual([1, 2, 1, 2]))
    view.unmount()
  })

  it('isolates record and resource invalidation', async () => {
    const first = vi.fn(async ({ id }: { id: number }) => ({ id, name: `First ${id}` }))
    const second = vi.fn(async ({ id }: { id: number }) => ({ id, name: `Second ${id}` }))
    const resource = defineResource({
      key: 'first',
      identity: (record: RecordRow) => record.id,
      detail: { permission: null, detail: () => ({ schema: rowSchema, fields: displayFields, load: first }) },
      update: { permission: null, form: ({ id }) => ({ schema: draftSchema, fields: formFields, load: async () => ({ name: 'Changed' }), submit: async (draft: Draft) => ({ id, ...draft }) }) },
    })
    const other = defineResource({
      key: 'second',
      identity: (record: RecordRow) => record.id,
      detail: { permission: null, detail: () => ({ schema: rowSchema, fields: displayFields, load: second }) },
    })
    const view = mount(() => h('div', [
      h(DetailView, { ...resource.detail({ id: 1 }), key: 'first-1' }),
      h(DetailView, { ...resource.detail({ id: 2 }), key: 'first-2' }),
      h(DetailView, { ...other.detail({ id: 1 }), key: 'second-1' }),
    ]))
    await vi.waitFor(() => {
      expect(first).toHaveBeenCalledTimes(2)
      expect(second).toHaveBeenCalledTimes(1)
      expect(view.host.textContent).toContain('First 1')
      expect(view.host.textContent).toContain('First 2')
      expect(view.host.textContent).toContain('Second 1')
    })
    expect(view.queryClient.getQueryCache().getAll().every((query) => query.isActive())).toBe(true)
    await resource.update({ id: 1 }).form.submit({ name: 'Changed' })
    await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(3))
    expect(second).toHaveBeenCalledTimes(1)
    expect(first.mock.calls.filter(([context]) => context.id === 2)).toHaveLength(1)
    view.unmount()
  })

  it('keeps display and form variants separate and applies write invalidation rules', async () => {
    let reject = false
    const read = vi.fn(async () => ({ id: 1, name: 'Value' }))
    const variantFields = { name: { label: 'Name', renderer: 'detail-token' } }
    const records = defineResource({
      key: 'variants',
      identity: (record: RecordRow) => record.id,
      detail: { permission: null, detail: () => ({ schema: rowSchema, fields: variantFields, load: read }) },
      update: {
        permission: null,
        form: ({ id }) => ({
          schema: draftSchema,
          fields: formFields,
          load: async () => ({ name: (await read()).name }),
          submit: async (draft: Draft) => { if (reject) throw new Error('No'); return { id, ...draft } },
        }),
      },
      delete: { permission: null, run: async () => undefined },
    })
    const Token = defineComponent({ props: { value: null }, setup: (props) => () => h('span', { 'data-token': '' }, String(props.value)) })
    const view = mount(
      () => h('div', [h(DetailView, records.detail({ id: 1 })), h(FormView, records.update({ id: 1 }))]),
      {
        renderers: { display: { 'detail-token': Token } },
        inputProps: createInputPropsRegistry({
          'detail-token': { value: { hydrate: (value) => `display:${value}` } },
          text: { value: { hydrate: (value) => `form:${value}` } },
        }),
      },
    )
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledTimes(2)
      expect(view.host.querySelector('[data-token]')?.textContent).toBe('Value')
      expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('form:Value')
    })
    reject = true
    await expect(records.update({ id: 1 }).form.submit({ name: 'Rejected' })).rejects.toThrow('No')
    await flush()
    expect(read).toHaveBeenCalledTimes(2)
    reject = false
    await records.delete({ id: 1 }).run()
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(4))
    await records.invalidate()
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(6))
    view.unmount()
  })
})
