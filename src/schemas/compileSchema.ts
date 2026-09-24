import type { RawSchema, RawSchemaInput, RawSchemaOutput, SchemaFieldKind, SchemaFieldMetadata, SchemaIssue, SchemaParseResult } from '../contracts/schema'

type SchemaRecord = Record<PropertyKey, unknown>

interface RuntimeSchema extends SchemaRecord {
  shape?: unknown
  _def?: unknown
  meta?: () => unknown
  parseAsync?: (input: unknown) => Promise<unknown>
}

interface SchemaDefinition extends SchemaRecord {
  type?: unknown
  typeName?: unknown
  innerType?: unknown
  schema?: unknown
  in?: unknown
  out?: unknown
  element?: unknown
  values?: unknown
  entries?: unknown
  options?: unknown
  coerce?: unknown
  effect?: unknown
  value?: unknown
  catchall?: unknown
  unknownKeys?: unknown
}

export interface CompiledSchema<TSchema extends RawSchema = RawSchema> {
  schema: TSchema
  inputKeys: readonly string[]
  fields: Readonly<Record<string, SchemaFieldMetadata>>
  parseAsync: (input: unknown) => Promise<SchemaParseResult<RawSchemaOutput<TSchema>>>
}

const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor'])

function isRecord(value: unknown): value is SchemaRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function schemaRecord(value: unknown): RuntimeSchema | undefined {
  if (!isRecord(value)) return undefined
  return value as RuntimeSchema
}

function definitionOf(schema: RuntimeSchema): SchemaDefinition | undefined {
  return isRecord(schema._def) ? schema._def as SchemaDefinition : undefined
}

function typeTag(schema: RuntimeSchema): string {
  const definition = definitionOf(schema)
  if (!definition) return ''
  if (typeof definition.type === 'string') return definition.type
  if (typeof definition.typeName === 'string') return definition.typeName.replace(/^Zod/, '').toLowerCase()
  return ''
}

function innerSchema(schema: RuntimeSchema, tag: string): RuntimeSchema | undefined {
  const definition = definitionOf(schema)
  if (!definition) return undefined
  if (tag === 'pipe') return schemaRecord(definition.in)
  if (tag === 'effects') {
    const effect = isRecord(definition.effect) ? definition.effect : undefined
    if (effect?.type === 'preprocess') return undefined
    return schemaRecord(definition.schema)
  }
  if (['optional', 'nullable', 'default', 'catch', 'prefault', 'nonoptional', 'readonly', 'branded'].includes(tag)) {
    return schemaRecord(definition.innerType)
  }
  return undefined
}

function discoverInputObject(schema: RuntimeSchema): { schema: RuntimeSchema; shape: Record<string, unknown> } | undefined {
  const seen = new Set<RuntimeSchema>()
  let current: RuntimeSchema | undefined = schema

  while (current && !seen.has(current)) {
    seen.add(current)
    if (isRecord(current.shape)) return { schema: current, shape: current.shape }
    const tag = typeTag(current)
    current = innerSchema(current, tag)
  }

  return undefined
}

function discoverOutputObject(schema: RuntimeSchema): { shape: Record<string, unknown> } | undefined {
  const seen = new Set<RuntimeSchema>()
  let current: RuntimeSchema | undefined = schema

  while (current && !seen.has(current)) {
    seen.add(current)
    if (isRecord(current.shape)) return { shape: current.shape }
    const tag = typeTag(current)
    const definition = definitionOf(current)
    if (tag === 'pipe') {
      current = schemaRecord(definition?.out)
      continue
    }
    if (tag === 'effects') {
      const effect = isRecord(definition?.effect) ? definition.effect : undefined
      if (effect?.type === 'transform' || effect?.type === 'preprocess') return undefined
      current = schemaRecord(definition?.schema)
      continue
    }
    if (['optional', 'nullable', 'default', 'catch', 'prefault', 'nonoptional', 'readonly', 'branded'].includes(tag)) {
      current = schemaRecord(definition?.innerType)
      continue
    }
    return undefined
  }

  return undefined
}

function unwrapInputSchema(schema: RuntimeSchema): RuntimeSchema {
  const seen = new Set<RuntimeSchema>()
  let current = schema

  while (!seen.has(current)) {
    seen.add(current)
    const next = innerSchema(current, typeTag(current))
    if (!next) return current
    current = next
  }

  return current
}

function isRequiredInput(schema: RuntimeSchema): boolean {
  const seen = new Set<RuntimeSchema>()
  let current = schema

  while (!seen.has(current)) {
    seen.add(current)
    const tag = typeTag(current)
    if (tag === 'optional' || tag === 'default' || tag === 'catch' || tag === 'prefault') return false
    const next = innerSchema(current, tag)
    if (!next) return true
    current = next
  }

  return true
}

