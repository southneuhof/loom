/**
 * Default and exceptional field access.
 *
 * Ordinary fields read by catalog key. Display projections cover computed or
 * nested display values; form writers are resolved only by Form on submit.
 * Accessors are pure: no navigation, no network, no reads outside arguments.
 */
import type { FieldContext, FieldDefinition } from '../contracts'
import type { ResolvedSurfaceField } from './resolve'

export function readField<TRecord extends object>(
  record: TRecord | undefined | null,
  key: string,
  field: Pick<FieldDefinition<TRecord>, 'display'> | undefined,
  context: FieldContext = {},
): unknown {
  if (record === undefined || record === null) return undefined
  if (field?.display?.read) return field.display.read(record, context)
  return record[key]
}

/** Reads every field of a record into a flat, renderer-ready value map. */
export function readFields<TRecord extends object>(
  record: TRecord | undefined | null,
  fields: readonly ResolvedSurfaceField<TRecord>[],
  context: FieldContext = {},
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) values[field.key] = record && field.read ? field.read(record, context) : record?.[field.key]
  return values
}
