/**
 * Internal cache runtime.
 *
 * TanStack Query is an implementation detail: it is installed by the framework
 * plugin, one client per Vue application, and never surfaces through public
 * component or resource APIs.
 */
import { inject, type InjectionKey } from 'vue'
import { CancelledError, isCancelledError, QueryClient, useQueryClient } from '@tanstack/vue-query'
import { defaultQueryRuntimeDefaults, type QueryRuntimeDefaults } from '../adapters/projectAdapters'
import { selectResourceQueries } from './feedback'
import { recordKey, isSameKey, resourceOptionsKeyPrefix } from './keys'
import type { QueryKey, RecordIdentity } from '../contracts'

export const frameworkQueryClientKey: InjectionKey<QueryClient> = Symbol.for('loom-query-client')

export function createFrameworkQueryClient(defaults: QueryRuntimeDefaults = defaultQueryRuntimeDefaults): QueryClient {
  const resolved = { ...defaultQueryRuntimeDefaults, ...defaults }
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: resolved.staleTime,
        retry: resolved.retry,
        refetchOnWindowFocus: resolved.refetchOnWindowFocus,
      },
    },
  })
}

export function useFrameworkQueryClient(): QueryClient {
  const client = inject(frameworkQueryClientKey, null)
  if (client) return client
  return useQueryClient()
}

export interface ResourceInvalidation {
  resource: string
  id?: RecordIdentity
  outcome?: 'refresh' | 'removed'
}

export async function invalidateResourceOptions(client: QueryClient, resource: string): Promise<void> {
  await client.invalidateQueries({ queryKey: resourceOptionsKeyPrefix(resource) }, { throwOnError: true })
}

export async function invalidateResourceData(client: QueryClient, { resource, id, outcome = 'refresh' }: ResourceInvalidation): Promise<void> {
  const selection = selectResourceQueries(client, resource, id)
  const retires = (key: QueryKey): boolean => outcome === 'removed'
    && id !== undefined
    && isSameKey(key, recordKey({ resource, id, variant: 'display' }).slice(0, 4))
  const retiredQueries = new Set(selection.groups.filter((group) => retires(group.key)).flatMap((group) => group.queries))
  const activeQueries = new Map(selection.queries
    .filter((query) => !retiredQueries.has(query))
    .filter((query) => query.isActive() && !query.isStatic())
    .map((query) => [query, query.state.dataUpdateCount]))
  const invalidations = selection.groups.flatMap((group) => {
    const refetchType = retires(group.key) ? 'none' as const : 'active' as const
    return group.queries.length > 0
      ? group.queries.map((query) => client.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType }, { throwOnError: true }))
      : [client.invalidateQueries({ queryKey: group.key, refetchType }, { throwOnError: true })]
  })
  const results = await Promise.allSettled(invalidations)
  const errors = results.flatMap((result) => result.status === 'rejected' ? [result.reason] : [])
  const failedRead = errors.findIndex((error) => !isCancelledError(error))
  if (failedRead >= 0) throw errors[failedRead]
  const canceledRead = errors.some(isCancelledError)
    || [...activeQueries].some(([query, dataUpdateCount]) => query.state.dataUpdateCount === dataUpdateCount)
  if (canceledRead) throw new CancelledError()
}
