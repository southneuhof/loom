import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { z } from 'zod'
import ListView from '../ListView.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import type { CollectionLoadContext, CollectionResult, CollectionSlotProps, TableProps } from '../../../contracts'
import type { ListViewActions } from '../ListView.vue'

type Role = { name: string }
type RoleQuery = { page?: number; limit?: number } & Record<string, unknown>

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
    const presentation = ref<'table' | 'custom'>('table')
    let customState: (CollectionSlotProps<Role, RoleQuery> & { actions?: ListViewActions<Role> }) | undefined
    const table: TableProps<Role, RoleQuery> = {
      namespace: 'browser-custom-list',
      schema: z.object({ name: z.string() }),
      columns: { name: { label: 'Name' } },
      query: { page: 1, limit: 10 },
      load: ({ query: currentQuery }: CollectionLoadContext<RoleQuery>): CollectionResult<Role> => {
        calls.push({ ...currentQuery })
        const page = Number(currentQuery.page ?? 1)
        return { data: [{ name: `Role ${page}` }], meta: { total: 2, totalPage: 2 } }
      },
    }

    const app = createApp({
      setup: () => () => {
        const slots = presentation.value === 'custom'
          ? {
              collection: (state: CollectionSlotProps<Role, RoleQuery> & { actions?: ListViewActions<Role> }) => {
                customState = state
                return h('p', { 'data-custom-record': '' }, String(state.records[0]?.name ?? ''))
              },
            }
          : undefined
        return h(
          ListView,
          {
            title: 'Roles',
            table,
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
