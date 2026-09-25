export { defineResource } from './defineResource'
export { isStandardRowOperation } from './operations'
export type {
  BoundResource,
  ResourceBinding,
  ResourceCreateDeclaration,
  ResourceCustomCommand,
  ResourceCustomContext,
  ResourceCustomHandle,
  ResourceCustomPermission,
  ResourceDeleteDeclaration,
  ResourceDetailDeclaration,
  ResourceIdentityFunction,
  ResourceIdentityValue,
  ResourceListDeclaration,
  ResourceRoute,
  ResourceRouteParams,
  ResourceStaticRoute,
  ResourceUpdateDeclaration,
  ResourceVisibility,
} from './operations'
export { resourceActionForRoute, registeredResourceActionNames, resetResourceActionRegistry } from './routeAccess'
export type { RegisteredResourceAction } from './routeAccess'

export { registerResourceRuntime, resetResourceRuntimeForTests, useResourceRuntime } from './runtime'
export type { ResourceRuntime } from './runtime'
