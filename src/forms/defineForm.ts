import type { FormDefinition, FormFields, FormInput, FormValidatorEntry } from '../contracts/forms'
import type { LabelDictionary } from '../contracts/labels'
import type { MaybePromise } from '../contracts/load'
import type { RawSchema, RawSchemaInput, RawSchemaOutput } from '../contracts/schema'
import type { AssetValue } from '../assets/contracts'
import type { TextInputConstraint, TextInputModelValue } from '../components/inputs/textInput.types'
import type { CheckboxGroupInputModelValue, RadioInputModelValue, SelectInputModelValue } from '../components/inputs/selectInput.types'
import type { FormRendererKey, FormRendererModelValue, FormRendererPropBag, FormRendererProps } from '../renderers/formContracts'
import { compileForm } from './compileForm'

type UnsafeKey = '__proto__' | 'prototype' | 'constructor' | `${number}`
type FiniteObjectGuard<TValue extends object> = string extends Extract<keyof TValue, string> ? never : unknown
type FormSchemaGuard<TSchema extends RawSchema<object, object>> = FiniteObjectGuard<RawSchemaInput<TSchema>> & FiniteObjectGuard<RawSchemaOutput<TSchema>>

type RequiredKeys<TObject> = {
  [TKey in keyof TObject]-?: {} extends Pick<TObject, TKey> ? never : TKey
}[keyof TObject]

type IsAny<TValue> = 0 extends 1 & TValue ? true : false

type SelectedRenderer<TInput extends object, TKey extends keyof TInput, TEntry> = TEntry extends { renderer: infer TRenderer } ? TRenderer : never

type SelectedProps<TEntry> = TEntry extends { props: infer TProps } ? TProps : {}

type ExtraProps<TRenderer, TProps> = TRenderer extends FormRendererKey ? (TProps extends object ? Exclude<keyof TProps, keyof FormRendererProps<TRenderer>> : keyof TProps) : keyof TProps

type ExactRendererProps<TRenderer, TProps> = TRenderer extends FormRendererKey
  ? IsAny<FormRendererProps<TRenderer>> extends true
    ? never
    : unknown extends FormRendererProps<TRenderer>
      ? never
      : [ExtraProps<TRenderer, TProps>] extends [never]
        ? [TProps] extends [FormRendererProps<TRenderer>]
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

type TextareaModelValue<TEntry> =
  SelectedProps<TEntry> extends { constraint: infer TConstraint extends readonly ('number' | 'text')[] }
    ? TConstraint extends readonly ['number']
      ? number | undefined
      : number extends TConstraint['length']
        ? string | number | undefined
        : string
    : string

type AssetModelValue<TEntry> = SelectedProps<TEntry> extends { multi: true } ? AssetValue[] | null : AssetValue | null

type RendererControlValue<TRenderer extends FormRendererKey, TEntry> = TRenderer extends 'text'
  ? TextModelValue<TEntry>
  : TRenderer extends 'textarea'
    ? TextareaModelValue<TEntry>
    : TRenderer extends 'select'
      ? SelectInputModelValue<SelectedProps<TEntry>>
      : TRenderer extends 'radio'
        ? RadioInputModelValue<SelectedProps<TEntry>>
        : TRenderer extends 'checkbox-group'
          ? CheckboxGroupInputModelValue<SelectedProps<TEntry>>
          : TRenderer extends 'file' | 'image'
            ? AssetModelValue<TEntry>
            : FormRendererModelValue<TRenderer>

type InvalidRendererChoices<TValue, TRenderer, TEntry> = TRenderer extends FormRendererKey
  ? [Exclude<RendererControlValue<TRenderer, TEntry>, null | undefined>] extends [Exclude<TValue, null | undefined>]
    ? never
    : TRenderer
  : TRenderer

type RendererValueGuard<TValue, TRenderer, TEntry> = [InvalidRendererChoices<TValue, TRenderer, TEntry>] extends [never] ? unknown : never

type InvalidRequiredProp<TProps> = TProps extends unknown ? ('required' extends keyof TProps ? true : never) : never
type InvalidRequiredPropEntry<TEntry> = TEntry extends { props: infer TProps } ? InvalidRequiredProp<TProps> : never
type RequiredPropGuard<TEntry> = [InvalidRequiredPropEntry<TEntry>] extends [never] ? unknown : never

