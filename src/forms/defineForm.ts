import { markRaw, toRaw } from 'vue'
import type { BoundFormInput, BoundFormInputResolver, FormSubmitContext, FormDefinition, FormDraftSnapshot, FormFieldContext, FormInput, FormValidatorEntry } from '../contracts/forms'
import type { LabelDictionary } from '../contracts/labels'
import type { MaybePromise } from '../contracts/load'
import type { RawSchema, RawSchemaInput, RawSchemaOutput } from '../contracts/schema'
import type { FileInputMode, FileInputModelValue } from '../components/inputs/fileInput.types'
import type { TextInputConstraint, TextInputModelValue } from '../components/inputs/textInput.types'
import type { TextareaInputConstraint, TextareaInputModelValue } from '../components/inputs/textareaInput.types'
import type { CheckboxGroupInputModelValue, RadioInputModelValue, SelectInputModelValue } from '../components/inputs/selectInput.types'
import type { FormRenderer, FormRendererKey, FormComponentModelInput, FormRendererModelValue, FormRendererProps } from '../renderers/formContracts'
import { assertFormDefinition } from './assertFormDefinition'
import type { CompactFormDefinition, FormDefinitionError, FormFieldsContext } from './definitionTypes'

type UnsafeKey = '__proto__' | 'prototype' | 'constructor' | `${number}`
type FiniteObjectGuard<TValue extends object> = string extends Extract<keyof TValue, string> ? never : unknown
type FormSchemaGuard<TSchema extends RawSchema<object, object>> = FiniteObjectGuard<RawSchemaInput<TSchema>> & FiniteObjectGuard<RawSchemaOutput<TSchema>>

type RequiredKeys<TObject> = {
  [TKey in keyof TObject]-?: {} extends Pick<TObject, TKey> ? never : TKey
}[keyof TObject]

type IsAny<TValue> = 0 extends 1 & TValue ? true : false

type SelectedRenderer<TInput extends object, TKey extends keyof TInput, TEntry> = TEntry extends { renderer: infer TRenderer } ? TRenderer : never
type EntryConfig<TEntry> = TEntry extends (...args: never[]) => unknown ? ReturnType<TEntry> : TEntry

type SelectedProps<TEntry> = TEntry extends { props: infer TProps } ? TProps : {}

type UndefinedOnlyKeys<TProps> = TProps extends object
  ? {
      [TKey in keyof TProps]-?: [Exclude<TProps[TKey], undefined>] extends [never] ? TKey : never
    }[keyof TProps]
  : never

type ExtraProps<TRenderer, TProps, TContext extends object> = TRenderer extends FormRenderer
  ? TProps extends object
    ? Exclude<keyof TProps, keyof FormRendererProps<TRenderer, TContext> | UndefinedOnlyKeys<TProps>>
    : keyof TProps
  : keyof TProps

type ExactRendererProps<TRenderer, TProps, TContext extends object> = TRenderer extends FormRenderer
  ? IsAny<FormRendererProps<TRenderer, TContext>> extends true
    ? never
    : unknown extends FormRendererProps<TRenderer, TContext>
      ? never
      : [ExtraProps<TRenderer, TProps, TContext>] extends [never]
        ? [TProps] extends [FormRendererProps<TRenderer, TContext>]
          ? unknown
          : never
        : never
  : never

type TextModelValue<TEntry> =
  SelectedProps<TEntry> extends { constraint?: infer TConstraint }
    ? TConstraint extends readonly TextInputConstraint[]
      ? TextInputModelValue<TConstraint>
      : TextInputModelValue<readonly ['decimal', 'text']>
    : TextInputModelValue<readonly ['decimal', 'text']>

type SelectedTextareaConstraint<TProps> = TProps extends { constraint?: infer TConstraint }
  ? Exclude<TConstraint, undefined> extends readonly TextareaInputConstraint[]
    ? Exclude<TConstraint, undefined> | (undefined extends TConstraint ? undefined : never)
    : undefined
  : undefined

