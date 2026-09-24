import type { LabelDictionary } from '../contracts/labels'
import type { ReadonlySurfaceConfiguration } from '../contracts/display'
import type { RawSchema, RawSchemaOutput } from '../contracts/schema'
import type { DisplayRendererHasValue, DisplayRendererKey, DisplayRendererProps, DisplayRendererValue } from '../renderers/displayContracts'
import type { TableColumn, TableDefinition } from '../contracts/tables'

type UnsafeKey = '__proto__' | 'prototype' | 'constructor' | `${number}`
type FiniteRecordGuard<TRecord extends object> = string extends Extract<keyof TRecord, string> ? never : unknown
type TableSchemaGuard<TSchema extends RawSchema<object, object>> = FiniteRecordGuard<RawSchemaOutput<TSchema>>
type AllowedColumnMember = keyof TableColumn

type ReadValue<TRecord extends object, TKey extends string, TColumn> = TColumn extends { read: (record: TRecord) => infer TValue }
  ? TValue
  : TKey extends keyof TRecord ? TRecord[TKey] : never

type DisplayRendererGuard<TColumn, TValue> = TColumn extends { renderer: infer TRenderer }
  ? TRenderer extends DisplayRendererKey
    ? DisplayRendererHasValue<TRenderer> extends true
      ? TValue extends DisplayRendererValue<TRenderer> ? unknown : never
      : unknown
    : never
  : unknown

type DisplayPropsGuard<TColumn> = TColumn extends { renderer: infer TRenderer }
  ? TRenderer extends DisplayRendererKey
    ? 'props' extends keyof TColumn
      ? TColumn extends { props?: infer TProps }
        ? TProps extends DisplayRendererProps<TRenderer> ? unknown : never
        : never
      : unknown
    : never
  : unknown

type TableRecordKeyGuard<TRecord extends object, TKey extends string, TColumn> =
  TKey extends Extract<keyof TRecord, string>
    ? unknown
    : TColumn extends { read: (record: TRecord) => unknown } ? unknown : never

type TableSortKeyGuard<TRecord extends object, TKey extends string, TColumn> = TColumn extends { sortable?: infer TSortable }
  ? true extends TSortable
    ? TColumn extends { read: (record: TRecord) => unknown }
      ? TColumn extends { sortKey: infer TSortKey }
        ? TSortKey extends Extract<keyof TRecord, string> ? unknown : never
        : never
      : TColumn extends { sortKey: infer TSortKey }
        ? TSortKey extends Extract<keyof TRecord, string> ? unknown : never
        : TKey extends Extract<keyof TRecord, string> ? unknown : never
    : TColumn extends { sortKey: infer TSortKey }
      ? TSortKey extends Extract<keyof TRecord, string> ? unknown : never
      : unknown
  : unknown

type TableColumnGuard<TRecord extends object, TKey extends string, TColumn> =
  TColumn extends TableColumn<TRecord, ReadValue<TRecord, TKey, TColumn>>
    ? Exclude<keyof TColumn, AllowedColumnMember> extends never
      ? TableRecordKeyGuard<TRecord, TKey, TColumn>
        & TableSortKeyGuard<TRecord, TKey, TColumn>
        & DisplayRendererGuard<TColumn, ReadValue<TRecord, TKey, TColumn>>
        & DisplayPropsGuard<TColumn>
      : never
    : never

type TableColumnsGuard<TRecord extends object, TColumns> = TColumns extends object
  ? TColumns extends readonly unknown[]
    ? never
    : Extract<keyof TColumns, UnsafeKey> extends never
      ? { [TKey in keyof TColumns]: TKey extends string ? TableColumnGuard<NoInfer<TRecord>, TKey, TColumns[TKey]> : never }
      : never
  : never

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidOption(member: string, expected: string): never {
  throw new Error(`[loom][SURFACE_OPTION_INVALID] Table member "${member}" must be ${expected}.`)
}

function assertLabels(value: unknown): void {
  if (value === undefined) return
  if (!isRecord(value)) invalidOption('labels', 'a label dictionary')
  for (const [key, label] of Object.entries(value)) {
    if (typeof label !== 'string' && typeof label !== 'function') invalidOption(`labels.${key}`, 'a string or a function that returns a string')
  }
}

