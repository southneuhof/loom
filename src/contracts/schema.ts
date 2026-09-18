import type { FormValidatorInput, ValidationSchema } from './validation'
import type { RecordIdentity, RecordIdentityValue } from './load'

/**
 * Required record keys whose entire value type is a scalar identity.
 * Optional, nullable, boolean, array, and object keys never match.
 */
export type IdentityKeyOf<TRecord> = {
  [TKey in Extract<keyof TRecord, string>]: {} extends Pick<TRecord, TKey>
    ? never
    : [TRecord[TKey]] extends [RecordIdentityValue] ? TKey : never
}[Extract<keyof TRecord, string>]

type KnownKeys<TRecord> = Extract<keyof TRecord, string>
type IsKnownRecord<TRecord> = [Extract<keyof TRecord, string>] extends [never]
  ? false
  : string extends Extract<keyof TRecord, string> ? false : true
type UnknownKeyCheck<TRecord, TKey> = IsKnownRecord<TRecord> extends true
  ? TKey extends KnownKeys<TRecord> ? unknown : never
  : unknown
type ScalarKeyCheck<TRecord, TKey extends string> = IsKnownRecord<TRecord> extends true
  ? TKey extends IdentityKeyOf<TRecord> ? unknown : never
  : unknown
type ScalarTupleCheck<TRecord, TTuple extends readonly string[]> = IsKnownRecord<TRecord> extends true
  ? TTuple[number] extends IdentityKeyOf<TRecord> ? unknown : never
  : unknown
type NonEmptyTupleCheck<TTuple extends readonly string[]> = TTuple extends readonly [] ? never : unknown
type DuplicateTupleCheck<TTuple extends readonly string[]> = TTuple extends readonly [infer TFirst extends string, ...infer TRest extends string[]]
  ? TFirst extends TRest[number] ? never : DuplicateTupleCheck<TRest>
  : unknown

/** Identity return contract shared by declaration functions. */
export type IdentityFunction<TRecord, TIdentity extends RecordIdentity = RecordIdentity> = (record: TRecord) => TIdentity

export type SchemaIdentityDeclaration<
  TRecord extends object,
  TIdentity extends RecordIdentity = RecordIdentity,
> =
  | Extract<keyof TRecord, string>
  | readonly Extract<keyof TRecord, string>[]
  | ((record: TRecord) => TIdentity)

/** Guard for one key declaration against its known record shape. */
export type CheckedIdentityKey<TRecord, TKey> = UnknownKeyCheck<TRecord, TKey> & ScalarKeyCheck<TRecord, TKey & string>
/** Guard for one key-tuple declaration against its known record shape. */
export type CheckedIdentityKeys<TRecord, TTuple> = IsKnownRecord<TRecord> extends true
  ? TTuple extends readonly string[]
    ? UnknownKeyCheck<TRecord, TTuple[number]> & ScalarTupleCheck<TRecord, TTuple> & NonEmptyTupleCheck<TTuple> & DuplicateTupleCheck<TTuple>
    : never
  : unknown
/** Guard for one function declaration against its known record shape. */
export type CheckedIdentityFunction<TRecord, TFunction> = IsKnownRecord<TRecord> extends true
  ? TFunction extends (record: TRecord) => infer TReturn
    ? TReturn extends RecordIdentity ? unknown : never
    : never
  : unknown
/** Guard for the absent declaration: the `id` default needs a required scalar. */
export type CheckedDefaultIdentity<TRecord> = IsKnownRecord<TRecord> extends true
  ? 'id' extends IdentityKeyOf<TRecord> ? unknown : never
  : unknown

type TTupleHasDuplicate<TTuple extends readonly string[]> = TTuple extends readonly [infer TFirst extends string, ...infer TRest extends string[]]
  ? TFirst extends TRest[number] ? true : TTupleHasDuplicate<TRest>
  : false
type TTupleHasInvalidMember<TRecord, TTuple extends readonly string[]> = TTuple[number] extends IdentityKeyOf<TRecord> ? false : true

/** Identity inferred from one declaration against its known record shape. */
export type IdentityFromDeclaration<TSchema, TRecord extends object> = IsKnownRecord<TRecord> extends true
  ? TSchema extends { identity?: infer TDeclaration }
    ? TDeclaration extends Extract<keyof TRecord, string>
      ? TDeclaration extends IdentityKeyOf<TRecord> ? TRecord[TDeclaration] & RecordIdentityValue : RecordIdentityValue
      : TDeclaration extends readonly Extract<keyof TRecord, string>[]
        ? TDeclaration extends readonly []
          ? RecordIdentityValue
          : TTupleHasDuplicate<TDeclaration> extends true
            ? RecordIdentityValue
            : TTupleHasInvalidMember<TRecord, TDeclaration> extends true
              ? RecordIdentityValue
              : { [TKey in TDeclaration[number]]: TRecord[TKey & keyof TRecord] & RecordIdentityValue }
        : TDeclaration extends (record: TRecord) => infer TValue
          ? TValue extends RecordIdentity ? TValue : RecordIdentityValue
          : RecordIdentityValue
    : 'id' extends IdentityKeyOf<TRecord> ? TRecord['id' & keyof TRecord] & RecordIdentityValue : RecordIdentityValue
  : TSchema extends { identity?: infer TDeclaration }
    ? TDeclaration extends Extract<keyof TRecord, string>
      ? TRecord[TDeclaration] extends RecordIdentityValue ? TRecord[TDeclaration] : RecordIdentityValue
      : TDeclaration extends readonly Extract<keyof TRecord, string>[]
        ? { [TKey in TDeclaration[number]]: TRecord[TKey] extends RecordIdentityValue ? TRecord[TKey] : RecordIdentityValue }
        : TDeclaration extends (record: TRecord) => infer TValue
          ? TValue extends RecordIdentity ? TValue : RecordIdentityValue
          : RecordIdentityValue
    : RecordIdentityValue

/**
 * Declaration guard for a known record shape. Broad or erased shapes keep the
 * declaration unchecked so runtime validation still applies. A known invalid
 * declaration resolves to `never` so the authoring call fails to compile.
 */
export type CheckedSchemaIdentity<TRecord, TDeclaration> = [TDeclaration] extends [string]
  ? [CheckedIdentityKey<TRecord, TDeclaration>] extends [never] ? { readonly __invalidResourceIdentity__: never } : unknown
  : [TDeclaration] extends [readonly unknown[]]
    ? [CheckedIdentityKeys<TRecord, TDeclaration>] extends [never] ? { readonly __invalidResourceIdentity__: never } : unknown
    : [TDeclaration] extends [(record: never) => unknown]
      ? [CheckedIdentityFunction<TRecord, TDeclaration>] extends [never] ? { readonly __invalidResourceIdentity__: never } : unknown
      : [TDeclaration] extends [undefined]
        ? [CheckedDefaultIdentity<TRecord>] extends [never] ? { readonly __invalidResourceIdentity__: never } : unknown
        : unknown

/** Invalid known identity marker shared by authoring-call guards. */
export type InvalidSchemaIdentity = { readonly __invalidResourceIdentity__: never }

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

export type WebResourceIdentityOf<TSchema> = IdentityFromDeclaration<TSchema, WebResourceRecordOf<TSchema> extends object ? WebResourceRecordOf<TSchema> : Record<string, unknown>>
