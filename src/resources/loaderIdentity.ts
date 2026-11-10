import { normalizeQueryFilters } from '../query/filters'
import type { RecordIdentity } from '../contracts/load'

export interface ResourceLoaderIdentity {
  readonly resource: string
  readonly operation: string
  readonly id?: RecordIdentity
  readonly searchParameters: Readonly<Record<string, unknown>>
}

const loaderIdentities = new WeakMap<Function, ResourceLoaderIdentity>()

export function associateResourceLoader<TLoader extends Function>(loader: TLoader, identity: ResourceLoaderIdentity): TLoader {
  loaderIdentities.set(loader, identity)
  return loader
}

export function resourceLoaderIdentity(source: unknown): ResourceLoaderIdentity | undefined {
  return typeof source === 'function' ? loaderIdentities.get(source) : undefined
}

export function resourceLoaderOwner(source: unknown, explicit: string | undefined, fallback: string): string {
  const identity = resourceLoaderIdentity(source)
  if (identity && explicit !== undefined && explicit !== identity.resource) {
    throw new Error(`[loom][RESOURCE_LOADER_OWNER_CONFLICT] Bound loader belongs to resource "${identity.resource}", not "${explicit}".`)
  }
  return identity?.resource ?? explicit ?? fallback
}

export function resourceLoaderParameters(source: unknown, explicit: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> {
  const identity = resourceLoaderIdentity(source)
  return normalizeQueryFilters({ ...(identity?.searchParameters ?? {}), ...(explicit ?? {}) })
}

export function bindResourceRead<TLoad extends (...args: never[]) => unknown>(resource: string, operation: string, load: TLoad): TLoad {
  const owner = resourceLoaderIdentity(load)
  if (owner && (owner.resource !== resource || owner.operation !== operation)) {
    throw new Error(`[loom][RESOURCE_LOADER_OWNER_CONFLICT] Action belongs to "${owner.resource}.${owner.operation}", not "${resource}.${operation}".`)
  }
  if (!owner) associateResourceLoader(load, { resource, operation, searchParameters: {} })
  return load
}
