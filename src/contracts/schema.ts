import type { FormValidatorInput, ValidationSchema } from './validation'
import type { RecordIdentity, RecordIdentityValue } from './load'

export type SchemaIdentityDeclaration<
  TRecord extends object,
  TIdentity extends RecordIdentity = RecordIdentity,
> =
  | Extract<keyof TRecord, string>
  | readonly Extract<keyof TRecord, string>[]
  | ((record: TRecord) => TIdentity)

export interface WebResourceSchemaPart<TValue extends object> {
  schema?: ValidationSchema<TValue>
}

export interface WebResourceWriteSchemaPart<TValue extends object> extends WebResourceSchemaPart<TValue> {
  validators?: readonly FormValidatorInput<TValue>[]
}

export interface WebResourceSchema<
  TRecord extends object = object,
  TQuery extends object = object,
  TCreate extends object = object,
  TUpdate extends object = TCreate,
  TIdentity extends RecordIdentity = RecordIdentity,
> {
  identity?: SchemaIdentityDeclaration<TRecord, TIdentity>
  record?: WebResourceSchemaPart<TRecord>
  query?: WebResourceSchemaPart<TQuery>
  create?: WebResourceWriteSchemaPart<TCreate>
  update?: WebResourceWriteSchemaPart<TUpdate>
}

export type WebResourceSchemaBoundary = {
  identity?: string | readonly string[] | ((record: never) => RecordIdentity)
  record?: { schema?: ValidationSchema<object> }
  query?: { schema?: ValidationSchema<object> }
  create?: { schema?: ValidationSchema<object>; validators?: readonly unknown[] }
  update?: { schema?: ValidationSchema<object>; validators?: readonly unknown[] }
}

export type WebResourceRecordOf<TSchema> = TSchema extends WebResourceSchema<infer TValue, infer _TQuery, infer _TCreate, infer _TUpdate, infer _TIdentity>
  ? TValue
  : TSchema extends { record?: { schema?: ValidationSchema<infer TValue> } } ? TValue : never
export type WebResourceQueryOf<TSchema> = TSchema extends WebResourceSchema<infer _TRecord, infer TValue, infer _TCreate, infer _TUpdate, infer _TIdentity>
  ? TValue
  : TSchema extends { query?: { schema?: ValidationSchema<infer TValue> } } ? TValue : never
export type WebResourceCreateOf<TSchema> = TSchema extends WebResourceSchema<infer _TRecord, infer _TQuery, infer TValue, infer _TUpdate, infer _TIdentity>
  ? TValue
  : TSchema extends { create?: { schema?: ValidationSchema<infer TValue> } } ? TValue : never
export type WebResourceUpdateOf<TSchema> = TSchema extends WebResourceSchema<infer _TRecord, infer _TQuery, infer _TCreate, infer TValue, infer _TIdentity>
  ? TValue
  : TSchema extends { update?: { schema?: ValidationSchema<infer TValue> } } ? TValue : never
type IdentityFromDeclaration<TSchema, TRecord extends object> = TSchema extends { identity?: infer TDeclaration }
  ? TDeclaration extends Extract<keyof TRecord, string>
    ? TRecord[TDeclaration] extends RecordIdentityValue ? TRecord[TDeclaration] : RecordIdentityValue
    : TDeclaration extends readonly Extract<keyof TRecord, string>[]
      ? { [TKey in TDeclaration[number]]: TRecord[TKey] extends RecordIdentityValue ? TRecord[TKey] : RecordIdentityValue }
      : TDeclaration extends (record: TRecord) => infer TValue
        ? TValue extends RecordIdentity ? TValue : RecordIdentityValue
        : RecordIdentityValue
  : RecordIdentityValue

export type WebResourceIdentityOf<TSchema> = IdentityFromDeclaration<TSchema, WebResourceRecordOf<TSchema> extends object ? WebResourceRecordOf<TSchema> : Record<string, unknown>>
