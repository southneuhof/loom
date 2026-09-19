/**
 * UI access contracts. Backend authorization stays authoritative; these only
 * decide whether a resource action is presented.
 *
 * A resource action renders when the resource operation exists, a matching
 * route exists, the user is allowed, and the resource policy allows it.
 * Denied actions disappear.
 */

export type ResourceOperation = 'list' | 'detail' | 'create' | 'update' | 'delete'

/**
 * Standard operations scoped to one record. Derived from ResourceOperation
 * minus the collection ops, so a future standard action gains row semantics
 * without a new fixed list.
 */
export type StandardRowOperation = Exclude<ResourceOperation, 'list' | 'create'>

/** Custom action names travel with their resource key; server auth stays final. */
export type ResourceCustomOperation = string & {}

/** Any resource operation the adapter can check: standard or custom action. */
export type ResourceAccessOperation = ResourceOperation | ResourceCustomOperation

export interface AccessRequest<TRecord = Record<string, unknown>> {
  operation: ResourceAccessOperation
  /** Permission identity owned by the resource, e.g. `roles.update`. */
  permission?: string
  record?: TRecord
}

export interface AccessAdapter {
  allows: (request: AccessRequest) => boolean
}

/** Stable resource-level visibility policy, evaluated after the adapter. */
export type AccessPolicy<TRecord = Record<string, unknown>> = (request: AccessRequest<TRecord>) => boolean
