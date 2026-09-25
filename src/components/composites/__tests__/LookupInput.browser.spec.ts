import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { z } from 'zod/v4'
import { createMemoryHistory, createRouter } from 'vue-router'
import LookupInput from '../form-inputs/LookupInput.vue'
import type { CollectionLoadContext, CollectionResult, Load } from '../../../contracts'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import { defineTable } from '../../../tables/defineTable'

const apps: App[] = []

const optionSchema = z.object({ id: z.string(), name: z.string() })
type Option = z.output<typeof optionSchema>
const table = defineTable({ schema: optionSchema, columns: { name: {} } })
const options: Option[] = [{ id: 'one', name: 'Option one' }, { id: 'two', name: 'Option two' }]

async function frame(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function mountLookup(mountOptions: {
  model?: unknown
  disabled?: boolean
  multi?: boolean
  data?: readonly Option[]
  loadDetail?: (context: { id: unknown; searchParameters: Record<string, unknown>; signal: AbortSignal }) => Promise<unknown>
  load?: Load<CollectionLoadContext, CollectionResult<Option>>
}) {
  const model = ref(mountOptions.model ?? null)
  const props = ref<Record<string, unknown>>({
    ...(mountOptions.load ? { load: mountOptions.load } : { data: mountOptions.data ?? options }),
    pick: 'id',
    view: 'name',
    disabled: mountOptions.disabled,
    multi: mountOptions.multi,
    loadDetail: mountOptions.loadDetail,
    searchParameters: {},
  })
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({
    setup: () => () => h(LookupInput, {
      table,
      ...props.value,
      modelValue: model.value,
      'onUpdate:modelValue': (value: unknown) => { model.value = value },
    }),
  }))
  app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] }))
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  apps.push(app)
  return {
    host,
    model,
    setModel(value: unknown) { model.value = value },
    setProps(value: Record<string, unknown>) { props.value = { ...props.value, ...value } },
  }
}

function trigger(host: HTMLElement) {
  return host.querySelector<HTMLElement>('.overlay')!
}

function dialog() {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')!
}

function rowNamed(name: string) {
  return [...dialog().querySelectorAll<HTMLElement>('tbody tr')].find((row) => row.textContent?.includes(name))!
}

