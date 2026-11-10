import type { FormOutputs, FormPublisher } from '../forms/outputs'
import type { FormRenderer, FormRendererModelValue, FormRendererNeedsProps, FormRendererProps } from '../renderers/formContracts'
import type { Label, LabelDictionary } from './labels'
import type { MaybePromise } from './load'
import type { RawSchema, SchemaIssue, SchemaParseResult } from './schema'
import type { SubmitError } from './results'
import type { BaseInputControlBindings } from './formControlBindings'
import type { CallbackScopeContext, ContextRequirements } from './contextRequirements'

export type FormValidationTrigger = 'blur' | 'submit'

export type FormDraft<TInput extends object> = {
  [TKey in keyof TInput]?: TInput[TKey] | null
}

type SnapshotValue<TValue> = TValue extends Date | Blob
  ? TValue
  : TValue extends (...args: never[]) => unknown
    ? TValue
    : TValue extends readonly (infer TItem)[]
      ? readonly SnapshotValue<TItem>[]
      : TValue extends object
        ? { readonly [TKey in keyof TValue]: SnapshotValue<TValue[TKey]> }
        : TValue

export type FormDraftSnapshot<TInput extends object> = Readonly<{
  [TKey in keyof FormDraft<TInput>]: SnapshotValue<FormDraft<TInput>[TKey]>
}>

export interface FormFieldContext<TInput extends object, TContext extends object = {}> {
  readonly draft: FormDraftSnapshot<TInput>
  readonly outputs: FormOutputs
  readonly publish: FormPublisher
  readonly context: TContext
}

export type FormInputSlotField<_TInput extends object, TKey extends string> = {
  readonly key: TKey
  readonly renderer: FormRenderer
  readonly label: string
  readonly required: boolean
  readonly props: Readonly<Record<string, unknown>>
  readonly span?: number
}

export interface FormInputSlotProps<TInput extends object, TKey extends string> {
  readonly value: TKey extends keyof TInput ? FormDraftSnapshot<TInput>[TKey] : unknown
  readonly draft: FormDraftSnapshot<TInput>
  readonly field: FormInputSlotField<TInput, TKey>
  readonly setValue: (value: TKey extends keyof TInput ? FormDraft<TInput>[TKey] : unknown) => void
  readonly setError: (message: string | undefined) => void
  readonly error?: string
  readonly controlBindings: BaseInputControlBindings
  readonly touched: boolean
  readonly disabled: boolean
  readonly validating: boolean
  readonly formValidating: boolean
}

export interface FormSubmitContext<TContext extends object = Readonly<Record<string, unknown>>> {
  readonly outputs: FormOutputs
  readonly context: TContext
}

export interface FormSubmitOptions<TInput extends object, TOutput extends object = TInput, TResult = unknown, TContext extends object = Readonly<Record<string, unknown>>> {
  readonly values?: Partial<TInput>
  readonly run?: (output: TOutput, scope: FormSubmitContext<TContext>) => MaybePromise<TResult>
  readonly confirm?: { readonly title: string; readonly message: string }
}

export interface FormActionSlotProps<TInput extends object = Record<string, unknown>, TOutput extends object = TInput, TResult = unknown, TContext extends object = Readonly<Record<string, unknown>>> {
  readonly submit: (options?: FormSubmitOptions<TInput, TOutput, TResult, TContext>) => Promise<void>
  readonly reset: () => void
  readonly refresh: () => Promise<void>
  readonly submitting: boolean
  readonly submitPending: boolean
  readonly postWriteError: SubmitError | undefined
  readonly validating: boolean
  readonly dirty: boolean
  readonly inputPending: boolean
}

export interface FormExposed<TInput extends object, TOutput extends object, TResult = unknown, TContext extends object = Readonly<Record<string, unknown>>> extends FormActionSlotProps<TInput, TOutput, TResult, TContext> {
  readonly submittedValues?: Readonly<TOutput>
  readonly draft: FormDraftSnapshot<TInput>
  readonly validate: () => Promise<SchemaParseResult<TOutput>>
}

export type FormSlots<TInput extends object, TKeys extends string = Extract<keyof TInput, string>, TOutput extends object = TInput, TResult = unknown, TContext extends object = Readonly<Record<string, unknown>>> = {
  [TKey in TKeys as `input:${TKey}`]?: (props: FormInputSlotProps<TInput, TKey>) => unknown
} & {
  loading?: () => unknown
  'load-error'?: (props: { readonly error: SubmitError; readonly refresh: () => Promise<void> }) => unknown
  actions?: (props: FormActionSlotProps<TInput, TOutput, TResult, TContext>) => unknown
}

type FormInputBase<TInput extends object, TValue, TRenderer extends FormRenderer, TContext extends object> = {
  readonly label?: Label
  readonly span?: number
  readonly visible?: boolean
  readonly initialValue?: TValue | null | (() => TValue | null | undefined)
  readonly behavior?: FormBehavior<TInput, TValue, TRenderer, TContext>
}

type RendererPropsMember<TRenderer extends FormRenderer, TContext extends object> =
  FormRendererNeedsProps<TRenderer, TContext> extends true ? { readonly props: FormRendererProps<TRenderer, TContext> } : { readonly props?: FormRendererProps<TRenderer, TContext> }

type FormInputForRenderer<TInput extends object, TValue, TRenderer extends FormRenderer, TContext extends object> = FormInputBase<TInput, TValue, TRenderer, TContext> & {
  readonly renderer: TRenderer
} & RendererPropsMember<TRenderer, TContext>

