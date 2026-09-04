import { afterEach, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'
import { createApp, h, nextTick, ref } from 'vue'
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

const fields = { name: { label: 'Name' }, status: { label: 'Status' } }
const data = Array.from({ length: 40 }, (_, index) => ({ name: `User ${index}`, status: 'open' }))

function mount(options: {
  namespace?: string
  controlled?: boolean
  controlledVisibility?: boolean
  fields?: Record<string, { label: string }>
  data?: Record<string, unknown>[]
  rowPrefix?: boolean
  rowActions?: boolean
  width?: string
} = {}) {
  const host = document.createElement('div')
  host.style.width = options.width ?? '700px'
  document.body.append(host)
  const namespace = options.namespace ?? `browser-table-${namespaces.size}`
  namespaces.add(namespace)
  const commits: Record<string, number>[] = []
  const sizing = ref<Record<string, number>>({})
  const visibleColumns = ref(Object.keys(options.fields ?? fields))
  const app = createApp({
    render: () => h(
      Table,
      {
        namespace,
        fields: options.fields ?? fields,
        data: options.data ?? data,
        ...(options.controlled ? { columnSizing: sizing.value } : {}),
        ...(options.controlledVisibility ? { visibleColumns: visibleColumns.value } : {}),
        'onUpdate:columnSizing': (next: Record<string, number>) => {
          commits.push(next)
          if (options.controlled) sizing.value = next
        },
        'onUpdate:visibleColumns': (next: string[]) => {
          if (options.controlledVisibility) visibleColumns.value = next
        },
      },
      {
        ...(options.rowPrefix
          ? { 'row-prefix': ({ record }: { record: Record<string, unknown> }) => h('button', { class: 'row-prefix' }, String(record.name)) }
          : {}),
        ...(options.rowActions
          ? { 'row-actions': ({ record }: { record: Record<string, unknown> }) => h('button', { class: 'row-action' }, String(record.name)) }
          : {}),
      },
    ),
  })
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  apps.push(app)
  return { app, commits, host, namespace, visibleColumns }
}

async function frame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

function mouse(target: EventTarget, type: 'mousedown' | 'mousemove' | 'mouseup', clientX: number) {
  target.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === 'mouseup' ? 0 : 1,
    clientX,
  }))
}

function headers(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('thead th:not(:last-child), thead th:last-child')]
}

