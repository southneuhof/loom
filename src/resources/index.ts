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
  ResourceRoutePermission,
  ResourceRouteParams,
  ResourceStaticRoute,
  ResourceUpdateDeclaration,
  ResourceVisibility,
} from './operations'
export { evaluateResourceRouteAccess, resetResourceActionRegistry } from './routeAccess'
export type { RegisteredResourceRouteRequirement } from './routeAccess'

export { registerResourceRuntime, resetResourceRuntimeForTests, useResourceRuntime } from './runtime'
export type { ResourceRuntime } from './runtime'
