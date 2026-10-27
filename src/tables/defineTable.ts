import type { LabelDictionary } from '../contracts/labels'
import type { CompactDisplayField, DisplayFieldGuard, DisplayFieldValue } from '../display/compatibility'
import type { RawSchema, RawSchemaOutput } from '../contracts/schema'
import type { TableColumn, TableColumnContext, TableColumnsContext, TableDefinition } from '../contracts/tables'
import type { DisplayValueConfiguration } from '../contracts/display'
import { assertDisplayEntry, assertSafeDisplayKey } from '../display/assertDisplayDefinition'

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

type TableColumnConfig<TColumn> = TColumn extends (...args: never[]) => unknown ? ReturnType<TColumn> : TColumn

type TableColumnCellConfig<TCell> = TCell extends (...args: never[]) => unknown ? ReturnType<TCell> : TCell
type AllowedCellMember = keyof DisplayValueConfiguration
type FlatDisplayMembers = 'read' | 'renderer' | 'props' | 'format'

type HasDefinedMember<TValue, TMember extends PropertyKey> = TMember extends keyof TValue
  ? {} extends Pick<TValue, TMember> ? false : [Exclude<TValue[TMember], undefined>] extends [never] ? false : true
  : false

type HasFlatDisplayMember<TValue> = true extends {
  [TMember in FlatDisplayMembers]: HasDefinedMember<TValue, TMember>
}[FlatDisplayMembers] ? true : false

type TableColumnCellMemberValid<TRecord extends object, TKey extends string, TCell> = TableColumnCellConfig<TCell> extends infer TConfig
  ? TConfig extends unknown
    ? [TConfig] extends [DisplayValueConfiguration<TRecord>]
      ? Exclude<KeysOfUnion<TConfig>, AllowedCellMember> extends never
        ? [DisplayFieldGuard<TRecord, TKey, TConfig>] extends [never] ? false : true
        : false
      : false
    : never
  : never

type TableColumnCellMemberGuard<TRecord extends object, TKey extends string, TCell> = EveryTrue<TableColumnCellMemberValid<TRecord, TKey, TCell>>

type TableColumnMemberGuard<TRecord extends object, TKey extends string, TConfig> = [TConfig] extends [TableColumn<TRecord, DisplayFieldValue<TRecord, TKey, TConfig>, any>]
  ? Exclude<KeysOfUnion<TConfig>, AllowedColumnMember> extends never
    ? TableSortKeyGuard<TRecord, TKey, TConfig> & (TConfig extends { readonly cell: infer TCell }
        ? HasFlatDisplayMember<TConfig> extends false ? TableColumnCellMemberGuard<TRecord, TKey, TCell> : never
        : DisplayFieldGuard<TRecord, TKey, TConfig>)
    : never
  : never

type TableColumnMemberValid<TRecord extends object, TKey extends string, TColumn> = TableColumnConfig<TColumn> extends infer TConfig
  ? TConfig extends unknown
    ? [TableColumnMemberGuard<TRecord, TKey, TConfig>] extends [never] ? false : true
    : never
  : never

type TableColumnGuard<TRecord extends object, TKey extends string, TColumn> = EveryTrue<TableColumnMemberValid<TRecord, TKey, TColumn>>

type TableColumnsGuard<TRecord extends object, TColumns> = TColumns extends object
  ? TColumns extends readonly unknown[]
    ? never
    : Extract<keyof TColumns, UnsafeKey> extends never
      ? { [TKey in keyof TColumns]: TKey extends string ? TableColumnGuard<NoInfer<TRecord>, TKey, TColumns[TKey]> : never }
      : never
  : never

type CompactSortable<TColumn> = 'sortable' extends keyof TColumn
  ? TColumn extends { sortable: infer TSortable }
    ? { readonly sortable: TSortable }
    : TColumn extends { sortable?: infer TSortable }
      ? { readonly sortable?: TSortable }
      : {}
  : {}

type CompactTableCell<TColumn> = TColumn extends { readonly cell: infer TCell } ? { readonly cell: TCell } : {}

type CompactTableColumn<TRecord extends object, TKey extends string, TColumn> = CompactDisplayField<TRecord, DisplayFieldValue<TRecord, TKey, TColumn>, TColumn> & CompactSortable<TColumn> & CompactTableCell<TColumn> & {
  readonly sortKey?: TColumn extends { sortKey: infer TSortKey extends Extract<keyof TRecord, string> } ? TSortKey : never
  readonly align?: 'start' | 'center' | 'end'
  readonly class?: string
  readonly headerClass?: string
}

type CompactTableEntry<TRecord extends object, TKey extends string, TColumn> = TColumn extends (...args: never[]) => unknown
  ? TColumn
  : CompactTableColumn<TRecord, TKey, TColumn>

type CompactTableColumns<TRecord extends object, TColumns extends object> = {
  readonly [TKey in keyof TColumns]: TKey extends string ? CompactTableEntry<TRecord, TKey, TColumns[TKey]> : never
}

type DefinedTable<TSchema extends RawSchema<object, object>, TColumns extends object> = TableDefinition<RawSchemaOutput<TSchema>, CompactTableColumns<RawSchemaOutput<TSchema>, TColumns>, Extract<TableColumnsContext<TColumns>, object>>

type TableColumnArgument<TRecord extends object> = TableColumn<TRecord, unknown, any> | ((scope: TableColumnContext<any>) => TableColumn<TRecord, unknown, any>)

type TableColumnsArgument<TRecord extends object, TColumns extends object> = {
  readonly [TKey in keyof TColumns]: TableColumnArgument<TRecord>
}

type TableArgument<TSchema extends RawSchema<object, object>, TColumns extends object> = {
  readonly schema: TSchema & TableSchemaGuard<TSchema>
  readonly columns: TColumns & TableColumnsArgument<RawSchemaOutput<TSchema>, TColumns> & NoInfer<TableColumnsGuard<RawSchemaOutput<TSchema>, TColumns>>
  readonly labels?: LabelDictionary
}

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

function snapshotMap<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, isRecord(entry) ? { ...entry, ...(isRecord(entry.props) ? { props: { ...entry.props } } : {}) } : entry])) as T
}

export function defineTable<
  TSchema extends RawSchema<object, object>,
  const TColumns extends object,
  const TLabels extends LabelDictionary | undefined = undefined,
>(definition: TableArgument<TSchema, TColumns> & { readonly labels?: TLabels }): DefinedTable<TSchema, TColumns> {
  if (!isRecord(definition)) invalidOption('definition', 'an object')
  for (const member of Object.keys(definition)) {
    if (!['schema', 'columns', 'labels'].includes(member)) invalidOption(member, 'a TableDefinition member')
  }
  if (!isRecord(definition.schema) || typeof definition.schema.parseAsync !== 'function') invalidOption('schema', 'a raw record schema')
  if (!isRecord(definition.columns)) invalidOption('columns', 'an ordered column map')
  assertLabels(definition.labels)
  for (const key of Reflect.ownKeys(definition.columns)) {
    assertSafeDisplayKey(key, (invalidKey, expected) => invalidOption(`columns.${String(invalidKey)}`, expected))
    const column = definition.columns[key]
    if (typeof column !== 'function') {
      assertDisplayEntry('table', `columns.${key}`, column, (_surface, location, member, expected) => {
        invalidOption(member === 'definition' ? location : `${location}.${member}`, expected)
      })
    }
  }

  const result = {
    schema: definition.schema,
    columns: snapshotMap(definition.columns),
    ...(definition.labels !== undefined ? { labels: { ...definition.labels } } : {}),
  } as DefinedTable<TSchema, TColumns>
  return result
}
