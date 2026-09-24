/**
 * Shared plumbing for the three cores: the `data` XOR `load` rule and the
 * cache identity a core uses when no resource supplied a namespace.
 *
 * Cores stay resource-agnostic: no router, no permission store, no CRUD
 * operation names.
 */
import { getCurrentInstance } from 'vue'
import type { QueryKey, QueryNamespace, QueryValues, RecordIdentity } from '../../contracts'
import { collectionKey, recordKey } from '../../query'

export function assertSingleDataSource(component: string, data: unknown, load: unknown, dataShape: 'collection' | 'record' = 'collection'): void {
  const supplied = getCurrentInstance()?.vnode.props ?? {}
  const hasData = Object.hasOwn(supplied, 'data') || data !== undefined
  const hasLoad = Object.hasOwn(supplied, 'load') || load !== undefined
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

export function collectionCacheKey(resource: string, namespace: QueryNamespace | undefined, query: QueryValues, searchParameters: QueryValues): QueryKey {
  return collectionKey({ resource, namespace, query, searchParameters })
}

export function recordCacheKey(resource: string, id: RecordIdentity | undefined, variant: 'display' | 'form', namespace: QueryNamespace | undefined, searchParameters: QueryValues): QueryKey {
  return recordKey({ resource, id: id ?? null, variant, namespace, searchParameters })
}
