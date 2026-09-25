import type { FormRendererKey, FormRendererNeedsProps, FormRendererPropPatch, FormRendererProps } from '../renderers/formContracts'
import type { Label, LabelDictionary } from './labels'
import type { MaybePromise } from './load'
import type { RawSchema, SchemaIssue, SchemaParseResult } from './schema'
import type { SubmitError } from './results'

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

export type FormInputSlotField<TInput extends object, TKey extends Extract<keyof TInput, string>> = {
  readonly key: TKey
  readonly renderer: string
  readonly label: string
  readonly required: boolean
  readonly props: Readonly<Record<string, unknown>>
  readonly span?: number
}

export interface FormInputSlotProps<TInput extends object, TKey extends Extract<keyof TInput, string>> {
  readonly value: FormDraftSnapshot<TInput>[TKey]
  readonly draft: FormDraftSnapshot<TInput>
  readonly field: FormInputSlotField<TInput, TKey>
  readonly setValue: (value: FormDraft<TInput>[TKey]) => void
  readonly error?: string
  readonly touched: boolean
  readonly disabled: boolean
  readonly validating: boolean
  readonly formValidating: boolean
}

export interface FormActionSlotProps {
  readonly submit: () => Promise<void>
  readonly reset: () => void
  readonly submitting: boolean
  readonly submitPending: boolean
  readonly validating: boolean
  readonly dirty: boolean
  readonly inputPending: boolean
}

export interface FormExposed<TInput extends object, TOutput extends object> extends FormActionSlotProps {
  readonly draft: FormDraftSnapshot<TInput>
  readonly validate: () => Promise<SchemaParseResult<TOutput>>
  readonly refresh: () => Promise<void>
}

export type FormSlots<TInput extends object, TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>> = {
  [TKey in TKeys as `input:${TKey}`]?: (props: FormInputSlotProps<TInput, TKey>) => unknown
} & {
  loading?: () => unknown
  'load-error'?: (props: { readonly error: SubmitError; readonly refresh: () => Promise<void> }) => unknown
  actions?: (props: FormActionSlotProps) => unknown
}

type FormInputBase<TInput extends object, TValue, TRenderer extends FormRendererKey> = {
  readonly label?: Label
  readonly span?: number
  readonly initialValue?: () => TValue | null | undefined
  readonly behavior?: FormBehavior<TInput, TValue, TRenderer>
}

type RendererPropsMember<TRenderer extends FormRendererKey> =
  FormRendererNeedsProps<TRenderer> extends true ? { readonly props: FormRendererProps<TRenderer> } : { readonly props?: FormRendererProps<TRenderer> }

type FormInputForRenderer<TInput extends object, TValue, TRenderer extends FormRendererKey> = FormInputBase<TInput, TValue, TRenderer> & {
  readonly renderer: TRenderer
} & RendererPropsMember<TRenderer>

export type FormInput<TInput extends object = Record<string, unknown>, TValue = unknown, TRenderer extends FormRendererKey = FormRendererKey> = TRenderer extends FormRendererKey
  ? FormInputForRenderer<TInput, TValue, TRenderer>
  : never

export type FormFields<TInput extends object, TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>> = {
  readonly [TKey in TKeys]?: FormInput<TInput, TInput[TKey]>
}

export interface FormBehaviorContext<TInput extends object, TValue> {
  draft: FormDraftSnapshot<TInput>
  value: TValue | null | undefined
  context: Readonly<Record<string, unknown>>
}

export interface FormInputPresentation<TRenderer extends FormRendererKey = FormRendererKey> {
  readonly renderer?: TRenderer | null
  readonly label?: Label | null
  readonly props?: FormRendererPropPatch<TRenderer> | null
  readonly span?: number | null
  readonly required?: boolean | null
}

export interface FormBehavior<TInput extends object = Record<string, unknown>, TValue = unknown, TRenderer extends FormRendererKey = FormRendererKey> {
  readonly visible?: (context: FormBehaviorContext<TInput, TValue>) => boolean
  readonly disabled?: (context: FormBehaviorContext<TInput, TValue>) => boolean
  readonly props?: (context: FormBehaviorContext<TInput, TValue>) => FormRendererPropPatch<TRenderer>
  readonly presentation?: (context: FormBehaviorContext<TInput, TValue>) => FormInputPresentation
  readonly derived?: (context: FormBehaviorContext<TInput, TValue>) => TValue
  readonly resetWhen?: (context: FormBehaviorContext<TInput, TValue>) => unknown
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
  TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>,
> {
  readonly schema: RawSchema<TInput, TOutput>
  readonly fields: FormFields<TInput, TKeys>
  readonly labels?: LabelDictionary
  readonly validators?: readonly FormValidatorEntry<TInput, TOutput>[]
  readonly submit?: (output: TOutput) => MaybePromise<TResult>
}
