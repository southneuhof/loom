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
import {
  frameworkFieldDefaultsKey,
  resolveFrameworkFieldDefaults,
  type ResolvedFrameworkFieldDefaults,
} from '../fields/defaults'
import type { InputPropsRegistry } from '../renderers/inputProps'
import { inputPropsRegistryKey } from '../renderers/inputProps'

export interface ResourceRuntime {
  adapters: ResolvedFrameworkAdapters
  queryClient: QueryClient
  fieldDefaults: ResolvedFrameworkFieldDefaults
  inputProps?: InputPropsRegistry
}

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
    const fieldDefaults = inject(frameworkFieldDefaultsKey, null)
    const inputProps = inject(inputPropsRegistryKey, null)
    if (adapters && queryClient && fieldDefaults) return { adapters, queryClient, fieldDefaults, inputProps: inputProps ?? undefined }
  }
  if (installed) return installed
  return {
    adapters: resolveFrameworkAdapters(),
    queryClient: createFrameworkQueryClient(),
    fieldDefaults: resolveFrameworkFieldDefaults(),
  }
}
