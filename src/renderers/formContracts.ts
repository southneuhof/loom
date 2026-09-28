import type { builtInFormRenderers } from './form'
import type { TableInputProps } from '../components/composites/form-inputs/tableInput.types'
import type { TextInputDataAttributes } from '../components/inputs/textInput.types'

export type RichTextFormInput = typeof import('../components/inputs/RichTextInput.vue').default

type PublicFormProps<T> = T extends abstract new (...args: infer _TArgs) => infer TInstance
  ? TInstance extends { $props: infer TProps } ? TProps : never
  : never

export type BuiltInFormRendererComponents = typeof builtInFormRenderers

export interface FormRendererComponents extends BuiltInFormRendererComponents {}

export type FormRendererKey = (keyof typeof builtInFormRenderers | keyof FormRendererComponents) & string

type FormOwnedProp =
  | 'required'
  | 'label'
  | 'modelValue'
  | 'model-value'
  | 'onUpdate:modelValue'
  | 'onUpdate:model-value'
  | 'value'
  | 'setValue'
  | 'draft'
  | 'field'
  | 'error'
  | 'touched'
  | 'validating'
  | 'formValidating'
  | 'onValidation:touch'
  | 'onValidation:error'
  | 'validation:touch'
  | 'validation:error'

export type FormRendererPropBag<TRenderer extends keyof FormRendererComponents> = TRenderer extends 'table'
  ? TableInputProps<object, object>
  : PublicFormProps<FormRendererComponents[TRenderer]>

export type FormRendererProps<TRenderer extends keyof FormRendererComponents> = Omit<
  FormRendererPropBag<TRenderer>,
  FormOwnedProp
> & (TRenderer extends 'text' | 'password' ? TextInputDataAttributes : {})

export type FormRendererPropPatch<TRenderer extends keyof FormRendererComponents> = Partial<
  FormRendererProps<TRenderer>
>

type RequiredKeys<TObject> = TObject extends object
  ? {
      [TKey in keyof TObject]-?: {} extends Pick<TObject, TKey> ? never : TKey
    }[keyof TObject]
  : never

export type FormRendererNeedsProps<TRenderer extends keyof FormRendererComponents> =
  [RequiredKeys<FormRendererProps<TRenderer>>] extends [never] ? false : true

type ModelPropValue<TComponent> = PublicFormProps<TComponent> extends infer TProps
  ? TProps extends { modelValue?: unknown } ? TProps['modelValue'] : never
  : never

type ModelUpdateValue<TComponent> = PublicFormProps<TComponent> extends infer TProps
  ? TProps extends { 'onUpdate:modelValue'?: (...args: infer TArgs) => unknown }
    ? TArgs extends [infer TValue, ...unknown[]] ? TValue : never
    : never
  : never

type MatchingModelValue<TComponent> =
  [Exclude<ModelPropValue<TComponent>, undefined>] extends [Exclude<ModelUpdateValue<TComponent>, undefined>]
    ? [Exclude<ModelUpdateValue<TComponent>, undefined>] extends [Exclude<ModelPropValue<TComponent>, undefined>]
      ? Exclude<ModelPropValue<TComponent>, undefined>
      : never
    : never

export type FormRendererModelValue<TRenderer extends keyof FormRendererComponents> = TRenderer extends 'table'
  ? TableInputProps<object, object>['modelValue']
  : MatchingModelValue<FormRendererComponents[TRenderer]>
