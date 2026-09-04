import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ListView from '../ListView.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'

const apps: Array<ReturnType<typeof createApp>> = []

async function frame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('ListView collection presentation', () => {
  it('keeps one loader, query, and records when switching table and custom views', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const calls: Record<string, unknown>[] = []
    const query = ref<Record<string, unknown>>({ page: 1, limit: 10 })
    const presentation = ref<'table' | 'custom'>('table')
    let customState: Record<string, any> | undefined

    const app = createApp({
      setup: () => () => {
        const slots = presentation.value === 'custom'
          ? {
              collection: (state: Record<string, any>) => {
                customState = state
                return h('p', { 'data-custom-record': '' }, String(state.records[0]?.name ?? ''))
              },
            }
          : undefined
        return h(
          ListView,
          {
            title: 'Roles',
            query: query.value,
            table: {
              namespace: 'browser-custom-list',
              fields: { name: { label: 'Name' } },
              load: ({ query: currentQuery }: { query: Record<string, unknown> }) => {
                calls.push({ ...currentQuery })
                const page = Number(currentQuery.page ?? 1)
                return { data: [{ name: `Role ${page}` }], meta: { total: 2, totalPage: 2 } }
              },
            },
            'onUpdate:query': (next: Record<string, unknown>) => { query.value = next },
          },
          slots,
        )
      },
    })
    app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    await frame()
    expect(calls).toHaveLength(1)
    expect(host.querySelector('table')).not.toBeNull()

    presentation.value = 'custom'
    await frame()
    expect(calls).toHaveLength(1)
    expect(host.querySelector('[data-custom-record]')?.textContent).toBe('Role 1')

    customState!.updateQuery({ page: 2 })
    await frame()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ page: 2, limit: 10 })
    expect(host.querySelector('[data-custom-record]')?.textContent).toBe('Role 2')

    await customState!.refresh()
    await frame()
    expect(calls).toHaveLength(3)

    presentation.value = 'table'
    await frame()
    expect(calls).toHaveLength(3)
    expect(host.querySelector('table')).not.toBeNull()
  })
})
