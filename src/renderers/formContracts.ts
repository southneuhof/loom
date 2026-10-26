import type { Component } from 'vue'
import type { TableInputProps } from '../components/composites/form-inputs/tableInput.types'
import type { TextInputDataAttributes } from '../components/inputs/textInput.types'
import type { DrawingCanvasProps, FileInputMode, FileInputModelValue, FileInputProps, ImageInputProps } from '../components/inputs/fileInput.types'

export type RichTextFormInput = typeof import('../components/inputs/RichTextInput.vue').default

type PublicFormProps<T> = T extends abstract new (...args: infer _TArgs) => infer TInstance
  ? TInstance extends { $props: infer TProps } ? TProps : never
  : never

export interface BuiltInFormRendererComponents {
  text: typeof import('../components/inputs/TextInput.vue').default
  textarea: typeof import('../components/inputs/TextareaInput.vue').default
  password: typeof import('../components/inputs/PasswordInput.vue').default
  number: typeof import('../components/inputs/NumberInput.vue').default
  select: typeof import('../components/inputs/SelectInput.vue').default
  radio: typeof import('../components/inputs/RadioGroupInput.vue').default
  date: typeof import('../components/inputs/DateInput.vue').default
  daterange: typeof import('../components/inputs/DateRangeInput.vue').default
  month: typeof import('../components/inputs/MonthInput.vue').default
  year: typeof import('../components/inputs/YearInput.vue').default
  time: typeof import('../components/inputs/TimeInput.vue').default
  checkbox: typeof import('../components/inputs/CheckboxInput.vue').default
  'checkbox-group': typeof import('../components/inputs/CheckboxGroupInput.vue').default
  switch: typeof import('../components/inputs/Switch.vue').default
  file: typeof import('../components/inputs/FileInput.vue').default
  image: typeof import('../components/inputs/ImageInput.vue').default
  tag: typeof import('../components/inputs/TagInput.vue').default
  color: typeof import('../components/inputs/ColorInput.vue').default
  lookup: typeof import('../components/composites/form-inputs/LookupInput.vue').default
  location: typeof import('../components/composites/form-inputs/LocationInput.vue').default
  'multi-location': typeof import('../components/composites/form-inputs/MultiLocationInput.vue').default
  'rich-text': typeof import('../components/inputs/RichTextInput.vue').default
  'icon-select': typeof import('../components/inputs/IconSelectInput.vue').default
  table: Component
  separator: typeof import('../components/composites/form-inputs/FormSeparator.vue').default
  canvas: typeof import('../components/inputs/DrawingCanvas.vue').default
}

export interface FormRendererComponents extends BuiltInFormRendererComponents {}

export type FormRendererKey = keyof FormRendererComponents & string

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
  : TRenderer extends 'file'
    ? FileInputProps<FileInputMode, boolean>
    : TRenderer extends 'image'
      ? ImageInputProps<FileInputMode, boolean>
      : TRenderer extends 'canvas'
        ? DrawingCanvasProps<FileInputMode>
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
  : TRenderer extends 'file' | 'image'
    ? FileInputModelValue<FileInputMode, boolean>
    : TRenderer extends 'canvas'
      ? FileInputModelValue<FileInputMode, false>
      : MatchingModelValue<FormRendererComponents[TRenderer]>
