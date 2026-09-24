import type { FormDefinition, FormFields, FormInput, FormValidatorEntry } from '../contracts/forms'
import type { ReadonlySurfaceConfiguration } from '../contracts/display'
import type { LabelDictionary } from '../contracts/labels'
import type { MaybePromise } from '../contracts/load'
import type { RawSchema, RawSchemaInput, RawSchemaOutput } from '../contracts/schema'
import type { FormRendererKey, FormRendererPropBag } from '../renderers/formContracts'
import { compileForm } from './compileForm'

type UnsafeKey = '__proto__' | 'prototype' | 'constructor' | `${number}`
type FiniteObjectGuard<TValue extends object> = string extends Extract<keyof TValue, string> ? never : unknown
type FormSchemaGuard<TSchema extends RawSchema<object, object>> =
  FiniteObjectGuard<RawSchemaInput<TSchema>> & FiniteObjectGuard<RawSchemaOutput<TSchema>>
type InputProps<TRenderer extends FormRendererKey> = FormInput<object, unknown, TRenderer>['props']

type RequiredPropGuard<TEntry> = TEntry extends { props: infer TProps }
  ? 'required' extends keyof TProps ? never : unknown
  : unknown

type RequiredReturnGuard<TCallback> = TCallback extends (...args: never[]) => infer TResult
  ? TResult extends object
    ? 'required' extends keyof TResult ? never : unknown
    : unknown
  : unknown

type BehaviorRequiredPropGuard<TEntry> = TEntry extends { behavior: infer TBehavior }
  ? TBehavior extends { props: infer TProps }
    ? RequiredReturnGuard<TProps>
    : unknown
  : unknown

type PresentationRequiredPropGuard<TEntry> = TEntry extends { behavior: infer TBehavior }
  ? TBehavior extends { presentation: infer TPresentation }
    ? TPresentation extends (...args: never[]) => infer TResult
      ? TResult extends { props: infer TProps }
        ? RequiredReturnGuard<() => TProps>
        : unknown
      : unknown
    : unknown
  : unknown

type DefaultRenderer<TValue> = [NonNullable<TValue>] extends [never]
  ? never
  : [NonNullable<TValue>] extends [string]
    ? string extends NonNullable<TValue> ? 'text' : 'select'
    : [NonNullable<TValue>] extends [number]
      ? 'number'
      : [NonNullable<TValue>] extends [boolean]
        ? 'switch'
        : [NonNullable<TValue>] extends [Date]
          ? 'date'
          : never

type RendererFor<TInput extends object, TKey extends keyof TInput, TEntry> = TEntry extends { renderer: infer TRenderer }
  ? TRenderer
  : DefaultRenderer<TInput[TKey]>

type IsAny<TValue> = 0 extends (1 & TValue) ? true : false
type RendererControlValue<TRenderer extends FormRendererKey> =
  FormRendererPropBag<TRenderer> extends { modelValue?: infer TValue }
    ? IsAny<TValue> extends true
      ? never
      : unknown extends TValue ? never : TValue
    : FormRendererPropBag<TRenderer> extends { value?: infer TValue }
      ? IsAny<TValue> extends true
        ? never
        : unknown extends TValue ? never : TValue
      : never
type RendererEditableValue<TRenderer> = TRenderer extends 'date'
  ? Date
  : TRenderer extends FormRendererKey ? RendererControlValue<TRenderer> : never

type ValueFitsRenderer<TValue, TRenderer> = [RendererEditableValue<TRenderer>] extends [never]
  ? false
  : [Exclude<TValue, null | undefined>] extends [Exclude<RendererEditableValue<TRenderer>, null | undefined>]
    ? true
    : false

type InvalidRendererChoices<TValue, TRenderers> = TRenderers extends FormRendererKey
  ? ValueFitsRenderer<TValue, TRenderers> extends true ? never : TRenderers
  : never

type RendererValueGuard<TValue, TRenderers> = [InvalidRendererChoices<TValue, TRenderers>] extends [never] ? unknown : never

type PresentationRenderers<TEntry> = TEntry extends { behavior: infer TBehavior }
  ? TBehavior extends { presentation: infer TPresentation }
    ? TPresentation extends (...args: never[]) => infer TResult
      ? TResult extends { renderer?: infer TRenderer }
        ? Exclude<TRenderer, null | undefined>
        : never
      : never
    : never
  : never

type PresentationRendererGuard<TValue, TEntry> = RendererValueGuard<TValue, PresentationRenderers<TEntry>>

type RendererPropsGuard<TInput extends object, TKey extends keyof TInput, TEntry> = RendererFor<TInput, TKey, TEntry> extends infer TRenderer
  ? TRenderer extends FormRendererKey
    ? 'props' extends keyof TEntry
      ? TEntry extends { props?: infer TProps }
        ? TProps extends InputProps<TRenderer> ? unknown : never
        : never
      : unknown
    : never
  : never

type MissingRendererGuard<TInput extends object, TKey extends keyof TInput, TEntry> = TEntry extends { renderer: FormRendererKey }
  ? unknown
  : [DefaultRenderer<TInput[TKey]>] extends [never] ? never : unknown

type FormInputEntryGuard<TInput extends object, TKey extends keyof TInput, TEntry> = TEntry extends FormInput<TInput, TInput[TKey]>
  ? Exclude<keyof TEntry, keyof FormInput<TInput, TInput[TKey]>> extends never
    ? RequiredPropGuard<TEntry>
      & BehaviorRequiredPropGuard<TEntry>
      & PresentationRequiredPropGuard<TEntry>
      & RendererPropsGuard<TInput, TKey, TEntry>
      & RendererValueGuard<TInput[TKey], RendererFor<TInput, TKey, TEntry>>
      & PresentationRendererGuard<TInput[TKey], TEntry>
      & MissingRendererGuard<TInput, TKey, TEntry>
    : never
  : never

