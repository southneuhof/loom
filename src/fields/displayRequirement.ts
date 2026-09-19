import type { InternalSchemaKind } from './schemaMetadata'

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
 * Plain strings use the default text. Numbers, booleans, and dates accept
 * `format`, `renderer`, or `read`. Enums, selections, objects, arrays, and
 * lookup fields need `read` or `renderer`; a format string cannot render
 * chips, tags, or lookups. Unknown kinds never block.
 *
 * The static check mirrors this rule in scripts/module-ui-check.mjs; the
 * agreement test in scripts/module-ui-check.test.mjs proves they agree.
 */
export function requiresExplicitDisplay(kind: InternalSchemaKind, field: DisplayRequirementField): boolean {
  const hasRead = field.read !== undefined && field.read !== null
  const hasRenderer = field.renderer !== undefined && field.renderer !== null && field.renderer !== ''
  const hasFormat = field.format !== undefined && field.format !== null && field.format !== ''
  const hasSource = field.source !== undefined && field.source !== null
  // A lookup source names the display contract even when schema kind is unknown.
  if (hasSource) return !(hasRead || hasRenderer)
  if (kind === 'unknown') return false
  const readOrRenderer = hasRead || hasRenderer
  switch (kind) {
    case 'string':
    case 'string[]':
      // Options mark a string enum; chips and tags need a renderer or read.
      return field.props?.options !== undefined && !readOrRenderer
    case 'selection[]':
      // Selections render as chips, tags, or lookups; a format cannot render them.
      return !readOrRenderer
    case 'number':
    case 'boolean':
    case 'date':
    case 'number[]':
    case 'boolean[]':
      return !(readOrRenderer || hasFormat)
    case 'object':
    case 'array':
    case 'object[]':
      return !readOrRenderer
    default:
      return false
  }
}
