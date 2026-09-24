import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { z } from 'zod'
import DetailComponent from '../Detail.vue'
import { deferred, flush, mountCore } from './harness'

const recordSchema = z.object({ name: z.string(), rel_section_name: z.string() })
const Detail = defineComponent({
  inheritAttrs: false,
  setup(_, context) {
    const detail = ref<{ refresh: () => Promise<void> }>()
    context.expose({ refresh: () => detail.value?.refresh() ?? Promise.resolve() })
    return () => h(DetailComponent, { ...context.attrs, schema: recordSchema, ref: detail }, context.slots)
  },
})

const fields = {
  name: { label: 'Nama' },
  section: { label: 'Ruas', read: (record: { rel_section_name: string }) => record.rel_section_name },
}
const record = { name: 'Admin', rel_section_name: 'Ruas 1' }

describe('Detail core', () => {
  it('applies emphasis from the detail field', async () => {
    const view = mountCore(
      Detail,
      { fields: { name: { label: 'Nama' }, section: { label: 'Ruas', read: (value: typeof record) => value.rel_section_name, emphasis: 'muted' } }, data: record },
    )
    await flush()
    expect(view.all('td:not([aria-hidden])').map((cell) => cell.classList.contains('text-on-surface-variant'))).toEqual([false, true])
    view.unmount()
  })

  it('renders externally controlled data with computed reads', async () => {
    const view = mountCore(Detail, { fields, data: record })
    await flush()

    expect(view.all('table')).toHaveLength(1)
    expect(view.all('tr')).toHaveLength(2)
    expect(view.all('th[scope="row"]').map((node) => node.textContent)).toEqual(['Nama', 'Ruas'])
    expect(view.all('td[aria-hidden="true"]').map((node) => node.textContent)).toEqual([':', ':'])
    expect(view.all('td:not([aria-hidden])').map((node) => node.textContent)).toEqual(['Admin', 'Ruas 1'])
    expect(view.all('dt, dd')).toHaveLength(0)
    view.unmount()
  })

  it('rejects supplying both data and load', () => {
    expect(() => mountCore(Detail, { fields, data: record, load: () => record })).toThrow(
      '[loom][SURFACE_DATA_SOURCE_INVALID] Detail requires exactly one of "data" or "load".',
    )
  })

  it('loads by record identity and exposes reload', async () => {
    const load = vi.fn(async ({ id }: { id?: string | number }) => ({ ...record, name: `Admin ${id}` }))
    const view = mountCore(Detail, { fields, id: 7, load })
    await flush()

    expect(view.text()).toContain('Admin 7')

    await view.exposed().refresh()
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('reloads when the identity changes and cancels the pending request', async () => {
    const pending = deferred<typeof record>()
    const signals: (AbortSignal | undefined)[] = []
    let call = 0
    const id = ref(1)
    const Host = defineComponent(() => () =>
      h(Detail, {
        fields,
        id: id.value,
        load: ({ signal }: { signal?: AbortSignal }) => {
          signals.push(signal)
          call += 1
          return call === 1 ? pending.promise : Promise.resolve({ ...record, name: 'Kedua' })
        },
      }),
    )
    const view = mountCore(Host, {})
    await flush()

    id.value = 2
    await flush()

    expect(signals[0]?.aborted).toBe(true)
    expect(view.text()).toContain('Kedua')
    pending.resolve(record)
    view.unmount()
  })

  it('renders loading, missing, and error states', async () => {
    const pending = deferred<typeof record | undefined>()
    const loading = mountCore(Detail, { fields, load: () => pending.promise })
    expect(loading.text()).toContain('Memuat')
    pending.resolve(undefined)
    await flush()
    expect(loading.text()).toContain('tidak ditemukan')
    loading.unmount()

    const failing = mountCore(Detail, {
      fields,
      load: async () => {
        throw new Error('Gagal memuat')
      },
    })
    await flush(12)
    expect(failing.find('[role="alert"]')?.textContent).toContain('Gagal memuat')
    failing.unmount()
  })

  it('renders registered renderers and slot overrides', async () => {
    const Chip = defineComponent({ props: { value: null }, setup: (props) => () => h('em', String(props.value)) })
    const withRenderer = mountCore(
      Detail,
      { fields: { name: { label: 'Nama', renderer: 'chip' } }, data: record },
      { renderers: { display: { chip: Chip } } },
    )
    await flush()
    expect(withRenderer.find('em')?.textContent).toBe('Admin')
    expect(withRenderer.find('td em')?.textContent).toBe('Admin')
    withRenderer.unmount()

    const withSlot = mountCore(
      Detail,
      { fields, data: record },
      { slots: { 'value:name': (scope) => h('strong', String((scope as { value: unknown }).value)) } },
    )
    await flush()
    expect(withSlot.find('strong')?.textContent).toBe('Admin')
    expect(withSlot.find('td strong')?.textContent).toBe('Admin')
    withSlot.unmount()
  })

  it('consumes a canonical record result without a data adapter callback', async () => {
    const view = mountCore(Detail, { fields, load: async () => record })
    await flush()

    expect(view.text()).toContain('Admin')
    view.unmount()
  })
})