type TextareaRendererControlValue<TEntry> = TextareaInputModelValue<SelectedTextareaConstraint<SelectedProps<TEntry>>>

type SelectedAssetMulti<TProps> = TProps extends object
  ? 'multi' extends keyof TProps
    ? Extract<Exclude<TProps['multi' & keyof TProps], undefined>, boolean> | (undefined extends TProps['multi' & keyof TProps] ? undefined : never)
    : false
  : false

type SelectedInputMode<TProps> = TProps extends object
  ? 'mode' extends keyof TProps
    ? Exclude<TProps['mode' & keyof TProps], undefined> | (undefined extends TProps['mode' & keyof TProps] ? 'asset' : never)
    : 'asset'
  : 'asset'

type FileRendererControlValue<TEntry> = FileInputModelValue<SelectedInputMode<SelectedProps<TEntry>> & FileInputMode, SelectedAssetMulti<SelectedProps<TEntry>>>

type FileModePropsGuard<TRenderer, TEntry> = TRenderer extends 'file' | 'image' | 'canvas'
  ? SelectedInputMode<SelectedProps<TEntry>> extends 'asset'
    ? unknown
    : Extract<keyof SelectedProps<TEntry>, 'destination' | 'upload'> extends never
      ? unknown
      : never
  : unknown

type RendererControlValue<TRenderer extends FormRenderer, TEntry> = TRenderer extends 'table'
  ? SelectedProps<TEntry> extends { mode: 'inline'; createRow: () => infer TRow extends object }
    ? TRow[]
    : FormRendererModelValue<TRenderer>
  : TRenderer extends 'text'
    ? TextModelValue<TEntry>
    : TRenderer extends 'textarea'
      ? TextareaRendererControlValue<TEntry>
      : TRenderer extends 'select' | 'lookup'
        ? SelectInputModelValue<SelectedProps<TEntry>>
        : TRenderer extends 'radio'
          ? RadioInputModelValue<SelectedProps<TEntry>>
          : TRenderer extends 'checkbox-group'
            ? CheckboxGroupInputModelValue<SelectedProps<TEntry>>
            : TRenderer extends 'file' | 'image'
              ? FileRendererControlValue<TEntry>
              : TRenderer extends 'canvas'
                ? FileInputModelValue<SelectedInputMode<SelectedProps<TEntry>> & FileInputMode, false>
                : FormRendererModelValue<TRenderer>

type InvalidRendererChoices<TValue, TRenderer, TEntry> = TRenderer extends FormRenderer
  ? TRenderer extends FormRendererKey
    ? [Exclude<RendererControlValue<TRenderer, TEntry>, null | undefined>] extends [Exclude<TValue, null | undefined>]
      ? never
      : TRenderer
    : [RendererControlValue<TRenderer, TEntry>] extends [never]
      ? TRenderer
      : [Exclude<RendererControlValue<TRenderer, TEntry>, null | undefined>] extends [Exclude<TValue, null | undefined>]
        ? [Exclude<TValue, null | undefined>] extends [Exclude<FormComponentModelInput<TRenderer>, null | undefined>]
          ? never
          : TRenderer
        : TRenderer
  : TRenderer

type RendererValueGuard<TValue, TRenderer, TEntry> = [InvalidRendererChoices<TValue, TRenderer, TEntry>] extends [never] ? unknown : never

type InvalidRequiredProp<TProps> = TProps extends unknown ? ('required' extends keyof TProps ? true : never) : never
type InvalidRequiredPropEntry<TEntry> = TEntry extends { props: infer TProps } ? InvalidRequiredProp<TProps> : never
type RequiredPropGuard<TEntry> = [InvalidRequiredPropEntry<TEntry>] extends [never] ? unknown : never

type InvalidRendererProps<TInput extends object, TKey extends keyof TInput, TEntry, TContext extends object> =
  SelectedRenderer<TInput, TKey, TEntry> extends infer TRenderer
    ? TRenderer extends unknown
      ? TRenderer extends FormRenderer
        ? [ExactRendererProps<TRenderer, SelectedProps<TEntry>, TContext>] extends [never]
          ? TRenderer
          : never
        : TRenderer
      : never
    : never

