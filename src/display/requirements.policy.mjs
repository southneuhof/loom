const hasValue = value => value !== undefined && value !== null && value !== ''
const isStructuredKind = kind => kind === 'object' || kind === 'array'
const hasRead = value => typeof value === 'function' || value === true

export function displayRequirement(kind, field) {
  if (kind === 'date' && !hasValue(field.format)) return 'date-format'
  if (isStructuredKind(kind) && !(hasRead(field.read) || hasValue(field.renderer) || hasValue(field.format))) return 'text-or-renderer'
  return undefined
}

export function displayValueRequirement(value, field) {
  if (value instanceof Date) {
    if (!hasValue(field.format)) return 'date-format'
    if (!hasValue(field.renderer)) return 'text-or-renderer'
    return undefined
  }
  if (value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value)) return undefined
  return hasValue(field.renderer) ? undefined : 'text-or-renderer'
}
