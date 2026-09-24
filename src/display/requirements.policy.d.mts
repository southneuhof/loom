import type { SchemaFieldKind } from '../contracts/schema'

export interface DisplayRequirementField {
  readonly format?: unknown
  readonly renderer?: unknown
  readonly read?: unknown
}

export type DisplayRequirement = 'date-format' | 'text-or-renderer'

export function displayRequirement(kind: SchemaFieldKind, field: DisplayRequirementField): DisplayRequirement | undefined
export function displayValueRequirement(value: unknown, field: DisplayRequirementField): DisplayRequirement | undefined