type RendererPropsGuard<TInput extends object, TKey extends keyof TInput, TEntry, TContext extends object> = [InvalidRendererProps<TInput, TKey, TEntry, TContext>] extends [never] ? unknown : never

type FormInputEntryMemberGuard<TInput extends object, TKey extends keyof TInput, TEntry, TContext extends object> =
  Omit<TEntry, 'initialValue'> extends FormInput<TInput, TInput[TKey], FormRenderer, TContext>
    ? Exclude<keyof TEntry, keyof FormInput<TInput, TInput[TKey], FormRenderer, TContext>> extends never
      ? RequiredPropGuard<TEntry> &
          RendererPropsGuard<TInput, TKey, TEntry, TContext> &
          FileModePropsGuard<SelectedRenderer<TInput, TKey, TEntry>, TEntry> &
          RendererValueGuard<TInput[TKey], SelectedRenderer<TInput, TKey, TEntry>, TEntry> & InlineArrayGuard<TEntry, TContext>
      : never
    : never

type InlineFieldsGuard<TRow extends object, TFields, TContext extends object> = {
  [TKey in keyof TFields]: TKey extends keyof TRow ? FormInputEntryMemberGuard<TRow, TKey, Omit<TFields[TKey], 'required'>, TContext> : never
}

type InlineArrayGuard<TEntry, TContext extends object> = TEntry extends { props: { mode: 'inline'; createRow: () => infer TRow extends object; fields: infer TFields } }
  ? (TFields extends (...args: never[]) => infer TResolved ? TResolved extends InlineFieldsGuard<TRow, TResolved, TContext> ? unknown : never : TFields extends InlineFieldsGuard<TRow, TFields, TContext> ? unknown : never)
  : unknown

type EntryGuardAllows<TValue> = [TValue] extends [never] ? false : true
type FormInputEntryMemberResults<TInput extends object, TKey extends keyof TInput, TEntry, TContext extends object> = TEntry extends unknown
  ? EntryGuardAllows<FormInputEntryMemberGuard<TInput, TKey, TEntry, TContext>>
  : never

type FormInputEntryGuard<TInput extends object, TKey extends keyof TInput, TEntry, TContext extends object> = [TEntry] extends [never]
  ? never
  : [FormInputEntryMemberResults<TInput, TKey, TEntry, TContext>] extends [true]
    ? unknown
    : never

type BoundInputGuard<TInput extends object, TEntry, TContext extends object> =
  EntryConfig<TEntry> extends { renderer: infer TRenderer extends FormRenderer }
    ? FormInputEntryMemberGuard<TInput & { __boundValue: RendererControlValue<TRenderer, EntryConfig<TEntry>> }, '__boundValue', Omit<EntryConfig<TEntry>, 'binding'>, TContext>
    : never

type BindingKeys<TEntry> = EntryConfig<TEntry> extends { binding: { keys: infer TKeys extends readonly PropertyKey[] } } ? (number extends TKeys['length'] ? never : TKeys[number]) : never

type WrittenKeys<TKey, TEntry> = EntryConfig<TEntry> extends { binding: unknown } ? BindingKeys<TEntry> : TKey

type OtherWrittenKeys<TFields, TKey extends keyof TFields> = {
  [TOther in Exclude<keyof TFields, TKey>]: WrittenKeys<TOther, TFields[TOther]>
}[Exclude<keyof TFields, TKey>]

type MissingWriteKeys<TKeys, TResult> = TResult extends unknown ? Exclude<TKeys, RequiredKeys<TResult>> : never

type ExtraWriteKeys<TKeys, TResult> = TResult extends unknown ? Exclude<keyof TResult, TKeys> : never

