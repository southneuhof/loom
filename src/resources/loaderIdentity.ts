import type { RecordIdentity } from '../contracts/load'

export type ResourceLoaderOperation = 'list' | 'create' | 'detail' | 'update'
export type ResourceLoaderFamily = 'collection' | 'options' | 'record' | 'form'

export interface ResourceLoaderIdentity {
  readonly resource: string
  readonly operation: ResourceLoaderOperation
  readonly family: ResourceLoaderFamily
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

export function resourceLoaderParameters(
  source: unknown,
  explicit: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
  const identity = resourceLoaderIdentity(source)
  return { ...(identity?.searchParameters ?? {}), ...(explicit ?? {}) }
}
