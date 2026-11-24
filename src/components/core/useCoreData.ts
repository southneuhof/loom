import { getCurrentInstance } from 'vue'
import type { RecordIdentity } from '../../contracts/load'
import type { QueryKey, QueryNamespace, QueryValues } from '../../contracts/query'
import { recordKey, stableValue } from '../../query/keys'
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

export function instanceIdentity(fallback: string): string {
  const instance = getCurrentInstance()
  return instance ? `${fallback}-${instance.uid}` : fallback
}

export function recordCacheKey(resource: string, id: RecordIdentity | undefined, variant: 'display' | 'form', namespace: QueryNamespace | undefined, searchParameters: QueryValues, load?: unknown): QueryKey {
  const identity = resourceLoaderIdentity(load)
  if (identity?.id !== undefined && id !== undefined && JSON.stringify(stableValue(identity.id)) !== JSON.stringify(stableValue(id))) {
    throw new Error('[loom][RESOURCE_LOADER_IDENTITY_CONFLICT] Bound loader has a different record identity.')
  }
  return recordKey({ resource, id: id ?? identity?.id ?? null, variant, namespace, searchParameters: resourceLoaderParameters(load, searchParameters) })
}