function stringOptions(schema: RuntimeSchema): string[] | undefined {
  const tag = typeTag(schema)
  const definition = definitionOf(schema)

  if (tag === 'literal' || tag === 'literalstring') {
    const values = definition?.values
    if (Array.isArray(values) && values.every((value) => typeof value === 'string')) return [...new Set(values)]
    if (typeof definition?.value === 'string') return [definition.value]
    return undefined
  }

  if (tag === 'union') {
    const options = definition?.options
    if (!Array.isArray(options)) return undefined
    const result = options.map((option) => {
      const optionSchema = schemaRecord(option)
      return optionSchema ? stringOptions(unwrapInputSchema(optionSchema)) : undefined
    })
    if (result.some((option) => !option || option.length !== 1)) return undefined
    return [...new Set(result.flatMap((option) => option ?? []))]
  }

  if (tag === 'enum' || tag === 'nativeenum') {
    const values = definition?.values
    if (Array.isArray(values)) {
      const strings = values.filter((value): value is string => typeof value === 'string')
      return strings.length > 0 ? [...new Set(strings)] : undefined
    }
    const entries = definition?.entries
    if (isRecord(entries)) {
      const strings = Object.values(entries).filter((value): value is string => typeof value === 'string')
      return strings.length > 0 ? [...new Set(strings)] : undefined
    }
  }

  return undefined
}

function fieldKind(schema: RuntimeSchema): { kind: SchemaFieldKind; options?: string[] } {
  const input = unwrapInputSchema(schema)
  const tag = typeTag(input)
  const definition = definitionOf(input)

  if (definition?.coerce === true) return { kind: 'unknown' }
  if (tag === 'string') return { kind: 'string' }
  if (tag === 'number') return { kind: 'number' }
  if (tag === 'boolean') return { kind: 'boolean' }
  if (tag === 'date') return { kind: 'date' }
  if (tag === 'object') return { kind: 'object' }
  if (tag === 'array') return { kind: 'array' }

  const options = stringOptions(input)
  if (options) return { kind: 'enum', options }
  return { kind: 'unknown' }
}

function assertSchemaKey(key: string): void {
  if (unsafeKeys.has(key) || /^\d+$/.test(key)) {
    throw new Error(`[loom][FORM_SCHEMA_INPUT_UNSUPPORTED] Form schema input key "${key}" is unsafe. Expected a named object property.`)
  }
}

function normalizeIssues(value: unknown): SchemaIssue[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.issues)) return undefined
  const issues: SchemaIssue[] = []

  for (const issueValue of value.issues) {
    if (!isRecord(issueValue) || !Array.isArray(issueValue.path) || typeof issueValue.message !== 'string') return undefined
    const path = issueValue.path.map((part) => {
      if (typeof part === 'string' || typeof part === 'number') return part
      if (typeof part === 'symbol') return String(part)
      throw new Error('[loom][FORM_SCHEMA_INPUT_UNSUPPORTED] Schema issue paths must contain property keys.')
    })
    issues.push({ path, message: issueValue.message })
  }

  return issues
}

function assertFiniteObjectInput(schema: RuntimeSchema): Record<string, unknown> {
  const objectInput = discoverInputObject(schema)
  if (!objectInput) {
    throw new Error('[loom][FORM_SCHEMA_INPUT_UNSUPPORTED] Form schema input must be a discoverable finite object.')
  }

  const definition = definitionOf(objectInput.schema)
  const catchall = schemaRecord(definition?.catchall)
  if (definition?.unknownKeys === 'passthrough' || definition?.unknownKeys === 'loose' ||
      (catchall && typeTag(catchall) !== 'never')) {
    throw new Error('[loom][FORM_SCHEMA_INPUT_UNSUPPORTED] Form schema input must reject unknown object keys.')
  }

  const shape = objectInput.shape

  for (const key of Reflect.ownKeys(shape)) {
    if (typeof key !== 'string') {
      throw new Error('[loom][FORM_SCHEMA_INPUT_UNSUPPORTED] Form schema input keys must be strings.')
    }
    assertSchemaKey(key)
  }

  return shape
}

export function compileSchema<TSchema extends RawSchema<object, object>>(schema: TSchema): CompiledSchema<TSchema> {
  const runtime = schemaRecord(schema)
  if (!runtime || typeof runtime.parseAsync !== 'function') {
    throw new Error('[loom][FORM_SCHEMA_INPUT_UNSUPPORTED] Form schema must be a raw Zod object schema.')
  }

  const shape = assertFiniteObjectInput(runtime)
  const inputKeys = Object.keys(shape)
  const fields = Object.fromEntries(inputKeys.map((key) => {
    const field = schemaRecord(shape[key])
    if (!field) {
      throw new Error(`[loom][FORM_SCHEMA_INPUT_UNSUPPORTED] Form schema field "${key}" must be a Zod schema.`)
    }
    const info = fieldKind(field)
    const metadata: SchemaFieldMetadata = { kind: info.kind, required: isRequiredInput(field) }
    if (info.options) metadata.options = info.options
    return [key, metadata]
  }))

  return {
    schema,
    inputKeys,
    fields,
    parseAsync: async (input) => {
      try {
        const data = await schema.parseAsync(input)
        if (!isRecord(data)) {
          return { success: false, issues: [{ path: [], message: 'Expected the schema to produce an object.' }] }
        }
        return { success: true, data }
      } catch (error) {
        const issues = normalizeIssues(error)
        if (!issues) throw error
        return { success: false, issues }
      }
    },
  }
}

export function schemaOutputKeys(schema: RawSchema): readonly string[] | undefined {
  const runtime = schemaRecord(schema)
  const output = runtime ? discoverOutputObject(runtime) : undefined
  if (!output) return undefined
  const keys = Reflect.ownKeys(output.shape)
  const stringKeys: string[] = []
  for (const key of keys) {
    if (typeof key !== 'string') return undefined
    stringKeys.push(key)
  }
  return stringKeys
}
