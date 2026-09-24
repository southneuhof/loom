import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App, type PropType } from 'vue'
import { z } from 'zod/v4'
import LookupInput from '../form-inputs/LookupInput.vue'
import { defineTable } from '../../../tables/defineTable'
import type { CollectionLoadContext, CollectionMeta, CollectionResult, Load, RecordIdentity, RecordLoadContext } from '../../../contracts'

vi.mock('../../base/Dialog.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      setup(_, { slots }) {
        const setOpen = () => {}
        return () => h('div', [
          h('div', { class: 'dialog-trigger' }, slots.trigger?.({ setOpen })),
          h('div', { class: 'dialog-content' }, slots.content?.({ setOpen })),
        ])
      },
    }),
  }
})

vi.mock('../../core/Table.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: {
        data: { type: Array as PropType<Option[]>, default: () => [] },
        meta: Object as PropType<CollectionMeta>,
        pagination: [Boolean, String],
      },
      emits: ['row-click'],
      setup(props, { emit }) {
        return () => h('div', {
          class: props.pagination === false ? 'lookup-preview' : 'lookup-options',
          'data-total': props.meta?.total,
        }, props.data.map((record) =>
          h('button', {
            class: 'lookup-row',
            onClick: () => emit('row-click', record),
          }, record.name),
        ))
      },
    }),
  }
})

vi.mock('../../base/Button.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      inheritAttrs: false,
      props: { disabled: Boolean },
      emits: ['click'],
      setup(props, { attrs, emit, slots }) {
        return () => h('button', {
          ...attrs,
          disabled: props.disabled,
          onClick: (event: MouseEvent) => emit('click', event),
        }, slots.default?.())
      },
    }),
  }
})

vi.mock('../../base/Icon.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ render: () => h('span') }) }
})
vi.mock('../../inputs/SearchBox.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ render: () => h('input') }) }
})

const apps: App[] = []
const optionSchema = z.object({ id: z.string(), name: z.string() })
type Option = z.output<typeof optionSchema>
const table = defineTable({ schema: optionSchema, columns: { name: {} } })
const options = [{ id: 'one', name: 'Option one' }, { id: 'two', name: 'Option two' }]

function mountLookup(mountOptions: {
  model: unknown
  loadDetail?: Load<RecordLoadContext & { id: RecordIdentity }, Option>
  load?: Load<CollectionLoadContext, CollectionResult<Option>>
  searchParameters?: Record<string, unknown>
  placeholder?: string
  multi?: boolean
}) {
  const model = ref(mountOptions.model)
  const searchParameters = ref(mountOptions.searchParameters ?? {})
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({
    setup: () => () => h(LookupInput, {
      table,
      ...(mountOptions.load ? { load: mountOptions.load } : { data: options }),
      searchParameters: searchParameters.value,
      pick: 'id',
      view: 'name',
      multi: mountOptions.multi,
      placeholder: mountOptions.placeholder,
      loadDetail: mountOptions.loadDetail,
      modelValue: model.value,
      'onUpdate:modelValue': (value: unknown) => { model.value = value },
    }),
  }))
  app.mount(host)
  apps.push(app)
  return {
    host,
    model,
    setSearchParameters: (value: Record<string, unknown>) => { searchParameters.value = value },
    display: () => host.querySelector('.dialog-trigger p')?.textContent,
    row: (index: number) => host.querySelectorAll<HTMLButtonElement>('.lookup-row')[index]!,
    save: () => [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Simpan'))!,
  }
}

