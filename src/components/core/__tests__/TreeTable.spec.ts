import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { z } from 'zod'
import TreeTable from '../TreeTable.vue'
import { flush, mountCore } from './harness'

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
})
