import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import TreeTable from '../TreeTable.vue'
import { deferred, flush, mountCore } from './harness'

type Node = {
  id: string
  name: string
  status: string
  children: Node[]
}

const fields = {
  name: { label: 'Name' },
  status: { label: 'Status' },
}

function makeTree() {
  const grandchild: Node = { id: 'grandchild', name: 'Grandchild', status: 'deep', children: [] }
  const childA: Node = { id: 'child-a', name: 'Child A', status: 'open', children: [grandchild] }
  const childB: Node = { id: 'child-b', name: 'Child B', status: 'closed', children: [] }
  const rootA: Node = { id: 'root-a', name: 'Root A', status: 'open', children: [childA, childB] }
  const rootB: Node = { id: 'root-b', name: 'Root B', status: 'open', children: [] }
  return { roots: [rootA, rootB], rootA, childA, childB, grandchild, rootB }
}

function treeProps(overrides: Record<string, unknown> = {}) {
  return {
    fields,
    treeColumn: 'name',
    pagination: false,
    children: (record: Node) => record.children,
    ...overrides,
  }
}

describe('TreeTable core', () => {
  it('renders records in preorder and keeps original records in slots', async () => {
    const tree = makeTree()
    const treeScopes: Record<string, unknown>[] = []
    const actionRecords: Node[] = []
    const statusScopes: Record<string, unknown>[] = []
    const view = mountCore(
      TreeTable,
      treeProps({ data: tree.roots, 'onRow-click': vi.fn() }),
      {
        slots: {
          'tree-cell': (scope) => {
            treeScopes.push(scope)
            return h('strong', `${String(scope.depth)}:${String(scope.value)}`)
          },
          'cell:status': (scope) => {
            statusScopes.push(scope)
            return h('span', { class: 'status-cell' }, `status:${String(scope.value)}`)
          },
          'row-actions': ({ record }) => {
            actionRecords.push(record as Node)
            return h('button', { class: 'row-action' }, (record as Node).name)
          },
        },
      },
    )
    await flush()

    expect(view.all('tbody tr')).toHaveLength(5)
    expect(treeScopes.map((scope) => (scope.record as Node).id)).toEqual([
      'root-a',
      'child-a',
      'grandchild',
      'child-b',
      'root-b',
    ])
    expect(treeScopes[0]?.record).toBe(tree.rootA)
    expect(treeScopes[2]?.record).toBe(tree.grandchild)
    expect(actionRecords).toEqual([tree.rootA, tree.childA, tree.grandchild, tree.childB, tree.rootB])
    expect(actionRecords[1]).toBe(tree.childA)
    expect(treeScopes[0]).toMatchObject({ value: 'Root A', field: { key: 'name' }, index: 0, depth: 0 })
    expect(statusScopes[2]?.record).toBe(tree.grandchild)
    expect(view.text()).toContain('status:deep')
    view.unmount()
  })

  it('supplies depth and applies depth-only indentation', async () => {
    const tree = makeTree()
    const scopes: Record<string, unknown>[] = []
    const view = mountCore(
      TreeTable,
      treeProps({ data: tree.roots }),
      { slots: { 'tree-cell': (scope) => { scopes.push(scope); return h('span', String(scope.value)) } } },
    )
    await flush()

    expect(scopes.map((scope) => scope.depth)).toEqual([0, 1, 2, 1, 0])
    expect(view.all('.is-tree-table-connector')).toHaveLength(0)
    expect(view.all('.is-tree-table-label').map((label) => (label as HTMLElement).style.paddingInlineStart)).toEqual([
      '0rem',
      '2.5rem',
      '5rem',
      '2.5rem',
      '0rem',
    ])
    view.unmount()
  })

  it('delegates row clicks, loader refresh, and collection states to Table', async () => {
    const tree = makeTree()
    const onRowClick = vi.fn()
    const load = vi.fn(() => ({ data: tree.roots, meta: { total: 5, pageSize: 10, totalPage: 1 } }))
    const view = mountCore(TreeTable, treeProps({ load, 'onRow-click': onRowClick }))
    await flush()

    view.all('tbody tr')[2]!.click()
    expect(onRowClick).toHaveBeenCalledWith(tree.grandchild, 2)
    expect(onRowClick.mock.calls[0]?.[0]).toBe(tree.grandchild)
    await (view.exposed().refresh as () => Promise<void>)()
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    view.unmount()

    const pending = deferred<{ data: Node[] }>()
    const loading = mountCore(
      TreeTable,
      treeProps({ load: () => pending.promise }),
      { slots: { loading: () => h('p', 'Tree loading'), empty: () => h('p', 'Tree empty') } },
    )
    expect(loading.text()).toContain('Tree loading')
    pending.resolve({ data: [] })
    await flush()
    expect(loading.text()).toContain('Tree empty')
    loading.unmount()

    const failing = mountCore(
      TreeTable,
      treeProps({ load: async () => Promise.reject(new Error('Tree failed')) }),
      { slots: { error: ({ error }) => h('p', `Tree error: ${(error as Error).message}`) } },
    )
    await flush(12)
    expect(failing.text()).toContain('Tree error: Tree failed')
    failing.unmount()
  })

  it('rejects cyclic or repeated record identities', () => {
    const cycle = { id: 'cycle', name: 'Cycle', status: 'bad', children: [] as Node[] }
    cycle.children.push(cycle)

    expect(() => mountCore(TreeTable, treeProps({ data: [cycle] }))).toThrow(
      '[loom] TreeTable children must form a tree.',
    )
  })
})
