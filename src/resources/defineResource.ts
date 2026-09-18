import { defineActionResource, type ActionResource, type ActionResourceDefinition, type CheckedDefinition } from './actionResource'
import type {
  CheckedSchemaIdentity,
  WebResourceCreateOf,
  WebResourceIdentityOf,
  WebResourceQueryOf,
  WebResourceRecordOf,
  WebResourceSchemaBoundary,
  WebResourceUpdateOf,
} from '../contracts'
import type { RouteMap } from 'vue-router'

type InvalidRouteParameterKeys<TAction> = TAction extends { route: { name: infer TName; params: infer TParams } }
  ? TName extends keyof RouteMap
    ? Exclude<keyof (TParams extends (...args: any[]) => infer TResult ? TResult : TParams), keyof RouteMap[TName]['paramsRaw']>
    : never
  : never

type InvalidResourceRouteParameterKeys<TActions> = {
  [Key in keyof TActions]: InvalidRouteParameterKeys<TActions[Key]>
}[keyof TActions]

type SchemaIdentityInput<TSchema> = TSchema extends { identity?: infer TDeclaration } ? TDeclaration : undefined

export function defineResource<const TSchema extends WebResourceSchemaBoundary, const TActions extends ActionResourceDefinition<TSchema>['actions'], const TDefinition extends { key: string; actions: TActions }>(
  schema: TSchema & CheckedSchemaIdentity<WebResourceRecordOf<TSchema>, SchemaIdentityInput<TSchema>>,
  definition: TDefinition &
    { actions: TActions } &
    CheckedDefinition<
      WebResourceRecordOf<TSchema>,
      WebResourceQueryOf<TSchema>,
      WebResourceCreateOf<TSchema>,
      WebResourceUpdateOf<TSchema>,
      WebResourceIdentityOf<TSchema>,
      TSchema,
      NoInfer<TActions>
    > &
    { [TKey in Exclude<Extract<keyof TDefinition, string>, 'key' | 'actions'>]: never } & (
      InvalidResourceRouteParameterKeys<NoInfer<TActions>> extends never
        ? unknown
        : { readonly __invalidResourceRouteParameters__: never }
    ),
): ActionResource<TSchema, TActions> {
  return defineActionResource(schema, definition)
}
