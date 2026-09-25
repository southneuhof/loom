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

export function checkIdentityValue(resourceKey: string, keyOrOperation: string, value: unknown): asserts value is RecordIdentity {
  if (!isRecordIdentity(value)) throw new Error(`[loom] Resource "${resourceKey}" identity "${keyOrOperation}" is malformed.`)
}
