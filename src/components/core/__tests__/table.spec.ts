import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { z } from 'zod'
import { z as z3 } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import TableComponent from '../Table.vue'
import { createMemoryQueryLocationAdapter } from '../../../adapters/projectAdapters'
import { flush, mountCore } from './harness'

function recordSchema(columns: unknown) {
  const keys = columns && typeof columns === 'object' ? Object.keys(columns) : []
  return z.object(Object.fromEntries(keys.map((key) => [key, z.unknown()])))
}

const Table = defineComponent({
  inheritAttrs: false,
  setup(_, context) {
    const table = ref<{
      query: Record<string, unknown>
    }>()
    context.expose({
      query: computed(() => table.value?.query ?? {}),
    })
    return () => h(TableComponent, { ...context.attrs, schema: recordSchema(context.attrs.columns), ref: table }, context.slots)
  },
})

const columns = { name: { label: 'Nama', sortable: true }, status: { label: 'Status' } }
const rows = [
  { name: 'Admin', status: 'open' },
  { name: 'Editor', status: 'closed' },
]

describe('Table core', () => {
  it('renders externally controlled data with catalog labels', async () => {
    const view = mountCore(Table, { columns, data: rows })
    await flush()

    expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Nama', 'Status'])
    expect(view.all('tbody tr')).toHaveLength(2)
    expect(view.text()).toContain('Admin')
    view.unmount()
  })

  it('rejects an invalid query before calling the loader', async () => {
    const load = vi.fn(() => ({ data: rows }))
    const view = mountCore(Table, {
      columns: { name: { label: 'Name' } },
      query: { status: 'invalid' },
      querySchema: z.object({ status: z.enum(['active']), page: z.number().optional(), limit: z.number().optional() }),
      load,
    })
    await flush(12)

    expect(load).not.toHaveBeenCalled()
    expect(view.find('[role="alert"]')?.textContent).toContain('[loom][SURFACE_OPTION_INVALID] Collection query does not match querySchema at "status".')
    view.unmount()
  })

  it('validates the query output and preserves only framework paging keys stripped by the schema', async () => {
    const load = vi.fn(() => ({ data: rows, meta: { totalPage: 2, total: 20 } }))
    const view = mountCore(Table, {
      columns: { name: { label: 'Name' } },
      query: { status: 'active', page: 2, limit: 10, unsupported: 'drop' },
      querySchema: z.object({ status: z.enum(['active']) }),
      load,
    })
    await flush(12)

    expect(load).toHaveBeenCalledOnce()
    expect(load.mock.calls[0]?.[0].query).toEqual({ status: 'active', page: 2, limit: 10 })
    view.unmount()
  })

  it('checks sortable columns against finite sort_by choices from the bound query schema', async () => {
    const recordSchema = z4.object({ name: z4.string(), createdAt: z4.string() })
    const data = [{ name: 'Ada', createdAt: '2026-09-25' }]
    const columns = { createdAt: { label: 'Created at', sortable: true, sortKey: 'createdAt' } }

    expect(() => mountCore(TableComponent, {
      schema: recordSchema,
      columns,
      data,
      querySchema: z4.object({ sort_by: z4.enum(['name']) }),
    })).toThrow('[loom][SURFACE_OPTION_INVALID] Table column "createdAt" member "sortKey" must be a key in the bound query schema.')

    const accepted = mountCore(TableComponent, {
      schema: recordSchema,
      columns,
      data,
      querySchema: z3.object({ sort_by: z3.enum(['createdAt']) }),
    })
    await flush()
    expect(accepted.all('th').map((cell) => cell.textContent)).toEqual(['Created at'])
    accepted.unmount()
  })

  it('keeps a supplied query controlled even when a namespace exists', async () => {
    const location = createMemoryQueryLocationAdapter()
    const updates = vi.fn()
    const Host = defineComponent({
      setup(_, { expose }) {
        const query = ref<Record<string, unknown>>({ page: 1, limit: 10 })
        expose({ query })
        return () => h(Table, {
          columns,
          namespace: 'roles',
          query: query.value,
          load: () => ({ data: rows, meta: { total: 40, pageSize: 10, totalPage: 4 } }),
          'onUpdate:query': (next: Record<string, unknown>) => {
            updates(next)
            query.value = next
          },
        })
      },
    })
    const view = mountCore(Host, {}, { adapters: { query: location } })
    await flush()

    view.all('nav button')[1].click()
    await flush()
    expect(updates).toHaveBeenCalledTimes(1)
    expect((view.exposed().query as Record<string, unknown>).page).toBe(2)
    expect(location.read('roles')).toEqual({})

    view.exposed().query = { page: 3, limit: 10 }
    await flush()
    expect(view.text()).toContain('3 / 4')
    view.unmount()
  })

  it('toggles sort direction and resets to the first page', async () => {
    const queries: Record<string, unknown>[] = []
    const view = mountCore(Table, {
      columns,
      load: (context: { query: Record<string, unknown> }) => {
        queries.push({ ...context.query })
        return { data: rows }
      },
    })
    await flush()

    view.all('th button')[0].click()
    await flush()
    view.all('th button')[0].click()
    await flush()

    expect(queries.at(-2)).toMatchObject({ sort_by: 'name', sort: 'asc', page: 1 })
    expect(queries.at(-1)).toMatchObject({ sort_by: 'name', sort: 'desc' })
    view.unmount()
  })

  it('keeps pagination one-based and within normalized server bounds', async () => {
    const view = mountCore(Table, {
      columns,
      load: () => ({ data: rows, meta: { total: 20, pageSize: 10, totalPage: 2 } }),
    })
    await flush()

    const [previous, next] = view.all('nav button') as HTMLButtonElement[]
    expect(previous.disabled).toBe(true)
    next.click()
    await flush()
    expect((view.exposed().query as Record<string, unknown>).page).toBe(2)
    expect((view.all('nav button')[1] as HTMLButtonElement).disabled).toBe(true)
    view.all('nav button')[1].click()
    await flush()
    expect((view.exposed().query as Record<string, unknown>).page).toBe(2)
    view.unmount()
  })

  it('renders row actions in a separate column without emitting row clicks', async () => {
    const onRowClick = vi.fn()
    const view = mountCore(
      Table,
      { columns, data: rows, 'onRow-click': onRowClick },
      { slots: { 'row-actions': ({ record }) => h('button', { class: 'row-action' }, String((record as typeof rows[number]).name)) } },
    )
    await flush()

    const actionCells = view.all('tbody td:last-child')
    expect(view.all('th').map((cell) => cell.textContent?.trim())).toEqual(['Nama', 'Status', ''])
    expect(actionCells).toHaveLength(rows.length)
    view.find<HTMLButtonElement>('.row-action')!.click()
    expect(onRowClick).not.toHaveBeenCalled()
    view.find('tbody tr:first-child td:first-child')!.click()
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0)
    view.unmount()
  })
})
