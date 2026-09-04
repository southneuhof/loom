import { defineActionResource, type ActionResource, type ActionResourceDefinition } from './actionResource'
import type { WebResourceSchemaBoundary } from '../contracts'

export function defineResource<
  const TSchema extends WebResourceSchemaBoundary,
  const TActions extends ActionResourceDefinition<TSchema>['actions'],
>(
  schema: TSchema,
  definition: { key: string; actions: TActions },
): ActionResource<TSchema, TActions> {
  return defineActionResource(schema, definition)
}
