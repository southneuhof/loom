import type { RecordIdentity } from '../contracts/load'
import type { QueryKey, QueryNamespace, QueryValues } from '../contracts/query'
import { normalizeQueryFilters } from './filters'

export const resourceKeyPrefix = 'resource'

/** Stable serialization: property order and absent values never change identity. */
export function stableValue(value: unknown): unknown {
  if (value === undefined || value === null) return null
  if (Array.isArray(value)) return value.map(stableValue)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue
      result[key] = stableValue(source[key])
    }
    return result
  }
  return value
}

export interface CollectionKeyInput {
  resource: string
  query?: QueryValues
  searchParameters?: QueryValues
  /** Distinguishes duplicate instances of one resource in a single view. */
  namespace?: QueryNamespace
}

export interface RecordKeyInput {
  resource: string
  id: RecordIdentity | null
  variant: 'display' | 'form'
  namespace?: QueryNamespace
  searchParameters?: QueryValues
}

export interface ResourceOptionsKeyInput {
  resource: string
  operation?: string
  query?: QueryValues
  namespace: QueryNamespace
  searchParameters?: QueryValues
}

export function resourceKey(resource: string): QueryKey {
  return [resourceKeyPrefix, resource]
}

export function collectionKeyPrefix(resource: string): QueryKey {
  return [...resourceKey(resource), 'list']
}

export function recordKeyPrefix(resource: string, id: RecordIdentity | null): QueryKey {
  return [...resourceKey(resource), 'detail', stableValue(id)]
}

export function resourceOptionsKeyPrefix(resource: string): QueryKey {
  return [...resourceKey(resource), 'options']
}

export function resourceOptionsKey({ resource, operation, namespace, query, searchParameters }: ResourceOptionsKeyInput): QueryKey {
  return [...resourceOptionsKeyPrefix(resource), operation ?? null, namespace, stableValue(normalizeQueryFilters({ ...searchParameters, ...query }))]
}

export function collectionKey({ resource, query, searchParameters, namespace }: CollectionKeyInput): QueryKey {
  return [
    ...collectionKeyPrefix(resource),
    namespace ?? null,
    stableValue(normalizeQueryFilters({ ...searchParameters, ...query })),
  ]
}

export function recordKey({ resource, id, variant, namespace, searchParameters }: RecordKeyInput): QueryKey {
  return [...recordKeyPrefix(resource, id), variant, namespace ?? null, stableValue(normalizeQueryFilters(searchParameters ?? {}))]
}

export function isSameKey(left: QueryKey, right: QueryKey): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
