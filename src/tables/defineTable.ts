import type { LabelDictionary } from '../contracts/labels'
import type { CompactDisplayField, DisplayFieldGuard, DisplayFieldValue } from '../display/compatibility'
import type { RawSchema, RawSchemaOutput } from '../contracts/schema'
import type { TableColumn, TableDefinition } from '../contracts/tables'

type UnsafeKey = '__proto__' | 'prototype' | 'constructor' | `${number}`
type FiniteRecordGuard<TRecord extends object> = string extends Extract<keyof TRecord, string> ? never : unknown
type TableSchemaGuard<TSchema extends RawSchema<object, object>> = FiniteRecordGuard<RawSchemaOutput<TSchema>>
type AllowedColumnMember = keyof TableColumn
type KeysOfUnion<TValue> = TValue extends unknown ? keyof TValue : never

type SortMemberValid<TRecord extends object, TKey extends string, TColumn> = TColumn extends { sortable?: infer TSortable }
  ? true extends TSortable
    ? TColumn extends { read: (record: TRecord) => unknown }
      ? TColumn extends { sortKey: infer TSortKey }
        ? [TSortKey] extends [Extract<keyof TRecord, string>]
          ? true
          : false
        : false
      : TColumn extends { sortKey: infer TSortKey }
        ? [TSortKey] extends [Extract<keyof TRecord, string>]
          ? true
          : false
        : TKey extends Extract<keyof TRecord, string>
          ? true
          : false
    : TColumn extends { sortKey: infer TSortKey }
      ? [TSortKey] extends [Extract<keyof TRecord, string>]
        ? true
        : false
      : true
  : true

type TableSortKeyGuard<TRecord extends object, TKey extends string, TColumn> = EveryTrue<SortMemberValid<TRecord, TKey, TColumn>>

type EveryTrue<TValue> = [TValue] extends [true] ? unknown : never

type TableColumnGuard<TRecord extends object, TKey extends string, TColumn> = [TColumn] extends [TableColumn<TRecord, DisplayFieldValue<TRecord, TKey, TColumn>>]
  ? Exclude<KeysOfUnion<TColumn>, AllowedColumnMember> extends never
    ? DisplayFieldGuard<TRecord, TKey, TColumn> & TableSortKeyGuard<TRecord, TKey, TColumn>
    : never
  : never

type TableColumnsGuard<TRecord extends object, TColumns> = TColumns extends object
  ? TColumns extends readonly unknown[]
    ? never
    : Extract<keyof TColumns, UnsafeKey> extends never
      ? { [TKey in keyof TColumns]: TKey extends string ? TableColumnGuard<NoInfer<TRecord>, TKey, TColumns[TKey]> : never }
      : never
  : never

type CompactTableColumn<TRecord extends object, TKey extends string, TColumn> = CompactDisplayField<TRecord, DisplayFieldValue<TRecord, TKey, TColumn>, TColumn> & {
  readonly sortable?: boolean
  readonly sortKey?: TColumn extends { sortKey: infer TSortKey extends Extract<keyof TRecord, string> } ? TSortKey : never
  readonly align?: 'start' | 'center' | 'end'
  readonly class?: string
  readonly headerClass?: string
}

type CompactTableColumns<TRecord extends object, TColumns extends object> = {
  readonly [TKey in keyof TColumns]: TKey extends string ? CompactTableColumn<TRecord, TKey, TColumns[TKey]> : never
}

type DefinedTable<TSchema extends RawSchema<object, object>, TColumns extends object> = TableDefinition<RawSchemaOutput<TSchema>, CompactTableColumns<RawSchemaOutput<TSchema>, TColumns>>

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
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, isRecord(entry) ? { ...entry, ...(isRecord(entry.props) ? { props: { ...entry.props } } : {}) } : entry])) as T
}

export function defineTable<
  TSchema extends RawSchema<object, object>,
  const TColumns extends Record<string, TableColumn<RawSchemaOutput<TSchema>>>,
  const TLabels extends LabelDictionary | undefined = undefined,
>(definition: {
  readonly schema: TSchema & TableSchemaGuard<TSchema>
  readonly columns: TColumns & TableColumnsGuard<RawSchemaOutput<TSchema>, TColumns>
  readonly labels?: TLabels
}): DefinedTable<TSchema, TColumns> {
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

  const result: DefinedTable<TSchema, TColumns> = {
    schema: definition.schema,
    columns: snapshotMap(definition.columns),
    ...(definition.labels !== undefined ? { labels: { ...definition.labels } } : {}),
  }
  return result
}
