import type { DetailField, DetailDefinition } from '../contracts/details'
import type { ReadonlySurfaceConfiguration } from '../contracts/display'
import type { LabelDictionary } from '../contracts/labels'
import type { RawSchema, RawSchemaOutput } from '../contracts/schema'
import type { DisplayRendererHasValue, DisplayRendererKey, DisplayRendererProps, DisplayRendererValue } from '../renderers/displayContracts'

type UnsafeKey = '__proto__' | 'prototype' | 'constructor' | `${number}`
type FiniteRecordGuard<TRecord extends object> = string extends Extract<keyof TRecord, string> ? never : unknown
type DetailSchemaGuard<TSchema extends RawSchema<object, object>> = FiniteRecordGuard<RawSchemaOutput<TSchema>>
type AllowedFieldMember = keyof DetailField

type ReadValue<TRecord extends object, TKey extends string, TField> = TField extends { read: (record: TRecord) => infer TValue }
  ? TValue
  : TKey extends keyof TRecord ? TRecord[TKey] : never

type DisplayRendererGuard<TField, TValue> = TField extends { renderer: infer TRenderer }
  ? TRenderer extends DisplayRendererKey
    ? DisplayRendererHasValue<TRenderer> extends true
      ? TValue extends DisplayRendererValue<TRenderer> ? unknown : never
      : unknown
    : never
  : unknown

type DisplayPropsGuard<TField> = TField extends { renderer: infer TRenderer }
  ? TRenderer extends DisplayRendererKey
    ? 'props' extends keyof TField
      ? TField extends { props?: infer TProps }
        ? TProps extends DisplayRendererProps<TRenderer> ? unknown : never
        : never
      : unknown
    : never
  : unknown

type DetailRecordKeyGuard<TRecord extends object, TKey extends string, TField> =
  TKey extends Extract<keyof TRecord, string>
    ? unknown
    : TField extends { read: (record: TRecord) => unknown } ? unknown : never

type DetailFieldGuard<TRecord extends object, TKey extends string, TField> =
  TField extends DetailField<TRecord, ReadValue<TRecord, TKey, TField>>
    ? Exclude<keyof TField, AllowedFieldMember> extends never
      ? DetailRecordKeyGuard<TRecord, TKey, TField>
        & DisplayRendererGuard<TField, ReadValue<TRecord, TKey, TField>>
        & DisplayPropsGuard<TField>
      : never
    : never

type DetailFieldsGuard<TRecord extends object, TFields> = TFields extends object
  ? TFields extends readonly unknown[]
    ? never
    : Extract<keyof TFields, UnsafeKey> extends never
      ? { [TKey in keyof TFields]: TKey extends string ? DetailFieldGuard<NoInfer<TRecord>, TKey, TFields[TKey]> : never }
      : never
  : never

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidOption(member: string, expected: string): never {
  throw new Error(`[loom][SURFACE_OPTION_INVALID] Detail member "${member}" must be ${expected}.`)
}

function assertLabels(value: unknown): void {
  if (value === undefined) return
  if (!isRecord(value)) invalidOption('labels', 'a label dictionary')
  for (const [key, label] of Object.entries(value)) {
    if (typeof label !== 'string' && typeof label !== 'function') invalidOption(`labels.${key}`, 'a string or a function that returns a string')
  }
}

function assertField(key: string, field: unknown): void {
  if (!isRecord(field)) invalidOption(`fields.${key}`, 'a DetailField object')
  const allowed = new Set(['label', 'read', 'renderer', 'props', 'format', 'emphasis', 'span'])

  for (const member of Object.keys(field)) {
    if (!allowed.has(member)) invalidOption(`fields.${key}.${member}`, 'a DetailField member')
  }
  if ('label' in field && typeof field.label !== 'string' && typeof field.label !== 'function') invalidOption(`fields.${key}.label`, 'a string or a function that returns a string')
  if ('read' in field && typeof field.read !== 'function') invalidOption(`fields.${key}.read`, 'a function')
  if ('renderer' in field && typeof field.renderer !== 'string') invalidOption(`fields.${key}.renderer`, 'a registered display key')
  if ('props' in field && !isRecord(field.props)) invalidOption(`fields.${key}.props`, 'an object')
  if (isRecord(field.props)) {
    for (const member of ['value', 'modelValue', 'record', 'draft', 'field', 'key', 'index', 'setValue']) {
      if (Object.hasOwn(field.props, member)) invalidOption(`fields.${key}.props.${member}`, 'supplied by the display surface')
    }
  }
  if ('format' in field && typeof field.format !== 'string') invalidOption(`fields.${key}.format`, 'a format key')
  if ('emphasis' in field && !['strong', 'muted'].includes(String(field.emphasis))) invalidOption(`fields.${key}.emphasis`, 'strong or muted')
  if ('span' in field && (typeof field.span !== 'number' || !Number.isInteger(field.span) || field.span < 1)) invalidOption(`fields.${key}.span`, 'a positive integer')
}

function snapshotMap<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    isRecord(entry) ? { ...entry, ...(isRecord(entry.props) ? { props: { ...entry.props } } : {}) } : entry,
  ])) as T
}

export function defineDetail<
  TSchema extends RawSchema<object, object>,
  const TFields extends Record<string, DetailField<RawSchemaOutput<TSchema>>>,
  const TLabels extends LabelDictionary | undefined = undefined,
>(definition: {
  readonly schema: TSchema & DetailSchemaGuard<TSchema>
  readonly fields: TFields & DetailFieldsGuard<RawSchemaOutput<TSchema>, TFields>
  readonly labels?: TLabels
}): Omit<DetailDefinition<RawSchemaOutput<TSchema>>, 'schema' | 'fields' | 'labels'> & {
  readonly schema: TSchema
  readonly fields: ReadonlySurfaceConfiguration<TFields>
} & (undefined extends TLabels
  ? { readonly labels?: never }
  : { readonly labels: ReadonlySurfaceConfiguration<TLabels> }) {
  if (!isRecord(definition)) invalidOption('definition', 'an object')
  for (const member of Object.keys(definition)) {
    if (!['schema', 'fields', 'labels'].includes(member)) invalidOption(member, 'a DetailDefinition member')
  }
  if (!isRecord(definition.schema) || typeof definition.schema.parseAsync !== 'function') invalidOption('schema', 'a raw record schema')
  if (!isRecord(definition.fields)) invalidOption('fields', 'an ordered detail field map')
  assertLabels(definition.labels)
  for (const key of Reflect.ownKeys(definition.fields)) {
    if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor' || /^\d+$/.test(key)) {
      invalidOption(`fields.${String(key)}`, 'a safe named key')
    }
    assertField(key, definition.fields[key])
  }

  const result: Record<string, unknown> = { schema: definition.schema, fields: snapshotMap(definition.fields) }
  if (definition.labels !== undefined) result.labels = { ...definition.labels }
  return result as Omit<DetailDefinition<RawSchemaOutput<TSchema>>, 'schema' | 'fields' | 'labels'> & {
    readonly schema: TSchema
    readonly fields: ReadonlySurfaceConfiguration<TFields>
  } & (undefined extends TLabels
    ? { readonly labels?: never }
    : { readonly labels: ReadonlySurfaceConfiguration<TLabels> })
}
