import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'vue'
import type { FormRendererKey } from '../renderers/formContracts'
import type { FormRendererPropBag } from '../renderers/formContracts'
import type { Label, LabelDictionary } from './labels'
import type { MaybePromise } from './load'
import type { RawSchema, SchemaIssue } from './schema'

export type FormValidationTrigger = 'blur' | 'submit'

type FormOwnedProp =
  | 'required'
  | 'value'
  | 'modelValue'
  | 'model-value'
  | 'onUpdate:modelValue'
  | 'onUpdate:model-value'
  | 'setValue'
  | 'draft'
  | 'field'
  | 'touched'
  | 'validating'
  | 'formValidating'
  | 'onValidation:touch'
  | 'validation:touch'

type NativeInputProps<TRenderer extends FormRendererKey> = TRenderer extends 'text'
  ? InputHTMLAttributes
  : TRenderer extends 'textarea' ? TextareaHTMLAttributes : Record<never, never>

type AuthoredNativeInputProps<TRenderer extends FormRendererKey> = Omit<
  NativeInputProps<TRenderer>,
  FormOwnedProp | Extract<keyof NativeInputProps<TRenderer>, `on${string}`>
>

type InputRendererProps<TRenderer extends FormRendererKey> = Partial<
  Omit<FormRendererPropBag<TRenderer>, FormOwnedProp>
> & AuthoredNativeInputProps<TRenderer>

export interface FormBehaviorContext<TInput extends object, TValue> {
  draft: Partial<TInput>
  value: TValue | undefined
  context: Readonly<Record<string, unknown>>
}

export interface FormInputPresentation<TRenderer extends FormRendererKey = FormRendererKey> {
  readonly renderer?: TRenderer | null
  readonly label?: Label | null
  readonly props?: InputRendererProps<TRenderer> | null
  readonly span?: number | null
  readonly required?: boolean | null
}

export interface FormBehavior<
  TInput extends object = Record<string, unknown>,
  TValue = unknown,
  TRenderer extends FormRendererKey = FormRendererKey,
> {
  readonly visible?: (context: FormBehaviorContext<TInput, TValue>) => boolean
  readonly disabled?: (context: FormBehaviorContext<TInput, TValue>) => boolean
  readonly props?: (context: FormBehaviorContext<TInput, TValue>) => InputRendererProps<TRenderer>
  readonly presentation?: (context: FormBehaviorContext<TInput, TValue>) => FormInputPresentation<TRenderer>
  readonly derived?: (context: FormBehaviorContext<TInput, TValue>) => TValue
  readonly resetWhen?: (context: FormBehaviorContext<TInput, TValue>) => unknown
}

export interface FormInput<
  TInput extends object = Record<string, unknown>,
  TValue = unknown,
  TRenderer extends FormRendererKey = FormRendererKey,
> {
  readonly label?: Label
  readonly renderer?: TRenderer
  readonly props?: InputRendererProps<TRenderer>
  readonly source?: object
  readonly span?: number
  readonly initialValue?: () => TValue
  readonly behavior?: FormBehavior<TInput, TValue, TRenderer>
}

export type FormFields<TInput extends object> = {
  readonly [TKey in Extract<keyof TInput, string>]?: FormInput<TInput, TInput[TKey]>
}

export interface FormDefinitionValidatorContext<
  TInput extends object,
  TOutput extends object,
  TContext extends object = Readonly<Record<string, unknown>>,
> {
  data: TOutput
  draft: Readonly<Partial<TInput>>
  initial: Readonly<Partial<TInput>>
  context: TContext
  field?: string
  signal: AbortSignal
}

export type FormDefinitionValidatorResult = void | SchemaIssue | readonly SchemaIssue[]

export interface FormValidatorDescriptor<
  TInput extends object,
  TOutput extends object,
  TContext extends object = Readonly<Record<string, unknown>>,
> {
  readonly validate: (context: FormDefinitionValidatorContext<TInput, TOutput, TContext>) => MaybePromise<FormDefinitionValidatorResult>
  readonly triggers?: readonly FormValidationTrigger[]
  readonly path?: readonly (string | number)[]
}

export type FormValidatorEntry<
  TInput extends object,
  TOutput extends object,
  TContext extends object = Readonly<Record<string, unknown>>,
> = FormValidatorDescriptor<TInput, TOutput, TContext>

export interface FormDefinition<
  TInput extends object = Record<string, unknown>,
  TOutput extends object = Record<string, unknown>,
  TResult = unknown,
> {
  readonly schema: RawSchema<TInput, TOutput>
  readonly fields: FormFields<TInput>
  readonly labels?: LabelDictionary
  readonly validators?: readonly FormValidatorEntry<TInput, TOutput>[]
  readonly submit?: (output: TOutput) => MaybePromise<TResult>
}
