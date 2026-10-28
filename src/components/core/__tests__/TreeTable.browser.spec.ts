import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createApp, h, nextTick, type App } from 'vue'
import { z } from 'zod'
import TreeTable from '../TreeTable.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import './browser.css'

type TreeRecord = { id: string; name: string; children: TreeRecord[] }

const apps: App[] = []
const columns = { name: { label: 'Name' } }
const data: TreeRecord[] = [
  {
    id: 'root',
    name: 'Root',
    children: [{ id: 'branch', name: 'Branch', children: [{ id: 'leaf', name: 'Leaf', children: [] }] }],
  },
]

function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const rowClick = vi.fn()
  const app = createApp({
    render: () =>
      h(
        TreeTable,
        {
          schema: z.object({ id: z.string(), name: z.string(), children: z.array(z.unknown()) }),
          columns,
          data,
          rowKey: 'id',
          children: (record: TreeRecord) => record.children,
          treeColumn: 'name',
          pagination: false,
          'onRow-click': rowClick,
        },
        {
          'row-actions': ({ record }: { record: TreeRecord }) => h('button', { type: 'button', class: 'row-action' }, `Open ${record.name}`),
        }
      ),
  })
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  apps.push(app)
  return { host, rowClick }
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
  it('uses native Enter and Space disclosures and keeps actions inert', async () => {
    const { host, rowClick } = mount()
    await frame()

    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    const rootButton = host.querySelector<HTMLButtonElement>('button[aria-label="Luaskan Root"]')!
    rootButton.focus()
    await userEvent.keyboard('{Enter}')
    await frame()
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(rootButton.getAttribute('aria-expanded')).toBe('true')

    const branchButton = host.querySelector<HTMLButtonElement>('button[aria-label="Luaskan Branch"]')!
    branchButton.focus()
    await userEvent.keyboard(' ')
    await frame()
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3)
    expect(rowClick).not.toHaveBeenCalled()

    host.querySelector<HTMLButtonElement>('button.row-action')!.click()
    expect(rowClick).not.toHaveBeenCalled()

    host.querySelector<HTMLElement>('tr[data-tree-key="leaf"] td')!.click()
    expect(rowClick).toHaveBeenCalledTimes(1)
    expect(rowClick).toHaveBeenCalledWith(data[0]!.children[0]!.children[0], 2)

    host.querySelector<HTMLButtonElement>('button[aria-label="Ciutkan Root"]')!.focus()
    await userEvent.keyboard('{Enter}')
    await frame()
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(rowClick).toHaveBeenCalledTimes(1)
  })
})
