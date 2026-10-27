import type { FormRendererKey, FormRendererModelValue, FormRendererNeedsProps, FormRendererProps } from '../renderers/formContracts'
import type { Label, LabelDictionary } from './labels'
import type { MaybePromise } from './load'
import type { RawSchema, SchemaIssue, SchemaParseResult } from './schema'
import type { SubmitError } from './results'
import type { BaseInputControlBindings } from './formControlBindings'
import type { ContextRequirements } from './contextRequirements'

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
  readonly context: TContext
}

export type FormInputSlotField<_TInput extends object, TKey extends string> = {
  readonly key: TKey
  readonly renderer: string
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
  readonly error?: string
  readonly controlBindings: BaseInputControlBindings
  readonly touched: boolean
  readonly disabled: boolean
  readonly validating: boolean
  readonly formValidating: boolean
}

export interface FormActionSlotProps {
  readonly submit: () => Promise<void>
  readonly reset: () => void
  readonly refresh: () => Promise<void>
  readonly submitting: boolean
  readonly submitPending: boolean
  readonly postWriteError: SubmitError | undefined
  readonly validating: boolean
  readonly dirty: boolean
  readonly inputPending: boolean
}

export interface FormExposed<TInput extends object, TOutput extends object> extends FormActionSlotProps {
  readonly draft: FormDraftSnapshot<TInput>
  readonly validate: () => Promise<SchemaParseResult<TOutput>>
}

export type FormSlots<TInput extends object, TKeys extends string = Extract<keyof TInput, string>> = {
  [TKey in TKeys as `input:${TKey}`]?: (props: FormInputSlotProps<TInput, TKey>) => unknown
} & {
  loading?: () => unknown
  'load-error'?: (props: { readonly error: SubmitError; readonly refresh: () => Promise<void> }) => unknown
  actions?: (props: FormActionSlotProps) => unknown
}

type FormInputBase<TInput extends object, TValue, TRenderer extends FormRendererKey, TContext extends object> = {
  readonly label?: Label
  readonly span?: number
  readonly visible?: boolean
  readonly initialValue?: TValue | null | (() => TValue | null | undefined)
  readonly behavior?: FormBehavior<TInput, TValue, TRenderer, TContext>
}

type RendererPropsMember<TRenderer extends FormRendererKey, TContext extends object> =
  FormRendererNeedsProps<TRenderer, TContext> extends true ? { readonly props: FormRendererProps<TRenderer, TContext> } : { readonly props?: FormRendererProps<TRenderer, TContext> }

type FormInputForRenderer<TInput extends object, TValue, TRenderer extends FormRendererKey, TContext extends object> = FormInputBase<TInput, TValue, TRenderer, TContext> & {
  readonly renderer: TRenderer
} & RendererPropsMember<TRenderer, TContext>

export type FormInput<
  TInput extends object = Record<string, unknown>,
  TValue = unknown,
  TRenderer extends FormRendererKey = FormRendererKey,
  TContext extends object = Readonly<Record<string, unknown>>,
> = TRenderer extends FormRendererKey
  ? FormInputForRenderer<TInput, TValue, TRenderer, TContext>
  : never

export type FormFieldResolver<
  TInput extends object,
  TValue,
  TRenderer extends FormRendererKey,
  TContext extends object = {},
> = (context: FormFieldContext<TInput, TContext>) => FormInput<TInput, TValue, TRenderer, TContext>

export type FormFieldEntry<
  TInput extends object,
  TValue,
  TContext extends object = {},
> = FormInput<TInput, TValue, FormRendererKey, TContext> | FormFieldResolver<TInput, TValue, FormRendererKey, TContext>

export interface FormFieldBinding<TInput extends object, TValue, TKey extends Extract<keyof TInput, string> = Extract<keyof TInput, string>> {
  readonly keys: readonly TKey[]
  readonly read: (values: FormDraftSnapshot<Pick<TInput, TKey>>) => TValue | null | undefined
  readonly write: (value: NonNullable<TValue>) => Partial<Pick<TInput, TKey>>
}

export type BoundFormInput<TInput extends object, TRenderer extends FormRendererKey = FormRendererKey, TContext extends object = {}> = TRenderer extends FormRendererKey
  ? FormInput<TInput, FormRendererModelValue<TRenderer>, TRenderer, TContext> & {
      readonly binding: FormFieldBinding<TInput, FormRendererModelValue<TRenderer>>
    }
  : never

export type BoundFormInputResolver<TInput extends object, TContext extends object = {}> = (
  context: FormFieldContext<TInput, TContext>,
) => BoundFormInput<TInput, FormRendererKey, TContext>

export type FormFields<
  TInput extends object,
  TKeys extends string = Extract<keyof TInput, string>,
  TContext extends object = {},
> = keyof TInput extends never ? object : {
  readonly [TKey in TKeys]?: TKey extends keyof TInput
    ? FormInput<TInput, TInput[TKey], FormRendererKey, TContext> | FormFieldResolver<TInput, TInput[TKey], FormRendererKey, TContext>
    : BoundFormInput<TInput, FormRendererKey, TContext> | BoundFormInputResolver<TInput, TContext>
}

export type FormFieldContextValue<TEntry> = TEntry extends (...args: infer TArgs) => unknown
  ? TArgs extends [infer TScope]
    ? TScope extends { readonly draft: unknown; readonly context: infer TValue } ? TValue : never
    : never
  : never

type FormFieldContexts<TFields> = {
  [TKey in keyof TFields]: FormFieldContextValue<Exclude<TFields[TKey], undefined>>
}[keyof TFields]

export type FormFieldsContext<TFields extends object> = ContextRequirements<FormFieldContexts<TFields>>

export interface FormBehaviorContext<
  TInput extends object,
  TValue,
  TContext extends object = Readonly<Record<string, unknown>>,
> {
  readonly draft: FormDraftSnapshot<TInput>
  readonly value: TValue | null | undefined
  readonly context: TContext
}

export interface FormBehavior<
  TInput extends object = Record<string, unknown>,
  TValue = unknown,
  _TRenderer extends FormRendererKey = FormRendererKey,
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
> {
  readonly schema: RawSchema<TInput, TOutput>
  readonly fields: FormFields<TInput, TKeys, TContext>
  readonly labels?: LabelDictionary
  readonly validators?: readonly FormValidatorEntry<TInput, TOutput, TContext>[]
  readonly submit?: (output: TOutput) => MaybePromise<TResult>
}
