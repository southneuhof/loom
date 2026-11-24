import type { LabelDictionary } from '../contracts/labels'
import type { CompactDisplayField, DisplayFieldGuard, DisplayFieldValue } from '../display/compatibility'
import type { RawSchema, RawSchemaOutput } from '../contracts/schema'
import type { TableColumn, TableColumnContext, TableColumnsContext, TableDefinition } from '../contracts/tables'
import type { DisplayValueConfiguration } from '../contracts/display'
import { assertDisplayDefinition, snapshotDisplayEntries } from '../display/assertDisplayDefinition'

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
type CellGuard<TRecord extends object, TKey extends string, TCell> = EveryTrue<TableColumnCellConfig<TCell> extends infer TConfig
  ? TConfig extends unknown
    ? [TConfig] extends [DisplayValueConfiguration<TRecord>]
      ? Exclude<KeysOfUnion<TConfig>, AllowedCellMember> extends never
        ? [DisplayFieldGuard<TRecord, TKey, TConfig>] extends [never] ? false : true
        : false
      : false
    : never
  : never>

type TableColumnMemberGuard<TRecord extends object, TKey extends string, TConfig> = [TConfig] extends [TableColumn<TRecord, DisplayFieldValue<TRecord, TKey, TConfig>, any>]
  ? Exclude<KeysOfUnion<TConfig>, AllowedColumnMember> extends never
    ? TableSortKeyGuard<TRecord, TKey, TConfig> & (TConfig extends { readonly cell: infer TCell }
        ? CellGuard<TRecord, TKey, TCell>
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

export function defineTable<
  TSchema extends RawSchema<object, object>,
  const TColumns extends object,
  const TLabels extends LabelDictionary | undefined = undefined,
>(definition: TableArgument<TSchema, TColumns> & { readonly labels?: TLabels }): DefinedTable<TSchema, TColumns> {
  assertDisplayDefinition('table', definition)

  const result = {
    schema: definition.schema,
    columns: snapshotDisplayEntries(definition.columns),
    ...(definition.labels !== undefined ? { labels: { ...definition.labels } } : {}),
  } as DefinedTable<TSchema, TColumns>
  return result
}
