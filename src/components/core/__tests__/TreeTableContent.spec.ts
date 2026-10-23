import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { z } from 'zod'
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
  pagination: false,
}

describe('TreeTableContent', () => {
  it('renders the loaded tree through the shared table and exposes local expansion commands', async () => {
    const emitted: string[][] = []
    const refresh = vi.fn()
    const updateQuery = vi.fn()
    const view = mountCore(TreeTableContent, {
      ...contentProps,
      refresh,
      updateQuery,
      'onUpdate:expandedKeys': (keys: string[]) => emitted.push(keys),
    })
    await flush()

    expect(view.all('tbody tr')).toHaveLength(1)
    expect(view.text()).toContain('Root')
    const exposed = view.exposed() as {
      expandAll: () => void
      collapseAll: () => void
      reveal: (keys: readonly string[]) => void
    }
    exposed.reveal(['leaf'])
    await flush()
    expect(view.all('tbody tr')).toHaveLength(3)
    expect(emitted[0]).toEqual(['root', 'child'])
    expect(refresh).not.toHaveBeenCalled()
    expect(updateQuery).not.toHaveBeenCalled()

    exposed.collapseAll()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(1)
    exposed.expandAll()
    await flush()
    expect(view.all('tbody tr')).toHaveLength(3)
    view.unmount()
  })

  it('does not accept loader or source attributes', () => {
    expect(() => mountCore(TreeTableContent, { ...contentProps, load: vi.fn() })).toThrow(
      '[loom][SURFACE_OPTION_INVALID] TreeTable content accepts loaded records and cannot receive data, load, or resourceLoader.'
    )
    expect(() => mountCore(TreeTableContent, { ...contentProps, data: [root] })).toThrow(
      '[loom][SURFACE_OPTION_INVALID] TreeTable content accepts loaded records and cannot receive data, load, or resourceLoader.'
    )
    expect(() => mountCore(TreeTableContent, { ...contentProps, 'resource-loader': vi.fn() })).toThrow(
      '[loom][SURFACE_OPTION_INVALID] TreeTable content accepts loaded records and cannot receive data, load, or resourceLoader.'
    )
  })

  it('forwards collection loading and error states to the existing content slots', async () => {
    const loading = mountCore(
      TreeTableContent,
      { ...contentProps, loading: true },
      {
        slots: { loading: () => h('p', 'Tree loading') },
      }
    )
    expect(loading.text()).toContain('Tree loading')
    loading.unmount()

    const error = mountCore(
      TreeTableContent,
      {
        ...contentProps,
        records: [],
        loading: false,
        empty: false,
        error: { message: 'Tree failed' },
      },
      {
        slots: { error: ({ error }) => h('p', `Tree error: ${error?.message}`) },
      }
    )
    await flush()
    expect(error.text()).toContain('Tree error: Tree failed')
    error.unmount()
  })

  it('keeps ordinary cell content inside the owned disclosure and label structure', async () => {
    const view = mountCore(TreeTableContent, contentProps, {
      slots: {
        'cell:name': ({ value }) => h('span', { class: 'custom-label' }, `Name: ${String(value)}`),
      },
    })
    await flush()

    const control = view.find<HTMLButtonElement>('button[aria-label="Luaskan Root"]')!
    expect(control.closest('.is-tree-table-cell')?.querySelector('.custom-label')?.textContent).toBe('Name: Root')
    expect(control.getAttribute('aria-expanded')).toBe('false')
    view.unmount()
  })
})
