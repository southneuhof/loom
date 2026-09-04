/**
 * UI access contracts. Backend authorization stays authoritative; these only
 * decide whether a resource action is presented.
 *
 * A resource action renders when the resource operation exists, a matching
 * route exists, the user is allowed, and the resource policy allows it.
 * Denied actions disappear.
 */

export type ResourceOperation = 'list' | 'detail' | 'create' | 'update' | 'delete'

export interface AccessRequest<TRecord = Record<string, unknown>> {
  operation: ResourceOperation
  /** Permission identity owned by the resource, e.g. `roles.update`. */
  permission?: string
  record?: TRecord
}

export interface AccessAdapter {
  allows: (request: AccessRequest) => boolean
}

/** Stable resource-level visibility policy, evaluated after the adapter. */
export type AccessPolicy<TRecord = Record<string, unknown>> = (request: AccessRequest<TRecord>) => boolean
