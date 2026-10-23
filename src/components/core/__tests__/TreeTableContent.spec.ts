import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { z } from 'zod'
import type { TreeRowContext } from '../../../contracts'
import TreeTableContent from '../TreeTableContent.vue'
import { flush, mountCore } from './harness'

type Node = { id: string; name: string; children: Node[] }

const root: Node = {
  id: 'root',
  name: 'Root',
  children: [{ id: 'child', name: 'Child', children: [{ id: 'leaf', name: 'Leaf', children: [] }] }],
}

const contentProps = {
  schema: z.object({ id: z.string(), name: z.string(), children: z.array(z.unknown()) }),
  columns: { name: { label: 'Name' } },
  records: [root],
  loading: false,
  empty: false,
  query: {},
  rowKey: 'id',
  children: (record: Node) => record.children,
  treeColumn: 'name',
}

describe('TreeTableContent', () => {
  it('updates rows and reveal paths after nested tree edits', async () => {
    const records = ref<Node[]>(structuredClone([root]))
    const treeContent = ref<{ reveal: (keys: readonly string[]) => void }>()
    const Host = defineComponent({
      setup: () => () => h(TreeTableContent, {
        ...contentProps,
        records: records.value,
        defaultExpandedKeys: ['root'],
        ref: treeContent,
      }),
    })
    const view = mountCore(Host, {})
    await flush()

    records.value[0]!.children = [{ id: 'new-child', name: 'New child', children: [] }]
    await flush()
    expect(view.all('tbody tr').map((row) => row.textContent?.trim())).toEqual(['Root', 'New child'])

    records.value[0]!.children[0]!.children.push({ id: 'new-leaf', name: 'New leaf', children: [] })
    await flush()
    treeContent.value!.reveal(['new-leaf'])
    await flush()
    expect(view.all('tbody tr').map((row) => row.textContent?.trim())).toEqual(['Root', 'New child', 'New leaf'])

    records.value[0]!.children[0]!.children[0]!.name = 'Edited leaf'
    await flush()
    expect(view.text()).toContain('Edited leaf')
    view.unmount()
  })

  it('uses default expansion and keeps local expansion actions separate from collection actions', async () => {
    const emitted: string[][] = []
    const refresh = vi.fn()
    const updateQuery = vi.fn()
    const view = mountCore(TreeTableContent, {
      ...contentProps,
      refresh,
      updateQuery,
      defaultExpandedKeys: ['root'],
      'onUpdate:expandedKeys': (keys: string[]) => emitted.push(keys),
      'onUpdate:query': updateQuery,
    })
    await flush()

    expect(view.all('tbody tr')).toHaveLength(2)
    view.find<HTMLButtonElement>('button[aria-label="Collapse Root"]')!.click()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(1)
    const exposed = view.exposed() as {
      expandAll: () => void
      collapseAll: () => void
      reveal: (keys: readonly string[]) => void
    }
    exposed.reveal(['leaf'])
    await flush()
    expect(view.all('tbody tr')).toHaveLength(3)
    expect(emitted.at(-1)).toEqual(expect.arrayContaining(['root', 'child']))

    exposed.collapseAll()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(1)
    exposed.expandAll()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(3)
    expect(refresh).not.toHaveBeenCalled()
    expect(updateQuery).not.toHaveBeenCalled()
    view.unmount()
  })

  it('requests controlled expansion and waits for the parent to apply it', async () => {
    const expandedKeys = ref<string[]>([])
    const updateExpandedKeys = vi.fn()
    const Host = defineComponent({
      setup: () => () => h(TreeTableContent, {
        ...contentProps,
        expandedKeys: expandedKeys.value,
        'onUpdate:expandedKeys': updateExpandedKeys,
      }),
    })
    const view = mountCore(Host, {})
    await flush()

    view.find<HTMLButtonElement>('button[aria-label="Expand Root"]')!.click()
    await flush()

    expect(updateExpandedKeys).toHaveBeenLastCalledWith(['root'])
    expect(view.all('tbody tr')).toHaveLength(1)
    expandedKeys.value = ['root']
    await flush()
    expect(view.all('tbody tr')).toHaveLength(2)
    expect(view.find('button[aria-label="Collapse Root"]')?.getAttribute('aria-expanded')).toBe('true')
    view.find<HTMLButtonElement>('button[aria-label="Collapse Root"]')!.click()
    await flush()
    expect(updateExpandedKeys).toHaveBeenLastCalledWith([])
    expect(view.all('tbody tr')).toHaveLength(2)
    expandedKeys.value = []
    await flush()
    expect(view.all('tbody tr')).toHaveLength(1)
    expect(updateExpandedKeys).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('preserves custom cell state and supplies tree context when expansion inserts rows', async () => {
    const sibling: Node = { id: 'sibling', name: 'Sibling', children: [] }
    const rowClick = vi.fn()
    const rowAction = vi.fn()
    const view = mountCore(TreeTableContent, { ...contentProps, records: [root, sibling], 'onRow-click': rowClick }, {
      slots: {
        'cell:name': ({ value, record, tree }) => {
          const row = tree as TreeRowContext
          return [h('span', `${row.depth}:${String(value)}`), h('input', { 'aria-label': (record as Node).name })]
        },
        'row-actions': ({ record, index, tree }) => h('button', { onClick: () => rowAction(record, index, tree) }, `Action ${(record as Node).name}`),
      },
    })
    await flush()

    view.find<HTMLInputElement>('input[aria-label="Sibling"]')!.value = 'Unsubmitted edit'
    view.find<HTMLButtonElement>('button[aria-label="Expand Root"]')!.click()
    await flush()

    expect(view.find<HTMLInputElement>('input[aria-label="Sibling"]')!.value).toBe('Unsubmitted edit')
    expect(view.text()).toContain('1:Child')
    expect(rowClick).not.toHaveBeenCalled()
    const childRow = view.all('tbody tr')[1]!
    view.find<HTMLButtonElement>('button[aria-label="Expand Child"]')!.click()
    await flush()
    expect(rowClick).not.toHaveBeenCalled()
    view.all('button').find((button) => button.textContent === 'Action Child')!.click()
    expect(rowAction).toHaveBeenCalledWith(root.children[0], 1, expect.objectContaining({ key: 'child', parentKey: 'root', depth: 1 }))
    childRow.click()
    expect(rowClick).toHaveBeenCalledWith(root.children[0], 1)
    view.unmount()
  })

  it('rejects duplicate row keys, competing expansion models, and data sources', () => {
    const duplicate = [
      { id: 1, name: 'First', children: [] },
      { id: '1', name: 'Second', children: [] },
    ]
    expect(() => mountCore(TreeTableContent, { ...contentProps, records: duplicate })).toThrow(
      '[loom][SURFACE_OPTION_INVALID] TreeTable rowKey values must be unique after normalization; duplicate key "1".',
    )
    expect(() => mountCore(TreeTableContent, { ...contentProps, expandedKeys: [], defaultExpandedKeys: [] })).toThrow(
      '[loom][SURFACE_OPTION_INVALID] TreeTable cannot receive both expandedKeys and defaultExpandedKeys.',
    )
    expect(() => mountCore(TreeTableContent, { ...contentProps, load: vi.fn() })).toThrow(
      '[loom][SURFACE_OPTION_INVALID] TreeTable content accepts loaded records and cannot receive data, load, or resourceLoader.',
    )
  })
})
