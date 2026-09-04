type InternalSchemaKind = 'unknown' | 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'string[]' | 'number[]' | 'boolean[]' | 'object[]' | 'selection[]'

const fieldSchemaMetadata = Symbol('loom.field-schema-metadata')

export function setSchemaKind<T extends object>(target: T, kind: InternalSchemaKind): T {
  Object.defineProperty(target, fieldSchemaMetadata, { value: kind, enumerable: false, configurable: true })
  return target
}

export function getSchemaKind(target: unknown): InternalSchemaKind | undefined {
  if (!target || typeof target !== 'object') return undefined
  return (target as Record<PropertyKey, unknown>)[fieldSchemaMetadata] as InternalSchemaKind | undefined
}

export type { InternalSchemaKind }