function handle(host: HTMLElement) {
  return host.querySelector<HTMLButtonElement>('[role="separator"]')!
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
  it('uses the shared overlay state layer', async () => {
    const { host } = mount()
    await frame()
    const row = host.querySelector('tbody tr')!
    expect(row.classList.contains('overlay')).toBe(true)
    expect(row.classList.contains('after:bg-primary-hover')).toBe(true)
    expect(row.classList.contains('focus-within:after:bg-primary-active')).toBe(true)
  })

  it('keeps blank action header and action cells pinned during horizontal scroll', async () => {
    const wideFields = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`field${index}`, { label: `Field ${index}` }]))
    const wideData = [Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`field${index}`, `value-${index}`]))]
    const { host } = mount({ fields: wideFields, data: wideData, rowActions: true, width: '300px' })
    await frame()

    const scrollContainer = host.querySelector<HTMLElement>('.is-table .overflow-x-auto')!
    const actionHeader = host.querySelector<HTMLElement>('thead th:last-child')!
    const actionCell = host.querySelector<HTMLElement>('tbody td:last-child')!
    expect(actionHeader.textContent?.trim()).toBe('')
    expect(getComputedStyle(actionHeader).position).toBe('sticky')
    expect(getComputedStyle(actionCell).position).toBe('sticky')
    expect(scrollContainer.scrollWidth).toBeGreaterThan(scrollContainer.clientWidth)
    scrollContainer.scrollLeft = 200
    await frame()

    expect(scrollContainer.scrollLeft).toBe(200)
    const scrollportRight = scrollContainer.getBoundingClientRect().left + scrollContainer.clientWidth
    expect(scrollportRight - actionHeader.getBoundingClientRect().right).toBeGreaterThanOrEqual(0)
    expect(scrollportRight - actionHeader.getBoundingClientRect().right).toBeLessThanOrEqual(12)
    expect(scrollportRight - actionCell.getBoundingClientRect().right).toBeGreaterThanOrEqual(0)
    expect(scrollportRight - actionCell.getBoundingClientRect().right).toBeLessThanOrEqual(12)
  })

  it('renders row-prefix before first data column and row-actions after last', async () => {
    const { host } = mount({ rowPrefix: true, rowActions: true, data: [data[0]] })
    await frame()

    const cells = [...host.querySelectorAll<HTMLElement>('tbody td')]
    expect(cells[0].querySelector('.row-prefix')).not.toBeNull()
    expect(cells[0].getBoundingClientRect().width).toBeLessThanOrEqual(64)
    expect(cells[0].getBoundingClientRect().width).toBeLessThan(cells[1].getBoundingClientRect().width)
    expect(getComputedStyle(cells[0]).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(cells[1].textContent).toContain('User 0')
    expect(cells.at(-1)?.querySelector('.row-action')).not.toBeNull()
  })

  it('settles controlled visibility updates without cumulative renderer work', async () => {
    const stressFields = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`field${index}`, { label: `Field ${index}` }]))
    const stressData = Array.from({ length: 200 }, (_, row) => Object.fromEntries(Array.from({ length: 20 }, (_, column) => [`field${column}`, `row-${row}-value-${column}`])))
    const { host, visibleColumns } = mount({ fields: stressFields, data: stressData, controlledVisibility: true })
    await frame()

    for (let index = 0; index < 10; index += 1) {
      const key = `field${index % 2}`
      visibleColumns.value = visibleColumns.value.includes(key)
        ? visibleColumns.value.filter((column) => column !== key)
        : [...visibleColumns.value, key]
      await frame()
      expect(host.querySelectorAll('thead th').length).toBe(visibleColumns.value.length)
      expect(host.querySelectorAll('tbody td').length).toBe(visibleColumns.value.length * stressData.length)
    }
  }, 4_000)

  it('resizes from physical header geometry and commits once on mouseup', async () => {
    const { host, commits } = mount({ controlled: true })
    await frame()
    const [first] = headers(host)
    const start = first!.getBoundingClientRect().width
    expect(start).toBeGreaterThan(300)

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

  it('clamps movement and emits once after many mousemove samples', async () => {
    const { host, commits } = mount({ controlled: true })
    await frame()
    const first = headers(host)[0]!
    mouse(handle(host), 'mousedown', 350)
    for (let clientX = 349; clientX > -600; clientX -= 8) mouse(document, 'mousemove', clientX)
    await frame()
    expect(first.getBoundingClientRect().width).toBeLessThan(350)
    expect(commits).toHaveLength(0)
    mouse(document, 'mouseup', -600)
    expect(commits).toHaveLength(1)
    expect(commits[0]?.name).toBe(96)
  })

  it('persists one completed raw gesture and restores the complete snapshot', async () => {
    const { host, namespace } = mount()
    await frame()
    const key = columnSizesKey(namespace)
    const writes: string[] = []
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) writes.push(value)
      return original.call(this, name, value)
    }
    try {
      await commands.pointerAction('down')
      await commands.pointerAction('move', 80)
      await frame()
      expect(writes).toHaveLength(0)
      await commands.pointerAction('up', 80)
      await nextTick()
      expect(writes).toHaveLength(1)
      const completedWidth = headers(host)[0]!.getBoundingClientRect().width
      apps.pop()!.unmount()
      host.remove()
      const remounted = mount({ namespace })
      await frame()
      expect(headers(remounted.host)[0]!.getBoundingClientRect().width).toBeCloseTo(completedWidth, 0)
    } finally {
      Storage.prototype.setItem = original
    }
  })

  it('cleans up an active mouse gesture on unmount without a commit', async () => {
    const cancelled = mount({ controlled: true })
    await frame()
    await commands.pointerAction('down')
    await commands.pointerAction('move', 60)
    cancelled.app.unmount()
    apps.splice(apps.indexOf(cancelled.app), 1)
    await commands.pointerAction('up', 60)
    await frame()
    expect(cancelled.commits).toHaveLength(0)
  })

  it('keeps a focusable 12px vertical separator hit target', async () => {
    const { host } = mount()
    await frame()
    const resizeHandle = handle(host)
    expect(resizeHandle.getAttribute('aria-orientation')).toBe('vertical')
    expect(resizeHandle.tabIndex).toBe(0)
    expect(resizeHandle.getBoundingClientRect().width).toBeGreaterThanOrEqual(12)
  })
})