type InvalidRendererProps<TInput extends object, TKey extends keyof TInput, TEntry> = SelectedRenderer<TInput, TKey, TEntry> extends infer TRenderer
  ? TRenderer extends unknown
    ? TRenderer extends FormRendererKey
      ? [ExactRendererProps<TRenderer, SelectedProps<TEntry>>] extends [never]
        ? TRenderer
        : never
      : TRenderer
    : never
  : never

type RendererPropsGuard<TInput extends object, TKey extends keyof TInput, TEntry> = [InvalidRendererProps<TInput, TKey, TEntry>] extends [never] ? unknown : never

type PresentationBranches<TEntry> = TEntry extends { behavior: infer TBehavior } ? (TBehavior extends { presentation: (...args: never[]) => infer TResult } ? TResult : never) : never

type PresentationRenderer<TEntry> = PresentationBranches<TEntry> extends infer TBranch ? (TBranch extends { renderer?: infer TRenderer } ? Exclude<TRenderer, null | undefined> : never) : never

type InvalidPresentationRendererProps<TProps, TRenderer> = Exclude<TRenderer, null | undefined> extends infer TRendererChoice
  ? TRendererChoice extends unknown
    ? TRendererChoice extends FormRendererKey
      ? [ExactRendererProps<TRendererChoice, TProps>] extends [never]
        ? TRendererChoice
        : never
      : TRendererChoice
    : never
  : never

type InvalidPresentationProps<TEntry> = PresentationBranches<TEntry> extends infer TBranch
  ? TBranch extends unknown
    ? TBranch extends { props: infer TProps }
      ? TBranch extends { renderer: infer TRenderer }
        ? InvalidPresentationRendererProps<TProps, TRenderer>
        : never
      : never
    : never
  : never

type PresentationPropsGuard<TEntry> = [InvalidPresentationProps<TEntry>] extends [never] ? unknown : never

type PresentationRendererGuard<TValue, TEntry> = RendererValueGuard<TValue, PresentationRenderer<TEntry>, PresentationBranches<TEntry>>

type InvalidRequiredPropPatch<TEntry> = TEntry extends { behavior: infer TBehavior }
  ? TBehavior extends unknown
    ? TBehavior extends { props: (...args: never[]) => infer TProps }
      ? InvalidRequiredProp<TProps>
      : never
    : never
  : never

type RequiredPropPatchGuard<TEntry> = [InvalidRequiredPropPatch<TEntry>] extends [never] ? unknown : never

type FormInputEntryMemberGuard<TInput extends object, TKey extends keyof TInput, TEntry> = TEntry extends FormInput<TInput, TInput[TKey]>
    ? Exclude<keyof TEntry, keyof FormInput<TInput, TInput[TKey]>> extends never
      ? RequiredPropGuard<TEntry> &
          RequiredPropPatchGuard<TEntry> &
          RendererPropsGuard<TInput, TKey, TEntry> &
          RendererValueGuard<TInput[TKey], SelectedRenderer<TInput, TKey, TEntry>, TEntry> &
          PresentationPropsGuard<TEntry> &
          PresentationRendererGuard<TInput[TKey], TEntry>
      : never
    : never

type EntryGuardAllows<TValue> = [TValue] extends [never] ? false : true
type FormInputEntryMemberResults<TInput extends object, TKey extends keyof TInput, TEntry> = TEntry extends unknown
  ? EntryGuardAllows<FormInputEntryMemberGuard<TInput, TKey, TEntry>>
  : never

type FormInputEntryGuard<TInput extends object, TKey extends keyof TInput, TEntry> = [TEntry] extends [never]
  ? never
  : [FormInputEntryMemberResults<TInput, TKey, TEntry>] extends [true]
    ? unknown
    : never

type FormFieldsGuard<TInput extends object, TFields> = TFields extends object
  ? TFields extends readonly unknown[]
    ? never
    : Extract<keyof TFields, UnsafeKey> extends never
      ? Exclude<keyof TFields, Extract<keyof TInput, string>> extends never
        ? { [TKey in keyof TFields]: TKey extends keyof TInput ? FormInputEntryGuard<NoInfer<TInput>, TKey, TFields[TKey]> : never }
        : never
      : never
  : never