type BindingWriteGuard<TEntry> =
  EntryConfig<TEntry> extends { binding: { keys: infer TKeys extends readonly PropertyKey[]; write: (...args: never[]) => infer TResult } }
    ? number extends TKeys['length']
      ? unknown
      : ([MissingWriteKeys<TKeys[number], TResult>] extends [never] ? unknown : { readonly __bindingWriteMissingKeys: MissingWriteKeys<TKeys[number], TResult> }) &
          ([ExtraWriteKeys<TKeys[number], TResult>] extends [never] ? unknown : { readonly __bindingWriteExtraKeys: ExtraWriteKeys<TKeys[number], TResult> })
    : unknown

type BindingContractGuard<TFields, TKey extends keyof TFields> = BindingWriteGuard<TFields[TKey]> &
  ([Extract<WrittenKeys<TKey, TFields[TKey]>, OtherWrittenKeys<TFields, TKey>>] extends [never]
    ? unknown
    : { readonly __bindingKeysAlreadyWritten: Extract<WrittenKeys<TKey, TFields[TKey]>, OtherWrittenKeys<TFields, TKey>> })

type FormFieldsGuard<TInput extends object, TFields extends object, TContext extends object = Readonly<Record<string, unknown>>> = TFields extends object
  ? TFields extends readonly unknown[]
    ? never
    : Extract<keyof TFields, UnsafeKey> extends never
      ? {
          [TKey in keyof TFields]: BindingContractGuard<TFields, TKey> &
            ('initialValue' extends keyof EntryConfig<TFields[TKey]>
              ? {
                  initialValue?: EntryConfig<TFields[TKey]> extends { renderer: infer TRenderer extends FormRenderer; binding: unknown }
                    ? FormInput<TInput, RendererControlValue<TRenderer, EntryConfig<TFields[TKey]>>, TRenderer, TContext>['initialValue']
                    : TKey extends keyof TInput
                      ? FormInput<TInput, TInput[TKey], FormRenderer, TContext>['initialValue']
                      : never
                }
              : unknown) &
            (EntryConfig<TFields[TKey]> extends { binding: unknown }
              ? BoundInputGuard<TInput, TFields[TKey], TContext>
              : TKey extends keyof TInput
                ? FormInputEntryGuard<NoInfer<TInput>, TKey, EntryConfig<TFields[TKey]>, TContext>
                : never)
        }
      : never
  : never

type SubmitFunction<TOutput extends object, TContext extends object = Readonly<Record<string, unknown>>> = (output: TOutput, scope: FormSubmitContext<TContext>) => MaybePromise<unknown>
type SubmitResult<TSubmit> = [TSubmit] extends [never] ? unknown : TSubmit extends (...args: never[]) => infer TResult ? Awaited<TResult> : unknown

type EffectiveFormContext<TFields extends object> = [FormFieldsContext<TFields>] extends [never] ? {} : Extract<FormFieldsContext<TFields>, object>

type DefinedForm<TInput extends object, TOutput extends object, TResult, TFields extends object, TContext extends object, THasSubmit extends boolean> = CompactFormDefinition<
  TInput,
  TOutput,
  TFields,
  TContext
> &
  ([THasSubmit] extends [true]
    ? {
        readonly submit: ((...args: [FormFieldsContext<TFields>] extends [never] ? [output: TOutput] : [output: TOutput, scope: FormSubmitContext<TContext>]) => MaybePromise<TResult>) &
          (TFields extends FormFieldsGuard<TInput, TFields> ? unknown : FormDefinitionError)
      }
    : { readonly submit?: never })

function snapshotMap<T extends object>(value: T, clone: (entry: unknown) => unknown): T {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)])) as T
}

function snapshotInput(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const input = { ...value }
  const renderer = Reflect.get(value, 'renderer')
  if (renderer && (typeof renderer === 'object' || typeof renderer === 'function')) Object.assign(input, { renderer: markRaw(toRaw(renderer)) })
  const props = Reflect.get(value, 'props')
  const behavior = Reflect.get(value, 'behavior')
  const binding = Reflect.get(value, 'binding')
  if (binding && typeof binding === 'object') Object.assign(input, { binding: { ...binding, keys: [...Reflect.get(binding, 'keys')] } })
  if (props && typeof props === 'object' && !Array.isArray(props)) Object.assign(input, { props: { ...props } })
  if (behavior && typeof behavior === 'object' && !Array.isArray(behavior)) Object.assign(input, { behavior: { ...behavior } })
  return input
}