export type FormInput<
  TInput extends object = Record<string, unknown>,
  TValue = unknown,
  TRenderer extends FormRenderer = FormRenderer,
  TContext extends object = Readonly<Record<string, unknown>>,
> = TRenderer extends FormRenderer ? FormInputForRenderer<TInput, TValue, TRenderer, TContext> : never

export type FormFieldResolver<TInput extends object, TValue, TRenderer extends FormRenderer, TContext extends object = {}> = (
  context: FormFieldContext<TInput, TContext>
) => FormInput<TInput, TValue, TRenderer, TContext>

export type FormFieldEntry<TInput extends object, TValue, TContext extends object = {}> = FormInput<TInput, TValue, FormRenderer, TContext> | FormFieldResolver<TInput, TValue, FormRenderer, TContext>

export interface FormFieldBinding<TInput extends object, TValue, TKey extends Extract<keyof TInput, string> = Extract<keyof TInput, string>> {
  readonly keys: readonly TKey[]
  readonly read: (values: FormDraftSnapshot<Pick<TInput, TKey>>) => TValue | null | undefined
  readonly write: (value: NonNullable<TValue>) => Partial<Pick<TInput, TKey>>
}

export type BoundFormInput<TInput extends object, TRenderer extends FormRenderer = FormRenderer, TContext extends object = {}> = TRenderer extends FormRenderer
  ? FormInput<TInput, FormRendererModelValue<TRenderer>, TRenderer, TContext> & {
      readonly binding: FormFieldBinding<TInput, FormRendererModelValue<TRenderer>>
    }
  : never

export type BoundFormInputResolver<TInput extends object, TContext extends object = {}, TRenderer extends FormRenderer = FormRenderer> = (
  context: FormFieldContext<TInput, TContext>
) => BoundFormInput<TInput, TRenderer, TContext>

type FieldRenderer<TEntry> = TEntry extends (...args: never[]) => infer TConfig ? FieldRenderer<TConfig> : TEntry extends { renderer: infer TRenderer extends FormRenderer } ? TRenderer : FormRenderer

type RendererForField<TFields extends object, TKey> = TKey extends keyof TFields ? FieldRenderer<TFields[TKey]> : FormRenderer

export type FormFields<TInput extends object, TKeys extends string = Extract<keyof TInput, string>, TContext extends object = {}, TFields extends object = {}> = keyof TInput extends never
  ? object
  : {
      readonly [TKey in TKeys]?: TKey extends keyof TInput
        ? FormInput<TInput, TInput[TKey], RendererForField<TFields, TKey>, TContext> | FormFieldResolver<TInput, TInput[TKey], RendererForField<TFields, TKey>, TContext>
        : BoundFormInput<TInput, RendererForField<TFields, TKey>, TContext> | BoundFormInputResolver<TInput, TContext, RendererForField<TFields, TKey>>
    }

export type FormFieldContextValue<TEntry> = CallbackScopeContext<TEntry>

export type FormFieldsContext<TFields extends object> = ContextRequirements<
  {
    [TKey in keyof TFields]: FormFieldContextValue<Exclude<TFields[TKey], undefined>>
  }[keyof TFields]
>

export interface FormBehaviorContext<TInput extends object, TValue, TContext extends object = Readonly<Record<string, unknown>>> {
  readonly draft: FormDraftSnapshot<TInput>
  readonly value: TValue | null | undefined
  readonly context: TContext
}

export interface FormBehavior<
  TInput extends object = Record<string, unknown>,
  TValue = unknown,
  _TRenderer extends FormRenderer = FormRenderer,
  TContext extends object = Readonly<Record<string, unknown>>,
> {
  readonly derived?: (context: FormBehaviorContext<TInput, TValue, TContext>) => TValue
}

export interface FormDefinitionValidatorContext<TInput extends object, TOutput extends object, TContext extends object = Readonly<Record<string, unknown>>> {
  data: TOutput
  draft: FormDraftSnapshot<TInput>
  initial: FormDraftSnapshot<TInput>
  context: TContext
  field?: string
  signal: AbortSignal
}

export type FormDefinitionValidatorResult = void | SchemaIssue | readonly SchemaIssue[]

export interface FormValidatorDescriptor<TInput extends object, TOutput extends object, TContext extends object = Readonly<Record<string, unknown>>> {
  readonly validate: (context: FormDefinitionValidatorContext<TInput, TOutput, TContext>) => MaybePromise<FormDefinitionValidatorResult>
  readonly triggers?: readonly FormValidationTrigger[]
  readonly path?: readonly (string | number)[]
}

export type FormValidatorEntry<TInput extends object, TOutput extends object, TContext extends object = Readonly<Record<string, unknown>>> = FormValidatorDescriptor<TInput, TOutput, TContext>

export interface FormDefinition<
  TInput extends object = Record<string, unknown>,
  TOutput extends object = Record<string, unknown>,
  TResult = unknown,
  TKeys extends string = Extract<keyof TInput, string>,
  TContext extends object = Readonly<Record<string, unknown>>,
  TFields extends object = {},
> {
  readonly schema: RawSchema<TInput, TOutput>
  readonly fields: TFields & FormFields<TInput, TKeys, TContext, TFields>
  readonly labels?: LabelDictionary
  readonly validators?: readonly FormValidatorEntry<TInput, TOutput, TContext>[]
  readonly submit?: (output: TOutput, scope: FormSubmitContext<TContext>) => MaybePromise<TResult>
}
