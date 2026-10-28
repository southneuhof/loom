import { afterEach, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'
import { createApp, h, nextTick, ref } from 'vue'
import { z } from 'zod'
import Table from '../Table.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import './browser.css'

declare module 'vitest/browser' {
  interface BrowserCommands {
    pointerAction(action: 'down' | 'move' | 'up' | 'reset', deltaX?: number, steps?: number): Promise<void>
  }
}

const apps: ReturnType<typeof createApp>[] = []
const namespaces = new Set<string>()

const columns = { name: { label: 'Name' }, status: { label: 'Status' } }
const data = Array.from({ length: 40 }, (_, index) => ({ name: `User ${index}`, status: 'open' }))

function mount(
  options: {
    namespace?: string
    controlled?: boolean
  } = {}
) {
  const host = document.createElement('div')
  host.style.width = '700px'
  document.body.append(host)
  const namespace = options.namespace ?? `browser-table-${namespaces.size}`
  namespaces.add(namespace)
  const commits: Record<string, number>[] = []
  const sizing = ref<Record<string, number>>({})
  const app = createApp({
    render: () =>
      h(Table, {
        namespace,
        schema: z.object(Object.fromEntries(Object.keys(columns).map((key) => [key, z.unknown()]))),
        columns,
        data,
        ...(options.controlled ? { columnSizing: sizing.value } : {}),
        'onUpdate:columnSizing': (next: Record<string, number>) => {
          commits.push(next)
          if (options.controlled) sizing.value = next
        },
      }),
  })
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  apps.push(app)
  return { commits, host, namespace }
}

async function frame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

function headers(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('thead th:not(:last-child), thead th:last-child')]
}

function columnSizesKey(namespace: string) {
  return `is-framework:${namespace}:table:column-sizes`
}

afterEach(async () => {
  await commands.pointerAction('reset')
  apps.splice(0).forEach((app) => app.unmount())
  namespaces.forEach((namespace) => localStorage.removeItem(columnSizesKey(namespace)))
  namespaces.clear()
  document.body.innerHTML = ''
})

describe('Table browser interactions', () => {
  it('resizes from physical header geometry and commits once on mouseup', async () => {
    const { host, commits } = mount({ controlled: true })
    await frame()
    const [first] = headers(host)
    const start = first!.getBoundingClientRect().width
    expect(start).toBeGreaterThan(0)

    await commands.pointerAction('down')
    await commands.pointerAction('move', 80)
    await frame()
    const liveWidth = first!.getBoundingClientRect().width
    expect(liveWidth).toBeGreaterThan(start)
    expect(commits).toHaveLength(0)
    await commands.pointerAction('up', 80)
    expect(commits).toHaveLength(1)
    expect(commits[0]?.name).toBeGreaterThan(start)
    expect(Object.keys(commits[0] ?? {})).toEqual(['name'])
  })

  it('restores a resized column after remount', async () => {
    const { host, namespace } = mount()
    await frame()
    const initialWidth = headers(host)[0]!.getBoundingClientRect().width
    await commands.pointerAction('down')
    await commands.pointerAction('move', 80)
    await frame()
    await commands.pointerAction('up', 80)
    await frame()
    const completedWidth = headers(host)[0]!.getBoundingClientRect().width
    expect(completedWidth).toBeGreaterThan(initialWidth)

    apps.pop()!.unmount()
    host.remove()
    const remounted = mount({ namespace })
    await frame()
    expect(headers(remounted.host)[0]!.getBoundingClientRect().width).toBeCloseTo(completedWidth, 0)
  })
})