function assertColumn(key: string, column: unknown): void {
  if (!isRecord(column)) invalidOption(`columns.${key}`, 'a TableColumn object')
  const allowed = new Set(['label', 'read', 'renderer', 'props', 'format', 'sortable', 'sortKey', 'align', 'class', 'headerClass'])

  for (const member of Object.keys(column)) {
    if (!allowed.has(member)) invalidOption(`columns.${key}.${member}`, 'a TableColumn member')
  }
  if ('label' in column && typeof column.label !== 'string' && typeof column.label !== 'function') invalidOption(`columns.${key}.label`, 'a string or a function that returns a string')
  if ('read' in column && typeof column.read !== 'function') invalidOption(`columns.${key}.read`, 'a function')
  if ('renderer' in column && typeof column.renderer !== 'string') invalidOption(`columns.${key}.renderer`, 'a registered display key')
  if ('props' in column && !isRecord(column.props)) invalidOption(`columns.${key}.props`, 'an object')
  if (isRecord(column.props)) {
    for (const member of ['value', 'modelValue', 'record', 'draft', 'field', 'key', 'index', 'setValue']) {
      if (Object.hasOwn(column.props, member)) invalidOption(`columns.${key}.props.${member}`, 'supplied by the display surface')
    }
  }
  if ('format' in column && typeof column.format !== 'string') invalidOption(`columns.${key}.format`, 'a format key')
  if ('sortable' in column && typeof column.sortable !== 'boolean') invalidOption(`columns.${key}.sortable`, 'a boolean')
  if ('sortKey' in column && typeof column.sortKey !== 'string') invalidOption(`columns.${key}.sortKey`, 'a record key')
  if (column.sortable === true && typeof column.read === 'function' && !Object.hasOwn(column, 'sortKey')) {
    invalidOption(`columns.${key}.sortKey`, 'present for a sortable accessor')
  }
  if ('align' in column && !['start', 'center', 'end'].includes(String(column.align))) invalidOption(`columns.${key}.align`, 'start, center, or end')
  if ('class' in column && typeof column.class !== 'string') invalidOption(`columns.${key}.class`, 'a string')
  if ('headerClass' in column && typeof column.headerClass !== 'string') invalidOption(`columns.${key}.headerClass`, 'a string')
}

function snapshotMap<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    isRecord(entry) ? { ...entry, ...(isRecord(entry.props) ? { props: { ...entry.props } } : {}) } : entry,
  ])) as T
}

export function defineTable<
  TSchema extends RawSchema<object, object>,
  const TColumns extends Record<string, TableColumn<RawSchemaOutput<TSchema>>>,
  const TLabels extends LabelDictionary | undefined = undefined,
>(definition: {
  readonly schema: TSchema & TableSchemaGuard<TSchema>
  readonly columns: TColumns & TableColumnsGuard<RawSchemaOutput<TSchema>, TColumns>
  readonly labels?: TLabels
}): Omit<TableDefinition<RawSchemaOutput<TSchema>>, 'schema' | 'columns' | 'labels'> & {
  readonly schema: TSchema
  readonly columns: ReadonlySurfaceConfiguration<TColumns>
} & (undefined extends TLabels
  ? { readonly labels?: never }
  : { readonly labels: ReadonlySurfaceConfiguration<TLabels> }) {
  if (!isRecord(definition)) invalidOption('definition', 'an object')
  for (const member of Object.keys(definition)) {
    if (!['schema', 'columns', 'labels'].includes(member)) invalidOption(member, 'a TableDefinition member')
  }
  if (!isRecord(definition.schema) || typeof definition.schema.parseAsync !== 'function') invalidOption('schema', 'a raw record schema')
  if (!isRecord(definition.columns)) invalidOption('columns', 'an ordered column map')
  assertLabels(definition.labels)
  for (const key of Reflect.ownKeys(definition.columns)) {
    if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor' || /^\d+$/.test(key)) {
      invalidOption(`columns.${String(key)}`, 'a safe named key')
    }
    assertColumn(key, definition.columns[key])
  }

  const result: Record<string, unknown> = { schema: definition.schema, columns: snapshotMap(definition.columns) }
  if (definition.labels !== undefined) result.labels = { ...definition.labels }
  return result as Omit<TableDefinition<RawSchemaOutput<TSchema>>, 'schema' | 'columns' | 'labels'> & {
    readonly schema: TSchema
    readonly columns: ReadonlySurfaceConfiguration<TColumns>
  } & (undefined extends TLabels
    ? { readonly labels?: never }
    : { readonly labels: ReadonlySurfaceConfiguration<TLabels> })
}
