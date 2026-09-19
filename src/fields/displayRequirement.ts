import type { InternalSchemaKind } from './schemaMetadata'
import type { ResolvedSurfaceField } from './resolve'

/** Display signals the requirement check reads. `source` covers form lookup and select. */
export interface DisplayRequirementField {
  format?: string
  renderer?: string
  read?: unknown
  source?: unknown
  props?: Record<string, unknown>
}

/**
 * Tells whether table or detail display needs an explicit choice.
 *
 * Plain strings use the default text. Any other kind needs `format`,
 * `renderer`, or `read`. Objects, arrays, and lookup fields need `read` or
 * `renderer`; a format string cannot render them. Unknown kinds never block.
 */
export function requiresExplicitDisplay(kind: InternalSchemaKind, field: DisplayRequirementField): boolean {
  if (kind === 'unknown') return false
  const hasRead = field.read !== undefined && field.read !== null
  const hasRenderer = field.renderer !== undefined && field.renderer !== null && field.renderer !== ''
  const hasFormat = field.format !== undefined && field.format !== null && field.format !== ''
  const hasSource = field.source !== undefined && field.source !== null
  if (hasSource) return !(hasRead || hasRenderer)
  switch (kind) {
    case 'string':
    case 'string[]':
      // Options mark a string enum; it needs a chip or select display.
      return field.props?.options !== undefined && !(hasRead || hasRenderer || hasFormat)
    case 'number':
    case 'boolean':
    case 'date':
    case 'number[]':
    case 'boolean[]':
    case 'selection[]':
      return !(hasRead || hasRenderer || hasFormat)
    case 'object':
    case 'array':
    case 'object[]':
      return !(hasRead || hasRenderer)
    default:
      return false
  }
}
