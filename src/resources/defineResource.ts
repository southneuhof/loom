import { bindResource } from './bindResource'
import type {
  BoundCustomActions,
  BoundResource,
  IdentityRecord,
  ResourceBoundOperations,
  ResourceDefinitionGuard,
  ResourceDefinitionInput,
  ResourceIdentityFunction,
  ResourceIdentityValue,
  ResourcePermissions,
} from './operations'

export function defineResource<
  const TIdentityFunction extends ResourceIdentityFunction,
  const TDefinition extends ResourceDefinitionInput<TIdentityFunction>,
>(definition: TDefinition
  & { identity: TIdentityFunction }
  & ResourceDefinitionGuard<NoInfer<TDefinition>, TIdentityFunction>): BoundResource<
    ResourceIdentityValue<TIdentityFunction>,
    TDefinition['key'],
    ResourcePermissions<TDefinition>,
    TDefinition extends { actions: infer TActions }
      ? BoundCustomActions<TActions, ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>>
      : Record<never, never>,
    ResourceBoundOperations<TDefinition, TIdentityFunction>
  > {
  return bindResource(definition)
}
