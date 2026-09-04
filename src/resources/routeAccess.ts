export interface RegisteredResourceAction {
  resourceKey: string
  action: string
  permission: string | null
}

const actionsByRoute = new Map<string, RegisteredResourceAction>()

export function registerResourceAction(routeName: string, action: RegisteredResourceAction): void {
  const existing = actionsByRoute.get(routeName)
  if (!existing) {
    actionsByRoute.set(routeName, action)
    return
  }
  if (existing.action === action.action && existing.permission === action.permission) {
    actionsByRoute.set(routeName, action)
    return
  }
  throw new Error(`[loom] Route action conflict for "${routeName}".`)
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
