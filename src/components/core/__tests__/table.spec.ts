import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import Table from '../Table.vue'
import { createMemoryQueryLocationAdapter } from '../../../adapters/projectAdapters'
import { deferred, flush, mountCore } from './harness'

const fields = { name: { label: 'Nama', table: { sortable: true } }, status: { label: 'Status' } }
const rows = [
  { name: 'Admin', status: 'open' },
  { name: 'Editor', status: 'closed' },
]

function installStorage() {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      get length() { return values.size },
    },
  })
  return values
}

describe('Table core', () => {
  it('applies uniform table defaults before explicit projections', async () => {
    const view = mountCore(
      Table,
      { fields: { name: { label: 'Nama' }, status: { label: 'Status', table: { align: 'start' } } }, data: rows },
      { fieldDefaults: { table: { align: 'end', props: { dense: true } } } },
    )
    await flush()
    expect(view.all('tbody td').slice(0, 2).map((cell) => (cell as HTMLElement).style.textAlign)).toEqual(['end', 'start'])
    view.unmount()
  })

  it('renders externally controlled data with catalog labels', async () => {
    const view = mountCore(Table, { fields, data: rows })
    await flush()

    expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Nama', 'Status'])
    expect(view.all('tbody tr')).toHaveLength(2)
    expect(view.text()).toContain('Admin')
    view.unmount()
  })

  it('fills its container while preserving column widths as a minimum', async () => {
    const view = mountCore(Table, { fields, data: rows })
    await flush()

    const table = view.find('table') as HTMLTableElement
    expect(table.classList.contains('w-full')).toBe(true)
    expect(table.style.minWidth).toBe('300px')
    expect(table.style.width).toBe('')
    view.unmount()
  })

  it('accepts a synchronous offline loader', async () => {
    const view = mountCore(Table, { fields, load: () => ({ data: rows }) })
    await flush()

    expect(view.all('tbody tr')).toHaveLength(2)
    view.unmount()
  })

  it('accepts a canonical asynchronous collection result', async () => {
    const view = mountCore(Table, {
      fields,
      load: async () => ({ data: rows, meta: { total: 20, pageSize: 10, totalPage: 2 } }),
    })
    await flush()

    expect(view.all('tbody tr')).toHaveLength(2)
    expect(view.text()).toContain('1 / 2')
    view.unmount()
  })

  it('rejects supplying both data and load', () => {
    expect(() => mountCore(Table, { fields, data: rows, load: () => ({ data: rows }) })).toThrow(
      'Table accepts either `data` or `load`, not both.',
    )
  })

  it('writes its query to the URL under the supplied namespace', async () => {
    const location = createMemoryQueryLocationAdapter()
    const view = mountCore(
      Table,
      { fields, namespace: 'roles', load: async () => ({ data: rows, meta: { total: 40, pageSize: 10, totalPage: 4 } }) },
      { adapters: { query: location } },
    )
    await flush()

    view.all('nav button')[1].click()
    await flush()

    expect(location.read('roles').page).toBe(2)
    view.unmount()
  })

  it('keeps a supplied query controlled even when a namespace exists', async () => {
    const location = createMemoryQueryLocationAdapter()
    const updates = vi.fn()
    const Host = defineComponent({
      setup(_, { expose }) {
        const query = ref<Record<string, unknown>>({ page: 1, limit: 10 })
        expose({ query })
        return () => h(Table, {
          fields,
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

  it('settles repeated successful query result changes', async () => {
    const Host = defineComponent({
      setup(_, { expose }) {
        const query = ref<Record<string, unknown>>({ page: 1, limit: 10 })
        expose({ query })
        return () => h(Table, {
          fields,
          namespace: 'roles',
          query: query.value,
          load: ({ query: activeQuery }: { query: Record<string, unknown> }) => ({
            data: activeQuery.search ? [] : rows,
            meta: activeQuery.search
              ? { total: 0, page: 1, pageSize: 10, totalPage: 0 }
              : { total: 2, page: 1, pageSize: 10, totalPage: 1 },
          }),
        })
      },
    })
    const view = mountCore(Host, {})
    await flush()

    for (let index = 0; index < 30; index += 1) {
      view.exposed().query = index % 2
        ? { page: 1, limit: 10 }
        : { page: 1, limit: 10, search: 'no-match' }
      await flush()
      if (index % 2) expect(view.all('tbody tr')).toHaveLength(2)
      else expect(view.text()).toContain('No data')
    }

    view.exposed().query = { page: 1, limit: 10 }
    await flush()
    expect(view.all('tbody tr')).toHaveLength(2)
    view.unmount()
  })

  it('keeps duplicate instances independent through explicit namespaces', async () => {
    const location = createMemoryQueryLocationAdapter()
    const Host = defineComponent(() => () => [
      h(Table, { fields, namespace: 'assignees', load: async () => ({ data: rows, meta: { total: 40, pageSize: 10, totalPage: 4 } }) }),
      h(Table, { fields, namespace: 'archived', load: async () => ({ data: rows, meta: { total: 40, pageSize: 10, totalPage: 4 } }) }),
    ])
    const view = mountCore(Host, {}, { adapters: { query: location } })
    await flush()

    view.all('nav')[1].querySelectorAll('button')[1].click()
    await flush()

    expect(location.read('archived').page).toBe(2)
    expect(location.read('assignees').page ?? 1).toBe(1)
    view.unmount()
  })

  it('renders controlled visible columns immediately without storage writes', async () => {
    const storage = installStorage()
    const Host = defineComponent({
      setup(_, { expose }) {
        const visible = ref(['name', 'status'])
        expose({ visible })
        return () => h(Table, { fields, namespace: 'roles', data: rows, visibleColumns: visible.value, 'onUpdate:visibleColumns': (next: string[]) => (visible.value = next) })
      },
    })
    const view = mountCore(Host, {})
    await flush()

    view.exposed().visible = ['name']
    await flush()
    expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Nama'])
    expect(storage.size).toBe(0)
    view.unmount()
  })

  it('reloads and cancels the previous request when the load context changes', async () => {
    const first = deferred<{ data: typeof rows }>()
    const signals: (AbortSignal | undefined)[] = []
    let call = 0
    const section = ref('a')
    const Host = defineComponent(() => () =>
      h(Table, {
        fields,
        searchParameters: { section_id: section.value },
        load: ({ signal }: { signal?: AbortSignal }) => {
          signals.push(signal)
          call += 1
          return call === 1 ? first.promise : Promise.resolve({ data: rows })
        },
      }),
    )
    const view = mountCore(Host, {})
    await flush()

    expect(signals[0]?.aborted).toBe(false)

    section.value = 'b'
    await flush()

    expect(signals.length).toBeGreaterThan(1)
    expect(signals[0]?.aborted).toBe(true)
    first.resolve({ data: rows })
    view.unmount()
  })

  it('toggles sort direction and resets to the first page', async () => {
    const queries: Record<string, unknown>[] = []
    const view = mountCore(Table, {
      fields,
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

  it('keeps the two-state sort cycle and does not reorder controlled data', async () => {
    const orderedRows = [
      { name: 'Zulu', status: 'open' },
      { name: 'Alpha', status: 'closed' },
    ]
    const queries: Record<string, unknown>[] = []
    const view = mountCore(Table, {
      fields,
      data: orderedRows,
      'onUpdate:query': (query: Record<string, unknown>) => queries.push(query),
    })
    await flush()

    const sort = view.all('th button')[0]
    sort.click()
    await flush()
    sort.click()
    await flush()
    sort.click()
    await flush()

    expect(queries.map(({ sort }) => sort)).toEqual(['asc', 'desc', 'asc'])
    expect(view.all('tbody tr').map((row) => row.textContent)).toEqual(['Zuluopen', 'Alphaclosed'])
    view.unmount()
  })

  it('emits original row records with visible zero-based indexes', async () => {
    const onRowClick = vi.fn()
    const view = mountCore(Table, { fields, data: rows, 'onRow-click': onRowClick })
    await flush()

    view.all('tbody tr')[1].click()

    expect(onRowClick).toHaveBeenCalledWith(rows[1], 1)
    expect(onRowClick.mock.calls[0][0]).toBe(rows[1])
    view.unmount()
  })

  it('uses field reads and excludes fields outside the table surface', async () => {
    const view = mountCore(Table, {
      fields: {
        name: { label: 'Nama lengkap', display: { read: (record: { name: string }) => record.name.toUpperCase() } },
        status: { label: 'Status', table: false },
      },
      data: rows,
    })
    await flush()

    expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Nama lengkap'])
    expect(view.text()).toContain('ADMIN')
    expect(view.text()).not.toContain('open')
    view.unmount()
  })

  it('keeps resolved alignment on table headers and cells', async () => {
    const view = mountCore(Table, {
      fields: {
        name: { label: 'Nama', table: { align: 'start' } },
        status: { label: 'Status', table: { align: 'end' } },
      },
      data: rows,
    })
    await flush()

    expect(view.all('th').map((cell) => (cell as HTMLElement).style.textAlign)).toEqual(['start', 'end'])
    expect(view.all('td').map((cell) => (cell as HTMLElement).style.textAlign)).toEqual(['start', 'end', 'start', 'end'])
    view.unmount()
  })

  it('keeps pagination one-based and within normalized server bounds', async () => {
    const view = mountCore(Table, {
      fields,
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

  it('defaults standalone table pagination to auto', async () => {
    const view = mountCore(Table, {
      fields,
      load: () => ({ data: rows, meta: { total: 1, pageSize: 10, totalPage: 1 } }),
    })
    await flush()

    expect(view.find('nav[aria-label="Pagination"]')).toBeNull()
    view.unmount()
  })

  it('can keep disabled pagination visible for a single known page', async () => {
    const view = mountCore(Table, {
      fields,
      pagination: 'always',
      load: () => ({ data: rows, meta: { total: 1, pageSize: 10, totalPage: 1 } }),
    })
    await flush()

    expect(view.text()).toContain('1 / 1')
    expect((view.all('nav button').slice(0, 2) as HTMLButtonElement[]).every((button) => button.disabled)).toBe(true)
    view.unmount()
  })

  it('renders row actions in a separate column without emitting row clicks', async () => {
    const onRowClick = vi.fn()
    const view = mountCore(
      Table,
      { fields, data: rows, 'onRow-click': onRowClick },
      { slots: { 'row-actions': ({ record }) => h('button', { class: 'row-action' }, String((record as typeof rows[number]).name)) } },
    )
    await flush()

    const [actionHeader] = view.all('th').slice(-1)
    const actionCells = view.all('tbody td:last-child')
    expect(view.all('th').map((cell) => cell.textContent?.trim())).toEqual(['Nama', 'Status', ''])
    expect(actionHeader?.classList.contains('sticky')).toBe(true)
    expect(actionHeader?.classList.contains('right-0')).toBe(true)
    expect(actionCells).toHaveLength(rows.length)
    expect(actionCells.every((cell) => cell.classList.contains('sticky') && cell.classList.contains('right-0'))).toBe(true)
    expect(actionCells.every((cell) => cell.classList.contains('is-table-row-action') && !cell.classList.contains('bg-surface-container'))).toBe(true)
    view.find<HTMLButtonElement>('.row-action')!.click()
    expect(onRowClick).not.toHaveBeenCalled()
    view.unmount()
  })

  it('renders loading, empty, and error states', async () => {
    const pending = deferred<{ data: typeof rows }>()
    const loading = mountCore(Table, { fields, load: () => pending.promise })
    expect(loading.text()).toContain('Memuat')
    expect(loading.find('[role="status"]')?.parentElement?.classList.contains('bg-surface-container')).toBe(true)
    pending.resolve({ data: [] })
    await flush()
    expect(loading.text()).toContain('No data')
    loading.unmount()

    const failing = mountCore(Table, {
      fields,
      load: async () => {
        throw new Error('Gagal memuat')
      },
    })
    await flush(12)
    expect(failing.find('[role="alert"]')?.textContent).toContain('Gagal memuat')
    failing.unmount()
  })

  it('renders a registered renderer and lets a slot override it', async () => {
    const Chip = defineComponent({ props: { value: null }, setup: (props) => () => h('em', String(props.value)) })
    const withRenderer = mountCore(
      Table,
      { fields: { status: { label: 'Status', table: { renderer: 'chip' } } }, data: rows },
      { renderers: { table: { chip: Chip } } },
    )
    await flush()
    expect(withRenderer.find('em')?.textContent).toBe('open')
    withRenderer.unmount()

    const withSlot = mountCore(
      Table,
      { fields, data: rows },
      { slots: { 'cell:name': (scope) => h('strong', String((scope as { value: unknown }).value)) } },
    )
    await flush()
    expect(withSlot.find('strong')?.textContent).toBe('Admin')
    withSlot.unmount()
  })

  it('emits query changes', async () => {
    const onUpdate = vi.fn()
    const view = mountCore(Table, {
      fields,
      data: rows,
      'onUpdate:query': onUpdate,
    })
    await flush()
    view.all('th button')[0].click()
    await flush()

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ sort_by: 'name' }))
    view.unmount()
  })

  it('passes complete cell scope and lets a named slot override its renderer', async () => {
    const Chip = defineComponent({ props: { value: null }, setup: () => () => h('em', 'renderer') })
    const scopes: Record<string, unknown>[] = []
    const view = mountCore(
      Table,
      {
        fields: {
          name: { label: 'Nama', table: { renderer: 'chip' } },
        },
        data: rows,
      },
      {
        renderers: { table: { chip: Chip } },
        slots: {
          'cell:name': (cell) => {
            scopes.push(cell)
            return h('strong', `slot:${String(cell.value)}`)
          },
        },
      },
    )
    await flush()

    expect(view.find('strong')?.textContent).toBe('slot:Admin')
    expect(view.find('em')).toBeNull()
    expect(scopes[0]).toMatchObject({ value: 'Admin', record: rows[0], field: { key: 'name', label: 'Nama' }, index: 0 })
    expect(scopes[0].record).toBe(rows[0])
    view.unmount()
  })

  it('keeps loading, error, and empty slot precedence', async () => {
    const pending = deferred<{ data: typeof rows }>()
    const loading = mountCore(
      Table,
      { fields, load: () => pending.promise },
      { slots: { loading: () => h('p', 'Memuat khusus'), empty: () => h('p', 'Kosong khusus') } },
    )
    expect(loading.text()).toContain('Memuat khusus')
    pending.resolve({ data: [] })
    await flush()
    expect(loading.text()).toContain('Kosong khusus')
    loading.unmount()

    const failing = mountCore(
      Table,
      { fields, load: async () => Promise.reject(new Error('Gagal khusus')) },
      { slots: { error: ({ error }) => h('p', `Error khusus: ${(error as Error).message}`) } },
    )
    await flush(12)
    expect(failing.text()).toContain('Error khusus: Gagal khusus')
    failing.unmount()
  })

  it('refreshes through the exposed API and keeps framework query state exposed', async () => {
    const load = vi.fn(() => ({ data: rows }))
    const view = mountCore(Table, { fields, data: undefined, load })
    await flush()

    expect(view.exposed().query as Record<string, unknown>).toMatchObject({ page: 1, limit: 10 })
    await (view.exposed().refresh as () => Promise<unknown>)()
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    expect(view.exposed()).not.toHaveProperty('table')
    view.unmount()
  })

  it('reacts to data and field changes without remounting', async () => {
    const data = ref(rows)
    const reactiveFields = ref(fields)
    const Host = defineComponent(() => () => h(Table, { fields: reactiveFields.value, data: data.value }))
    const view = mountCore(Host, {})
    await flush()

    data.value = [{ name: 'Owner', status: 'active' }]
    reactiveFields.value = { status: { label: 'Keadaan' } }
    await flush()

    expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Keadaan'])
    expect(view.all('tbody tr')).toHaveLength(1)
    expect(view.text()).toContain('active')
    view.unmount()
  })

  it('reacts to query-adapter updates and replaces loader results without remounting', async () => {
    const location = createMemoryQueryLocationAdapter()
    const view = mountCore(
      Table,
      {
        fields,
        namespace: 'roles',
        load: ({ query }: { query: Record<string, unknown> }) => ({
          data: query.page === 2 ? [{ name: 'Owner', status: 'active' }] : rows,
          meta: { total: 20, pageSize: 10, totalPage: 2 },
        }),
      },
      { adapters: { query: location } },
    )
    await flush()

    location.write('roles', { page: 2, limit: 10 })
    await flush()

    expect((view.exposed().query as Record<string, unknown>).page).toBe(2)
    expect(view.all('tbody tr')).toHaveLength(1)
    expect(view.text()).toContain('Owner')
    view.unmount()
  })
})