function saveButton() {
  return [...dialog().querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Simpan'))!
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('LookupInput real dialog', () => {
  it('selects a named record through the dialog and commits its scalar ID', async () => {
    const view = mountLookup({})
    await frame()
    expect(trigger(view.host).textContent).toBe('Pilih')

    trigger(view.host).click()
    await frame()
    expect(dialog().querySelector('table')).not.toBeNull()
    expect(dialog().textContent).toContain('Pilih data')
    expect(dialog().textContent).toContain('Pilih data dari daftar untuk mengisi nilai ini.')

    rowNamed('Option two').click()
    await frame()
    saveButton().click()
    await frame()

    expect(view.model.value).toBe('two')
    expect(trigger(view.host).textContent).toContain('Option two')
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('does not open or change the model while disabled', async () => {
    const view = mountLookup({ disabled: true, multi: true, model: [options[0]] })
    await frame()

    expect(view.host.textContent).toContain('Option one')
    expect(view.host.querySelector('[aria-label="Remove selected record"]')).toBeNull()
    trigger(view.host).click()
    await frame()

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(view.model.value).toEqual([options[0]])
  })

  it('renders pagination from explicit source metadata', async () => {
    const view = mountLookup({
      load: () => ({
        data: options,
        meta: { total: 11, page: 1, pageSize: 5, totalPage: 3 },
      }),
    })
    await frame()

    trigger(view.host).click()
    await frame()

    expect(dialog().textContent).toContain('1 / 3')
    expect(dialog().textContent).toContain('Showing data 1–2 out of 11')
  })

  it('shows an initial scalar ID label after loadDetail hydration', async () => {
    const view = mountLookup({
      model: 'one',
      loadDetail: async ({ id }) => options.find((item) => item.id === id),
    })
    await frame()

    expect(trigger(view.host).textContent).toContain('Option one')
  })

  it('keeps a new staged row when committed detail hydration finishes later', async () => {
    const detail = deferred<Option>()
    const view = mountLookup({
      model: 'one',
      loadDetail: () => detail.promise,
    })
    await frame()

    trigger(view.host).click()
    await frame()
    rowNamed('Option two').click()
    await frame()
    detail.resolve(options[0]!)
    await frame()
    saveButton().click()
    await frame()

    expect(view.model.value).toBe('two')
    expect(trigger(view.host).textContent).toContain('Option two')
  })

  it('aborts canceled staging and hydrates the committed value after reopening', async () => {
    const firstDetail = deferred<Option>()
    const secondDetail = deferred<Option>()
    const signals: AbortSignal[] = []
    const loadDetail = ({ signal }: { signal: AbortSignal }) => {
      signals.push(signal)
      return signals.length === 1 ? firstDetail.promise : secondDetail.promise
    }
    const view = mountLookup({ model: 'one', loadDetail })
    await frame()

    trigger(view.host).click()
    await frame()
    rowNamed('Option two').click()
    await frame()
    const close = [...dialog().querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Close'))
    if (!close) throw new Error('Lookup dialog did not render its close action.')
    close.click()
    await frame()
    expect(signals[0]?.aborted).toBe(true)

    trigger(view.host).click()
    await frame()
    expect(signals).toHaveLength(2)
    secondDetail.resolve(options[0]!)
    await frame()
    expect(trigger(view.host).textContent).toContain('Option one')
    saveButton().click()
    await frame()

    expect(view.model.value).toBe('one')
  })

  it('keeps a parent replacement when older detail and staged work resolve', async () => {
    const firstDetail = deferred<Option>()
    const secondDetail = deferred<Option>()
    const loadDetail = ({ id }: { id: unknown }) => id === 'one' ? firstDetail.promise : secondDetail.promise
    const view = mountLookup({ model: 'one', loadDetail })
    await frame()

    trigger(view.host).click()
    await frame()
    rowNamed('Option two').click()
    view.model.value = 'two'
    await frame()
    firstDetail.resolve(options[0]!)
    secondDetail.resolve(options[1]!)
    await frame()
    saveButton().click()
    await frame()

    expect(view.model.value).toBe('two')
    expect(trigger(view.host).textContent).toContain('Option two')
  })

  it('revalidates an already displayed scalar under the new remote context', async () => {
    const loadDetail = vi.fn(async ({ id }: { id: unknown }) => options.find((item) => item.id === id))
    const view = mountLookup({
      model: 'one',
      load: async () => ({ data: options, meta: { total: 2, page: 1, pageSize: 5 } }),
      loadDetail,
    })
    await frame()
    expect(trigger(view.host).textContent).toContain('Option one')

    view.setProps({ searchParameters: { divisionId: 'south' } })
    await frame()

    expect(loadDetail).toHaveBeenCalledTimes(2)
    expect(loadDetail.mock.calls[1]?.[0].searchParameters).toEqual({ divisionId: 'south' })
    expect(view.model.value).toBe('one')
  })

  it('clears a remote scalar when new-context detail is missing or mismatched', async () => {
    const missing = mountLookup({
      model: 'one',
      load: async () => ({ data: options, meta: { total: 2, page: 1, pageSize: 5 } }),
      loadDetail: async ({ searchParameters }) => searchParameters.divisionId ? undefined : options[0],
    })
    await frame()
    missing.setProps({ searchParameters: { divisionId: 'south' } })
    await frame()
    expect(missing.model.value).toBeNull()

    const mismatched = mountLookup({
      model: 'one',
      load: async () => ({ data: options, meta: { total: 2, page: 1, pageSize: 5 } }),
      loadDetail: async ({ searchParameters }) => searchParameters.divisionId ? options[1] : options[0],
    })
    await frame()
    mismatched.setProps({ searchParameters: { divisionId: 'south' } })
    await frame()
    expect(mismatched.model.value).toBeNull()
  })

  it('preserves a scalar when new-context detail fails and exposes the error', async () => {
    const loadDetail = async ({ searchParameters }: { searchParameters: Record<string, unknown> }) => {
      if (searchParameters.divisionId) throw new Error('Detail unavailable')
      return options[0]
    }
    const view = mountLookup({
      model: 'one',
      load: async () => ({ data: options, meta: { total: 2, page: 1, pageSize: 5 } }),
      loadDetail,
    })
    await frame()

    view.setProps({ searchParameters: { divisionId: 'south' } })
    await frame()
    trigger(view.host).click()
    await frame()

    expect(view.model.value).toBe('one')
    expect(dialog().querySelector('[role="alert"]')?.textContent).toContain('Detail unavailable')
  })

  it('clears remote selections without detail and clears remote multi selections on context changes', async () => {
    const single = mountLookup({
      model: 'one',
      load: async () => ({ data: options, meta: { total: 2, page: 1, pageSize: 5 } }),
    })
    await frame()
    single.setProps({ searchParameters: { divisionId: 'south' } })
    await frame()
    expect(single.model.value).toBeNull()

    const multi = mountLookup({
      model: [options[0]],
      multi: true,
      load: async () => ({ data: options, meta: { total: 2, page: 1, pageSize: 5 } }),
    })
    await frame()
    multi.setProps({ searchParameters: { divisionId: 'south' } })
    await frame()
    expect(multi.model.value).toEqual([])
  })

  it('prunes static multi values by identity and retains the selected record', async () => {
    const first = { ...options[0]!, note: 'remove' }
    const second = { ...options[1]!, note: 'keep' }
    const view = mountLookup({ model: [first, second], multi: true })
    await frame()

    view.setProps({ data: [options[1]] })
    await frame()

    expect(view.model.value).toEqual([second])
    expect(view.model.value).toMatchObject([{ note: 'keep' }])
  })

  it('keeps or clears a static scalar by current data membership', async () => {
    const view = mountLookup({ model: 'one' })
    await frame()

    view.setProps({ data: [{ ...options[0]!, name: 'Updated option one' }] })
    await frame()
    expect(view.model.value).toBe('one')

    view.setProps({ data: [options[1]!] })
    await frame()
    expect(view.model.value).toBeNull()
  })

  it('keeps a parent supplied scalar when its external context changes in the same update', async () => {
    const view = mountLookup({
      model: 'one',
      load: async ({ searchParameters }) => ({
        data: searchParameters.divisionId === 'south' ? [options[1]] : [options[0]],
        meta: { total: 1, page: 1, pageSize: 5 },
      }),
      loadDetail: async ({ id }) => options.find((item) => item.id === id),
    })
    await frame()

    view.setProps({ searchParameters: { divisionId: 'south' } })
    view.setModel('two')
    await frame()

    expect(view.model.value).toBe('two')
  })

  it('does not invalidate committed values for internal dialog search changes', async () => {
    const view = mountLookup({
      model: 'one',
      load: async () => ({ data: options, meta: { total: 2, page: 1, pageSize: 5 } }),
      loadDetail: async ({ id }) => options.find((item) => item.id === id),
    })
    await frame()

    trigger(view.host).click()
    await frame()
    const search = dialog().querySelector<HTMLInputElement>('input[placeholder="Search..."]')!
    search.value = 'two'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await frame()

    expect(view.model.value).toBe('one')
  })

  it('revalidates source mode changes and keeps only one active source', async () => {
    const load = vi.fn(async () => ({ data: [options[1]], meta: { total: 1, page: 1, pageSize: 5 } }))
    const view = mountLookup({ model: 'one' })
    await frame()

    view.setProps({ data: undefined, load })
    await frame()

    expect(load).toHaveBeenCalled()
    expect(view.model.value).toBeNull()
  })
})
