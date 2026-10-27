import type { DisplayField } from './display'
import type { LabelDictionary } from './labels'
import type { RawSchema } from './schema'
import type { ContextRequirements } from './contextRequirements'

export interface DetailFieldContext<TRecord extends object, TContext extends object = {}> {
  readonly record: TRecord
  readonly context: TContext
}

export interface DetailField<TRecord extends object = Record<string, unknown>, TValue = unknown> extends DisplayField<TRecord, TValue> {
  readonly emphasis?: 'strong' | 'muted'
  readonly span?: number
}

export type DetailFieldResolver<
  TRecord extends object,
  TContext extends object = {},
> = (scope: DetailFieldContext<TRecord, TContext>) => DetailField<TRecord>

export type DetailFieldEntry<TRecord extends object, TContext extends object = {}> =
  | DetailField<TRecord>
  | DetailFieldResolver<TRecord, TContext>

type DetailFieldContexts<TFields> = {
  [TKey in keyof TFields]: Exclude<TFields[TKey], undefined> extends (...args: infer TArgs) => unknown
    ? TArgs extends [infer TScope] ? TScope extends { readonly record: object; readonly context: infer TContext } ? TContext : never : never
    : never
}[keyof TFields]

export type DetailFieldsContext<TFields extends object> = ContextRequirements<DetailFieldContexts<TFields>>

export interface DetailDefinition<
  TRecord extends object = Record<string, unknown>,
  TFields extends Readonly<Record<string, unknown>> = Readonly<Record<string, DetailFieldEntry<TRecord>>>,
  TContext extends object = Readonly<Record<string, unknown>>,
> {
  readonly schema: RawSchema<object, TRecord>
  readonly fields: TFields
  readonly labels?: LabelDictionary
  readonly context?: TContext
}
