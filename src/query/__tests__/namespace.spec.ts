import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { coerceQueryValues, useNamespacedQuery } from '../namespace'
import type { QueryLocationAdapter, QueryValues } from '../../contracts'
import { flush, withApp } from './harness'

/** Stands in for the application's router-backed adapter, dotted keys included. */
function createUrlAdapter(initial: Record<string, string> = {}) {
  const url = new Map(Object.entries(initial))
  const listeners = new Set<{ namespace: string; onChange: (values: QueryValues) => void }>()
  const history: Record<string, string>[] = [Object.fromEntries(url)]

  const readNamespace = (namespace: string): QueryValues => {
    const values: QueryValues = {}
    for (const [key, value] of url) {
      if (!key.startsWith(`${namespace}.`)) continue
      values[key.slice(namespace.length + 1)] = value
    }
    return values
  }

  const notify = () => {
    for (const listener of listeners) listener.onChange(readNamespace(listener.namespace))
  }

  const adapter: QueryLocationAdapter = {
    read: readNamespace,
    write: (namespace, values) => {
      for (const key of [...url.keys()]) {
        if (key.startsWith(`${namespace}.`)) url.delete(key)
      }
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === null || value === '') continue
        url.set(`${namespace}.${key}`, String(value))
      }
      history.push(Object.fromEntries(url))
      notify()
    },
    watch: (namespace, onChange) => {
      const listener = { namespace, onChange }
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  return {
    adapter,
    entries: () => Object.fromEntries(url),
    writes: () => history.length - 1,
    /** Simulates browser back/forward and unrelated external navigation. */
    restore: (entry: Record<string, string>) => {
      url.clear()
      for (const [key, value] of Object.entries(entry)) url.set(key, value)
      notify()
    },
    history,
  }
}

describe('namespaced query ownership', () => {
  it('works with no explicit binding and derives values from defaults', () => {
    const location = createUrlAdapter()
    const { result, app } = withApp(() => useNamespacedQuery({ namespace: 'roles', defaults: { page: 1, limit: 10 } }), {
      adapters: { query: location.adapter },
    })

    expect(result.values.value).toEqual({ page: 1, limit: 10 })

    result.update({ page: 2 })

    expect(result.values.value.page).toBe(2)
    expect(location.entries()).toEqual({ 'roles.page': '2', 'roles.limit': '10' })
    app.unmount()
  })

  it('keeps two different resources independent in one route', () => {
    const location = createUrlAdapter()
    const { result, app } = withApp(
      () => ({
        actions: useNamespacedQuery({ namespace: 'incident-actions', defaults: { page: 1 } }),
        victims: useNamespacedQuery({ namespace: 'incident-victims', defaults: { page: 1 } }),
      }),
      { adapters: { query: location.adapter } },
    )

    result.actions.update({ page: 2 })

    expect(location.entries()).toEqual({ 'incident-actions.page': '2' })
    expect(result.victims.values.value.page).toBe(1)
    app.unmount()
  })

  it('separates duplicate instances of one resource through an explicit namespace', () => {
    const location = createUrlAdapter()
    const { result, app } = withApp(
      () => ({
        assignees: useNamespacedQuery({ namespace: 'users', defaults: { page: 1 } }),
        archived: useNamespacedQuery({ namespace: 'archived', defaults: { page: 1 } }),
      }),
      { adapters: { query: location.adapter } },
    )

    result.archived.update({ page: 5 })

    expect(result.assignees.values.value.page).toBe(1)
    expect(location.entries()['archived.page']).toBe('5')
    app.unmount()
  })

  it('restores state on back/forward navigation', () => {
    const location = createUrlAdapter({ 'roles.page': '3' })
    const { result, app } = withApp(() => useNamespacedQuery({ namespace: 'roles', defaults: { page: 1 } }), {
      adapters: { query: location.adapter },
    })

    expect(result.values.value.page).toBe(3)

    result.update({ page: 4 })
    location.restore({ 'roles.page': '3' })

    expect(result.values.value.page).toBe(3)
    app.unmount()
  })

  it('preserves unrelated query parameters', () => {
    const location = createUrlAdapter({ tab: 'summary', 'roles.page': '2' })
    const { result, app } = withApp(() => useNamespacedQuery({ namespace: 'roles', defaults: { page: 1 } }), {
      adapters: { query: location.adapter },
    })

    result.update({ page: 3 })

    expect(location.entries().tab).toBe('summary')
    app.unmount()
  })

  it('repairs malformed values instead of throwing', () => {
    const location = createUrlAdapter({ 'roles.page': 'not-a-number', 'roles.active': 'true' })
    const { result, app } = withApp(
      () => useNamespacedQuery({ namespace: 'roles', defaults: { page: 1, active: false } }),
      { adapters: { query: location.adapter } },
    )

    expect(result.values.value).toEqual({ page: 1, active: true })
    app.unmount()
  })

  it('does not write the same state twice', async () => {
    const location = createUrlAdapter()
    const { result, app } = withApp(() => useNamespacedQuery({ namespace: 'roles', defaults: { page: 1 } }), {
      adapters: { query: location.adapter },
    })

    result.update({ page: 2 })
    const writes = location.writes()
    result.update({ page: 2 })
    await flush()

    expect(location.writes()).toBe(writes)
    app.unmount()
  })

  it('bypasses the URL for local query state', () => {
    const location = createUrlAdapter()
    const local = ref<QueryValues>({ page: 7 })
    const { result, app } = withApp(
      () => useNamespacedQuery({ namespace: 'roles', defaults: { page: 1 }, local }),
      { adapters: { query: location.adapter } },
    )

    result.update({ page: 8 })

    expect(local.value.page).toBe(8)
    expect(location.entries()).toEqual({})
    app.unmount()
  })

  it('coerces values against declared defaults', () => {
    expect(coerceQueryValues({ page: '2', tags: 'a' }, { page: 1, tags: [] as unknown[] })).toEqual({ page: 2, tags: ['a'] })
  })
})
