import { parse } from '@southneuhof/utilities/parse'
import type { ResolvedSurfaceField } from './resolve'

/** Reads one field value and applies its configured display formatter. */
export function displayValue(
  record: Record<string, unknown>,
  field: ResolvedSurfaceField,
): unknown {
  const value = field.read ? field.read(record, {}) : record[field.key]
  return field.format ? parse(field.format, value) : value
}
