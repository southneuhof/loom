import { bindResource } from './bindResource'
import { bindResourceRead } from './loaderIdentity'
import { invalidateResourceData } from '../query/client'
import { useResourceRuntime } from './runtime'
import type {
  LoadedResourceDefinition,
  LoadedResourceUpdatePage,
  ResourceRecordLoad,
  ResourceFormBag,
  FormBagShape,
  ResourceLoadedUpdateDeclaration,
  BoundCustomActions,
  BoundResource,
  IdentityRecord,
  ResourceBoundOperations,
  ResourceDefinitionGuard,
  ResourceDefinitionInput,
  ResourceExportSource,
  ResourceExportTableShape,
  ResourceExportDetailFactory,
  ResourceIdentityFunction,
  ResourceIdentityValue,
  ResourcePermissions,
  ResourceReadAction,
} from './operations'

type ReadResourceDefinition<TActions extends Record<string, ResourceReadAction>> = {
  key: string
  actions: TActions
  identity?: never
  list?: never
  create?: never
  detail?: never
  update?: never
  delete?: never
}

export function defineResource<const TKey extends string, const TActions extends Record<string, ResourceReadAction>>(
  definition: ReadResourceDefinition<TActions> & { key: TKey }
): { key: TKey; actions: TActions; invalidate: () => Promise<void> }

export function defineResource<
  const TIdentityFunction extends ResourceIdentityFunction,
  const TTable extends ResourceExportTableShape,
  const TDetailFactory extends ResourceExportDetailFactory<TIdentityFunction>,
  const TLoad extends ResourceRecordLoad,
  const TForm extends Omit<FormBagShape, 'load'> & { load?: never },
  const TDefinition extends Omit<ResourceDefinitionInput<TIdentityFunction>, 'update' | 'exports'>,
  TContext extends object = {},
>(definition: TDefinition & { identity: TIdentityFunction; update: ResourceLoadedUpdateDeclaration<TLoad, ResourceIdentityValue<TIdentityFunction>, TForm, TContext> } & ResourceDefinitionGuard<NoInfer<TDefinition>, TIdentityFunction> & ResourceExportSource<TTable, TIdentityFunction, TDetailFactory>):
  Omit<BoundResource<ResourceIdentityValue<TIdentityFunction>, TDefinition['key'], ResourcePermissions<TDefinition>, TDefinition extends { actions: infer TActions } ? BoundCustomActions<TActions, ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>> : Record<never, never>, ResourceBoundOperations<TDefinition, TIdentityFunction>>, 'update'> & {
    update: (binding: { id: ResourceIdentityValue<TIdentityFunction>; searchParameters?: Record<string, unknown> } & (keyof TContext extends never ? { context?: TContext } : { context: TContext })) => LoadedResourceUpdatePage<TForm, ResourceIdentityValue<TIdentityFunction>>
  }


export function defineResource<const TIdentityFunction extends ResourceIdentityFunction, const TTable extends ResourceExportTableShape, const TDetailFactory extends ResourceExportDetailFactory<TIdentityFunction>, const TDefinition extends Omit<ResourceDefinitionInput<TIdentityFunction>, 'exports'>>(
  definition: TDefinition & { identity: TIdentityFunction } & ResourceDefinitionGuard<NoInfer<TDefinition>, TIdentityFunction> & ResourceExportSource<TTable, TIdentityFunction, TDetailFactory>
): BoundResource<
  ResourceIdentityValue<TIdentityFunction>,
  TDefinition['key'],
  ResourcePermissions<TDefinition>,
  TDefinition extends { actions: infer TActions } ? BoundCustomActions<TActions, ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>> : Record<never, never>,
  ResourceBoundOperations<TDefinition, TIdentityFunction>
>

export function defineResource<const TIdentityFunction extends ResourceIdentityFunction, const TDefinition extends ResourceDefinitionInput<TIdentityFunction>>(
  definition: TDefinition | LoadedResourceDefinition<TIdentityFunction, ResourceRecordLoad, ResourceFormBag> | ReadResourceDefinition<Record<string, ResourceReadAction>>
) {
  if (typeof definition.identity === 'function') return bindResource<TIdentityFunction, TDefinition | LoadedResourceDefinition<TIdentityFunction, ResourceRecordLoad, ResourceFormBag>>(definition as TDefinition | LoadedResourceDefinition<TIdentityFunction, ResourceRecordLoad, ResourceFormBag>)
  const resourceKey = definition.key
  if (typeof resourceKey !== 'string' || resourceKey.length === 0) throw new Error('[loom][RESOURCE_IDENTITY_INVALID] Resource key must be a nonempty string.')
  for (const key of Object.keys(definition)) {
    if (key !== 'key' && key !== 'actions') throw new Error(`[loom][SURFACE_OPTION_INVALID] Read resource member "${key}" is not supported.`)
  }
  if (!definition.actions || typeof definition.actions !== 'object' || Array.isArray(definition.actions)) {
    throw new Error('[loom][SURFACE_OPTION_INVALID] Read resource actions must be an object.')
  }
  const actions = Object.fromEntries(
    Object.entries(definition.actions).map(([operation, action]) => {
      if (typeof action !== 'function') throw new Error(`[loom][SURFACE_OPTION_INVALID] Read resource action "${operation}" must be callable.`)
      return [operation, bindResourceRead(resourceKey, operation, action)]
    })
  )
  return {
    key: resourceKey,
    actions,
    invalidate: async () => invalidateResourceData(useResourceRuntime().queryClient, { resource: resourceKey }),
  }
}
