import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { z } from 'zod'
import TreeTable from '../TreeTable.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import './browser.css'

type TreeRecord = Record<string, unknown> & { id: string; name: string; children: TreeRecord[] }

const apps: App[] = []
const columns = Object.fromEntries([['name', { label: 'Name' }], ...Array.from({ length: 8 }, (_, index) => [`field${index}`, { label: `Field ${index}` }])])
const data: TreeRecord[] = [
  {
    id: 'root',
    name: 'Root',
    children: [
      {
        id: 'branch',
        name: 'Branch',
        children: [{ id: 'leaf', name: 'Leaf', children: [] }],
      },
    ],
    ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`field${index}`, `root-${index}`])),
  },
]
data[0]!.children[0]!.field0 = 'branch-0'
data[0]!.children[0]!.children[0]!.field0 = 'leaf-0'

function mount(options: { controlled?: boolean; initialExpanded?: readonly string[]; indent?: string; width?: string } = {}) {
  const host = document.createElement('div')
  host.style.width = options.width ?? '375px'
  if (options.indent) host.style.setProperty('--loom-tree-indent', options.indent)
  document.body.append(host)
  const expanded = ref<readonly string[]>(['root', 'branch'])
  const treeTable = ref<{ collapseAll: () => void }>()
  const rowClick = vi.fn()
  const common = {
    schema: z.object({ id: z.string(), name: z.string(), children: z.array(z.unknown()), ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`field${index}`, z.string().optional()])) }),
    columns,
    data,
    rowKey: 'id',
    children: (record: TreeRecord) => record.children,
    treeColumn: 'name',
    pagination: false,
    'onRow-click': rowClick,
  }
  const app = createApp(
    defineComponent({
      render: () =>
        h(
          TreeTable,
          {
            ...common,
            ref: treeTable,
            ...(options.controlled
              ? {
                  expandedKeys: expanded.value,
                  'onUpdate:expandedKeys': (keys: string[]) => {
                    expanded.value = keys
                  },
                }
              : {}),
            ...(!options.controlled && options.initialExpanded ? { defaultExpandedKeys: options.initialExpanded } : {}),
          },
          {
            'cell:name': ({ value }: { value: unknown }) => h('span', { class: 'browser-long-label' }, `${String(value)} ${'long custom tree label '.repeat(8)}`),
            'row-actions': ({ record }: { record: TreeRecord }) => h('button', { type: 'button', class: 'row-action', 'aria-label': `Open ${record.name}` }, 'Open'),
          }
        ),
    })
  )
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  apps.push(app)
  return { host, expanded, treeTable, rowClick }
}

