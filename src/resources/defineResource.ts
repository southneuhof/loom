import { bindResource } from './bindResource'
import type { BoundResource, ResourceDefinitionGuard, ResourceDefinitionInput, ResourceIdentityFunction } from './operations'

export function defineResource<
  const TIdentityFunction extends ResourceIdentityFunction,
  const TDefinition extends ResourceDefinitionInput<ResourceIdentityFunction>,
>(definition: TDefinition
  & { identity: TIdentityFunction }
  & ResourceDefinitionInput<NoInfer<TIdentityFunction>>
  & ResourceDefinitionGuard<TDefinition, TIdentityFunction>): BoundResource<TDefinition, TIdentityFunction> {
  return bindResource(definition)
}