async function flush() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('LookupInput selection labels', () => {
  it('loads options from its explicit source with the active query and search parameters', async () => {
    const load = vi.fn(async () => ({ data: options, meta: { total: 2, page: 1, pageSize: 5 } }))
    const view = mountLookup({ model: null, load, searchParameters: { parentId: 'parent' } })
    await flush()

    expect(load).toHaveBeenCalledWith({
      query: { page: 1, limit: 5 },
      searchParameters: { parentId: 'parent' },
      signal: expect.any(AbortSignal),
    })
    expect(view.display()).toBe('Pilih')
    expect(view.host.querySelector('.lookup-options')?.getAttribute('data-total')).toBe('2')
  })

  it('cancels stale option loads when contextual search parameters change', async () => {
    let resolveFirst!: (result: CollectionResult<Option>) => void
    let firstSignal: AbortSignal | undefined
    const first = new Promise<CollectionResult<Option>>((resolve) => { resolveFirst = resolve })
    const load = vi.fn(({ searchParameters, signal }: CollectionLoadContext) => {
      if (searchParameters.parentId === 'first') {
        firstSignal = signal
        return first
      }
      return Promise.resolve({ data: [options[1]], meta: { total: 1, page: 1, pageSize: 5 } })
    })
    const view = mountLookup({ model: null, load, searchParameters: { parentId: 'first' } })
    await flush()

    view.setSearchParameters({ parentId: 'second' })
    await flush()
    resolveFirst({ data: [options[0]], meta: { total: 1, page: 1, pageSize: 5 } })
    await flush()

    expect(firstSignal?.aborted).toBe(true)
    expect(view.host.querySelector('.lookup-options .lookup-row')?.textContent).toBe('Option two')
  })

  it('emits selected multi records without scalar conversion', async () => {
    const view = mountLookup({
      model: null,
      multi: true,
    })

    view.row(0).click()
    view.save().click()
    await flush()

    expect(view.model.value).toEqual([options[0]])
    expect(view.display()).toBe('Option one')
    expect(view.host.querySelector('.lookup-preview .lookup-row')?.textContent).toBe('Option one')
  })

  it('keeps initial multi records and does not hydrate them as scalar IDs', async () => {
    const loadDetail = vi.fn(async ({ id }) => options.find((item) => item.id === id))
    const view = mountLookup({ model: [options[0]], multi: true, loadDetail })
    await flush()

    expect(loadDetail).not.toHaveBeenCalled()
    expect(view.display()).toBe('Option one')
    expect(view.host.querySelector('.lookup-preview .lookup-row')?.textContent).toBe('Option one')
  })

  it('preserves multi-selection records without display-only fields', async () => {
    const selection = [{ id: 'one' }]
    const view = mountLookup({ model: selection, multi: true })
    await flush()

    expect(view.model.value).toEqual(selection)
    expect(view.display()).toBe('1 Selected')
    expect(view.host.querySelectorAll('.lookup-preview .lookup-row')).toHaveLength(1)
  })

  it('keeps locally selected label without calling loadDetail', async () => {
    const loadDetail = vi.fn(async () => options[0])
    const view = mountLookup({ model: null, loadDetail })

    view.row(0).click()
    view.save().click()
    await flush()

    expect(view.model.value).toBe('one')
    expect(view.display()).toBe('Option one')
    expect(loadDetail).not.toHaveBeenCalled()
  })

  it('hydrates an initial scalar ID through optional loadDetail', async () => {
    let resolveDetail!: (record: (typeof options)[number]) => void
    const detail = new Promise<(typeof options)[number]>((resolve) => { resolveDetail = resolve })
    const loadDetail = vi.fn(() => detail)
    const view = mountLookup({ model: 'one', loadDetail })
    await flush()

    expect(view.display()).toBe('1 Selected')
    resolveDetail(options[0])
    await flush()

    expect(loadDetail).toHaveBeenCalledWith(expect.objectContaining({
      id: 'one',
      searchParameters: {},
      signal: expect.any(AbortSignal),
    }))
    expect(view.display()).toBe('Option one')
  })

  it('uses an incoming object label without loadDetail', async () => {
    const loadDetail = vi.fn(async () => options[0])
    const view = mountLookup({ model: options[0], loadDetail })
    await flush()

    expect(view.display()).toBe('Option one')
    expect(loadDetail).not.toHaveBeenCalled()
  })

  it('falls back to Selected when scalar hydration is unavailable', async () => {
    const view = mountLookup({ model: 'one' })
    await flush()

    expect(view.display()).toBe('1 Selected')
  })

  it('uses placeholder for an empty selection', async () => {
    const view = mountLookup({ model: null, placeholder: 'Choose option' })
    await flush()

    expect(view.display()).toBe('Choose option')
  })

  it('treats an empty string as an empty selection', async () => {
    const loadDetail = vi.fn(async () => options[0])
    const view = mountLookup({ model: '', placeholder: 'Choose option', loadDetail })
    await flush()

    expect(view.display()).toBe('Choose option')
    expect(loadDetail).not.toHaveBeenCalled()
  })

  it('hydrates a different external scalar ID', async () => {
    const loadDetail = vi.fn(async ({ id }) => options.find((item) => item.id === id))
    const view = mountLookup({ model: 'one', loadDetail })
    await flush()
    expect(view.display()).toBe('Option one')

    view.model.value = 'two'
    await flush()

    expect(loadDetail).toHaveBeenCalledTimes(2)
    expect(view.display()).toBe('Option two')
  })
})