async function frame() {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('TreeTable browser interactions', () => {
  it('uses native Enter and Space disclosures, keeps actions inert, and contains narrow table scrolling', async () => {
    const { host, rowClick } = mount()
    await frame()

    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    const rootButton = host.querySelector<HTMLButtonElement>('button[aria-label="Luaskan Root"]')!
    const rootButtonRect = rootButton.getBoundingClientRect()
    expect(rootButtonRect.width).toBeCloseTo(32, 0)
    expect(rootButtonRect.height).toBeCloseTo(32, 0)
    expect(getComputedStyle(rootButton).minWidth).toBe('32px')
    expect(getComputedStyle(rootButton.closest('.is-tree-table-cell')!).gap).toBe('8px')
    rootButton.focus()
    await userEvent.keyboard('{Enter}')
    await frame()
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(rootButton.getAttribute('aria-expanded')).toBe('true')

    const branchButton = host.querySelector<HTMLButtonElement>('button[aria-label="Luaskan Branch"]')!
    expect(Number.parseFloat(getComputedStyle(branchButton.closest('.is-tree-table-cell')!).paddingInlineStart)).toBe(16)
    branchButton.focus()
    await userEvent.keyboard(' ')
    await frame()
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3)
    expect(rowClick).not.toHaveBeenCalled()
    const leafSpacer = host.querySelector<HTMLElement>('tr[data-tree-key="leaf"] .is-tree-table-disclosure-spacer')!
    expect(leafSpacer.getBoundingClientRect().width).toBeCloseTo(32, 0)
    expect(leafSpacer.getBoundingClientRect().height).toBeCloseTo(32, 0)

    const action = host.querySelector<HTMLButtonElement>('button.row-action')!
    action.click()
    expect(rowClick).not.toHaveBeenCalled()
    const longLabel = host.querySelector<HTMLElement>('.is-tree-table-label')!
    expect(getComputedStyle(longLabel).whiteSpace).toBe('normal')
    expect(getComputedStyle(longLabel).overflowWrap).toBe('anywhere')
    for (const row of host.querySelectorAll('tbody tr')) expect(getComputedStyle(row, '::after').content).not.toBe('""')

    const scrollContainer = host.querySelector<HTMLElement>('.is-table .overflow-x-auto')!
    const actionHeader = host.querySelector<HTMLElement>('thead th:last-child')!
    const actionCell = host.querySelector<HTMLElement>('tbody td:last-child')!
    expect(scrollContainer.scrollWidth).toBeGreaterThan(scrollContainer.clientWidth)
    expect(getComputedStyle(actionHeader).position).toBe('sticky')
    expect(getComputedStyle(actionCell).position).toBe('sticky')
    scrollContainer.scrollLeft = 200
    await frame()
    expect(scrollContainer.scrollLeft).toBe(200)
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth + 1)
    const scrollportRight = scrollContainer.getBoundingClientRect().left + scrollContainer.clientWidth
    expect(scrollportRight - actionHeader.getBoundingClientRect().right).toBeGreaterThanOrEqual(0)
    expect(scrollportRight - actionHeader.getBoundingClientRect().right).toBeLessThanOrEqual(12)
    expect(scrollportRight - actionCell.getBoundingClientRect().right).toBeGreaterThanOrEqual(0)
    expect(scrollportRight - actionCell.getBoundingClientRect().right).toBeLessThanOrEqual(12)
    expect(host.getBoundingClientRect().width).toBe(375)
  })

  it('fills wide tree tables through data columns and pins the action edge', async () => {
    const { host } = mount({ width: '2000px' })
    await frame()

    const table = host.querySelector<HTMLTableElement>('.is-tree-table table')!
    const scrollport = host.querySelector<HTMLElement>('.is-table .overflow-x-auto')!
    const headers = [...table.querySelectorAll<HTMLElement>('thead th')]
    const cells = [...table.querySelectorAll<HTMLElement>('tbody tr:first-child td')]
    const actionHeader = headers.at(-1)!
    const actionCell = cells.at(-1)!

    expect(table.getBoundingClientRect().width).toBeCloseTo(scrollport.clientWidth, 0)
    expect(headers[0]!.getBoundingClientRect().width).toBeGreaterThan(150)
    expect(actionHeader.getBoundingClientRect().right).toBeCloseTo(table.getBoundingClientRect().right, 0)
    expect(actionCell.getBoundingClientRect().right).toBeCloseTo(table.getBoundingClientRect().right, 0)
  })

  it('moves focus to the nearest visible disclosure after controlled ancestor collapse', async () => {
    const { host, expanded } = mount({ controlled: true })
    await frame()
    const leafAction = host.querySelector<HTMLButtonElement>('tr[data-tree-key="leaf"] .row-action')!
    leafAction.focus()
    expect(document.activeElement).toBe(leafAction)

    expanded.value = ['root']
    await frame()
    const branchDisclosure = host.querySelector<HTMLButtonElement>('button[aria-label="Luaskan Branch"]')!
    expect(document.activeElement).toBe(branchDisclosure)

    expanded.value = []
    await frame()
    const rootDisclosure = host.querySelector<HTMLButtonElement>('button[aria-label="Luaskan Root"]')!
    expect(document.activeElement).toBe(rootDisclosure)
  })

  it('recovers focus after programmatic collapseAll without stealing outside focus', async () => {
    const { host, treeTable } = mount({ controlled: false, initialExpanded: ['root', 'branch'] })
    await frame()

    const leafAction = host.querySelector<HTMLButtonElement>('tr[data-tree-key="leaf"] .row-action')!
    leafAction.focus()
    treeTable.value?.collapseAll()
    await frame()
    const rootDisclosure = host.querySelector<HTMLButtonElement>('button[aria-label="Luaskan Root"]')!
    expect(document.activeElement).toBe(rootDisclosure)

    treeTable.value?.expandAll()
    await frame()
    const external = document.createElement('button')
    external.textContent = 'Outside'
    host.prepend(external)
    external.focus()
    treeTable.value?.collapseAll()
    await frame()
    expect(document.activeElement).toBe(external)
  })

  it('inherits indentation customization from an ancestor', async () => {
    const { host } = mount({ indent: '1.5rem' })
    await frame()

    const rootButton = host.querySelector<HTMLButtonElement>('button[aria-label="Luaskan Root"]')!
    rootButton.click()
    await frame()

    const branchCell = host.querySelector<HTMLElement>('tr[data-tree-key="branch"] .is-tree-table-cell')!
    expect(Number.parseFloat(getComputedStyle(branchCell).paddingInlineStart)).toBe(24)
  })

  it('keeps focus in another tree with the same row keys when this tree collapses', async () => {
    const first = mount({ initialExpanded: ['root', 'branch'] })
    const second = mount({ initialExpanded: ['root', 'branch'] })
    await frame()

    const secondLeafAction = second.host.querySelector<HTMLButtonElement>('tr[data-tree-key="leaf"] .row-action')!
    secondLeafAction.focus()
    expect(document.activeElement).toBe(secondLeafAction)

    first.treeTable.value?.collapseAll()
    await frame()

    expect(document.activeElement).toBe(secondLeafAction)
  })
})
