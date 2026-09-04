import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import TreeTable from '../TreeTable.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import './browser.css'

type TreeRecord = Record<string, unknown> & { children: TreeRecord[] }

const apps: ReturnType<typeof createApp>[] = []
const fields = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`field${index}`, { label: `Field ${index}` }]))
const data: TreeRecord[] = [{ field0: 'Root', children: [{ field0: 'Child', children: [] }] }]

function mount() {
  const host = document.createElement('div')
  host.style.width = '300px'
  document.body.append(host)
  const app = createApp({
    render: () => h(
      TreeTable,
      {
        fields,
        data,
        children: (record: TreeRecord) => record.children,
        treeColumn: 'field0',
        pagination: false,
      },
      {
        'row-actions': ({ record }: { record: TreeRecord }) => h('button', { class: 'row-action' }, String(record.field0)),
      },
    ),
  })
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  apps.push(app)
  return { host }
}

async function frame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('TreeTable browser interactions', () => {
  it('pins row actions while tree cells use depth-only indentation', async () => {
    const { host } = mount()
    await frame()

    const scrollContainer = host.querySelector<HTMLElement>('.is-table .overflow-x-auto')!
    const actionHeader = host.querySelector<HTMLElement>('thead th:last-child')!
    const actionCell = host.querySelector<HTMLElement>('tbody td:last-child')!
    expect(getComputedStyle(actionHeader).position).toBe('sticky')
    expect(getComputedStyle(actionCell).position).toBe('sticky')
    expect(scrollContainer.scrollWidth).toBeGreaterThan(scrollContainer.clientWidth)
    expect(host.querySelectorAll('.is-tree-table-connector')).toHaveLength(0)
    const labels = host.querySelectorAll<HTMLElement>('.is-tree-table-label')
    expect(labels[0]?.style.paddingInlineStart).toBe('0rem')
    expect(labels[1]?.style.paddingInlineStart).toBe('2.5rem')
    scrollContainer.scrollLeft = 200
    await frame()

    expect(scrollContainer.scrollLeft).toBe(200)
    const scrollportRight = scrollContainer.getBoundingClientRect().left + scrollContainer.clientWidth
    expect(scrollportRight - actionHeader.getBoundingClientRect().right).toBeGreaterThanOrEqual(0)
    expect(scrollportRight - actionHeader.getBoundingClientRect().right).toBeLessThanOrEqual(12)
    expect(scrollportRight - actionCell.getBoundingClientRect().right).toBeGreaterThanOrEqual(0)
    expect(scrollportRight - actionCell.getBoundingClientRect().right).toBeLessThanOrEqual(12)
  })
})
