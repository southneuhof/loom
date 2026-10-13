import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { z } from 'zod'
import Table from '../Table.vue'
import { deferred, flush, mountCore } from './harness'
import { exportTableRows } from '../../../services/export'
import type { CollectionResult, CollectionSlotProps } from '../../../contracts'
import { resolveDisplayFields } from '../../../display/resolveDisplay'

const schema = z.object({ id: z.number(), name: z.string() })
const columns = { name: { label: 'Name' } }

describe('Table collection slot', () => {
  it('keeps the loading state in TableContent until the custom slot is ready', async () => {
    const pending = vi.fn(() => deferred<CollectionResult<{ id: string; name: string }>>().promise)
    const collection = vi.fn(({ records }: { records: { id: string; name: string }[] }) => h('p', { class: 'slot-view' }, records.map((record) => record.name).join(',')))
    const view = mountCore(
      Table,
      { schema, columns, load: pending },
      { slots: { collection } },
    )

    expect(view.find('[role="status"]')).not.toBeNull()
    expect(collection).not.toHaveBeenCalled()
    view.unmount()
  })

  it('keeps the error state in TableContent when a custom slot exists', async () => {
    const collection = vi.fn(() => h('p', { class: 'slot-view' }, 'Custom'))
    const view = mountCore(
      Table,
      { schema, columns, load: async () => { throw new Error('Broken') } },
      { slots: { collection } },
    )
    await flush()

    expect(view.find('[role="alert"]')?.textContent).toContain('Broken')
    expect(collection).not.toHaveBeenCalled()
    view.unmount()
  })

  it('keeps the empty state in TableContent when a custom slot exists', async () => {
    const collection = vi.fn(() => h('p', { class: 'slot-view' }, 'Custom'))
    const view = mountCore(
      Table,
      { schema, columns, load: async () => ({ data: [] }) },
      { slots: { collection } },
    )
    await flush()

    expect(view.text()).toContain('No data')
    expect(collection).not.toHaveBeenCalled()
    view.unmount()
  })

  it('serves the loaded collection through the slot without rendering the table', async () => {
    const load = vi.fn(async (): Promise<CollectionResult<{ id: string; name: string }>> => ({
      data: [{ id: '1', name: 'One' }],
      meta: { page: 1, pageSize: 10, total: 1, totalPage: 1 },
    }))
    const view = mountCore(
      Table,
      { schema, columns, load },
      {
        slots: {
          collection: ({ records }: { records: { name: string }[] }) =>
            h('p', { class: 'slot-view' }, records.map((record) => record.name).join(',')),
        },
      },
    )
    await flush()
    expect(view.text()).toContain('One')
    expect(load).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('keeps current rows and passes the failed refresh state to a collection slot', async () => {
    let fail = false
    let collectionState: CollectionSlotProps<{ id: number; name: string }> | undefined
    const load = async (): Promise<CollectionResult<{ id: number; name: string }>> => {
      if (fail) throw new Error('The refresh failed.')
      return { data: [{ id: 1, name: 'Current row' }] }
    }
    const view = mountCore(
      Table,
      { schema, columns, resource: 'stale-table', load },
      {
        slots: {
          collection: (state: CollectionSlotProps<{ id: number; name: string }>) => {
            collectionState = state
            return h('p', { class: 'slot-view' }, state.records.map((record) => record.name).join(','))
          },
        },
      },
    )

    await vi.waitFor(() => expect(view.text()).toContain('Current row'))
    fail = true
    const refresh = view.exposed().refresh
    if (typeof refresh !== 'function') throw new Error('Table did not expose refresh().')
    await expect(refresh()).rejects.toThrow('The refresh failed.')
    await vi.waitFor(() => expect(collectionState?.error?.message).toBe('The refresh failed.'))

    expect(collectionState?.records).toEqual([{ id: 1, name: 'Current row' }])
    expect(collectionState?.loading).toBe(false)
    expect(view.find('[role="alert"]')?.textContent).toContain('The refresh failed.')
    expect(view.text()).toContain('Current row')
    view.unmount()
  })

  it('does not show rows from the prior query while the next query is loading', async () => {
    const nextPage = deferred<CollectionResult<{ id: number; name: string }>>()
    const load = vi.fn(({ query }: { query: Record<string, unknown> }) => Number(query.page) === 1
      ? Promise.resolve({ data: [{ id: 1, name: 'Page one' }], meta: { total: 20, totalPage: 2 } })
      : nextPage.promise)
    const view = mountCore(Table, { schema, columns, load })
    await vi.waitFor(() => expect(view.text()).toContain('Page one'))

    view.find<HTMLButtonElement>('button[aria-label="Next page"]')?.click()
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))

    expect(view.text()).not.toContain('Page one')
    expect(view.find('[role="status"]')).not.toBeNull()
    nextPage.resolve({ data: [{ id: 2, name: 'Page two' }], meta: { total: 20, totalPage: 2 } })
    await vi.waitFor(() => expect(view.text()).toContain('Page two'))
    expect(view.text()).not.toContain('Page one')
    view.unmount()
  })
})

describe('exportTableRows paging', () => {
  it('pages until meta.totalPage is exhausted and stops', async () => {
    let calls = 0
    const load = async ({ query }: { query: Record<string, unknown> }): Promise<CollectionResult<{ id: number }>> => {
      calls += 1
      const page = Number(query.page)
      return {
        data: Array.from({ length: 2 }, (_, i) => ({ id: (page - 1) * 2 + i })),
        meta: { page, pageSize: 2, total: 6, totalPage: 3 },
      }
    }
    await exportTableRows({
      activeQuery: {},
      searchParameters: {},
      load,
      columns: resolveDisplayFields({ surface: 'table', entries: { id: { label: 'ID' } } }),
    })
    expect(calls).toBe(3)
  })

  it('throws when every page repeats the same signature', async () => {
    const load = async (): Promise<CollectionResult<{ id: number }>> => ({ data: [{ id: 1 }], meta: { totalPage: 99 } })
    await expect(
      exportTableRows({
        activeQuery: {},
        searchParameters: {},
        load,
        columns: resolveDisplayFields({ surface: 'table', entries: { id: {} } }),
      }),
    ).rejects.toThrowError(/repeated a page/)
  })
})
