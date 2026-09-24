export interface RegisteredResourceAction {
  resourceKey: string
  action: string
  permission: string | null
  permissions?: readonly string[]
}

const actionsByRoute = new Map<string, RegisteredResourceAction>()

export function registerResourceAction(routeName: string, action: RegisteredResourceAction): void {
  const existing = actionsByRoute.get(routeName)
  if (!existing) {
    actionsByRoute.set(routeName, action)
    return
  }
  if (existing.action === action.action && existing.permission === action.permission && samePermissions(existing.permissions, action.permissions)) {
    actionsByRoute.set(routeName, action)
    return
  }
  throw new Error(`[loom] Route action conflict for "${routeName}".`)
}

function samePermissions(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  return left === undefined || right === undefined
    ? left === right
    : left.length === right.length && left.every((permission, index) => permission === right[index])
}

export function resourceActionForRoute(routeName: string): RegisteredResourceAction | undefined {
  return actionsByRoute.get(routeName)
}

/** Every route name a resource action registered under, for boundary checks. */
export function registeredResourceActionNames(): string[] {
  return [...actionsByRoute.keys()]
}

export function resetResourceActionRegistry(): void {
  actionsByRoute.clear()
}
