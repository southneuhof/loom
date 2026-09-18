import type { RecordIdentity, RecordIdentityValue } from '../contracts'

function isScalarValue(value: unknown): value is RecordIdentityValue {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
}

/** Checks one resolved identity value; keeps `0` and `''` valid. */
export function isRecordIdentity(value: unknown): value is RecordIdentity {
  if (isScalarValue(value)) return true
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entries = Object.values(value)
  return entries.length > 0 && entries.every(isScalarValue)
}

function keyListOf(declaration: string | readonly string[]): readonly string[] {
  return typeof declaration === 'string' ? [declaration] : declaration
}

/**
 * Rejects empty and duplicate key-array declarations at construction.
 * Names the resource without record data.
 */
export function checkIdentityDeclaration(resourceKey: string, declaration: string | readonly string[] | ((record: never) => RecordIdentity) | undefined): void {
  if (typeof declaration === 'string' || declaration === undefined || typeof declaration === 'function') return
  const keys = keyListOf(declaration)
  if (keys.length === 0) throw new Error(`[loom] Resource "${resourceKey}" identity needs a nonempty key or key array.`)
  if (new Set(keys).size !== keys.length) throw new Error(`[loom] Resource "${resourceKey}" identity has a duplicate key.`)
}

/**
 * Checks one resolved identity before navigation, mutation, or keyed
 * invalidation. Names the resource and key or operation without record data.
 */
export function checkIdentityValue(resourceKey: string, keyOrOperation: string, value: unknown): asserts value is RecordIdentity {
  if (!isRecordIdentity(value)) throw new Error(`[loom] Resource "${resourceKey}" identity "${keyOrOperation}" is malformed.`)
}
