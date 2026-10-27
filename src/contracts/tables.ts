import type { DisplayField, DisplayValueConfiguration } from './display'
import type { LabelDictionary } from './labels'
import type { RawSchema } from './schema'
import type { CallbackScopeContext, ContextRequirements } from './contextRequirements'

export interface TableColumnContext<TContext extends object = {}> {
  readonly context: TContext
}

export type TableColumnContextValue<TEntry> = CallbackScopeContext<TEntry>

type TableColumnCellContextValue<TEntry> = (TEntry extends (...args: never[]) => unknown ? ReturnType<TEntry> : TEntry) extends { readonly cell: infer TCell }
  ? CallbackScopeContext<TCell>
  : never

export type TableColumnCell<TRecord extends object, TContext extends object = {}> =
  | DisplayValueConfiguration<TRecord>
  | ((scope: { readonly record: TRecord; readonly context: TContext }) => DisplayValueConfiguration<TRecord>)

type TableColumnMetadata<TRecord extends object> = {
  readonly label?: DisplayField<TRecord>['label']
  readonly sortable?: boolean
  readonly sortKey?: Extract<keyof TRecord, string>
  readonly align?: 'start' | 'center' | 'end'
  readonly class?: string
  readonly headerClass?: string
}

export type TableColumn<TRecord extends object = Record<string, unknown>, TValue = unknown, TContext extends object = {}> =
  | (TableColumnMetadata<TRecord> & DisplayField<TRecord, TValue> & { readonly cell?: never })
  | (TableColumnMetadata<TRecord> & {
      readonly cell: TableColumnCell<TRecord, TContext>
      readonly read?: never
      readonly renderer?: never
      readonly props?: never
      readonly format?: never
    })

export type TableColumnResolver<
  TRecord extends object,
  TContext extends object = {},
> = (scope: TableColumnContext<TContext>) => TableColumn<TRecord, unknown, TContext>

export type TableColumnEntry<TRecord extends object, TContext extends object = {}> =
  | TableColumn<TRecord, unknown, TContext>
  | TableColumnResolver<TRecord, TContext>

export type TableColumnsContext<TColumns extends object> = ContextRequirements<{
  [TKey in keyof TColumns]: TableColumnContextValue<Exclude<TColumns[TKey], undefined>> | TableColumnCellContextValue<Exclude<TColumns[TKey], undefined>>
}[keyof TColumns]>

export interface TableDefinition<
  TRecord extends object = Record<string, unknown>,
  TColumns extends Readonly<Record<string, unknown>> = Readonly<Record<string, TableColumnEntry<TRecord>>>,
  TContext extends object = Readonly<Record<string, unknown>>,
> {
  readonly schema: RawSchema<object, TRecord>
  readonly columns: TColumns
  readonly labels?: LabelDictionary
  readonly context?: TContext
}
