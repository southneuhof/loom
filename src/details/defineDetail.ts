import type { DetailField, DetailFieldContext, DetailFieldsContext, DetailSection, DetailDefinition } from '../contracts/details'
import type { CompactDisplayField, DisplayFieldGuard, DisplayFieldValue } from '../display/compatibility'
import type { LabelDictionary } from '../contracts/labels'
import type { RawSchema, RawSchemaOutput } from '../contracts/schema'
import { assertDisplayDefinition, snapshotDisplayEntries } from '../display/assertDisplayDefinition'

type UnsafeKey = '__proto__' | 'prototype' | 'constructor' | `${number}`
type FiniteRecordGuard<TRecord extends object> = string extends Extract<keyof TRecord, string> ? never : unknown
type DetailSchemaGuard<TSchema extends RawSchema<object, object>> = FiniteRecordGuard<RawSchemaOutput<TSchema>>
type AllowedFieldMember = keyof DetailField
type KeysOfUnion<TValue> = TValue extends unknown ? keyof TValue : never

type DetailFieldConfig<TField> = TField extends (...args: never[]) => unknown ? ReturnType<TField> : TField

type DetailFieldGuard<TRecord extends object, TKey extends string, TField> = [DetailFieldConfig<TField>] extends [DetailField<TRecord, DisplayFieldValue<TRecord, TKey, DetailFieldConfig<TField>>>]
  ? Exclude<KeysOfUnion<DetailFieldConfig<TField>>, AllowedFieldMember> extends never
    ? DisplayFieldGuard<TRecord, TKey, DetailFieldConfig<TField>>
    : never
  : never

type DetailFieldsGuard<TRecord extends object, TFields> = TFields extends object
  ? TFields extends readonly unknown[]
    ? never
    : Extract<keyof TFields, UnsafeKey> extends never
      ? { [TKey in keyof TFields]: TKey extends string ? DetailFieldGuard<NoInfer<TRecord>, TKey, TFields[TKey]> : never }
      : never
  : never

type DetailFieldArgument<TRecord extends object> = DetailField<TRecord> | ((scope: DetailFieldContext<TRecord, any>) => DetailField<TRecord>)

type DetailFieldsArgument<TRecord extends object, TFields extends object> = {
  readonly [TKey in keyof TFields]: DetailFieldArgument<TRecord>
}

type DetailArgument<TSchema extends RawSchema<object, object>, TFields extends object> = {
  readonly schema: TSchema & DetailSchemaGuard<TSchema>
  readonly fields: TFields & DetailFieldsArgument<RawSchemaOutput<TSchema>, TFields> & NoInfer<DetailFieldsGuard<RawSchemaOutput<TSchema>, TFields>>
  readonly sections?: readonly DetailSection<Extract<keyof TFields, string>>[]
  readonly labels?: LabelDictionary
}

type CompactDetailField<TRecord extends object, TKey extends string, TField> = CompactDisplayField<TRecord, DisplayFieldValue<TRecord, TKey, TField>, TField> & {
  readonly emphasis?: 'strong' | 'muted'
  readonly span?: number
}

type CompactDetailEntry<TRecord extends object, TKey extends string, TField> = TField extends (...args: never[]) => unknown
  ? TField
  : CompactDetailField<TRecord, TKey, TField>

type CompactDetailFields<TRecord extends object, TFields extends object> = {
  readonly [TKey in keyof TFields]: TKey extends string ? CompactDetailEntry<TRecord, TKey, TFields[TKey]> : never
}

type DefinedDetail<TSchema extends RawSchema<object, object>, TFields extends object> = DetailDefinition<RawSchemaOutput<TSchema>, CompactDetailFields<RawSchemaOutput<TSchema>, TFields>, Extract<DetailFieldsContext<TFields>, object>>

export function defineDetail<
  TSchema extends RawSchema<object, object>,
  const TFields extends object,
  const TLabels extends LabelDictionary | undefined = undefined,
>(definition: DetailArgument<TSchema, TFields> & { readonly labels?: TLabels }): DefinedDetail<TSchema, TFields> {
  assertDisplayDefinition('detail', definition)

  const result = {
    schema: definition.schema,
    fields: snapshotDisplayEntries(definition.fields),
    ...(definition.sections !== undefined
      ? {
          sections: definition.sections.map((section) => ({
            title: section.title,
            ...(section.description !== undefined ? { description: section.description } : {}),
            fields: [...section.fields],
          })),
        }
      : {}),
    ...(definition.labels !== undefined ? { labels: { ...definition.labels } } : {}),
  } as DefinedDetail<TSchema, TFields>
  return result
}