function snapshotValidators<TInput extends object, TOutput extends object, TContext extends object>(
  validators: readonly FormValidatorEntry<TInput, TOutput, TContext>[]
): FormValidatorEntry<TInput, TOutput, TContext>[] {
  return validators.map((validator) => {
    const result: FormValidatorEntry<TInput, TOutput, TContext> = { ...validator }
    const triggers = Reflect.get(validator, 'triggers')
    const path = Reflect.get(validator, 'path')
    if (Array.isArray(triggers)) Object.assign(result, { triggers: [...triggers] })
    if (Array.isArray(path)) Object.assign(result, { path: [...path] })
    return result
  })
}

type FormFieldResolverArgument<TInput extends object, TValue> = (context: FormFieldContext<TInput, any>) => FormInput<TInput, TValue, FormRenderer, any>

type FormFieldArgument<TInput extends object> = {
  readonly [TKey in keyof TInput]?: FormInput<TInput, TInput[TKey], FormRenderer, any> | FormFieldResolverArgument<TInput, TInput[TKey]>
}

type BoundFieldArgument<TInput extends object, TFields extends object> = {
  readonly [TKey in Exclude<keyof TFields, keyof TInput>]:
    | BoundFormInput<TInput, EntryConfig<TFields[TKey]> extends { renderer: infer TRenderer extends FormRenderer } ? TRenderer : FormRenderer, any>
    | BoundFormInputResolver<TInput, any, EntryConfig<TFields[TKey]> extends { renderer: infer TRenderer extends FormRenderer } ? TRenderer : FormRenderer>
}

type FormArgument<TSchema extends RawSchema<object, object>, TFields extends object> = {
  schema: TSchema & FormSchemaGuard<TSchema>
  fields: TFields & FormFieldArgument<RawSchemaInput<TSchema>> & BoundFieldArgument<RawSchemaInput<TSchema>, TFields> & NoInfer<FormFieldsGuard<RawSchemaInput<TSchema>, TFields>>
  labels?: LabelDictionary
  validators?: readonly FormValidatorEntry<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>, EffectiveFormContext<TFields>>[]
}

export function defineForm<TSchema extends RawSchema<object, object>, const TFields extends object, TSubmit extends SubmitFunction<NoInfer<RawSchemaOutput<TSchema>>, EffectiveFormContext<TFields>>>(
  definition: FormArgument<TSchema, TFields> & { submit: TSubmit }
): DefinedForm<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>, SubmitResult<TSubmit>, TFields, EffectiveFormContext<TFields>, true>
export function defineForm<TSchema extends RawSchema<object, object>, const TFields extends object>(
  definition: FormArgument<TSchema, TFields> & { submit?: never }
): DefinedForm<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>, unknown, TFields, EffectiveFormContext<TFields>, false>
export function defineForm<TSchema extends RawSchema<object, object>, const TFields extends object>(definition: {
  schema: TSchema & FormSchemaGuard<TSchema>
  fields: TFields
  labels?: LabelDictionary
  validators?: readonly FormValidatorEntry<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>, EffectiveFormContext<TFields>>[]
  submit?: SubmitFunction<RawSchemaOutput<TSchema>>
}): unknown {
  assertFormDefinition<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>, unknown, Extract<keyof RawSchemaInput<TSchema>, string>, Readonly<Record<string, unknown>>>(
    definition as unknown as FormDefinition<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>>
  )

  const result: Record<string, unknown> = {
    schema: definition.schema,
    fields: snapshotMap(definition.fields, snapshotInput),
  }
  if (definition.labels !== undefined) result.labels = { ...definition.labels }
  if (definition.validators !== undefined) result.validators = snapshotValidators(definition.validators)
  if (definition.submit !== undefined) result.submit = definition.submit
  return result
}
