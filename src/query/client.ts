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
import type { RecordIdentity } from '../contracts'

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
}

export async function invalidateResourceData(client: QueryClient, { resource, id }: ResourceInvalidation): Promise<void> {
  const selection = selectResourceQueries(client, resource, id)
  const queries = selection.queries
  const activeQueries = new Map(queries
    .filter((query) => query.isActive() && !query.isStatic())
    .map((query) => [query, query.state.dataUpdateCount]))
  const invalidations = selection.groups.flatMap((group) => group.queries.length > 0
    ? group.queries.map((query) => client.invalidateQueries({ queryKey: query.queryKey, exact: true }, { throwOnError: true }))
    : [client.invalidateQueries({ queryKey: group.key }, { throwOnError: true })])
  const results = await Promise.allSettled(invalidations)
  const errors = results.flatMap((result) => result.status === 'rejected' ? [result.reason] : [])
  const failedRead = errors.findIndex((error) => !isCancelledError(error))
  if (failedRead >= 0) throw errors[failedRead]
  const canceledRead = errors.some(isCancelledError)
    || [...activeQueries].some(([query, dataUpdateCount]) => query.state.dataUpdateCount === dataUpdateCount)
  if (canceledRead) throw new CancelledError()
}
