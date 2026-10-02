const hasValue = (value: unknown) => value !== undefined && value !== null && value !== ''

export interface DisplayRequirementField {
  readonly format?: unknown
  readonly renderer?: unknown
}

export type DisplayRequirement = 'date-format' | 'text-or-renderer'

export function displayValueRequirement(value: unknown, field: DisplayRequirementField): DisplayRequirement | undefined {
  if (value instanceof Date) {
    if (!hasValue(field.format)) return 'date-format'
    if (!hasValue(field.renderer)) return 'text-or-renderer'
    return undefined
  }
  if (value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value)) return undefined
  return hasValue(field.renderer) ? undefined : 'text-or-renderer'
}
