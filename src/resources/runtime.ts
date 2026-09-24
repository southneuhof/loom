/**
 * Resource runtime access.
 *
 * Resource definitions are module constants, but the adapters, cache client,
 * and access policy belong to a Vue app. Inside a component the runtime comes
 * from injection; outside one — a custom workflow invalidating after an
 * `await`, for example — it comes from the last installed app.
 */
import { getCurrentInstance, inject } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import { frameworkAdaptersKey, resolveFrameworkAdapters, type ResolvedFrameworkAdapters } from '../adapters/projectAdapters'
import { createFrameworkQueryClient, frameworkQueryClientKey } from '../query/client'

export interface ResourceRuntime {
  adapters: ResolvedFrameworkAdapters
  queryClient: QueryClient
}

export type ResourceOperationRuntime = Pick<ResourceRuntime, 'adapters' | 'queryClient'>

let installed: ResourceRuntime | undefined

export function registerResourceRuntime(runtime: ResourceRuntime): void {
  installed = runtime
}

export function resetResourceRuntimeForTests(): void {
  installed = undefined
}

export function useResourceRuntime(): ResourceRuntime {
  if (getCurrentInstance()) {
    const adapters = inject(frameworkAdaptersKey, null)
    const queryClient = inject(frameworkQueryClientKey, null)
    if (adapters && queryClient) return { adapters, queryClient }
  }
  if (installed) return installed
  return {
    adapters: resolveFrameworkAdapters(),
    queryClient: createFrameworkQueryClient(),
  }
}

export function useResourceOperationRuntime(): ResourceOperationRuntime {
  return useResourceRuntime()
}
