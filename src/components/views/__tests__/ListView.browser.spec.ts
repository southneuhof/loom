import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { z } from 'zod'
import ListView from '../ListView.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import type { CollectionLoadContext, CollectionResult, CollectionSlotProps, QueryLocationAdapter, QueryValues, TableProps } from '../../../contracts'
import type { ListViewActions } from '../../../contracts/views'

type Role = { name: string }
type RoleQuery = { page?: number; limit?: number } & Record<string, unknown>

const apps: Array<ReturnType<typeof createApp>> = []

async function frame(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
  }
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
    const initialQuery = { page: 1, limit: 10 }
    const query = ref<RoleQuery>({ ...initialQuery })
    const updates: QueryValues[] = []
    let customState: (CollectionSlotProps<Role, RoleQuery> & { actions?: ListViewActions<Role> }) | undefined
    const table: TableProps<Role, RoleQuery> = {
      namespace: 'browser-custom-list',
      schema: z.object({ name: z.string() }),
      columns: { name: { label: 'Name' } },
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
                return h('div', [
                  h('p', { 'data-custom-record': '' }, String(state.records[0]?.name ?? '')),
                  h('button', { 'data-next-page': '', onClick: () => state.updateQuery({ page: 2 }) }, 'Next page'),
                ])
              },
            }
          : undefined
        return h(
          ListView,
          {
            title: 'Roles',
            table: { ...table, query: query.value },
            'onUpdate:query': (values: QueryValues) => {
              updates.push(values)
              query.value = { ...values }
            },
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

    host.querySelector<HTMLButtonElement>('[data-next-page]')!.click()
    await frame()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ page: 2, limit: 10 })
    expect(updates).toEqual([{ page: 2, limit: 10 }])
    expect(initialQuery).toEqual({ page: 1, limit: 10 })
    expect(query.value).toEqual({ page: 2, limit: 10 })
    expect(host.querySelector('[data-custom-record]')?.textContent).toBe('Role 2')

    await customState!.refresh()
    await frame()
    expect(calls).toHaveLength(3)
    expect(updates).toHaveLength(1)

    presentation.value = 'table'
    await frame()
    expect(calls).toHaveLength(3)
    expect(host.querySelector('table')).not.toBeNull()
  })

  it('keeps query ownership across namespace and controlled mode changes', async () => {
    const values = new Map<string, QueryValues>([
      ['roles-primary', { page: 2, limit: 10, search: 'primary' }],
      ['roles-archive', { page: 4, limit: 10, search: 'archive' }],
    ])
    const listeners = new Map<string, Set<(query: QueryValues) => void>>()
    const writes: Array<{ namespace: string; query: QueryValues }> = []
    const restore = (namespace: string, query: QueryValues) => {
      values.set(namespace, { ...query })
      listeners.get(namespace)?.forEach((listener) => listener({ ...query }))
    }
    const queryAdapter: QueryLocationAdapter = {
      read: (namespace) => ({ ...(values.get(namespace) ?? {}) }),
      write: (namespace, query) => {
        values.set(namespace, { ...query })
        writes.push({ namespace, query: { ...query } })
        listeners.get(namespace)?.forEach((listener) => listener({ ...query }))
      },
      watch: (namespace, listener) => {
        const group = listeners.get(namespace) ?? new Set()
        group.add(listener)
        listeners.set(namespace, group)
        return () => group.delete(listener)
      },
    }
    const namespace = ref('roles-primary')
    const controlled = ref(false)
    const parentQuery = ref<RoleQuery>({ page: 8, limit: 10, search: 'controlled' })
    const updates: QueryValues[] = []
    const loads: QueryValues[] = []
    let collectionState: CollectionSlotProps<Role, RoleQuery> | undefined
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => {
        const table: TableProps<Role, RoleQuery> = {
          namespace: namespace.value,
          schema: z.object({ name: z.string() }),
          columns: { name: { label: 'Name' } },
          load: ({ query }: CollectionLoadContext<RoleQuery>) => {
            loads.push({ ...query })
            return { data: [{ name: `Role ${query.page}` }] }
          },
        }
        if (controlled.value) table.query = parentQuery.value
        return h(ListView, {
          title: 'Roles',
          table,
          'onUpdate:query': (query: QueryValues) => {
            updates.push(query)
            if (controlled.value) parentQuery.value = { ...query }
          },
        }, {
          collection: (state: CollectionSlotProps<Role, RoleQuery>) => {
            collectionState = state
            return h('div', [
              h('p', { 'data-query-page': '' }, String(state.query.page)),
              h('button', { 'data-increment-page': '', onClick: () => state.updateQuery({ page: Number(state.query.page) + 1 }) }, 'Next page'),
            ])
          },
        })
      },
    }))
    app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] }))
    app.use(FrameworkPlugin, {
      adapters: { query: queryAdapter },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.mount(host)
    apps.push(app)

    await frame()
    expect(loads).toHaveLength(1)
    expect(loads[0]).toMatchObject({ page: 2, search: 'primary' })
    host.querySelector<HTMLButtonElement>('[data-increment-page]')!.click()
    await frame()
    expect(loads).toHaveLength(2)
    expect(loads[1]).toMatchObject({ page: 3, search: 'primary' })
    expect(writes).toEqual([{ namespace: 'roles-primary', query: { page: 3, limit: 10, search: 'primary' } }])
    expect(updates).toEqual([{ page: 3, limit: 10, search: 'primary' }])

    namespace.value = 'roles-archive'
    await frame()
    expect(loads).toHaveLength(3)
    expect(loads[2]).toMatchObject({ page: 4, search: 'archive' })
    expect(collectionState?.query.page).toBe(4)

    host.querySelector<HTMLButtonElement>('[data-increment-page]')!.click()
    await frame()
    expect(loads).toHaveLength(4)
    expect(loads[3]).toMatchObject({ page: 5, search: 'archive' })
    expect(writes.at(-1)).toEqual({ namespace: 'roles-archive', query: { page: 5, limit: 10, search: 'archive' } })

    controlled.value = true
    await frame()
    expect(loads).toHaveLength(5)
    expect(loads[4]).toMatchObject({ page: 8, search: 'controlled' })
    host.querySelector<HTMLButtonElement>('[data-increment-page]')!.click()
    await frame()
    expect(loads).toHaveLength(6)
    expect(loads[5]).toMatchObject({ page: 9, search: 'controlled' })
    expect(parentQuery.value).toMatchObject({ page: 9, search: 'controlled' })
    expect(writes).toHaveLength(2)
    expect(updates.at(-1)).toEqual({ page: 9, limit: 10, search: 'controlled' })

    controlled.value = false
    await frame()
    expect(loads).toHaveLength(7)
    expect(loads[6]).toMatchObject({ page: 5, search: 'archive' })
    expect(updates).toHaveLength(3)

    restore('roles-archive', { page: 6, limit: 10, search: 'back' })
    await frame()
    expect(loads).toHaveLength(8)
    expect(loads[7]).toMatchObject({ page: 6, search: 'back' })
    expect(updates.at(-1)).toEqual({ page: 6, limit: 10, search: 'back' })
    expect(writes).toHaveLength(2)
    expect(host.querySelector<HTMLInputElement>('header input')?.value).toBe('back')
  })
})
