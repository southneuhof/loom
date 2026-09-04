import type { WebResourceSchemaBoundary } from '../contracts'

/** Keep the schema value exact; validation and transport behavior stay outside this builder. */
export function defineSchema<const TSchema extends WebResourceSchemaBoundary>(schema: TSchema): TSchema
export function defineSchema(schema: WebResourceSchemaBoundary): WebResourceSchemaBoundary {
  return schema
}
