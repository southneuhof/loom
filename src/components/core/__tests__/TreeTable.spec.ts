import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { z } from 'zod'
import TreeTable from '../TreeTable.vue'
import { deferred, flush, mountCore } from './harness'

type TreeRecord = {
  id: string | number
  name: string
  status: string
  children: TreeRecord[]
}

const columns = {
  name: { label: 'Name' },
  status: { label: 'Status' },
}

const schema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  status: z.string(),
  children: z.array(z.unknown()),
})

function makeTree(name = 'Root A') {
  const grandchild: TreeRecord = { id: 'grandchild', name: 'Grandchild', status: 'deep', children: [] }
  const childA: TreeRecord = { id: 'child-a', name: 'Child A', status: 'open', children: [grandchild] }
  const childB: TreeRecord = { id: 'child-b', name: 'Child B', status: 'closed', children: [] }
  const rootA: TreeRecord = { id: 'root-a', name, status: 'open', children: [childA, childB] }
  const rootB: TreeRecord = { id: 'root-b', name: 'Root B', status: 'open', children: [] }
  return { roots: [rootA, rootB], rootA, childA, childB, grandchild, rootB }
}

function treeProps(overrides: Record<string, unknown> = {}) {
  return {
    schema,
    columns,
    rowKey: 'id',
    treeColumn: 'name',
    pagination: false,
    children: (record: TreeRecord) => record.children,
    ...overrides,
  }
}

function visibleNames(view: ReturnType<typeof mountCore>) {
  return view.all('tbody tr .is-tree-table-label').map((element) => element.textContent?.trim())
}