type FormFieldsGuard<TInput extends object, TFields> = TFields extends object
  ? TFields extends readonly unknown[]
    ? never
    : Extract<keyof TFields, UnsafeKey> extends never
      ? Exclude<keyof TFields, Extract<keyof TInput, string>> extends never
        ? { [TKey in keyof TFields]: TKey extends keyof TInput
            ? FormInputEntryGuard<NoInfer<TInput>, TKey, TFields[TKey]>
            : never }
        : never
      : never
  : never

type SubmitFunction<TOutput extends object> = (output: TOutput) => MaybePromise<unknown>
type SubmitResult<TSubmit> = [TSubmit] extends [never]
  ? unknown
  : TSubmit extends (...args: never[]) => infer TResult ? Awaited<TResult> : unknown
type OptionalMember<TName extends string, TValue> = [TValue] extends [never]
  ? { readonly [TKey in TName]?: never }
  : undefined extends TValue
  ? { readonly [TKey in TName]?: never }
  : { readonly [TKey in TName]: ReadonlySurfaceConfiguration<TValue> }

type DefinedForm<
  TSchema extends RawSchema<object, object>,
  TFields extends object,
  TLabels,
  TValidators,
  TSubmit,
> = Omit<FormDefinition<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>, SubmitResult<TSubmit>>, 'schema' | 'fields' | 'labels' | 'validators' | 'submit'> & {
  readonly schema: TSchema
  readonly fields: ReadonlySurfaceConfiguration<TFields>
} & OptionalMember<'labels', TLabels> & OptionalMember<'validators', TValidators> & OptionalMember<'submit', TSubmit>

type FormDefinitionInput<
  TSchema extends RawSchema<object, object>,
  TFields extends FormFields<RawSchemaInput<TSchema>>,
  TLabels extends LabelDictionary | undefined,
  TValidators extends readonly FormValidatorEntry<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>>[] | undefined,
> = {
  schema: TSchema & FormSchemaGuard<TSchema>
  fields: TFields & FormFieldsGuard<RawSchemaInput<TSchema>, TFields>
  labels?: TLabels
  validators?: TValidators
}

function snapshotMap<T extends object>(value: T, clone: (entry: unknown) => unknown): T {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)])) as T
}

function snapshotInput(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const input = { ...value }
  const props = Reflect.get(value, 'props')
  const behavior = Reflect.get(value, 'behavior')
  if (props && typeof props === 'object' && !Array.isArray(props)) Object.assign(input, { props: { ...props } })
  if (behavior && typeof behavior === 'object' && !Array.isArray(behavior)) Object.assign(input, { behavior: { ...behavior } })
  return input
}

function snapshotValidators<TInput extends object, TOutput extends object>(
  validators: readonly FormValidatorEntry<TInput, TOutput>[],
): FormValidatorEntry<TInput, TOutput>[] {
  return validators.map((validator) => {
    const result: FormValidatorEntry<TInput, TOutput> = { ...validator }
    const triggers = Reflect.get(validator, 'triggers')
    const path = Reflect.get(validator, 'path')
    if (Array.isArray(triggers)) Object.assign(result, { triggers: [...triggers] })
    if (Array.isArray(path)) Object.assign(result, { path: [...path] })
    return result
  })
}

export function defineForm<
  TSchema extends RawSchema<object, object>,
  const TFields extends FormFields<RawSchemaInput<TSchema>>,
  const TLabels extends LabelDictionary | undefined,
  const TValidators extends readonly FormValidatorEntry<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>>[] | undefined,
  TSubmit extends SubmitFunction<NoInfer<RawSchemaOutput<TSchema>>>,
>(definition: FormDefinitionInput<TSchema, TFields, TLabels, TValidators> & { submit: TSubmit }): DefinedForm<TSchema, TFields, TLabels, TValidators, TSubmit>
export function defineForm<
  TSchema extends RawSchema<object, object>,
  const TFields extends FormFields<RawSchemaInput<TSchema>>,
  const TLabels extends LabelDictionary | undefined = undefined,
  const TValidators extends readonly FormValidatorEntry<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>>[] | undefined = undefined,
>(definition: FormDefinitionInput<TSchema, TFields, TLabels, TValidators> & { submit?: never }): DefinedForm<TSchema, TFields, TLabels, TValidators, never>
export function defineForm<
  TSchema extends RawSchema<object, object>,
  const TFields extends FormFields<RawSchemaInput<TSchema>>,
  const TLabels extends LabelDictionary | undefined = undefined,
  const TValidators extends readonly FormValidatorEntry<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>>[] | undefined = undefined,
>(definition: FormDefinitionInput<TSchema, TFields, TLabels, TValidators> & { submit?: SubmitFunction<RawSchemaOutput<TSchema>> }): unknown {
  compileForm(definition)

  const result: Record<string, unknown> = {
    schema: definition.schema,
    fields: snapshotMap(definition.fields, snapshotInput),
  }
  if (definition.labels !== undefined) result.labels = { ...definition.labels }
  if (definition.validators !== undefined) result.validators = snapshotValidators(definition.validators)
  if (definition.submit !== undefined) result.submit = definition.submit
  return result
}
