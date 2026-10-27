/**
 * Shared plumbing for the three cores: the `data` XOR `load` rule and the
 * cache identity a core uses when no resource supplied a namespace.
 *
 * Cores stay resource-agnostic: no router, no permission store, no CRUD
 * operation names.
 */
import { getCurrentInstance } from 'vue'
import type { QueryKey, QueryNamespace, QueryValues, RecordIdentity } from '../../contracts'
import { collectionKey, recordKey, stableValue } from '../../query'
import { resourceLoaderParameters, resourceLoaderIdentity } from '../../resources/loaderIdentity'

export function assertSingleDataSource(component: string, data: unknown, load: unknown, dataShape: 'collection' | 'record' = 'collection', supplied?: object): void {
  const hasData = data !== undefined || (supplied !== undefined && Object.hasOwn(supplied, 'data'))
  const hasLoad = load !== undefined || (supplied !== undefined && Object.hasOwn(supplied, 'load'))
  if (hasData === hasLoad) {
    throw new Error(`[loom][SURFACE_DATA_SOURCE_INVALID] ${component} requires exactly one of "data" or "load".`)
  }
  if (hasData && dataShape === 'collection' && !Array.isArray(data)) {
    throw new Error(`[loom][SURFACE_DATA_SOURCE_INVALID] ${component} "data" must be an array.`)
  }
  if (hasData && dataShape === 'record' && (typeof data !== 'object' || data === null || Array.isArray(data))) {
    throw new Error(`[loom][SURFACE_DATA_SOURCE_INVALID] ${component} "data" must be an object.`)
  }
  if (hasLoad && typeof load !== 'function') {
    throw new Error(`[loom][SURFACE_DATA_SOURCE_INVALID] ${component} "load" must be a function.`)
  }
}

/** Stable per-instance identity, used only when no namespace is supplied. */
export function instanceIdentity(fallback: string): string {
  const instance = getCurrentInstance()
  return instance ? `${fallback}-${instance.uid}` : fallback
}

export function collectionCacheKey(resource: string, namespace: QueryNamespace | undefined, query: QueryValues, searchParameters: QueryValues, load?: unknown): QueryKey {
  return collectionKey({ resource, namespace, query, searchParameters: resourceLoaderParameters(load, searchParameters) })
}

export function recordCacheKey(resource: string, id: RecordIdentity | undefined, variant: 'display' | 'form', namespace: QueryNamespace | undefined, searchParameters: QueryValues, load?: unknown): QueryKey {
  const identity = resourceLoaderIdentity(load)
  if (identity?.id !== undefined && id !== undefined && JSON.stringify(stableValue(identity.id)) !== JSON.stringify(stableValue(id))) {
    throw new Error('[loom][RESOURCE_LOADER_IDENTITY_CONFLICT] Bound loader has a different record identity.')
  }
  return recordKey({ resource, id: id ?? identity?.id ?? null, variant, namespace, searchParameters: resourceLoaderParameters(load, searchParameters) })
}
