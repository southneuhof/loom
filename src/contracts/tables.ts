import type { DisplayField } from './display'
import type { LabelDictionary } from './labels'
import type { RawSchema } from './schema'

export interface TableColumn<
  TRecord extends object = Record<string, unknown>,
  TValue = unknown,
> extends DisplayField<TRecord, TValue> {
  readonly sortable?: boolean
  readonly sortKey?: Extract<keyof TRecord, string>
  readonly align?: 'start' | 'center' | 'end'
  readonly class?: string
  readonly headerClass?: string
}

export interface TableDefinition<TRecord extends object = Record<string, unknown>> {
  readonly schema: RawSchema<object, TRecord>
  readonly columns: Readonly<Record<string, TableColumn<TRecord>>>
  readonly labels?: LabelDictionary
}
