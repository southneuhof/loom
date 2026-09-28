import type { AccessAdapter } from '../contracts'

export interface RegisteredResourceRouteRequirement {
  readonly resourceKey: string
  readonly operation: string
  readonly permissions: readonly string[]
}

const requirementsByRoute = new Map<string, RegisteredResourceRouteRequirement>()

export function registerResourceRouteRequirement(routeName: string, requirement: RegisteredResourceRouteRequirement): void {
  const permissions = [...new Set(requirement.permissions)]
  if (permissions.some((permission) => typeof permission !== 'string' || permission.length === 0)) {
    throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${requirement.resourceKey}" operation "${requirement.operation}" route permission codes must be nonempty strings.`)
  }
  permissions.sort()
  const registered = Object.freeze({
    resourceKey: requirement.resourceKey,
    operation: requirement.operation,
    permissions: Object.freeze(permissions),
  })
  const existing = requirementsByRoute.get(routeName)
  if (!existing) {
    requirementsByRoute.set(routeName, registered)
    return
  }
  if (existing.resourceKey === registered.resourceKey && existing.operation === registered.operation && samePermissions(existing.permissions, registered.permissions)) return
  throw new Error(`[loom] Route action conflict for "${routeName}".`)
}

function samePermissions(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((permission, index) => permission === right[index])
}

export function evaluateResourceRouteAccess(routeName: string, access: AccessAdapter): boolean | undefined {
  const requirement = requirementsByRoute.get(routeName)
  if (!requirement) return undefined
  const permissions: readonly (string | null)[] = requirement.permissions.length ? requirement.permissions : [null]
  const decisions = permissions.map((permission) => access.allows({ operation: requirement.operation, permission }))
  return decisions.every(Boolean)
}

export function resetResourceActionRegistry(): void {
  requirementsByRoute.clear()
}
