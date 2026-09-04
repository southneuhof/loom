import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import Collection from '../Collection.vue'
import { flush, mountCore } from './harness'

describe('Collection', () => {
  it('shares one loaded state with its presentation slot and refresh API', async () => {
    let calls = 0
    let slotState: Record<string, unknown> | undefined
    const view = mountCore(
      Collection,
      {
        namespace: 'collection-test',
        query: { page: 1, limit: 10 },
        load: ({ query }: { query: Record<string, unknown> }) => {
          calls += 1
          return { data: [{ name: `Page ${query.page}` }], meta: { total: 1, totalPage: 1 } }
        },
      },
      {
        slots: {
          default: (state) => {
            slotState = state
            return h('p', { class: 'collection-record' }, String((state.records as Array<{ name: string }>)[0]?.name))
          },
        },
      },
    )

    await flush()
    expect(calls).toBe(1)
    expect(view.find('.collection-record')?.textContent).toBe('Page 1')
    expect(slotState).toBeDefined()
    expect(slotState).not.toHaveProperty('load')
    expect(slotState).not.toHaveProperty('data')

    ;(slotState!.updateQuery as (patch: Record<string, unknown>) => void)({ page: 2 })
    await flush()
    expect(calls).toBe(2)
    expect(view.text()).toContain('Page 2')

    await (slotState!.refresh as () => Promise<void>)()
    expect(calls).toBe(3)
    view.unmount()
  })
})