describe('TreeTable ownership and presentation', () => {
  it('starts collapsed, traverses arbitrary depth in sibling order, and supplies original records in all row slots', async () => {
    const tree = makeTree()
    const cellScopes: Record<string, unknown>[] = []
    const prefixScopes: Record<string, unknown>[] = []
    const actionScopes: Record<string, unknown>[] = []
    const rowClick = vi.fn()
    const view = mountCore(TreeTable, treeProps({ data: tree.roots, 'onRow-click': rowClick }), {
      slots: {
        'cell:name': (scope) => {
          cellScopes.push(scope)
          return h('strong', { class: 'custom-tree-label' }, `custom:${String(scope.value)}`)
        },
        'cell:status': (scope) => h('span', `status:${String(scope.value)}`),
        'row-prefix': (scope) => {
          prefixScopes.push(scope)
          return h('span', { class: 'row-prefix' }, String(scope.tree && (scope.tree as { depth: number }).depth))
        },
        'row-actions': (scope) => {
          actionScopes.push(scope)
          return h('button', { class: 'row-action', type: 'button' }, (scope.record as TreeRecord).name)
        },
      },
    })
    await flush()

    expect(visibleNames(view)).toEqual(['custom:Root A', 'custom:Root B'])
    expect(view.all('tbody tr')).toHaveLength(2)
    expect(view.find('.is-tree-table-label')?.parentElement?.querySelector('button[aria-expanded="false"]')).not.toBeNull()
    expect(view.all('.is-tree-table-disclosure-spacer')).toHaveLength(1)
    expect(cellScopes[0]?.record).toBe(tree.rootA)
    expect(cellScopes[0]?.tree).toMatchObject({ key: 'root-a', depth: 0, parentKey: null, hasChildren: true, expanded: false })
    expect(typeof (cellScopes[0]!.tree as { toggleExpanded: unknown }).toggleExpanded).toBe('function')
    expect(prefixScopes[0]?.record).toBe(tree.rootA)
    expect(actionScopes[1]?.record).toBe(tree.rootB)
    expect((actionScopes[0]!.tree as { key: string }).key).toBe('root-a')
    expect(view.text()).toContain('status:open')

    const rootDisclosure = view.find<HTMLButtonElement>('button[aria-label="Luaskan Root A"]')!
    rootDisclosure.click()
    await flush()
    expect(rowClick).not.toHaveBeenCalled()
    expect(visibleNames(view)).toEqual(['custom:Root A', 'custom:Child A', 'custom:Child B', 'custom:Root B'])
    expect(cellScopes.find((scope) => (scope.record as TreeRecord).id === 'child-a')?.tree).toMatchObject({
      key: 'child-a',
      depth: 1,
      parentKey: 'root-a',
      hasChildren: true,
      expanded: false,
    })
    view.find<HTMLButtonElement>('button[aria-label="Luaskan Child A"]')!.click()
    await flush()
    expect(visibleNames(view)).toEqual(['custom:Root A', 'custom:Child A', 'custom:Grandchild', 'custom:Child B', 'custom:Root B'])
    expect(cellScopes.find((scope) => (scope.record as TreeRecord).id === 'grandchild')?.record).toBe(tree.grandchild)

    view.find<HTMLButtonElement>('.row-action')!.click()
    expect(rowClick).not.toHaveBeenCalled()
    view.find('tbody tr:last-child')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(rowClick).toHaveBeenCalledWith(tree.rootB, 4)
    view.unmount()
  })

  it('retains descendant expansion when an ancestor collapses and reopens', async () => {
    const tree = makeTree()
    const view = mountCore(TreeTable, treeProps({ data: tree.roots, defaultExpandedKeys: ['root-a', 'child-a'] }))
    await flush()
    expect(view.all('tbody tr')).toHaveLength(5)

    view.find<HTMLButtonElement>('button[aria-label="Ciutkan Root A"]')!.click()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(2)
    view.find<HTMLButtonElement>('button[aria-label="Luaskan Root A"]')!.click()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(5)
    expect(view.find('button[aria-label="Ciutkan Child A"]')).not.toBeNull()
    view.unmount()
  })

  it('preserves keys through same-key object replacement and temporary filtering', async () => {
    const initial = makeTree()
    const records = ref<TreeRecord[]>(initial.roots)
    const Host = defineComponent(() => () => h(TreeTable, treeProps({ data: records.value, defaultExpandedKeys: ['root-a', 'child-a'] })))
    const view = mountCore(Host, {})
    await flush()
    expect(view.all('tbody tr')).toHaveLength(5)

    records.value = []
    await flush()
    expect(view.all('tbody tr')).toHaveLength(0)
    const replacement = makeTree('Root A refreshed')
    records.value = replacement.roots
    await flush()
    expect(visibleNames(view)).toEqual(['Root A refreshed', 'Child A', 'Grandchild', 'Child B', 'Root B'])
    expect(replacement.rootA).not.toBe(initial.rootA)
    view.unmount()
  })

  it('keeps controlled arrays untouched and waits for the parent to accept emitted keys', async () => {
    const tree = makeTree()
    const supplied = ['root-a']
    const keys = ref<readonly string[]>(supplied)
    const updates: string[][] = []
    const Host = defineComponent(
      () => () =>
        h(TreeTable, {
          ...treeProps({ data: tree.roots, expandedKeys: keys.value }),
          'onUpdate:expandedKeys': (next: string[]) => updates.push(next),
        })
    )
    const view = mountCore(Host, {})
    await flush()
    expect(view.all('tbody tr')).toHaveLength(4)

    view.find<HTMLButtonElement>('button[aria-label="Ciutkan Root A"]')!.click()
    await flush()
    expect(updates).toEqual([[]])
    expect(updates[0]).not.toBe(supplied)
    expect(supplied).toEqual(['root-a'])
    expect(view.all('tbody tr')).toHaveLength(4)

    keys.value = updates[0]!
    await flush()
    expect(view.all('tbody tr')).toHaveLength(2)
    view.unmount()
  })

  it('expands, collapses, and reveals loaded ancestors without another read or query change', async () => {
    const tree = makeTree()
    const load = vi.fn(async (_context: { query: Record<string, unknown> }) => ({ data: tree.roots, meta: { total: 2, pageSize: 10, totalPage: 1 } }))
    const view = mountCore(TreeTable, treeProps({ load, defaultExpandedKeys: ['root-a'] }))
    await flush()
    expect(load).toHaveBeenCalledTimes(1)
    expect(view.all('tbody tr')).toHaveLength(4)

    const exposed = view.exposed() as {
      expandAll: () => void
      collapseAll: () => void
      reveal: (keys: readonly string[]) => void
      updateQuery: (patch: Record<string, unknown>) => void
      query: Record<string, unknown>
    }
    exposed.expandAll()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(5)
    expect(load).toHaveBeenCalledTimes(1)

    exposed.collapseAll()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(2)
    exposed.reveal(['grandchild', 'missing-key'])
    await flush()
    expect(view.all('tbody tr')).toHaveLength(5)
    expect(load).toHaveBeenCalledTimes(1)
    expect(exposed.query).toEqual({ page: 1, limit: 10 })

    exposed.updateQuery({ search: 'child' })
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    expect(load.mock.calls[1]?.[0].query).toMatchObject({ search: 'child' })
    exposed.updateQuery({ search: 'child' })
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('counts server-paged roots in the summary while expanding complete subtrees', async () => {
    const tree = makeTree()
    const view = mountCore(
      TreeTable,
      treeProps({
        data: [tree.rootA],
        pagination: 'always',
        meta: { total: 3, pageSize: 1, totalPage: 3 },
        defaultExpandedKeys: ['root-a'],
      })
    )
    await flush()
    expect(view.all('tbody tr')).toHaveLength(3)
    expect(view.text()).toContain('Showing data 1–1 out of 3')
    view.unmount()
  })

  it('handles deeper nesting without a depth-specific limit', async () => {
    const root: TreeRecord = { id: 'depth-0', name: 'Depth 0', status: '', children: [] }
    let parent = root
    for (let depth = 1; depth <= 12; depth += 1) {
      const child: TreeRecord = { id: `depth-${depth}`, name: `Depth ${depth}`, status: '', children: [] }
      parent.children.push(child)
      parent = child
    }
    const depths: number[] = []
    const view = mountCore(TreeTable, treeProps({ data: [root] }), {
      slots: {
        'cell:name': ({ tree }) => {
          depths.push((tree as { depth: number }).depth)
          return null
        },
      },
    })
    await flush()
    expect(view.all('tbody tr')).toHaveLength(1)
    ;(view.exposed().expandAll as () => void)()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(13)
    expect(depths.at(-1)).toBe(12)
    view.unmount()
  })

  it('emits server sort query changes without reordering loaded siblings', async () => {
    const ordered: TreeRecord[] = [
      { id: 'z', name: 'Zebra', status: '', children: [] },
      { id: 'a', name: 'Alpha', status: '', children: [] },
    ]
    const updateQuery = vi.fn()
    const view = mountCore(
      TreeTable,
      treeProps({
        columns: { name: { label: 'Name', sortable: true } },
        data: ordered,
        'onUpdate:query': updateQuery,
      })
    )
    await flush()
    view.all('thead th button')[0]!.click()
    await flush()
    expect(updateQuery).toHaveBeenCalledWith(expect.objectContaining({ sort_by: 'name', sort: 'asc' }))
    expect(visibleNames(view)).toEqual(['Zebra', 'Alpha'])
    view.unmount()
  })

  it('validates loader queries through querySchema before calling the loader', async () => {
    const tree = makeTree()
    const load = vi.fn(async () => ({ data: tree.roots }))
    const view = mountCore(
      TreeTable,
      treeProps({
        load,
        querySchema: z.object({ page: z.number(), limit: z.number(), search: z.string().optional() }),
      }),
      { slots: { error: ({ error }) => h('p', `Query error: ${(error as Error).message}`) } }
    )
    await flush(12)
    expect(load).toHaveBeenCalledTimes(1)

    ;(view.exposed().updateQuery as (patch: Record<string, unknown>) => void)({ search: 42 })
    await flush(12)
    expect(load).toHaveBeenCalledTimes(1)
    expect(view.text()).toContain('Collection query does not match querySchema at "search"')
    view.unmount()
  })

  it('validates row keys, column visibility, child arrays, and repeated or cyclic trees', () => {
    const tree = makeTree()
    expect(() => mountCore(TreeTable, treeProps({ data: tree.roots, rowKey: undefined }))).toThrow('[loom][SURFACE_OPTION_INVALID] TreeTable requires rowKey')
    expect(() => mountCore(TreeTable, treeProps({ data: tree.roots, columns: { status: { label: 'Status' } } }))).toThrow(
      '[loom][SURFACE_OPTION_INVALID] TreeTable treeColumn "name" must be declared in columns.'
    )
    expect(() => mountCore(TreeTable, treeProps({ data: tree.roots, visibleColumns: ['status'] }))).toThrow(
      '[loom][SURFACE_OPTION_INVALID] TreeTable treeColumn "name" cannot be excluded from visibleColumns.'
    )
    expect(() => mountCore(TreeTable, treeProps({ data: tree.roots, children: () => undefined }))).toThrow('[loom][SURFACE_OPTION_INVALID] TreeTable children for key')

    const repeated = makeTree()
    repeated.rootB.children.push(repeated.childA)
    expect(() => mountCore(TreeTable, treeProps({ data: repeated.roots }))).toThrow('[loom][SURFACE_OPTION_INVALID] TreeTable children contain a cycle or a repeated record reference.')

    const cycle = makeTree()
    cycle.grandchild.children.push(cycle.rootA)
    expect(() => mountCore(TreeTable, treeProps({ data: cycle.roots }))).toThrow('[loom][SURFACE_OPTION_INVALID] TreeTable children contain a cycle or a repeated record reference.')

    const duplicate: TreeRecord[] = [
      { id: 1, name: 'Numeric', status: '', children: [] },
      { id: '1', name: 'String', status: '', children: [] },
    ]
    expect(() => mountCore(TreeTable, treeProps({ data: duplicate }))).toThrow('[loom][SURFACE_OPTION_INVALID] TreeTable rowKey values must be unique after normalization; duplicate key "1".')
  })

  it('rejects simultaneous controlled and default expansion props', () => {
    const tree = makeTree()
    expect(() => mountCore(TreeTable, treeProps({ data: tree.roots, expandedKeys: [], defaultExpandedKeys: [] }))).toThrow(
      '[loom][SURFACE_OPTION_INVALID] TreeTable cannot receive both expandedKeys and defaultExpandedKeys.'
    )
  })

  it('keeps loader failures in the collection error state and refreshes only on demand', async () => {
    const pending = deferred<{ data: TreeRecord[] }>()
    const load = vi.fn(() => pending.promise)
    const view = mountCore(TreeTable, treeProps({ load }), { slots: { loading: () => h('p', 'Tree loading'), error: ({ error }) => h('p', `Tree error: ${(error as Error).message}`) } })
    expect(view.text()).toContain('Tree loading')
    pending.reject(new Error('Tree failed'))
    await flush(12)
    expect(view.text()).toContain('Tree error: Tree failed')
    expect(load).toHaveBeenCalledTimes(1)
    view.unmount()
  })
})
