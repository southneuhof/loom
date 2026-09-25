export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function cloneEditable(value: unknown): unknown {
  if (value instanceof Date) return new Date(value.getTime())
  if (Array.isArray(value)) return value.map(cloneEditable)
  if (!isPlainRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneEditable(entry)]))
}

function freezeEditable(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeEditable))
  if (!isPlainRecord(value)) return value
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freezeEditable(entry)])))
}

export function snapshotEditable(value: unknown): unknown {
  return freezeEditable(cloneEditable(value))
}