type SubmitFunction<TOutput extends object> = (output: TOutput) => MaybePromise<unknown>
type SubmitInputGuard<TSubmit, TOutput extends object> = TSubmit extends (...args: infer TArguments) => unknown
  ? TArguments extends []
    ? unknown
    : TArguments extends [infer TInput, ...infer TRest]
      ? Required<TRest> extends []
        ? [TOutput] extends [TInput]
          ? unknown
          : never
        : never
      : never
  : never
type SubmitResult<TSubmit> = [TSubmit] extends [never] ? unknown : TSubmit extends (...args: never[]) => infer TResult ? Awaited<TResult> : unknown

type FieldRenderers<TFields extends object> = {
  readonly [TKey in keyof TFields]: Exclude<TFields[TKey], undefined> extends { renderer: infer TRenderer extends FormRendererKey } ? TRenderer : never
}

type CompactFormField<TInput extends object, TKey extends Extract<keyof TInput, string>, TRenderer> = TRenderer extends FormRendererKey
  ? FormInput<TInput, TInput[TKey], TRenderer>
  : never

type CompactFormFields<TInput extends object, TRenderers extends object> = {
  readonly [TKey in keyof TRenderers]: TKey extends Extract<keyof TInput, string> ? CompactFormField<TInput, TKey, TRenderers[TKey]> : never
}

type DefinedForm<TInput extends object, TOutput extends object, TResult, TKeys extends Extract<keyof TInput, string>, TRenderers extends object, THasSubmit extends boolean> = Omit<
  FormDefinition<TInput, TOutput, TResult, TKeys>,
  'fields' | 'submit'
> & {
  readonly schema: RawSchema<TInput, TOutput>
  readonly fields: CompactFormFields<TInput, TRenderers>
} & ([THasSubmit] extends [true] ? { readonly submit: (output: TOutput) => MaybePromise<TResult> } : { readonly submit?: never })

type FormDefinitionInput<
  TSchema extends RawSchema<object, object>,
  TFields extends object,
  TLabels extends LabelDictionary | undefined,
  TValidators extends readonly FormValidatorEntry<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>>[] | undefined,
> = {
  schema: TSchema & FormSchemaGuard<TSchema>
  fields: TFields & FormFields<RawSchemaInput<TSchema>> & NoInfer<FormFieldsGuard<RawSchemaInput<TSchema>, TFields>>
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

function snapshotValidators<TInput extends object, TOutput extends object>(validators: readonly FormValidatorEntry<TInput, TOutput>[]): FormValidatorEntry<TInput, TOutput>[] {
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
  const TFields extends object,
  const TLabels extends LabelDictionary | undefined,
  const TValidators extends readonly FormValidatorEntry<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>>[] | undefined,
  TSubmit extends SubmitFunction<NoInfer<RawSchemaOutput<TSchema>>>,
>(
  definition: FormDefinitionInput<TSchema, TFields, TLabels, TValidators> & { submit: TSubmit & SubmitInputGuard<TSubmit, RawSchemaOutput<TSchema>> }
): DefinedForm<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>, SubmitResult<TSubmit>, Extract<keyof TFields, Extract<keyof RawSchemaInput<TSchema>, string>>, FieldRenderers<TFields>, true>
export function defineForm<
  TSchema extends RawSchema<object, object>,
  const TFields extends object,
  const TLabels extends LabelDictionary | undefined = undefined,
  const TValidators extends readonly FormValidatorEntry<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>>[] | undefined = undefined,
>(
  definition: FormDefinitionInput<TSchema, TFields, TLabels, TValidators> & { submit?: never }
): DefinedForm<RawSchemaInput<TSchema>, RawSchemaOutput<TSchema>, unknown, Extract<keyof TFields, Extract<keyof RawSchemaInput<TSchema>, string>>, FieldRenderers<TFields>, false>
export function defineForm<
  TSchema extends RawSchema<object, object>,
  const TFields extends object,
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
